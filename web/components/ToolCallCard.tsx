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

/**
 * Inline-keyframe spinner ring. Pure SVG so we don't depend on a Tailwind
 * keyframe — `animate-spin` exists but the dasharray pulse adds a touch
 * of life that a flat rotation lacks. The keyframes ride on the SVG
 * `<style>` element scoped per render so multiple spinners don't fight.
 */
function SpinnerRing({ size = 12, color }: { size?: number; color: string }) {
  const stroke = 1.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="running"
      role="status"
      style={{
        animation: "augur-spinner-rotate 1.2s linear infinite",
        display: "inline-block",
      }}
    >
      <style>{`
        @keyframes augur-spinner-rotate {
          to { transform: rotate(360deg); }
        }
        @keyframes augur-spinner-dash {
          0% { stroke-dasharray: 1, ${c}; stroke-dashoffset: 0; }
          50% { stroke-dasharray: ${c * 0.55}, ${c}; stroke-dashoffset: -${c * 0.18}; }
          100% { stroke-dasharray: 1, ${c}; stroke-dashoffset: -${c * 0.99}; }
        }
      `}</style>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{
          animation: "augur-spinner-dash 1.2s ease-in-out infinite",
          transformOrigin: "center",
        }}
      />
    </svg>
  );
}

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
    return <SpinnerRing size={12} color="var(--augur-orange)" />;
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

/**
 * Format a millisecond duration into a compact, eye-readable suffix:
 *   <1s   → "342ms"
 *   <10s  → "1.4s"
 *   <60s  → "12s"
 *   ≥60s  → "1m 12s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
}

function durationFor(call: ToolCall): string | null {
  if (!call.started_at || !call.completed_at) return null;
  if (call.status === "running") return null;
  const ms = Date.parse(call.completed_at) - Date.parse(call.started_at);
  if (!Number.isFinite(ms) || ms <= 100) return null;
  return formatDuration(ms);
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
          {call.status === "running" ? (
            <motion.span
              className="block text-[13.5px] font-medium leading-[18px] text-ink"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
            >
              {friendlyLabel}
            </motion.span>
          ) : (
            <span className="block text-[13.5px] font-medium leading-[18px] text-ink">
              {friendlyLabel}
            </span>
          )}
          <span className="block text-[11.5px] leading-tight text-muted">
            <code className="font-mono tracking-tight">{call.name}</code>
            <span aria-hidden="true"> · </span>
            <span>{ServiceLabel({ service })}</span>
            {(() => {
              const d = durationFor(call);
              return d ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>{d}</span>
                </>
              ) : null;
            })()}
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
