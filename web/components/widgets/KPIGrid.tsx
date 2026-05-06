"use client";

// 2/3/4-column responsive KPI grid. Each cell is a compact Stat. Hairline
// dividers between cells; no outer border (the surrounding card draws it).

import * as React from "react";
import { motion } from "framer-motion";
import { Stat } from "./Stat";
import type { KPIGridWidget } from "@/lib/widgets";

const ENTRY_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function colsClass(n: number): string {
  // Mobile always 2-col. Desktop scales up to 4-col. Cap at 4: 5/6 still fit
  // in two rows of three or four — readable enough.
  if (n <= 2) return "grid-cols-2 sm:grid-cols-2";
  if (n === 3) return "grid-cols-2 sm:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-4";
}

interface KPIGridProps {
  widget: KPIGridWidget;
}

export function KPIGrid({ widget }: KPIGridProps): React.ReactElement {
  const cols = colsClass(widget.items.length);

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
      <div className={`grid ${cols}`}>
        {widget.items.map((item, i) => (
          <div
            key={`${item.label}-${i}`}
            className="px-3 py-2 border-r border-b border-[color:var(--border)] last:border-r-0 [&:nth-last-child(-n+2)]:sm:border-b-0 [&:nth-last-child(-n+1)]:border-b-0"
          >
            <Stat
              widget={{
                type: "stat",
                label: item.label,
                value: item.value,
                delta: item.delta,
                deltaPositive: item.deltaPositive,
              }}
              compact
              bare
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
