"use client";

// First-paint of the chat. Apple-restrained: a single heading, three
// example questions, generous whitespace. No illustrations, no marketing
// copy. The heading is intentionally a question, not an instruction —
// that maps better to how partners actually use the tool.

import { ServiceLogo, type Service } from "./ServiceLogo";

const EXAMPLES = [
  "What's overdue across all my client meetings?",
  "Did the SEO change Sara discussed in the May 4 call work?",
  "Summarize the Helmsley situation.",
];

const CAPABILITIES: { service: Service; label: string }[] = [
  { service: "drive", label: "Read your meeting transcripts" },
  { service: "ga4", label: "Pull live GA4 metrics" },
  { service: "gsc", label: "Query Search Console" },
];

interface EmptyStateProps {
  onPickExample: (text: string) => void;
}

export function EmptyState({ onPickExample }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-chat text-center animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.service}
              className="flex w-full max-w-[260px] sm:w-[180px] flex-col items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-center"
            >
              <ServiceLogo service={cap.service} size={28} />
              <span className="text-[13px] text-muted dark:text-muted-dark leading-snug">
                {cap.label}
              </span>
            </div>
          ))}
        </div>
        <h1
          className="font-semibold tracking-tight text-[28px] sm:text-[32px]"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.15 }}
        >
          Ask about your meetings or your data.
        </h1>
        <p className="mt-4 text-[15px] text-muted dark:text-muted-dark">
          Tap an example, or type your own question below.
        </p>
        <div className="mt-10 flex flex-col gap-3">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPickExample(q)}
              className="group rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 text-left text-[15px] text-ink dark:text-ink-dark transition-colors hover:border-augur-orange/60 hover:bg-augur-orange/5"
            >
              <span className="text-muted dark:text-muted-dark transition-colors group-hover:text-ink dark:group-hover:text-ink-dark">
                {q}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
