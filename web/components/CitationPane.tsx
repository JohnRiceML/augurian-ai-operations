"use client";

// Slide-in right pane that shows the source for a clicked citation.
//
// On desktop: 40% width (clamped 360–560px), absolutely-positioned right
// rail. The chat column does NOT shift — the pane overlays the right edge
// while the chat keeps its layout. On mobile (< 768px): a full-width
// overlay with a backdrop blur.
//
// The pane caches fetched sources by citation key so the same citation
// being re-opened doesn't re-fetch.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Citation } from "@/lib/citations";
import { citationKey } from "@/lib/citations";

interface SourceResponse {
  client: string;
  meeting_slug: string;
  anchor: string;
  extraction: ExtractionDoc | null;
  transcript_text: string;
  transcript_source?: string;
  anchor_offset: number | null;
  anchor_line: string | null;
  spelling_corrections_applied?: Array<{
    as_transcribed?: string;
    corrected?: string;
    count?: number;
  }>;
  drive_error?: string;
  error?: string;
}

interface ExtractionItem {
  id?: string;
  type?: string;
  captured_date?: string;
  due_date?: string | null;
  owner?: string;
  owner_role?: string;
  deliverable_text?: string;
  verbatim?: string;
  transcript_anchor?: string;
  priority?: number;
  status?: string;
  tags?: string[];
  confidence?: string;
}

interface ExtractionDoc {
  client?: string;
  captured_date?: string;
  source_path?: string;
  call_attendees?: string[];
  items?: ExtractionItem[];
}

interface CitationPaneProps {
  citation: Citation | null;
  onClose: () => void;
}

const cache = new Map<string, SourceResponse>();

