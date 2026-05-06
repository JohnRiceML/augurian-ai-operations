"use client";

// Auto-resizing textarea + circular send button. Keyboard contract:
//   - Enter inserts a newline.
//   - Cmd+Enter (Mac) / Ctrl+Enter (everywhere else) submits.
// This matches Slack and ChatGPT and plays nicely with the long-form
// questions partners actually ask ("here's a paragraph of context, then
// my question").

import { useEffect, useRef } from "react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  /** While true, show a "stop" button instead of "send". */
  streaming: boolean;
  onStop?: () => void;
}

const MAX_ROWS = 6;
// 15px font * 1.5 leading ≈ 22.5px per row. Round to 23 for crispness.
const ROW_PX = 23;

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  streaming,
  onStop,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reset to measure scrollHeight against content. Cap at MAX_ROWS.
    el.style.height = "auto";
    const max = ROW_PX * MAX_ROWS + 16; // include vertical padding
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className="flex w-full items-end gap-3 rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2.5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        rows={1}
        placeholder="Ask about your meetings, GA4, or Search Console…"
        className="min-h-[28px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none"
      />
      {streaming && onStop ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="stop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-ink dark:text-ink-dark transition-transform active:scale-95"
        >
          {/* Stop icon (square) */}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="send"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-100 active:scale-95 ${
            canSend
              ? "bg-augur-orange hover:bg-augur-orange-700"
              : "bg-[color:var(--border)] cursor-not-allowed"
          }`}
        >
          {/* Up arrow */}
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      )}
    </form>
  );
}
