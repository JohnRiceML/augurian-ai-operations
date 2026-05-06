"use client";

// One message in the conversation. The visual difference between user and
// assistant is intentionally small — Apple Messages handles this with
// just bubble color + alignment, and that's all the affordance the
// reader needs.

import { useState } from "react";
import { ToolCallCard } from "./ToolCallCard";
import type { Message as Msg } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="copy message"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* no-op — older browsers / blocked permissions */
        }
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark text-[11px] flex items-center gap-1"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function Message({ message }: { message: Msg }) {
  if (message.role === "user") {
    return (
      <div className="group flex justify-end animate-fade-in">
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          <div
            className="rounded-bubble px-4 py-2.5 text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words"
            style={{
              backgroundColor: "var(--augur-orange)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {message.content}
          </div>
          <CopyButton text={message.content} />
        </div>
      </div>
    );
  }

  // Assistant
  const hasTools = (message.toolCalls?.length ?? 0) > 0;
  const showShimmer = message.pending && !message.content && !hasTools;
  return (
    <div className="group flex justify-start animate-fade-in">
      <div className="flex flex-col items-start gap-1 max-w-[85%] sm:max-w-[80%]">
        <div
          className="rounded-bubble bg-[color:var(--surface)] border border-[color:var(--border)] px-4 py-3 text-[15px] leading-relaxed text-ink dark:text-ink-dark"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {hasTools && (
            <div className="mb-3 space-y-1.5">
              {message.toolCalls!.map((tc) => (
                <ToolCallCard key={tc.id} call={tc} />
              ))}
            </div>
          )}
          {showShimmer && (
            <div className="flex items-center gap-2 text-muted dark:text-muted-dark">
              <span className="h-2 w-2 rounded-full bg-augur-orange animate-shimmer" />
              <span className="text-[13.5px]">Thinking…</span>
            </div>
          )}
          {message.content && (
            <div className="prose-msg">{message.content}</div>
          )}
          {message.error && !message.content && (
            <div className="text-rose-600 dark:text-rose-400 text-[13.5px]">
              {message.error}
            </div>
          )}
        </div>
        <div className="flex w-full items-center justify-between gap-3 px-1 text-[11.5px]">
          {message.usage ? (
            <span className="text-muted dark:text-muted-dark">
              in {message.usage.in.toLocaleString()} / out{" "}
              {message.usage.out.toLocaleString()} tokens · {message.usage.iterations} iteration
              {message.usage.iterations === 1 ? "" : "s"}
            </span>
          ) : (
            <span />
          )}
          {message.content && <CopyButton text={message.content} />}
        </div>
      </div>
    </div>
  );
}
