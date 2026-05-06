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
// Augurian-red user-message bubble.
export const SERVICE_PRIMARY: Record<Service, string> = {
  drive: "#0066DA",  // Drive blue (matches the canonical 2020 logo)
  ga4: "#F9AB00",    // GA4 orange
  gsc: "#34A853",    // GSC green (for visual separation from Drive blue)
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

// Google Drive — canonical 2020 multicolor logo. Six paths sourced from
// Wikimedia Commons (Google's brand-kit version).
function DriveLogo({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 87.3 78"
      className={className}
      aria-hidden="true"
    >
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
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

// Google Search Console — canonical SimpleIcons mark (Google's official
// abstract Search-Console glyph: a server/monitor with a chart and gauge).
function GSCLogo({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#458CF5"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.548 1.156L6.832 2.872v1.682h1.716zm0 3.398v.035H6.832v-.035H3.386L0 7.844v3.577h2.826V8.94c0-.525.429-.954.954-.954h16.476c.525 0 .954.43.954.954v2.48h2.754V7.844l-3.386-3.29H17.3v.035h-1.717v-.035zm7.035 0H17.3V2.872l-1.717-1.716zM8.679 1.188V2.84h6.773V1.188zm11.471 7.07a.834.834 0 00-.132.01l-.543.002c-5.216.014-10.432-.008-15.648.01-.435-.063-.794.436-.716.883v2.264h17.812c-.016-.888.045-1.782-.034-2.666-.104-.342-.427-.502-.739-.502zm-15.422.634a.689.698 0 01.689.698.689.698 0 01-.689.697.689.698 0 01-.688-.697.689.698 0 01.688-.698zm2.134 0a.689.698 0 01.689.698.689.698 0 01-.689.697.689.698 0 01-.688-.697.689.698 0 01.688-.698zM.036 11.645v9.156c0 1.05.858 1.908 1.907 1.908h.883V11.645zm21.174 0v11.064h.882c1.05 0 1.908-.858 1.908-1.908v-9.156zM4.057 13.133v6.85h6.137v-6.85zm13.243.021v3.777l-1.708.977-1.708-.977v-3.758a4.006 4.006 0 000 7.23v2.441h3.457v-2.442a4.006 4.006 0 00-.041-7.248zm-13.243 8.26v1.43h7.925v-1.43z" />
    </svg>
  );
}
