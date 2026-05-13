// Forwards POST /api/reauth to FastAPI. Kicks off the OAuth flow in a
// background thread on the server (it opens the browser on the user's
// machine since we're on localhost). UI then polls /api/status to detect
// when the three Google pills flip to connected.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.AUGUR_API_BASE ?? "http://localhost:8000";

export async function POST() {
  try {
    const upstream = await fetch(`${API_BASE}/api/reauth`, {
      method: "POST",
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        state: "failed",
        error: `backend unreachable: ${(err as Error).message}`,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
