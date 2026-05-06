// Thin proxy: forwards the chat request to FastAPI and pipes the SSE
// response back to the browser unchanged. We don't reshape events here —
// the parser in lib/api.ts handles that.

import { NextRequest } from "next/server";

// Force dynamic + node runtime. The default edge runtime can't stream
// SSE through some configurations cleanly; node is the boring choice.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.AUGUR_API_BASE ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
    // Bypass any ambient cache. SSE must not be cached.
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return new Response(errText || `upstream error: ${upstream.status}`, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
