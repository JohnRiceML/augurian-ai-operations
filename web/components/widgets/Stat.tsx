"use client";

// Headline stat card. Big number, small uppercase label above, optional
// delta on the right and caption below. Inferred sign for the delta when
// `deltaPositive` isn't explicit.

import * as React from "react";
import { motion } from "framer-motion";
import type { StatWidget } from "@/lib/widgets";

const ENTRY_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const POSITIVE_GREEN = "#16A34A";
const NEGATIVE_RED = "#DC2626";

function inferPositive(delta: string | undefined, explicit: boolean | undefined): boolean | undefined {
  if (explicit !== undefined) return explicit;
  if (!delta) return undefined;
  const trimmed = delta.trim();
  if (trimmed.startsWith("+")) return true;
  // Unicode minus, hyphen-minus, en-dash all count as down.
  if (trimmed.startsWith("-") || trimmed.startsWith("−") || trimmed.startsWith("–")) {
    return false;
  }
  return undefined;
}

interface StatProps {
  widget: StatWidget;
  /** Render at smaller size — used inside KPIGrid. */
  compact?: boolean;
  /** Skip the surrounding card chrome — used when the parent draws it. */
  bare?: boolean;
}

export function Stat({ widget, compact = false, bare = false }: StatProps): React.ReactElement {
  const positive = inferPositive(widget.delta, widget.deltaPositive);
  const valueClass = compact
    ? "text-[22px] sm:text-[24px] font-semibold leading-none"
    : "text-[32px] sm:text-[40px] font-semibold leading-none";

  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-wider text-muted">
          {widget.label}
        </div>
        <div
          className={`mt-1 text-ink ${valueClass}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {typeof widget.value === "number"
            ? widget.value.toLocaleString()
            : widget.value}
        </div>
        {widget.caption && (
          <div className="mt-1 text-[12px] text-muted">{widget.caption}</div>
        )}
      </div>
      {widget.delta && (
        <div
          className="shrink-0 flex items-center gap-1 text-[13px] font-medium"
          style={{
            color:
              positive === true
                ? POSITIVE_GREEN
                : positive === false
                ? NEGATIVE_RED
                : "#5B6F7A",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {positive === true && <span aria-hidden="true">▲</span>}
          {positive === false && <span aria-hidden="true">▼</span>}
          <span>{widget.delta}</span>
        </div>
      )}
    </div>
  );

  if (bare) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: ENTRY_EASE }}
      className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 my-2"
    >
      {inner}
    </motion.div>
  );
}
