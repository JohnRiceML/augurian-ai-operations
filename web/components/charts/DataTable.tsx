// Quiet, scannable table for tool results. Tailwind handles the layout;
// the goal is just enough chrome to be legible without competing with
// the chat itself.

import * as React from "react";

export interface DataTableColumn {
  key: string;
  label: string;
  format?: (v: unknown) => string;
  align?: "left" | "right";
}

export interface DataTableProps {
  rows: Record<string, unknown>[];
  columns?: DataTableColumn[];
  maxRows?: number;
}

function defaultFormat(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return v ? "true" : "false";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function inferColumns(rows: Record<string, unknown>[]): DataTableColumn[] {
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) keys.add(k);
  }
  return Array.from(keys).map((k) => ({
    key: k,
    label: k,
    align: typeof rows[0]?.[k] === "number" ? "right" : "left",
  }));
}

export function DataTable({
  rows,
  columns,
  maxRows = 25,
}: DataTableProps): React.ReactElement {
  const cols = columns && columns.length > 0 ? columns : inferColumns(rows);
  const visible = rows.slice(0, maxRows);
  const hidden = rows.length - visible.length;

  return (
    <div className="w-full overflow-x-auto">
      <table
        className="w-full border-collapse"
        style={{ fontSize: "13.5px" }}
      >
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className="border-b border-t border-[color:var(--border)] py-1.5 px-2 font-medium"
                style={{
                  color: "#5B6F7A",
                  textAlign: c.align ?? "left",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => {
                const raw = row[c.key];
                const text = c.format ? c.format(raw) : defaultFormat(raw);
                return (
                  <td
                    key={c.key}
                    className="border-b border-[color:var(--border)] py-1.5 px-2 align-top"
                    style={{
                      color: "var(--ink)",
                      textAlign: c.align ?? "left",
                    }}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div
          className="mt-1 text-[12px]"
          style={{ color: "#5B6F7A" }}
        >
          + {hidden} more
        </div>
      )}
    </div>
  );
}
