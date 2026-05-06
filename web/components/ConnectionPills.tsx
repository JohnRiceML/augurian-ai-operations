"use client";

// Three small status indicators in the top bar. Polls /api/status every
// 30s — enough to catch a fresh OAuth without spamming the backend.

import { useEffect, useState } from "react";
import { getStatus } from "@/lib/api";
import type { StatusResponse } from "@/lib/types";

const SCOPE_LABELS: Record<string, string> = {
  drive: "Drive",
  ga4: "GA4",
  gsc: "GSC",
};

const SCOPE_TOOLTIPS: Record<string, string> = {
  drive: "https://www.googleapis.com/auth/drive.readonly",
  ga4: "https://www.googleapis.com/auth/analytics.readonly",
  gsc: "https://www.googleapis.com/auth/webmasters.readonly",
};

function dotColor(state: StatusResponse["drive"]) {
  switch (state) {
    case "connected":
      return "bg-emerald-500";
    case "scope_missing":
      return "bg-amber-400";
    default:
      return "bg-rose-500";
  }
}

export function ConnectionPills() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getStatus();
        if (!cancelled) setStatus(s);
      } catch {
        // Soft-fail. The /api/status route already returns a synthetic
        // disconnected response if the backend is down — a thrown error
        // here is a real network problem, and we just leave the last
        // good status visible until the next tick succeeds.
      }
    };
    void tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {(["drive", "ga4", "gsc"] as const).map((key) => {
        const state = status?.[key] ?? "not_connected";
        return (
          <span
            key={key}
            title={`${SCOPE_LABELS[key]} — ${state.replace("_", " ")}\n${SCOPE_TOOLTIPS[key]}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs text-muted dark:text-muted-dark"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor(state)}`} />
            <span className="font-medium">{SCOPE_LABELS[key]}</span>
          </span>
        );
      })}
    </div>
  );
}
