// Inline line chart for time series. Catmull-Rom-to-Bezier smoothing for
// the path, dots at each datum, ~7 X labels evenly spaced regardless of
// series length.

import * as React from "react";

export interface LineDatum {
  x: string;
  y: number;
}

export interface LineChartProps {
  data: LineDatum[];
  title?: string;
  yLabel?: string;
}

const RED = "#C90000";
const SLATE = "#5B6F7A";
const INK = "#212020";
const BORDER = "#E5E2DD";

function formatY(n: number): string {
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "k";
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// Catmull-Rom -> cubic Bezier. tension 0.5 is the standard mapping. With
// fewer than 2 points we just emit a moveto so the SVG still parses.
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const d: string[] = [`M${pts[0].x},${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`);
  }
  return d.join(" ");
}

export function LineChart({
  data,
  title,
  yLabel,
}: LineChartProps): React.ReactElement {
  const VBW = 640;
  const VBH = 280;
  const PAD_L = 44;
  const PAD_R = 12;
  const PAD_T = title ? 28 : 12;
  const PAD_B = 28;
  const W = VBW - PAD_L - PAD_R;
  const H = VBH - PAD_T - PAD_B;

  const ys = data.map((d) => d.y);
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  // Pad the Y range so the line doesn't kiss the top/bottom edges.
  const span = Math.max(maxY - minY, 1);
  const yLo = minY - span * 0.05;
  const yHi = maxY + span * 0.1;
  const yRange = yHi - yLo || 1;

  const xFor = (i: number): number =>
    data.length <= 1 ? PAD_L + W / 2 : PAD_L + (i / (data.length - 1)) * W;
  const yFor = (v: number): number => PAD_T + H - ((v - yLo) / yRange) * H;

  const pts = data.map((d, i) => ({ x: xFor(i), y: yFor(d.y) }));
  const path = smoothPath(pts);

  // 5 Y gridlines.
  const yTicks = 5;
  const yTickValues = Array.from(
    { length: yTicks },
    (_, i) => yLo + (i / (yTicks - 1)) * yRange,
  );

  // ~7 X labels, evenly spaced by index.
  const targetXLabels = 7;
  const stride = data.length <= targetXLabels
    ? 1
    : Math.ceil(data.length / targetXLabels);
  const xLabelIndices: number[] = [];
  for (let i = 0; i < data.length; i += stride) xLabelIndices.push(i);
  if (data.length > 0 && xLabelIndices[xLabelIndices.length - 1] !== data.length - 1) {
    xLabelIndices.push(data.length - 1);
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMinYMin meet"
        width="100%"
        height={280}
        role="img"
        aria-label={title ?? "Line chart"}
      >
        {title && (
          <text
            x={PAD_L}
            y={16}
            fontSize={13}
            fontWeight={500}
            fill={INK}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            {title}
          </text>
        )}

        {/* Y gridlines + labels */}
        {yTickValues.map((v, i) => {
          const y = yFor(v);
          return (
            <g key={`y-${i}`}>
              <line
                x1={PAD_L}
                x2={VBW - PAD_R}
                y1={y}
                y2={y}
                stroke={i === 0 ? BORDER : SLATE}
                strokeOpacity={i === 0 ? 0.9 : 0.15}
                strokeWidth={1}
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                fontSize={10.5}
                fill={SLATE}
                textAnchor="end"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                {formatY(v)}
              </text>
            </g>
          );
        })}

        {/* Y axis label */}
        {yLabel && (
          <text
            x={6}
            y={PAD_T + H / 2}
            fontSize={10.5}
            fill={SLATE}
            transform={`rotate(-90 6 ${PAD_T + H / 2})`}
            textAnchor="middle"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            {yLabel}
          </text>
        )}

        {/* line */}
        <path d={path} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" />

        {/* dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={RED}>
            <title>{`${data[i].x}: ${formatY(data[i].y)}`}</title>
          </circle>
        ))}

        {/* X labels */}
        {xLabelIndices.map((i) => {
          const x = xFor(i);
          return (
            <text
              key={`x-${i}`}
              x={x}
              y={VBH - 8}
              fontSize={10.5}
              fill={SLATE}
              textAnchor="middle"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              {data[i].x}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
