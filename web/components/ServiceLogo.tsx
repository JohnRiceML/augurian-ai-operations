// Inline SVG service logos for Drive, GA4, GSC. Kept simple — no gradients,
// no filters, recognizable at 16px. Matches the colors in each brand's
// public press kit.

import * as React from "react";

export type Service = "drive" | "ga4" | "gsc";

export type ToolName =
  | "query_commitments"
  | "get_meeting_details"
  | "list_meetings"
  | "read_meeting_summary"
  | "read_meeting_transcript"
  | "query_ga4"
  | "query_gsc";

const TOOL_TO_SERVICE: Record<ToolName, Service> = {
  query_commitments: "drive",
  get_meeting_details: "drive",
  list_meetings: "drive",
  read_meeting_summary: "drive",
  read_meeting_transcript: "drive",
  query_ga4: "ga4",
  query_gsc: "gsc",
};

const SERVICE_LABELS: Record<Service, string> = {
  drive: "Drive",
  ga4: "GA4",
  gsc: "Search Console",
};

// Primary brand color used for the card border tint. Each service gets a
// distinct hue so they're visually separable from each other AND from the
// Augurian-blue user-message bubble.
export const SERVICE_PRIMARY: Record<Service, string> = {
  drive: "#4285F4",  // Drive blue
  ga4: "#F9AB00",    // GA4 orange
  gsc: "#34A853",    // GSC green (was blue — clashed with Drive + accent)
};

export function serviceForTool(tool: string): Service {
  if (tool in TOOL_TO_SERVICE) {
    return TOOL_TO_SERVICE[tool as ToolName];
  }
  // Fallback — most unknown tools today are Drive-backed.
  return "drive";
}

export function ServiceLabel({ service }: { service: Service }): string {
  return SERVICE_LABELS[service];
}

interface ServiceLogoProps {
  service: Service;
  size?: number;
  className?: string;
}

export function ServiceLogo({
  service,
  size = 16,
  className,
}: ServiceLogoProps): React.ReactElement {
  if (service === "drive") return <DriveLogo size={size} className={className} />;
  if (service === "ga4") return <GA4Logo size={size} className={className} />;
  return <GSCLogo size={size} className={className} />;
}

// Google Drive — yellow triangle (top-left) + green triangle (top-right) +
// blue trapezoid (bottom). Three colors meeting in the canonical Drive shape.
function DriveLogo({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Yellow triangle (top-left wedge) */}
      <path d="M8 3 L13 11 L3 11 Z" fill="#FBBC04" />
      {/* Green triangle (top-right wedge) */}
      <path d="M16 3 L21 11 L11 11 Z" fill="#0F9D58" />
      {/* Blue trapezoid (bottom front face) */}
      <path d="M3 11 L7 19 L17 19 L21 11 Z" fill="#4285F4" />
    </svg>
  );
}

// Google Analytics 4 — orange step-chart bars.
function GA4Logo({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* tall right bar */}
      <rect x="16" y="3" width="4.5" height="18" rx="2.25" fill="#F9AB00" />
      {/* mid bar */}
      <rect x="9.75" y="9" width="4.5" height="12" rx="2.25" fill="#E37400" />
      {/* short left bar (dot-ish) */}
      <rect x="3.5" y="15" width="4.5" height="6" rx="2.25" fill="#F9AB00" />
    </svg>
  );
}

// Google Search Console — magnifying glass with a 3-bar chart inside.
// Reads as "search analytics" rather than generic search.
function GSCLogo({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Magnifying glass lens */}
      <circle cx="10" cy="10" r="6.5" stroke="#4285F4" strokeWidth="2" fill="#FFFFFF" />
      {/* Bar chart inside, ascending: blue → green → yellow */}
      <rect x="6.5" y="9.5" width="1.6" height="3" fill="#4285F4" />
      <rect x="9.2" y="7.5" width="1.6" height="5" fill="#34A853" />
      <rect x="11.9" y="6" width="1.6" height="6.5" fill="#FBBC04" />
      {/* Magnifying handle */}
      <line
        x1="14.7"
        y1="14.7"
        x2="20"
        y2="20"
        stroke="#4285F4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
