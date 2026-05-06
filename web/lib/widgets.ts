// Agent-emitted visual widgets parsed out of markdown content.
//
// The agent may include fenced ```widget JSON blocks in its reply. The UI
// pulls them out before markdown rendering, replaces each block with a
// `[[WIDGET:N]]` sentinel, and re-injects a styled card at sentinel
// positions during render.
//
// Distinct from `lib/visualization.ts`, which inspects raw tool output and
// auto-renders a chart for the tool card. Widgets are the AGENT'S
// deliberate visual choices — its synthesized headline numbers, KPI
// snapshots, and comparisons — not a re-render of one tool's output.

export type Widget =
  | StatWidget
  | KPIGridWidget
  | ComparisonWidget
  | BarWidget
  | LineWidget
  | TableWidget;

export interface StatWidget {
  type: "stat";
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  caption?: string;
}

export interface KPIGridWidget {
  type: "kpi_grid";
  title?: string;
  items: Array<{
    label: string;
    value: string | number;
    delta?: string;
    deltaPositive?: boolean;
  }>;
}

export interface ComparisonWidget {
  type: "comparison";
  title?: string;
  left: { label: string; value: string | number };
  right: { label: string; value: string | number };
  delta?: string;
  deltaPositive?: boolean;
}

export interface BarWidget {
  type: "bar";
  title?: string;
  bars: Array<{ label: string; value: number }>;
  format?: "number" | "currency" | "percent";
}

export interface LineWidget {
  type: "line";
  title?: string;
  yLabel?: string;
  points: Array<{ x: string; y: number }>;
}

export interface TableWidget {
  type: "table";
  title?: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Record<string, unknown>[];
}

export interface ParsedWidgets {
  widgets: { widget: Widget; raw: string }[];
  /** The original content with each widget block replaced by `[[WIDGET:N]]`. */
  contentWithSentinels: string;
}

// ```widget\n{...}\n``` — three backticks, language tag `widget`, JSON body,
// closing fence on its own line. We allow optional whitespace around the
// JSON body but require the language tag to be exactly `widget` so we don't
// shadow generic ```json blocks.
const WIDGET_FENCE_RE = /```widget\s*\n([\s\S]*?)\n```/g;

function isStringOrNumber(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(parsed: unknown): Widget | null {
  if (!isObject(parsed)) return null;
  const t = parsed.type;
  if (typeof t !== "string") return null;

  switch (t) {
    case "stat": {
      if (typeof parsed.label !== "string") return null;
      if (!isStringOrNumber(parsed.value)) return null;
      return parsed as unknown as StatWidget;
    }
    case "kpi_grid": {
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
      for (const item of parsed.items) {
        if (!isObject(item)) return null;
        if (typeof item.label !== "string") return null;
        if (!isStringOrNumber(item.value)) return null;
      }
      return parsed as unknown as KPIGridWidget;
    }
    case "comparison": {
      const left = parsed.left;
      const right = parsed.right;
      if (!isObject(left) || !isObject(right)) return null;
      if (typeof left.label !== "string" || !isStringOrNumber(left.value)) return null;
      if (typeof right.label !== "string" || !isStringOrNumber(right.value)) return null;
      return parsed as unknown as ComparisonWidget;
    }
    case "bar": {
      if (!Array.isArray(parsed.bars) || parsed.bars.length === 0) return null;
      for (const b of parsed.bars) {
        if (!isObject(b)) return null;
        if (typeof b.label !== "string") return null;
        if (typeof b.value !== "number") return null;
      }
      return parsed as unknown as BarWidget;
    }
    case "line": {
      if (!Array.isArray(parsed.points) || parsed.points.length === 0) return null;
      for (const p of parsed.points) {
        if (!isObject(p)) return null;
        if (typeof p.x !== "string") return null;
        if (typeof p.y !== "number") return null;
      }
      return parsed as unknown as LineWidget;
    }
    case "table": {
      if (!Array.isArray(parsed.columns) || parsed.columns.length === 0) return null;
      for (const c of parsed.columns) {
        if (!isObject(c)) return null;
        if (typeof c.key !== "string" || typeof c.label !== "string") return null;
      }
      if (!Array.isArray(parsed.rows)) return null;
      for (const r of parsed.rows) {
        if (!isObject(r)) return null;
      }
      return parsed as unknown as TableWidget;
    }
    default:
      return null;
  }
}

/**
 * Find every ```widget ... ``` JSON block in a markdown string. Malformed
 * JSON or unknown `type` is silently dropped — the original block stays as
 * text in the markdown so the user sees what the agent actually emitted.
 *
 * Returns the parsed widgets in source order plus a copy of the content
 * where each VALID widget block is replaced by `[[WIDGET:N]]` (N is the
 * widget index). Invalid blocks are left in place verbatim.
 */
export function parseWidgets(content: string): ParsedWidgets {
  if (!content) return { widgets: [], contentWithSentinels: content };

  const widgets: { widget: Widget; raw: string }[] = [];
  // We accumulate output by walking matches in order. matchAll keeps the
  // matches' index/length intact so we can splice cleanly.
  const matches: Array<{ start: number; end: number; raw: string; body: string }> = [];
  for (const m of content.matchAll(WIDGET_FENCE_RE)) {
    if (m.index == null) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      body: m[1],
    });
  }

  if (matches.length === 0) {
    return { widgets: [], contentWithSentinels: content };
  }

  let out = "";
  let cursor = 0;
  for (const match of matches) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match.body);
    } catch {
      // Leave the raw block in place; let the markdown renderer show it as a
      // code block. Don't warn — bad JSON is on the agent, not a bug.
      out += content.slice(cursor, match.end);
      cursor = match.end;
      continue;
    }
    const widget = validate(parsed);
    if (widget == null) {
      // eslint-disable-next-line no-console
      console.warn("widget block dropped: invalid shape or unknown type", parsed);
      out += content.slice(cursor, match.end);
      cursor = match.end;
      continue;
    }
    out += content.slice(cursor, match.start);
    out += `[[WIDGET:${widgets.length}]]`;
    cursor = match.end;
    widgets.push({ widget, raw: match.raw });
  }
  out += content.slice(cursor);

  return { widgets, contentWithSentinels: out };
}
