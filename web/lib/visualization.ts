// Decide whether (and how) to render a tool result as a chart vs a JSON
// preview. The orchestrator may wrap large results in a {_preview, ...}
// envelope where _preview is a JSON string — we unwrap that here so chart
// heuristics work the same on truncated and full payloads. If the preview
// JSON doesn't parse, fall through to "none" rather than throwing — the
// JSON preview UI will still render the raw envelope.

export type VizKind = "bar" | "line" | "table" | "none";

export interface BarDatum {
  label: string;
  value: number;
}
export interface LineDatum {
  x: string;
  y: number;
}
export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}
export interface BarVizData {
  bars: BarDatum[];
  yLabel?: string;
}
export interface LineVizData {
  points: LineDatum[];
  yLabel?: string;
}
export interface TableVizData {
  rows: Record<string, unknown>[];
  columns: TableColumn[];
}

export interface VizPlan {
  kind: VizKind;
  title?: string;
  data: BarVizData | LineVizData | TableVizData | null;
}

interface PreviewEnvelope {
  _preview: string;
  _truncated?: boolean;
  _full_len?: number;
}

function isPreviewEnvelope(v: unknown): v is PreviewEnvelope {
  return (
    typeof v === "object" &&
    v !== null &&
    "_preview" in (v as Record<string, unknown>) &&
    typeof (v as Record<string, unknown>)._preview === "string"
  );
}

