"use client";

// One tool call, rendered inside an assistant message. Default-collapsed:
// most users don't want to see the JSON, but the option to drill in is
// the entire reason this UI exists. Card is visually subordinate to the
// message — narrower padding, lighter background, smaller text.

import { useState } from "react";
import {
  ServiceLogo,
  ServiceLabel,
  serviceForTool,
  SERVICE_PRIMARY,
} from "./ServiceLogo";
import type { ToolCall } from "@/lib/types";

function StatusDot({ status }: { status: ToolCall["status"] }) {
  if (status === "running") {
    return (
      <span
        aria-label="running"
        className="h-2 w-2 rounded-full bg-augur-orange animate-shimmer"
      />
    );
  }
  if (status === "error") {
    return <span aria-label="error" className="h-2 w-2 rounded-full bg-rose-500" />;
  }
  return <span aria-label="done" className="h-2 w-2 rounded-full bg-emerald-500" />;
}

function previewText(result: unknown): string {
  if (result === undefined) return "";
  if (
    typeof result === "object" &&
    result !== null &&
    "_preview" in (result as Record<string, unknown>)
  ) {
    const r = result as { _preview: string; _full_len?: number };
    return r._preview + (r._full_len ? ` [+${r._full_len - r._preview.length} chars]` : "");
  }
  try {
    const s = JSON.stringify(result, null, 2);
    return s.length > 1500 ? s.slice(0, 1500) + "…" : s;
  } catch {
    return String(result);
  }
}

interface ToolCallCardProps {
  call: ToolCall;
}

export function ToolCallCard({ call }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const isError: boolean =
    call.status === "error" ||
    (call.result !== undefined &&
      call.result !== null &&
      typeof call.result === "object" &&
      "error" in (call.result as Record<string, unknown>));

  const service = serviceForTool(call.name);
  const tint = SERVICE_PRIMARY[service];

  return (
    <div
      className="rounded-[10px] border border-[color:var(--border)] bg-[color:var(--bg)]/60 dark:bg-[color:var(--bg)]/40 px-3 py-2 text-[13px]"
      style={{
        transition: "max-height 200ms ease-out",
        borderLeft: `3px solid ${tint}`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ServiceLogo service={service} size={14} />
          <code className="font-mono text-[12.5px] text-ink dark:text-ink-dark">
            {call.name}
          </code>
          <span className="text-[12px] text-muted dark:text-muted-dark">
            — {ServiceLabel({ service })}
          </span>
          {isError && (
            <span className="text-[11.5px] uppercase tracking-wide text-rose-600 dark:text-rose-400">
              error
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <StatusDot status={call.status} />
          <span
            className="text-[11px] text-muted dark:text-muted-dark"
            aria-hidden="true"
          >
            {open ? "▴" : "▾"}
          </span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 animate-fade-in">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted dark:text-muted-dark">
              args
            </div>
            <pre className="overflow-x-auto rounded-md bg-[color:var(--surface)] p-2 font-mono text-[12px] leading-snug border border-[color:var(--border)]">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted dark:text-muted-dark">
              result
            </div>
            <pre className="overflow-x-auto rounded-md bg-[color:var(--surface)] p-2 font-mono text-[12px] leading-snug border border-[color:var(--border)]">
              {call.result === undefined ? "…" : previewText(call.result)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
