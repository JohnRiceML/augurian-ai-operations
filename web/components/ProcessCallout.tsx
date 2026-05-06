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
          const label =
            tc.status === "done" ? desc.doneLabel : desc.runningLabel;
          return (
            <span key={tc.id} className="inline-flex items-center gap-1.5">
              <ServiceLogo service={service} size={11} />
              <span>{label}</span>
              {!isLast && (
                <span className="text-[color:var(--border)]">→</span>
              )}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}
