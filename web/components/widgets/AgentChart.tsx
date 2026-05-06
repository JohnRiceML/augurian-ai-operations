"use client";

// Wraps the existing chart components (BarChart / LineChart / DataTable) in
// the same surface card as Stat. Adds an optional title above the chart so
// the agent can label its synthesized view.

import * as React from "react";
import { motion } from "framer-motion";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { DataTable } from "@/components/charts/DataTable";
import type { BarWidget, LineWidget, TableWidget } from "@/lib/widgets";

const ENTRY_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(n: number): string {
  // Treat values >1 as already-percent (e.g. 12 → "12%"); values ≤1 as a
  // ratio (e.g. 0.12 → "12%"). The agent's input might be either.
  const v = Math.abs(n) > 1 ? n : n * 100;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

interface AgentChartProps {
  widget: BarWidget | LineWidget | TableWidget;
}

export function AgentChart({ widget }: AgentChartProps): React.ReactElement {
  const formatter =
    widget.type === "bar"
      ? widget.format === "currency"
        ? formatCurrency
        : widget.format === "percent"
        ? formatPercent
        : formatNumber
      : undefined;

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
      {widget.type === "bar" && (
        <BarChart data={widget.bars} format={formatter} />
      )}
      {widget.type === "line" && (
        <LineChart data={widget.points} yLabel={widget.yLabel} />
      )}
      {widget.type === "table" && (
        <DataTable rows={widget.rows} columns={widget.columns} />
      )}
    </motion.div>
  );
}