function unwrap(result: unknown): unknown {
  if (!isPreviewEnvelope(result)) return result;
  try {
    return JSON.parse(result._preview);
  } catch {
    return null;
  }
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

const NONE: VizPlan = { kind: "none", data: null };

// GSC results: { rows: [{ keys: [string], clicks, impressions, ctr, position }] }
// Dimension is inferred from the first row's keys[0]; if it parses as a
// date we draw a line, otherwise a bar of clicks per dimension value.
function planGsc(parsed: unknown): VizPlan {
  const obj = asObject(parsed);
  if (!obj) return NONE;
  const rows = asArray(obj.rows);
  if (!rows || rows.length === 0) return NONE;

  type GscRow = { key: string; clicks: number };
  const cleaned: GscRow[] = [];
  for (const r of rows) {
    const ro = asObject(r);
    if (!ro) continue;
    const keys = asArray(ro.keys);
    const key = keys && keys.length > 0 ? asString(keys[0]) : null;
    const clicks = asNumber(ro.clicks);
    if (key === null || clicks === null) continue;
    cleaned.push({ key, clicks });
  }
  if (cleaned.length === 0) return NONE;

  const looksLikeDate = (s: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}\d{2}\d{2}$/.test(s);
  const allDates = cleaned.every((c) => looksLikeDate(c.key));

  if (allDates) {
    const sorted = [...cleaned].sort((a, b) => (a.key < b.key ? -1 : 1));
    return {
      kind: "line",
      title: "Clicks over time",
      data: {
        points: sorted.map((c) => ({ x: c.key, y: c.clicks })),
        yLabel: "Clicks",
      },
    };
  }

  const top = [...cleaned].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  return {
    kind: "bar",
    title: "Top queries by clicks",
    data: {
      bars: top.map((c) => ({ label: c.key, value: c.clicks })),
      yLabel: "Clicks",
    },
  };
}

// GA4 result shape (per orchestrator/tools): { rows: [{ dimensions: {...},
// metrics: {...} }], dimensions: [name], metrics: [name] }. Date series ->
// line; otherwise bar of first metric per first dimension.
function planGa4(parsed: unknown): VizPlan {
  const obj = asObject(parsed);
  if (!obj) return NONE;
  const rows = asArray(obj.rows);
  if (!rows || rows.length === 0) return NONE;

  const first = asObject(rows[0]);
  if (!first) return NONE;
  const dims = asObject(first.dimensions);
  const metrics = asObject(first.metrics);
  if (!dims || !metrics) return NONE;

  const dimKeys = Object.keys(dims);
  const metricKeys = Object.keys(metrics);
  if (dimKeys.length === 0 || metricKeys.length === 0) return NONE;
  const dimKey = dimKeys[0];
  const metricKey = metricKeys[0];

  type Pt = { dim: string; metric: number };
  const cleaned: Pt[] = [];
  for (const r of rows) {
    const ro = asObject(r);
    if (!ro) continue;
    const d = asObject(ro.dimensions);
    const m = asObject(ro.metrics);
    if (!d || !m) continue;
    const dim = asString(d[dimKey]);
    const metric = asNumber(m[metricKey]);
    if (dim === null || metric === null) continue;
    cleaned.push({ dim, metric });
  }
  if (cleaned.length === 0) return NONE;

  if (dimKey === "date") {
    // GA4 returns YYYYMMDD; normalize to YYYY-MM-DD for axis labels.
    const norm = (s: string): string =>
      /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
    const sorted = [...cleaned].sort((a, b) => (a.dim < b.dim ? -1 : 1));
    return {
      kind: "line",
      title: `${metricKey} over time`,
      data: {
        points: sorted.map((c) => ({ x: norm(c.dim), y: c.metric })),
        yLabel: metricKey,
      },
    };
  }

  const top = [...cleaned].sort((a, b) => b.metric - a.metric).slice(0, 10);
  return {
    kind: "bar",
    title: `${metricKey} by ${dimKey}`,
    data: {
      bars: top.map((c) => ({ label: c.dim, value: c.metric })),
      yLabel: metricKey,
    },
  };
}

function planCommitments(parsed: unknown): VizPlan {
  const obj = asObject(parsed);
  if (!obj) return NONE;
  const rows = asArray(obj.rows) ?? asArray(obj.commitments);
  if (!rows || rows.length === 0) return NONE;
  const objRows = rows.filter((r): r is Record<string, unknown> => asObject(r) !== null);
  if (objRows.length === 0) return NONE;
  return {
    kind: "table",
    title: "Commitments",
    data: {
      rows: objRows,
      columns: [
        { key: "id", label: "ID", align: "left" },
        { key: "type", label: "Type", align: "left" },
        { key: "due_date", label: "Due", align: "left" },
        { key: "owner", label: "Owner", align: "left" },
        { key: "priority", label: "Priority", align: "left" },
        { key: "status", label: "Status", align: "left" },
      ],
    },
  };
}

function planMeetings(parsed: unknown): VizPlan {
  const obj = asObject(parsed);
  if (!obj) return NONE;
  const meetings = asArray(obj.meetings) ?? asArray(obj.rows);
  if (!meetings || meetings.length === 0) return NONE;
  const objRows = meetings.filter(
    (r): r is Record<string, unknown> => asObject(r) !== null,
  );
  if (objRows.length === 0) return NONE;
  return {
    kind: "table",
    title: "Meetings",
    data: {
      rows: objRows,
      columns: [
        { key: "slug", label: "Slug", align: "left" },
        { key: "captured_date", label: "Captured", align: "left" },
        { key: "source", label: "Source", align: "left" },
        { key: "items_count", label: "Items", align: "right" },
      ],
    },
  };
}

function planGscSites(parsed: unknown): VizPlan {
  const obj = asObject(parsed);
  if (!obj) return NONE;
  const sites = asArray(obj.sites) ?? asArray(obj.rows);
  if (!sites || sites.length === 0) return NONE;
  const objRows = sites.filter(
    (r): r is Record<string, unknown> => asObject(r) !== null,
  );
  if (objRows.length === 0) return NONE;
  return {
    kind: "table",
    title: "Search Console sites",
    data: {
      rows: objRows,
      columns: [
        { key: "site_url", label: "Site", align: "left" },
        { key: "permission", label: "Permission", align: "left" },
      ],
    },
  };
}

function planGa4Properties(parsed: unknown): VizPlan {
  const obj = asObject(parsed);
  if (!obj) return NONE;
  const props = asArray(obj.properties) ?? asArray(obj.rows);
  if (!props || props.length === 0) return NONE;
  const objRows = props.filter(
    (r): r is Record<string, unknown> => asObject(r) !== null,
  );
  if (objRows.length === 0) return NONE;
  return {
    kind: "table",
    title: "GA4 properties",
    data: {
      rows: objRows,
      columns: [
        { key: "property_name", label: "Property", align: "left" },
        { key: "property_id", label: "ID", align: "left" },
        { key: "account", label: "Account", align: "left" },
      ],
    },
  };
}

export function planVisualization(toolName: string, result: unknown): VizPlan {
  if (result === undefined || result === null) return NONE;
  const parsed = unwrap(result);
  if (parsed === null || parsed === undefined) return NONE;

  // If the unwrapped object carries an `error`, skip charting — the JSON
  // preview is more informative for that case.
  const top = asObject(parsed);
  if (top && "error" in top) return NONE;

  switch (toolName) {
    case "query_gsc":
      return planGsc(parsed);
    case "query_ga4":
      return planGa4(parsed);
    case "query_commitments":
      return planCommitments(parsed);
    case "list_meetings":
      return planMeetings(parsed);
    case "list_gsc_sites":
      return planGscSites(parsed);
    case "list_ga4_properties":
      return planGa4Properties(parsed);
    default:
      return NONE;
  }
}
