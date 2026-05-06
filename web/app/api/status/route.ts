// Forwards GET /api/status to FastAPI. No caching — the user may have just
// re-run the OAuth flow, and the connection pills should reflect that
// without a hard refresh.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.AUGUR_API_BASE ?? "http://localhost:8000";

export async function GET() {
  try {
    const upstream = await fetch(`${API_BASE}/api/status`, {
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // FastAPI not running or unreachable. Return a synthetic
    // "everything disconnected" response so the UI degrades gracefully
    // instead of throwing in a useEffect.
    return new Response(
      JSON.stringify({
        anthropic_configured: false,
        drive: "not_connected",
        ga4: "not_connected",
        gsc: "not_connected",
        user_email: null,
        token_path_exists: false,
        _error: `backend unreachable: ${(err as Error).message}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
