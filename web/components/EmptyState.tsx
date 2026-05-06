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

// Two-line capability card content. The title is the verb-phrase a
// partner would say out loud ("read meetings"); the descriptor names
// the underlying source so the card answers "from where?" without
// turning into a paragraph.
const CAPABILITIES: { service: Service; title: string; detail: string }[] = [
  {
    service: "drive",
    title: "Read meetings",
    detail: "Drive transcripts + extracted commitments",
  },
  {
    service: "ga4",
    title: "Pull GA4 metrics",
    detail: "Live analytics by client property",
  },
  {
    service: "gsc",
    title: "Query Search Console",
    detail: "Clicks, impressions, queries by site",
  },
];

interface EmptyStateProps {
  onPickExample: (text: string) => void;
}

export function EmptyState({ onPickExample }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-chat text-center animate-fade-in">
        <div className="mb-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.service}
              className="flex w-full sm:w-[200px] flex-col items-center gap-2 rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-5 text-center hover:border-augur-orange/40 hover:-translate-y-px"
              style={{
                transition:
                  "border-color var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out)",
              }}
            >
              <ServiceLogo service={cap.service} size={32} />
              <span className="mt-1 text-[13.5px] font-semibold text-ink dark:text-ink-dark leading-tight">
                {cap.title}
              </span>
              <span className="text-[12px] text-muted dark:text-muted-dark leading-snug">
                {cap.detail}
              </span>
            </div>
          ))}
        </div>
        <h1
          className="font-semibold tracking-tight text-[28px] sm:text-[32px]"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.15 }}
        >
          Ask about your meetings or your data
          {/* On-brand period: same color as the send button, same hue
           * as the focus halo. Quiet, but it makes the heading feel
           * like part of the product instead of a placeholder. */}
          <span style={{ color: "var(--augur-orange)" }}>.</span>
        </h1>
        <p className="mt-4 text-[15px] text-muted dark:text-muted-dark">
          Tap an example, or type your own question below.
        </p>
        <div className="mt-10 flex flex-col gap-2.5">
          {EXAMPLES.map((q, i) => (
            <button
              key={q}
              type="button"
              onClick={() => onPickExample(q)}
              // Red-tinted 3px left rail on hover — turns the card into
              // an obvious target without adding a visible CTA. Stagger
              // the fade-in so the three items cascade rather than pop.
              className="group rounded-card border border-l-[3px] border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3.5 text-left text-[15px] text-ink dark:text-ink-dark hover:border-l-augur-orange hover:border-[color:var(--border)] hover:bg-augur-orange/[0.03] animate-fade-in"
              style={{
                animationDelay: `${i * 60}ms`,
                animationFillMode: "both",
                transition:
                  "background-color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out)",
              }}
            >
              <span className="text-muted dark:text-muted-dark group-hover:text-ink dark:group-hover:text-ink-dark"
                style={{ transition: "color var(--motion-fast) var(--ease-out)" }}
              >
                {q}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
