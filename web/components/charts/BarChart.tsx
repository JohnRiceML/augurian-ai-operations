// Inline horizontal bar chart. SVG-only, no client lib. Augurian red bars
// on a slate gridline. Sized by viewBox so a single component scales from
// the chat bubble (~640px wide) down to a phone (~340px) without
// re-measuring.

import * as React from "react";

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  title?: string;
  format?: (n: number) => string;
  maxBars?: number;
}

const RED = "#C90000";
const SLATE = "#5B6F7A";
const INK = "#212020";
const BORDER = "#E5E2DD";

function defaultFormat(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function BarChart({
  data,
  title,
  format,
  maxBars = 10,
}: BarChartProps): React.ReactElement {
  const fmt = format ?? defaultFormat;
  const bars = data.slice(0, maxBars);
  const max = bars.reduce((a, b) => Math.max(a, b.value), 0) || 1;

  // viewBox in arbitrary units; we use px-equivalent for clarity.
  const VBW = 640;
  const ROW_H = 26;
  const TOP = title ? 28 : 8;
  const VBH = TOP + bars.length * ROW_H + 8;
  const LABEL_W = 168;
  const VALUE_W = 64;
  const BAR_X = LABEL_W + 8;
  const BAR_W = VBW - BAR_X - VALUE_W - 8;

  // 4 vertical gridlines: 0, 25%, 50%, 75%, 100%.
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMinYMin meet"
        width="100%"
        height={Math.min(VBH * 1.1, 320)}
        role="img"
        aria-label={title ?? "Bar chart"}
      >
        {title && (
          <text
            x={0}
            y={16}
            fontSize={13}
            fontWeight={500}
            fill={INK}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            {title}
          </text>
        )}

        {/* gridlines */}
        {ticks.map((t, i) => {
          const x = BAR_X + t * BAR_W;
          return (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={TOP - 4}
              y2={VBH - 4}
              stroke={i === 0 ? BORDER : SLATE}
              strokeOpacity={i === 0 ? 0.9 : 0.18}
              strokeWidth={1}
            />
          );
        })}

        {bars.map((b, i) => {
          const y = TOP + i * ROW_H;
          const w = (b.value / max) * BAR_W;
          const labelText = truncate(b.label, 28);
          return (
            <g key={`${b.label}-${i}`}>
              <title>{`${b.label}: ${fmt(b.value)}`}</title>
              <text
                x={LABEL_W}
                y={y + ROW_H / 2 + 4}
                fontSize={12}
                fill={INK}
                textAnchor="end"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                {labelText}
              </text>
              <rect
                x={BAR_X}
                y={y + 4}
                width={Math.max(w, 1)}
                height={ROW_H - 10}
                rx={2}
                fill={RED}
                fillOpacity={0.85}
              />
              <text
                x={BAR_X + w + 6}
                y={y + ROW_H / 2 + 4}
                fontSize={11.5}
                fill={INK}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                {fmt(b.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
