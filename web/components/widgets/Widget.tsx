"use client";

// Single dispatch entry point for widget rendering. Switches on
// `widget.type` and forwards to the per-type component. Keeps Message.tsx
// from needing to know about every widget shape.

import * as React from "react";
import { Stat } from "./Stat";
import { KPIGrid } from "./KPIGrid";
import { Comparison } from "./Comparison";
import { AgentChart } from "./AgentChart";
import type { Widget as WidgetT } from "@/lib/widgets";

interface WidgetProps {
  widget: WidgetT;
}

export function Widget({ widget }: WidgetProps): React.ReactElement | null {
  switch (widget.type) {
    case "stat":
      return <Stat widget={widget} />;
    case "kpi_grid":
      return <KPIGrid widget={widget} />;
    case "comparison":
      return <Comparison widget={widget} />;
    case "bar":
    case "line":
    case "table":
      return <AgentChart widget={widget} />;
    default:
      return null;
  }
}
