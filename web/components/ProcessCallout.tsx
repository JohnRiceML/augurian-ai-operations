"use client";

// Top-level "what's happening" summary for an assistant message. Renders
// a quiet timeline of the tool calls the agent ran, so a reader can take
// in the system's reasoning at a glance — clicking the cards below gives
// the proof. Renders nothing if there are no tool calls.

import { motion } from "framer-motion";
import { ServiceLogo, serviceForTool } from "./ServiceLogo";
import { describeTool } from "@/lib/tool-descriptions";
import type { ToolCall } from "@/lib/types";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Tiny spinner for the timeline scale. Mirrors the SVG ring used in
 * ToolCallCard but at 10px so it sits flush with the 11px service logos.
 */
function MiniSpinner({ size = 10 }: { size?: number }) {
  const stroke = 1.25;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="status"
      aria-label="running"
      style={{
        animation: "augur-mini-spin 1.2s linear infinite",
        display: "inline-block",
      }}
    >
      <style>{`
        @keyframes augur-mini-spin { to { transform: rotate(360deg); } }
        @keyframes augur-mini-dash {
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
        stroke="var(--augur-orange)"
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{
          animation: "augur-mini-dash 1.2s ease-in-out infinite",
          transformOrigin: "center",
        }}
      />
    </svg>
  );
}

interface ProcessCalloutProps {
  toolCalls: ToolCall[];
}

export function ProcessCallout({ toolCalls }: ProcessCalloutProps) {
  if (toolCalls.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
    >
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
        Process
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] leading-tight text-muted">
        {toolCalls.map((tc, i) => {
          const desc = describeTool(tc.name);
          const service = serviceForTool(tc.name);
          const isLast = i === toolCalls.length - 1;
          const isRunning = tc.status === "running";
          const label = isRunning ? desc.runningLabel : desc.doneLabel;
          // Trailing arrow is only meaningful between two entries. If this
          // is the final entry AND it's still in flight, omit the arrow —
          // there's nothing to point to yet.
          const showArrow = !isLast;
          return (
            <span key={tc.id} className="inline-flex items-center gap-1.5">
              {isRunning && <MiniSpinner size={10} />}
              <ServiceLogo service={service} size={11} />
              {isRunning ? (
                <motion.span
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{
                    duration: 1.2,
                    ease: "linear",
                    repeat: Infinity,
                  }}
                >
                  {label}
                </motion.span>
              ) : (
                <span>{label}</span>
              )}
              {showArrow && (
                <span className="text-[color:var(--border)]">→</span>
              )}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}
