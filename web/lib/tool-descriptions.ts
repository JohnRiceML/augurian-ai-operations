// Plain-English tool descriptions. Each entry maps a tool name to a
// running label, a past-tense done label, and a one-line "why" — what the
// tool actually does, in language a partner-side reader can parse. Keep
// these terse: the running/done labels show in cards and timelines, and
// the why line shows in the expanded card body.

export interface ToolDescription {
  /** Short imperative verb shown while the tool is running. */
  runningLabel: string;
  /** Past-tense label shown after it completes. */
  doneLabel: string;
  /** One-line "why" — explains what this tool does in plain English. */
  why: string;
}

export const TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
  query_commitments: {
    runningLabel: "Searching your commitments",
    doneLabel: "Searched commitments",
    why: "Filters the structured commitment index — fast, no Drive call.",
  },
  get_meeting_details: {
    runningLabel: "Loading meeting details",
    doneLabel: "Loaded meeting details",
    why: "Reads the per-call extraction file with verbatim quotes + anchors.",
  },
  list_meetings: {
    runningLabel: "Finding your meetings",
    doneLabel: "Found meetings",
    why: "Lists meetings — both extracted (in the index) and Drive-only (PDF in Drive but not yet processed).",
  },
  read_meeting_summary: {
    runningLabel: "Reading the meeting summary",
    doneLabel: "Read the summary",
    why: "Downloads Fireflies' own pre-extracted summary PDF and applies spelling corrections.",
  },
  read_meeting_transcript: {
    runningLabel: "Reading the full transcript",
    doneLabel: "Read the transcript",
    why: "Downloads the full Fireflies transcript PDF — last resort, biggest tokens.",
  },
  query_ga4: {
    runningLabel: "Pulling GA4 data",
    doneLabel: "Pulled GA4 data",
    why: "Live Google Analytics 4 report — sessions, users, conversions, engagement.",
  },
  query_gsc: {
    runningLabel: "Pulling Search Console data",
    doneLabel: "Pulled Search Console data",
    why: "Live GSC search analytics — keywords, rankings, impressions, CTR.",
  },
  list_ga4_properties: {
    runningLabel: "Looking up your GA4 properties",
    doneLabel: "Found GA4 properties",
    why: "Lists every GA4 account + property your authorized account can query.",
  },
  list_gsc_sites: {
    runningLabel: "Looking up your Search Console properties",
    doneLabel: "Found Search Console properties",
    why: "Lists every verified Search Console site your account can query.",
  },
};

export function describeTool(name: string): ToolDescription {
  return (
    TOOL_DESCRIPTIONS[name] ?? {
      runningLabel: `Running ${name}`,
      doneLabel: `Ran ${name}`,
      why: "Custom tool call.",
    }
  );
}
