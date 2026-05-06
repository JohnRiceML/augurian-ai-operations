"use client";

// Three small status indicators in the top bar. Polls /api/status every
// 30s — enough to catch a fresh OAuth without spamming the backend.

import { useEffect, useState } from "react";
import { getStatus } from "@/lib/api";
import type { StatusResponse } from "@/lib/types";
import { ServiceLogo, type Service } from "./ServiceLogo";

const SCOPE_LABELS: Record<Service, string> = {
  drive: "Drive",
  ga4: "GA4",
  gsc: "Search Console",
};

const SCOPE_TOOLTIPS: Record<Service, string> = {
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
        const dim = state !== "connected";
        return (
          <span
            key={key}
            title={`${SCOPE_LABELS[key]} — ${state.replace("_", " ")}\n${SCOPE_TOOLTIPS[key]}`}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs text-muted dark:text-muted-dark"
          >
            <span
              className="inline-flex items-center"
              style={{ opacity: dim ? 0.4 : 1 }}
            >
              <ServiceLogo service={key} size={16} />
            </span>
            <span className="font-medium ml-1">{SCOPE_LABELS[key]}</span>
            <span className={`ml-1 h-1.5 w-1.5 rounded-full ${dotColor(state)}`} />
          </span>
        );
      })}
    </div>
  );
}
