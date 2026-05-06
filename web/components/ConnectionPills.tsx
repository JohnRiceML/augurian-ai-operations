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

// Human-readable scope name + the OAuth URL it maps to. The pill's
// title attr stitches these together so hovering surfaces both "what
// am I allowed to see" and the literal scope string.
const SCOPE_DETAILS: Record<Service, { name: string; url: string }> = {
  drive: {
    name: "Drive (read-only)",
    url: "https://www.googleapis.com/auth/drive.readonly",
  },
  ga4: {
    name: "Analytics (read-only)",
    url: "https://www.googleapis.com/auth/analytics.readonly",
  },
  gsc: {
    name: "Search Console (read-only)",
    url: "https://www.googleapis.com/auth/webmasters.readonly",
  },
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
    <div className="flex items-center gap-1.5">
      {(["drive", "ga4", "gsc"] as const).map((key) => {
        const state = status?.[key] ?? "not_connected";
        const connected = state === "connected";
        const scope = SCOPE_DETAILS[key];
        const stateText = state.replace("_", " ");
        return (
          <span
            key={key}
            title={`${SCOPE_LABELS[key]} — ${stateText}\nScope: ${scope.name}\n${scope.url}`}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-[3px] text-[11.5px] text-muted dark:text-muted-dark hover:bg-augur-orange/[0.04] hover:border-augur-orange/30"
            style={{
              opacity: connected ? 1 : 0.5,
              transition:
                "background-color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out)",
            }}
          >
            <ServiceLogo service={key} size={14} />
            <span className="font-medium">{SCOPE_LABELS[key]}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${dotColor(state)}`}
              aria-label={stateText}
            />
          </span>
        );
      })}
    </div>
  );
}
