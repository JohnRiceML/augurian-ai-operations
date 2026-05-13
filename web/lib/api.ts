// Small wrapper around fetch for the two /api routes that the UI uses.
// We deliberately keep this file framework-agnostic — no React, no Next.
// Components import from here; the Next.js route handlers under app/api/
// are completely separate.

import type {
  ChatEvent,
  Message,
  ReauthResponse,
  StatusResponse,
} from "./types";

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`status fetch failed: ${res.status}`);
  }
  return (await res.json()) as StatusResponse;
}

export async function startReauth(): Promise<ReauthResponse> {
  const res = await fetch("/api/reauth", {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`reauth request failed: ${res.status}`);
  }
  return (await res.json()) as ReauthResponse;
}

export interface StreamChatOptions {
  client: string;
  messages: Pick<Message, "role" | "content">[];
  driveFolderId?: string | null;
  signal?: AbortSignal;
}

/**
 * Stream chat events from /api/chat. Yields parsed ChatEvent objects in the
 * order they arrive. The route handler proxies to FastAPI and pipes the
 * SSE response back unchanged, so the parser here is the same code that
 * would consume FastAPI directly — easy to unit-test later if we want.
 */
export async function* streamChat(
  opts: StreamChatOptions,
): AsyncIterable<ChatEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: opts.client,
      messages: opts.messages,
      drive_folder_id: opts.driveFolderId ?? null,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`chat stream failed: ${res.status} ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  // SSE framing: events are separated by a blank line. Each event has
  // optional "event:" + "data:" lines. We only care about those two.
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    // Look for both \n\n and \r\n\r\n — sse-starlette uses \r\n line
    // endings on some platforms.
    while (
      (sep = findEventBoundary(buf)) !== -1
    ) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep).replace(/^(\r?\n){1,2}/, "");
      const ev = parseEvent(raw);
      if (ev) {
        yield ev;
      }
    }
  }
  // Flush any final event without a trailing blank line.
  if (buf.trim()) {
    const ev = parseEvent(buf);
    if (ev) {
      yield ev;
    }
  }
}

function findEventBoundary(s: string): number {
  const a = s.indexOf("\n\n");
  const b = s.indexOf("\r\n\r\n");
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function parseEvent(raw: string): ChatEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
    // Ignore comments (":") and id/retry lines — we don't use them.
  }
  if (dataLines.length === 0) return null;
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
  switch (event) {
    case "iteration_start":
      return { type: "iteration_start", ...(data as { iteration: number }) };
    case "tool_use":
      return { type: "tool_use", ...(data as { name: string; args: Record<string, unknown> }) };
    case "tool_result":
      return { type: "tool_result", ...(data as { name: string; result: unknown }) };
    case "text_delta":
      return { type: "text_delta", ...(data as { text: string }) };
    case "done":
      return { type: "done", ...(data as { tokens_in: number; tokens_out: number; iterations: number }) };
    case "error":
      return { type: "error", ...(data as { message: string }) };
    default:
      // Unknown event type — drop it. Forward-compat: the server can add
      // events without breaking older clients.
      return null;
  }
}
