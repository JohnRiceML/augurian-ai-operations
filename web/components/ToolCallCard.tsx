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
import { AnimatePresence, motion } from "framer-motion";
import {
  ServiceLogo,
  ServiceLabel,
  serviceForTool,
  SERVICE_PRIMARY,
} from "./ServiceLogo";
import type { ToolCall } from "@/lib/types";
import { describeTool } from "@/lib/tool-descriptions";
import {
  planVisualization,
  type BarVizData,
  type LineVizData,
  type TableVizData,
} from "@/lib/visualization";
import { BarChart } from "./charts/BarChart";
import { LineChart } from "./charts/LineChart";
import { DataTable } from "./charts/DataTable";

// Shared easing for expand/collapse — Apple-style ease-out cubic bezier.
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
  const isError: boolean =
    call.status === "error" ||
    (call.result !== undefined &&
      call.result !== null &&
      typeof call.result === "object" &&
      "error" in (call.result as Record<string, unknown>));

  const service = serviceForTool(call.name);
  const tint = SERVICE_PRIMARY[service];
  const desc = describeTool(call.name);
  const friendlyLabel =
    call.status === "running" ? desc.runningLabel : desc.doneLabel;

  const plan = planVisualization(call.name, call.result);

  // Auto-expand when there's a chart/table to show — that's the whole
  // point of having a visualization. Errors also auto-expand so the user
  // doesn't have to click to find out what went wrong.
  const shouldAutoExpand = plan.kind !== "none" || isError;
  const [open, setOpen] = useState(shouldAutoExpand);

  return (
    <motion.div
      layout
      transition={{ duration: 0.2, ease: EASE }}
      className="group rounded-[8px] border border-[color:var(--border)] bg-[color:var(--bg)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[color:var(--surface)] hover:-translate-y-[1.5px] hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left"
      >
        <span className="flex h-[18px] items-center">
          <Chevron open={open} />
        </span>
        <span className="flex h-[18px] items-center">
          <ServiceLogo service={service} size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium leading-[18px] text-ink">
            {friendlyLabel}
          </span>
          <span className="block text-[11.5px] leading-tight text-muted">
            <code className="font-mono tracking-tight">{call.name}</code>
            <span aria-hidden="true"> · </span>
            <span>{ServiceLabel({ service })}</span>
          </span>
        </span>
        {isError && (
          <span className="mt-[2px] text-[10.5px] font-medium uppercase tracking-wider text-rose-600">
            error
          </span>
        )}
        <span className="ml-1 mt-[6px] flex items-center">
          <StatusDot status={call.status} isError={isError} tint={tint} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 pt-1 space-y-3">
              <Section label="Arguments">
                <pre className="overflow-x-auto rounded-md bg-[color:var(--surface)] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
                  {JSON.stringify(call.args, null, 2)}
                </pre>
              </Section>
              <p className="text-[12px] italic leading-snug text-muted">
                {desc.why}
              </p>
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
