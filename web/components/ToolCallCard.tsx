"use client";

// One tool call, rendered inside an assistant message. Default-collapsed:
// most users don't want to see the JSON, but the option to drill in is
// the entire reason this UI exists.
//
// Visual model: subordinate to the message text. Single hairline border,
// no heavy left-stripe tint, the service color shows up only as a small
// accent dot. Hover gives a subtle background lift to signal the card is
// clickable. Expand reveals a chart (when the result shape is known) or
// the raw JSON, with args + result as quietly-headed sections.

import { useState } from "react";
import {
  ServiceLogo,
  ServiceLabel,
  serviceForTool,
  SERVICE_PRIMARY,
} from "./ServiceLogo";
import type { ToolCall } from "@/lib/types";
import {
  planVisualization,
  type BarVizData,
  type LineVizData,
  type TableVizData,
} from "@/lib/visualization";
import { BarChart } from "./charts/BarChart";
import { LineChart } from "./charts/LineChart";
import { DataTable } from "./charts/DataTable";

function StatusDot({
  status,
  isError,
  tint,
}: {
  status: ToolCall["status"];
  isError: boolean;
  tint: string;
}) {
  if (status === "running") {
    return (
      <span
        aria-label="running"
        className="inline-block h-1.5 w-1.5 rounded-full animate-shimmer"
        style={{ background: tint }}
      />
    );
  }
  if (isError) {
    return (
      <span
        aria-label="error"
        className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500"
      />
    );
  }
  return (
    <span
      aria-label="done"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: tint }}
    />
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="text-muted transition-transform duration-200 ease-out"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      <path
        d="M4.5 3l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  const plan = planVisualization(call.name, call.result);

  return (
    <div
      className="group rounded-[8px] border border-[color:var(--border)] bg-[color:var(--bg)] transition-colors duration-150 hover:bg-[color:var(--surface)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
      >
        <Chevron open={open} />
        <ServiceLogo service={service} size={14} />
        <code className="flex-shrink-0 font-mono text-[12.5px] tracking-tight text-ink">
          {call.name}
        </code>
        <span className="text-[12px] text-muted">{ServiceLabel({ service })}</span>
        {isError && (
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-rose-600">
            error
          </span>
        )}
        <span className="ml-auto flex items-center">
          <StatusDot status={call.status} isError={isError} tint={tint} />
        </span>
      </button>
      {open && (
        <div
          className="px-3 pb-3 pt-1 space-y-3 animate-fade-in"
          style={{ animationDuration: "var(--motion, 200ms)" }}
        >
          <Section label="Arguments">
            <pre className="overflow-x-auto rounded-md bg-[color:var(--surface)] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </Section>
          <Section label="Result">
            {plan.kind === "none" || call.result === undefined ? (
              <pre className="overflow-x-auto rounded-md bg-[color:var(--surface)] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
                {call.result === undefined ? "…" : previewText(call.result)}
              </pre>
            ) : (
              <div className="rounded-md bg-[color:var(--surface)] px-3 py-3">
                {plan.kind === "bar" && (
                  <BarChart
                    data={(plan.data as BarVizData).bars}
                    title={plan.title}
                  />
                )}
                {plan.kind === "line" && (
                  <LineChart
                    data={(plan.data as LineVizData).points}
                    title={plan.title}
                    yLabel={(plan.data as LineVizData).yLabel}
                  />
                )}
                {plan.kind === "table" && (
                  <DataTable
                    rows={(plan.data as TableVizData).rows}
                    columns={(plan.data as TableVizData).columns}
                  />
                )}
                <details className="mt-2.5 group/raw">
                  <summary className="cursor-pointer list-none text-[10.5px] font-medium uppercase tracking-wider text-muted hover:text-ink transition-colors">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block transition-transform duration-150 group-open/raw:rotate-90">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <path d="M3 2l2 2-2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      Raw JSON
                    </span>
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-[color:var(--bg)] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink border border-[color:var(--border)]">
                    {previewText(call.result)}
                  </pre>
                </details>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}
