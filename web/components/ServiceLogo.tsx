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

// Primary brand color used for the card border tint.
export const SERVICE_PRIMARY: Record<Service, string> = {
  drive: "#4285F4",
  ga4: "#F9AB00",
  gsc: "#4285F4",
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

// Google Drive — three-color triangle approximation.
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
      {/* blue left wedge */}
      <path d="M3.5 17.5 8 9.5h8L11.5 17.5H3.5Z" fill="#4285F4" />
      {/* yellow right wedge */}
      <path d="M16 9.5h-8L12 2.5h4l4 7H16Z" fill="#FBBC04" />
      {/* green bottom-right wedge */}
      <path d="M11.5 17.5 16 9.5h4l-4.5 8H11.5Z" fill="#34A853" />
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

// Google Search Console — magnifying glass over Google blue.
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
      <circle cx="10.5" cy="10.5" r="6" stroke="#4285F4" strokeWidth="2.25" fill="none" />
      <line
        x1="15.2"
        y1="15.2"
        x2="20.5"
        y2="20.5"
        stroke="#4285F4"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* small Google-G accents inside the lens */}
      <path d="M8 10.5h2.5" stroke="#EA4335" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M10.5 8v2.5" stroke="#34A853" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M11 12.8l1.5-1.5" stroke="#FBBC04" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