export function CitationPane({ citation, onClose }: CitationPaneProps) {
  const [data, setData] = useState<SourceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const open = citation !== null;
  const anchorLineRef = useRef<HTMLSpanElement | null>(null);

  // Fetch on citation change, with in-memory cache.
  useEffect(() => {
    if (!citation) return;
    const key = citationKey(citation);
    setShowFull(false);

    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const url = `/api/source?client=${encodeURIComponent(citation.client)}&meeting_slug=${encodeURIComponent(
      citation.meetingSlug,
    )}&anchor=${encodeURIComponent(citation.anchor)}`;

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as SourceResponse;
        if (cancelled) return;
        if (!res.ok || body.error) {
          setError(body.error || `request failed: ${res.status}`);
          setLoading(false);
          return;
        }
        cache.set(key, body);
        setData(body);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError((e as Error).message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [citation]);

  // Auto-scroll the highlighted line into view once content renders.
  useEffect(() => {
    if (!data || data.anchor_offset == null) return;
    // Defer to next paint so the DOM has the highlight in place.
    const id = requestAnimationFrame(() => {
      anchorLineRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [data, showFull]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Pick the matching extraction item (closest by anchor). Verbatim/anchor
  // match wins; otherwise we fall back to the first item that mentions the
  // same anchor string, then null.
  const matchedItem: ExtractionItem | null = useMemo(() => {
    if (!data?.extraction || !citation) return null;
    const items = data.extraction.items ?? [];
    if (items.length === 0) return null;
    const target = citation.anchor.replace(/^0+/, "");
    const exact = items.find(
      (it) => (it.transcript_anchor ?? "").endsWith(target),
    );
    return exact ?? null;
  }, [data, citation]);

  // Derived transcript window — show ~10 lines before and ~20 after the
  // matched line. Toggleable to "full".
  const transcriptView = useMemo(() => {
    if (!data) return null;
    const text = data.transcript_text;
    if (showFull || data.anchor_offset == null) {
      return { before: "", line: null as string | null, after: text };
    }
    const lines = text.split(/\r?\n/);
    let runningIdx = 0;
    let lineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1; // +1 for newline
      if (
        runningIdx <= data.anchor_offset &&
        data.anchor_offset < runningIdx + lineLen
      ) {
        lineIdx = i;
        break;
      }
      runningIdx += lineLen;
    }
    if (lineIdx === -1) {
      return { before: "", line: null, after: text };
    }
    const start = Math.max(0, lineIdx - 10);
    const end = Math.min(lines.length, lineIdx + 21);
    const before = lines.slice(start, lineIdx).join("\n");
    const lineText = lines[lineIdx];
    const after = lines.slice(lineIdx + 1, end).join("\n");
    return { before, line: lineText, after };
  }, [data, showFull]);

  return (
    <>
      {/* Mobile backdrop. Hidden on md+ — desktop pane just overlays with
       * shadow, no dimming. */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        aria-hidden={!open}
        aria-label="Source citation"
        role="complementary"
        className={`fixed top-0 right-0 z-50 h-dvh
          w-full md:w-[40vw] md:min-w-[360px] md:max-w-[560px]
          bg-[color:var(--bg)] border-l border-[color:var(--border)]
          shadow-[0_0_24px_rgba(0,0,0,0.08)]
          transform transition-transform duration-[250ms] ease-out
          ${open ? "translate-x-0" : "translate-x-full"}
          flex flex-col`}
        style={{ willChange: "transform" }}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[color:var(--border)]">
          <div className="min-w-0">
            <div className="text-[11.5px] uppercase tracking-wider text-muted">
              Source
            </div>
            <h2 className="text-[16px] font-semibold text-ink truncate">
              {citation?.meetingSlug ?? ""}
            </h2>
            <div className="text-[12.5px] text-muted mt-0.5 flex flex-wrap items-center gap-x-2">
              {data?.extraction?.captured_date && (
                <span>{data.extraction.captured_date}</span>
              )}
              {data?.extraction?.captured_date && citation?.anchor && (
                <span aria-hidden="true">·</span>
              )}
              {citation?.anchor && (
                <span className="font-mono text-[12px] text-augur-orange">
                  @ {citation.anchor}
                </span>
              )}
              {citation?.client && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{citation.client}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close source pane"
            className="shrink-0 -mr-1 rounded-full p-1.5 text-muted hover:text-ink hover:bg-[color:var(--surface)] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-5 py-6 text-[13.5px] text-muted">
              Loading source…
            </div>
          )}

          {error && (
            <div className="px-5 py-6">
              <div className="rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[13px] text-rose-600">
                {error}
              </div>
            </div>
          )}

          {data && !error && (
            <div className="px-5 py-4 space-y-5">
              {matchedItem && (
                <section>
                  <h3 className="text-[12.5px] font-semibold uppercase tracking-wider text-muted mb-2">
                    Extracted item
                  </h3>
                  <div className="rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      {matchedItem.type && (
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[color:var(--border)] font-medium text-ink">
                          {matchedItem.type}
                        </span>
                      )}
                      {matchedItem.priority != null && (
                        <span className="text-muted">
                          P{matchedItem.priority}
                        </span>
                      )}
                      {matchedItem.status && (
                        <span className="text-muted">{matchedItem.status}</span>
                      )}
                      {matchedItem.confidence && (
                        <span className="text-muted">
                          conf: {matchedItem.confidence}
                        </span>
                      )}
                    </div>
                    {matchedItem.deliverable_text && (
                      <div className="text-[14px] text-ink leading-relaxed">
                        {matchedItem.deliverable_text}
                      </div>
                    )}
                    {matchedItem.verbatim && (
                      <blockquote className="border-l-2 border-augur-orange pl-3 text-[13.5px] text-ink/80 italic">
                        “{matchedItem.verbatim}”
                      </blockquote>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-muted">
                      {matchedItem.owner && (
                        <div>
                          <span className="text-muted">owner:</span>{" "}
                          <span className="text-ink">{matchedItem.owner}</span>
                        </div>
                      )}
                      {matchedItem.due_date && (
                        <div>
                          <span className="text-muted">due:</span>{" "}
                          <span className="text-ink">
                            {matchedItem.due_date}
                          </span>
                        </div>
                      )}
                      {matchedItem.transcript_anchor && (
                        <div>
                          <span className="text-muted">anchor:</span>{" "}
                          <span className="font-mono text-ink">
                            {matchedItem.transcript_anchor}
                          </span>
                        </div>
                      )}
                    </div>
                    {matchedItem.tags && matchedItem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {matchedItem.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[11.5px] px-1.5 py-0.5 rounded bg-white border border-[color:var(--border)] text-muted"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                    Transcript context
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowFull((v) => !v)}
                    className="text-[12px] text-augur-orange hover:underline"
                  >
                    {showFull ? "Show context only" : "View full transcript"}
                  </button>
                </div>

                {data.anchor_offset == null && (
                  <div className="text-[12.5px] text-muted mb-2">
                    Could not locate anchor {citation?.anchor} in this transcript;
                    showing full text.
                  </div>
                )}

                <div className="rounded-card border border-[color:var(--border)] bg-white">
                  <pre className="font-mono text-[12.5px] leading-relaxed text-ink whitespace-pre-wrap break-words p-4 m-0">
                    {transcriptView?.before && (
                      <span className="block text-ink/70">
                        {transcriptView.before}
                        {"\n"}
                      </span>
                    )}
                    {transcriptView?.line != null && (
                      <span
                        ref={anchorLineRef}
                        className="block -mx-4 px-4 py-1 border-l-2 border-augur-orange bg-[#fff5f5] text-ink"
                      >
                        {transcriptView.line}
                      </span>
                    )}
                    {transcriptView?.after && (
                      <span className="block text-ink/70">
                        {"\n"}
                        {transcriptView.after}
                      </span>
                    )}
                  </pre>
                </div>

                {data.spelling_corrections_applied &&
                  data.spelling_corrections_applied.length > 0 && (
                    <div className="mt-2 text-[11.5px] text-muted">
                      Spelling corrections applied:{" "}
                      {data.spelling_corrections_applied
                        .map(
                          (c) =>
                            `${c.as_transcribed}→${c.corrected}${
                              c.count ? ` (${c.count})` : ""
                            }`,
                        )
                        .join(", ")}
                    </div>
                  )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
