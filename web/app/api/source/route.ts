// Forwards GET /api/source to FastAPI. Same pattern as /api/status.
// JSON pass-through; the front-end uses the response directly.

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.AUGUR_API_BASE ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  const meetingSlug = url.searchParams.get("meeting_slug") ?? "";
  const anchor = url.searchParams.get("anchor") ?? "";

  if (!client || !meetingSlug || !anchor) {
    return new Response(
      JSON.stringify({
        error: "client, meeting_slug, and anchor query params are required",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const upstream = new URL(`${API_BASE}/api/source`);
  upstream.searchParams.set("client", client);
  upstream.searchParams.set("meeting_slug", meetingSlug);
  upstream.searchParams.set("anchor", anchor);

  try {
    const res = await fetch(upstream.toString(), { cache: "no-store" });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: `backend unreachable: ${(err as Error).message}`,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
