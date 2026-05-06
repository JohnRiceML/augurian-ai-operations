"use client";

// One message in the conversation. The visual difference between user and
// assistant is intentionally small — Apple Messages handles this with
// just bubble color + alignment, and that's all the affordance the
// reader needs.

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallCard } from "./ToolCallCard";
import type { Message as Msg } from "@/lib/types";

// Tailwind class overrides for assistant markdown. Tight type sizes and
// generous line-height — no `prose` plugin, this is the whole list.
const MD_COMPONENTS = {
  h1: (props: any) => (
    <h1 className="text-[20px] font-semibold mt-3 mb-1" {...props} />
  ),
  h2: (props: any) => (
    <h2 className="text-[17px] font-semibold mt-3 mb-1" {...props} />
  ),
  h3: (props: any) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1" {...props} />
  ),
  p: (props: any) => (
    <p className="text-[15px] leading-relaxed my-2" {...props} />
  ),
  ul: (props: any) => (
    <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
  ),
  ol: (props: any) => (
    <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
  ),
  li: (props: any) => (
    <li className="text-[15px] leading-relaxed" {...props} />
  ),
  a: (props: any) => (
    <a className="text-augur-orange hover:underline" {...props} />
  ),
  strong: (props: any) => (
    <strong className="font-semibold text-ink dark:text-ink-dark" {...props} />
  ),
  // Inline code vs fenced code: react-markdown passes `inline` boolean.
  code: ({ inline, className, children, ...rest }: any) => {
    if (inline) {
      return (
        <code
          className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-[color:var(--bg)] border border-[color:var(--border)]"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
  pre: (props: any) => (
    <pre
      className="font-mono text-[12.5px] p-3 rounded-md bg-[color:var(--bg)] border border-[color:var(--border)] overflow-x-auto my-2"
      {...props}
    />
  ),
  table: ({ children, ...rest }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="text-[14px]" {...rest}>
        {children}
      </table>
    </div>
  ),
  th: (props: any) => (
    <th
      className="text-left font-semibold border-b border-[color:var(--border)] py-1.5 pr-4"
      {...props}
    />
  ),
  td: (props: any) => <td className="py-1.5 pr-4 align-top" {...props} />,
};

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
            <div className="text-ink dark:text-ink-dark break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MD_COMPONENTS}
              >
                {message.content}
              </ReactMarkdown>
            </div>
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
