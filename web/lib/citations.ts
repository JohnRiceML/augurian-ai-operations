// Citation parsing for assistant responses.
//
// The agent often cites work products by referencing their source path
// plus a transcript anchor — e.g. `processed/commitments/sandbox/2026-04-30-test-this.json @ 02:22`.
// We scan messages for those references so the UI can render them as
// clickable pills that open the source pane.
//
// Design constraint: be permissive enough to catch real references the
// model writes naturally, but not so loose that we false-positive on
// arbitrary `MM:SS` strings (durations, time-of-day, etc.). The rule of
// thumb here is "an anchor must sit near a path-like substring."

export interface Citation {
  /** The original substring matched in the source text. */
  rawText: string;
  client: string;
  meetingSlug: string;
  /** Normalized to MM:SS or H:MM:SS as written. */
  anchor: string;
  /** "processed/commitments/<client>/<slug>.json" — what the model wrote. */
  sourcePath: string;
}

// "processed/commitments/<client>/<slug>.json" — the canonical full path.
// We keep this strict: `<client>` is a single path segment, `<slug>` is a
// single segment, and the file is `.json`. Relative paths (no leading slash)
// match agent-written prose.
const FULL_PATH_RE =
  /processed\/commitments\/([A-Za-z0-9_-]+)\/([A-Za-z0-9._-]+)\.json/g;

// MM:SS or H:MM:SS — anchored to word boundaries so we don't grab the tail
// of a longer numeric run like "10:02:22:55".
const ANCHOR_INNER = /\d{1,2}:\d{2}(?::\d{2})?/;

// "...source.json @ 02:22" — the anchor lives within ~24 chars of the path.
// We match the whole expression in one go so we know they belong together.
const PATH_AT_ANCHOR_RE = new RegExp(
  String(FULL_PATH_RE.source) +
    String.raw`(?:\s*@\s*|\s*\(|\s+at\s+)?(` +
    ANCHOR_INNER.source +
    String.raw`)`,
  "g",
);

// `transcript_anchor: "02:22"` — agent quoting JSON. We require the field
// name to anchor it.
const TRANSCRIPT_ANCHOR_RE = new RegExp(
  String.raw`transcript_anchor["']?\s*[:=]\s*["']?(` +
    ANCHOR_INNER.source +
    String.raw`)["']?`,
  "g",
);

// `<slug> @ MM:SS` — slug-only references; require an explicit `@` so
// random "<word> 02:22" sentences don't match.
const SLUG_AT_ANCHOR_RE = new RegExp(
  String.raw`(\b[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9_-]+)\s*@\s*(` +
    ANCHOR_INNER.source +
    String.raw`)`,
  "g",
);

export function clientFromSourcePath(p: string): string {
  // "processed/commitments/sandbox/2026-04-30-test-this.json" -> "sandbox"
  const m = p.match(/processed\/commitments\/([^/]+)\//);
  return m ? m[1] : "";
}

export function slugFromSourcePath(p: string): string {
  // "processed/commitments/sandbox/2026-04-30-test-this.json" -> "2026-04-30-test-this"
  const m = p.match(/processed\/commitments\/[^/]+\/([^/]+)\.json/);
  return m ? m[1] : "";
}

interface SlugContext {
  /** Map slug -> {client, sourcePath} learned from earlier in the doc. */
  knownSlugs: Map<string, { client: string; sourcePath: string }>;
}

/**
 * Find every citation in `content`. Returns them in order of appearance,
 * with non-overlapping match ranges. Citations earlier in the text register
 * their slug + client so later short-form references (slug-only or just a
 * dangling `(02:22)` after the meeting name) can resolve to the same source.
 */
export function findCitations(content: string): Citation[] {
  if (!content) return [];

  const out: Citation[] = [];
  const taken: Array<[number, number]> = [];
  const ctx: SlugContext = { knownSlugs: new Map() };

  const overlaps = (start: number, end: number): boolean =>
    taken.some(([a, b]) => start < b && end > a);

  // 1) full path + anchor
  for (const m of content.matchAll(PATH_AT_ANCHOR_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const client = m[1];
    const slug = m[2];
    const anchor = m[3];
    const sourcePath = `processed/commitments/${client}/${slug}.json`;
    ctx.knownSlugs.set(slug, { client, sourcePath });
    out.push({
      rawText: m[0],
      client,
      meetingSlug: slug,
      anchor,
      sourcePath,
    });
    taken.push([start, end]);
  }

  // 2) `<slug> @ MM:SS` — only resolves if we've seen the slug already, OR
  // the slug looks date-prefixed (which our pattern enforces).
  for (const m of content.matchAll(SLUG_AT_ANCHOR_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const slug = m[1];
    const anchor = m[2];
    const known = ctx.knownSlugs.get(slug);
    // If we don't know the client yet, skip — without a client we can't
    // build a working source URL. This intentionally errs on the side of
    // missing real citations rather than false-positives.
    if (!known) continue;
    out.push({
      rawText: m[0],
      client: known.client,
      meetingSlug: slug,
      anchor,
      sourcePath: known.sourcePath,
    });
    taken.push([start, end]);
  }

  // 3) `transcript_anchor: "02:22"` — bind to the most recent known slug
  // (the one whose match.index is closest before this anchor). Skip if no
  // prior slug is in scope.
  for (const m of content.matchAll(TRANSCRIPT_ANCHOR_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const anchor = m[1];
    // Find the most recent known slug whose first occurrence is before this
    // match. We approximate "in scope" as "appeared earlier in the doc".
    let best: { client: string; sourcePath: string; slug: string } | null = null;
    let bestPos = -1;
    for (const [slug, info] of ctx.knownSlugs.entries()) {
      const pos = content.indexOf(slug);
      if (pos !== -1 && pos < start && pos > bestPos) {
        bestPos = pos;
        best = { ...info, slug };
      }
    }
    if (!best) continue;
    out.push({
      rawText: m[0],
      client: best.client,
      meetingSlug: best.slug,
      anchor,
      sourcePath: best.sourcePath,
    });
    taken.push([start, end]);
  }

  // Sort by appearance order so the rendering layer can replace them in a
  // single forward pass.
  out.sort((a, b) => content.indexOf(a.rawText) - content.indexOf(b.rawText));
  return out;
}

/**
 * A short stable key for a citation — used by the pane to cache fetched
 * sources across re-renders. Two citations with the same key resolve to
 * the same upstream document + offset.
 */
export function citationKey(c: Citation): string {
  return `${c.client}::${c.meetingSlug}::${c.anchor}`;
}
