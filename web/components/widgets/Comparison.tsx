"use client";

// Two side-by-side blocks (left + right) with arrow + delta in the middle.
// Color-coded delta. Title sits above the row when present.

import * as React from "react";
import { motion } from "framer-motion";
import type { ComparisonWidget } from "@/lib/widgets";

const ENTRY_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const POSITIVE_GREEN = "#16A34A";
const NEGATIVE_RED = "#DC2626";

function inferPositive(delta: string | undefined, explicit: boolean | undefined): boolean | undefined {
  if (explicit !== undefined) return explicit;
  if (!delta) return undefined;
  const t = delta.trim();
  if (t.startsWith("+")) return true;
  if (t.startsWith("-") || t.startsWith("−") || t.startsWith("–")) return false;
  return undefined;
}

function formatValue(v: string | number): string {
  return typeof v === "number" ? v.toLocaleString() : v;
}

interface ComparisonProps {
  widget: ComparisonWidget;
}

export function Comparison({ widget }: ComparisonProps): React.ReactElement {
  const positive = inferPositive(widget.delta, widget.deltaPositive);
  const deltaColor =
    positive === true
      ? POSITIVE_GREEN
      : positive === false
      ? NEGATIVE_RED
      : "#5B6F7A";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: ENTRY_EASE }}
      className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 my-2"
    >
      {widget.title && (
        <div className="text-[13px] font-medium text-ink mb-2">
          {widget.title}
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] uppercase tracking-wider text-muted">
            {widget.left.label}
          </div>
          <div
            className="mt-1 text-[24px] sm:text-[28px] font-semibold leading-none text-ink"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatValue(widget.left.value)}
          </div>
        </div>

        <div
          className="shrink-0 flex flex-col items-center gap-1 px-2"
          style={{ color: deltaColor, fontVariantNumeric: "tabular-nums" }}
        >
          <span aria-hidden="true" className="text-[18px] leading-none text-muted">
            →
          </span>
          {widget.delta && (
            <span className="text-[12.5px] font-medium">{widget.delta}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <div className="text-[10.5px] uppercase tracking-wider text-muted">
            {widget.right.label}
          </div>
          <div
            className="mt-1 text-[24px] sm:text-[28px] font-semibold leading-none text-ink"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatValue(widget.right.value)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
