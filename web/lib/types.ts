// Shared types for the front-end. Mirror the SSE event names emitted by
// scripts/api.py — keep these two in sync if either side changes.

export type Role = "user" | "assistant";

export interface ToolCall {
  /** Server-generated id; stable across the tool_use → tool_result pair. */
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Set once tool_result arrives. */
  result?: unknown;
  status: "running" | "done" | "error";
  /** ISO timestamp recorded client-side when the tool_use event arrived. */
  started_at?: string;
  /** ISO timestamp recorded client-side when the tool_result event arrived. */
  completed_at?: string;
}

export interface UsageStats {
  in: number;
  out: number;
  iterations: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  usage?: UsageStats;
  /** Timestamp set client-side. Used for ordering + the optional debug footer. */
  createdAt: number;
  /** True while the assistant turn is still streaming. */
  pending?: boolean;
  /** Set if the agent loop emitted an `error` SSE event. */
  error?: string;
}

// SSE event shapes from /api/chat. The server emits them as named events
// with stringified JSON payloads; the client parser resolves to these.

export interface ToolUseEvent {
  type: "tool_use";
  name: string;
  args: Record<string, unknown>;
}
export interface ToolResultEvent {
  type: "tool_result";
  name: string;
  // Either the full result object, or a {_preview, _truncated, _full_len}
  // wrapper when the result was too big to fit in the SSE payload.
  result: unknown;
}
export interface TextDeltaEvent {
  type: "text_delta";
  text: string;
}
export interface DoneEvent {
  type: "done";
  tokens_in: number;
  tokens_out: number;
  iterations: number;
}
export interface ErrorEvent {
  type: "error";
  message: string;
}

export type ChatEvent =
  | ToolUseEvent
  | ToolResultEvent
  | TextDeltaEvent
  | DoneEvent
  | ErrorEvent;

// /api/status response — mirrors scripts/api.py status() exactly.
export interface StatusResponse {
  anthropic_configured: boolean;
  drive: "connected" | "scope_missing" | "not_connected";
  ga4: "connected" | "scope_missing" | "not_connected";
  gsc: "connected" | "scope_missing" | "not_connected";
  user_email: string | null;
  token_path_exists: boolean;
}
