"use client";

// One message in the conversation. The visual difference between user and
// assistant is intentionally small — Apple Messages handles this with
// just bubble color + alignment, and that's all the affordance the
// reader needs.

import { Children, isValidElement, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion } from "framer-motion";
import { ToolCallCard } from "./ToolCallCard";
import { ProcessCallout } from "./ProcessCallout";
import { Widget as WidgetView } from "./widgets/Widget";
import type { Message as Msg } from "@/lib/types";
import { findCitations, type Citation } from "@/lib/citations";
import { parseWidgets, type Widget } from "@/lib/widgets";

// Shared easing for tool-card stagger entry.
const STAGGER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Sentinel format used for citation replacement. We pick a syntax that's
// safe inside markdown — square brackets are common, but `[[CIT:N]]`
// double-bracket isn't a markdown link or image and round-trips through
// remark-gfm unchanged.
const CITATION_SENTINEL_RE = /\[\[CIT:(\d+)\]\]/g;

// Same idea for widgets. The widgets pre-pass swaps `\`\`\`widget {...}\`\`\``
// fences for `[[WIDGET:N]]` before markdown renders. The pass runs BEFORE
// the citation pre-pass; both sentinel families coexist.
const WIDGET_SENTINEL_RE = /\[\[WIDGET:(\d+)\]\]/g;

// Sentinel appended to streaming content so the renderer can place a
// blinking cursor at the END of the last paragraph rather than on a
// fresh row below it. Safe because no real content uses the literal
// triple-bracket form.
const CURSOR_SENTINEL = "[[CURSOR]]";
const CURSOR_SENTINEL_RE = /\[\[CURSOR\]\]/g;

interface CitationPillProps {
  citation: Citation;
  onClick?: (c: Citation) => void;
}

function CitationPill({ citation, onClick }: CitationPillProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(citation);
      }}
      title={`${citation.sourcePath} @ ${citation.anchor}`}
      className="inline-flex items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded font-mono text-[12px] leading-none align-baseline border border-[color:var(--border)] bg-white text-augur-orange hover:bg-[#fff5f5] hover:border-augur-orange/40 transition-colors cursor-pointer"
    >
      <span>{citation.anchor}</span>
      <span aria-hidden="true" className="text-[10px]">↗</span>
    </button>
  );
}

/**
 * Walk a ReactNode tree and replace `[[CIT:N]]` text occurrences with
 * citation pills. Non-string children pass through untouched. We bail on
 * anything inside `<a>` (links nesting buttons is invalid HTML) by simply
 * leaving the sentinel as-is — the markdown renderer turns these back into
 * literal text.
 */
function renderWithCitations(
  children: ReactNode,
  citations: Citation[],
  onClick?: (c: Citation) => void,
): ReactNode {
  if (citations.length === 0) return children;

  const replaceString = (s: string, keyPrefix: string): ReactNode => {
    if (!CITATION_SENTINEL_RE.test(s)) {
      // Reset lastIndex after the test() call.
      CITATION_SENTINEL_RE.lastIndex = 0;
      return s;
    }
    CITATION_SENTINEL_RE.lastIndex = 0;
    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = CITATION_SENTINEL_RE.exec(s)) !== null) {
      const idx = Number(m[1]);
      if (m.index > last) {
        parts.push(s.slice(last, m.index));
      }
      const c = citations[idx];
      if (c) {
        parts.push(
          <CitationPill
            key={`${keyPrefix}-cit-${i}`}
            citation={c}
            onClick={onClick}
          />,
        );
      } else {
        parts.push(m[0]);
      }
      last = m.index + m[0].length;
      i++;
    }
    if (last < s.length) parts.push(s.slice(last));
    return <>{parts}</>;
  };

  const walk = (node: ReactNode, keyPrefix: string): ReactNode => {
    if (typeof node === "string") {
      return replaceString(node, keyPrefix);
    }
    if (Array.isArray(node)) {
      return node.map((n, i) => (
        <span key={`${keyPrefix}-${i}`} style={{ display: "contents" }}>
          {walk(n, `${keyPrefix}-${i}`)}
        </span>
      ));
    }
    if (isValidElement(node)) {
      const el = node as React.ReactElement<{ children?: ReactNode }>;
      // Don't recurse into anchor tags (links can't legally contain buttons)
      // or code blocks (preserve verbatim text).
      if (el.type === "a" || el.type === "code" || el.type === "pre") {
        return el;
      }
      const kids = el.props?.children;
      if (kids == null) return el;
      const walked = walk(kids, `${keyPrefix}-c`);
      // Only re-clone if children would actually differ.
      if (walked === kids) return el;
      // Cast through unknown to keep TS happy across React's prop variance.
      const Cloned = el.type as React.ElementType;
      const newProps = { ...(el.props as Record<string, unknown>), children: walked };
      return <Cloned {...newProps} />;
    }
    return node;
  };

  return walk(children, "root");
}

/**
 * Walk a ReactNode tree and replace `[[CURSOR]]` text occurrences with
 * an inline blinking cursor element. We don't bother bailing on
 * code/links — the sentinel is only injected at the end of streaming
 * markdown, and no realistic streaming content places a literal
 * `[[CURSOR]]` token inside an `<a>` or `<code>`.
 */
function renderWithCursor(children: ReactNode): ReactNode {
  const replaceString = (s: string, keyPrefix: string): ReactNode => {
    if (!CURSOR_SENTINEL_RE.test(s)) {
      CURSOR_SENTINEL_RE.lastIndex = 0;
      return s;
    }
    CURSOR_SENTINEL_RE.lastIndex = 0;
    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = CURSOR_SENTINEL_RE.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      parts.push(<StreamingCursor key={`${keyPrefix}-cur-${i}`} />);
      last = m.index + m[0].length;
      i++;
    }
    if (last < s.length) parts.push(s.slice(last));
    return <>{parts}</>;
  };

  const walk = (node: ReactNode, keyPrefix: string): ReactNode => {
    if (typeof node === "string") return replaceString(node, keyPrefix);
    if (Array.isArray(node)) {
      return node.map((n, i) => (
        <span key={`${keyPrefix}-${i}`} style={{ display: "contents" }}>
          {walk(n, `${keyPrefix}-${i}`)}
        </span>
      ));
    }
    if (isValidElement(node)) {
      const el = node as React.ReactElement<{ children?: ReactNode }>;
      const kids = el.props?.children;
      if (kids == null) return el;
      const walked = walk(kids, `${keyPrefix}-c`);
      if (walked === kids) return el;
      const Cloned = el.type as React.ElementType;
      const newProps = { ...(el.props as Record<string, unknown>), children: walked };
      return <Cloned {...newProps} />;
    }
    return node;
  };

  return walk(children, "root");
}

/**
 * Walk a ReactNode tree replacing `[[WIDGET:N]]` text occurrences with the
 * matching widget component. Same skip rules as citations (don't recurse
 * into <code>/<pre>). Widgets are block-level; the paragraph wrapper is
 * detected upstream so a sentinel on its own line doesn't get jammed
 * inside a <p>.
 */
function renderWithWidgets(
  children: ReactNode,
  widgets: Widget[],
): ReactNode {
  if (widgets.length === 0) return children;

  const replaceString = (s: string, keyPrefix: string): ReactNode => {
    if (!WIDGET_SENTINEL_RE.test(s)) {
      WIDGET_SENTINEL_RE.lastIndex = 0;
      return s;
    }
    WIDGET_SENTINEL_RE.lastIndex = 0;
    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = WIDGET_SENTINEL_RE.exec(s)) !== null) {
      const idx = Number(m[1]);
      if (m.index > last) parts.push(s.slice(last, m.index));
      const w = widgets[idx];
      if (w) {
        parts.push(<WidgetView key={`${keyPrefix}-w-${i}`} widget={w} />);
      } else {
        parts.push(m[0]);
      }
      last = m.index + m[0].length;
      i++;
    }
    if (last < s.length) parts.push(s.slice(last));
    return <>{parts}</>;
  };

  const walk = (node: ReactNode, keyPrefix: string): ReactNode => {
    if (typeof node === "string") return replaceString(node, keyPrefix);
    if (Array.isArray(node)) {
      return node.map((n, i) => (
        <span key={`${keyPrefix}-${i}`} style={{ display: "contents" }}>
          {walk(n, `${keyPrefix}-${i}`)}
        </span>
      ));
    }
    if (isValidElement(node)) {
      const el = node as React.ReactElement<{ children?: ReactNode }>;
      if (el.type === "a" || el.type === "code" || el.type === "pre") return el;
      const kids = el.props?.children;
      if (kids == null) return el;
      const walked = walk(kids, `${keyPrefix}-c`);
      if (walked === kids) return el;
      const Cloned = el.type as React.ElementType;
      const newProps = { ...(el.props as Record<string, unknown>), children: walked };
      return <Cloned {...newProps} />;
    }
    return node;
  };

  return walk(children, "root");
}

/**
 * If `children` is a flat list of widget sentinels (and only that — possibly
 * with whitespace between them), return the parsed widget indexes so the
 * caller can render them as block-level cards instead of stuffing them into
 * a `<p>` (which is invalid HTML — a `<div>` widget can't legally nest in
 * `<p>`).
 *
 * Returns `null` for "this paragraph has prose mixed in, render normally."
 */
function widgetIndexesIfWholeParagraph(children: ReactNode): number[] | null {
  const indexes: number[] = [];
  const visit = (node: ReactNode): boolean => {
    if (node == null || typeof node === "boolean") return true;
    if (typeof node === "string") {
      // Strip the sentinels from the string and check what's left. If only
      // whitespace remains, the string contributes only widget refs.
      let cursor = 0;
      let m: RegExpExecArray | null;
      const re = new RegExp(WIDGET_SENTINEL_RE.source, "g");
      while ((m = re.exec(node)) !== null) {
        const between = node.slice(cursor, m.index);
        if (between.trim() !== "") return false;
        indexes.push(Number(m[1]));
        cursor = m.index + m[0].length;
      }
      const tail = node.slice(cursor);
      if (tail.trim() !== "") return false;
      return true;
    }
    if (typeof node === "number") return false;
    if (Array.isArray(node)) {
      for (const n of node) if (!visit(n)) return false;
      return true;
    }
    return false;
  };
  if (!visit(children)) return null;
  return indexes.length > 0 ? indexes : null;
}

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

/**
 * Three bouncing dots placed on a single baseline. Each dot phases its
 * opacity 0.3 → 1 → 0.3 with a 200ms offset from its neighbor — the
 * classic chat-app "agent is thinking" affordance, in muted slate so it
 * doesn't compete with the content that's about to land on top of it.
 */
function ThinkingDots() {
  return (
    <div
      className="flex items-center gap-1.5 text-muted dark:text-muted-dark"
      aria-label="Agent is thinking"
      role="status"
    >
      <span className="text-[14px]">Thinking</span>
      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-[4px] w-[4px] rounded-full"
            style={{ background: "currentColor" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.0,
              ease: "easeInOut",
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * Same animation as ThinkingDots but with a "Reasoning" label. Shown
 * between events from Anthropic — armed by an `iteration_start` SSE
 * event and cleared the moment the next event lands. Slots between the
 * tool cards (above) and the streaming prose (below), so the visual
 * lives at the boundary where "what comes next" is open.
 */
function ReasoningDots() {
  return (
    <div
      className="flex items-center gap-1.5 text-muted dark:text-muted-dark my-2"
      aria-label="Agent is reasoning"
      role="status"
    >
      <span className="text-[13px]">Reasoning</span>
      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-[4px] w-[4px] rounded-full"
            style={{ background: "currentColor" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.0,
              ease: "easeInOut",
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * Thin 1px-wide caret that follows the last streamed character. We use
 * an inline-block span so it sits on the text baseline of whatever
 * trailing inline element the markdown renderer produced, rather than
 * a block — that way it shows up at the end of the last line, not on a
 * fresh row below it.
 */
function StreamingCursor() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-[1px] inline-block align-text-bottom"
      style={{
        width: "1px",
        height: "1em",
        background: "var(--ink)",
        verticalAlign: "-0.1em",
      }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.0, ease: "easeInOut", repeat: Infinity }}
    />
  );
}

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

interface MessageProps {
  message: Msg;
  onCitationClick?: (c: Citation) => void;
}

/**
 * Pre-process raw markdown to swap each citation occurrence with a
 * sentinel token. We return the rewritten text and the citation list so
 * the renderer can re-inject pills at sentinel positions.
 *
 * Tradeoff: citations that fall inside fenced code blocks or inline
 * `code` will still get sentinel-rewritten in the source string, but the
 * renderer skips replacement inside <code>/<pre> elements (see
 * renderWithCitations) so they show as literal `[[CIT:N]]` text in code.
 * That's acceptable — citations in code spans are a non-goal.
 */
function rewriteCitations(content: string): {
  rewritten: string;
  citations: Citation[];
} {
  const citations = findCitations(content);
  if (citations.length === 0) return { rewritten: content, citations };
  let out = "";
  let cursor = 0;
  // Walk citations in order, replacing each rawText occurrence by index.
  citations.forEach((c, i) => {
    const idx = content.indexOf(c.rawText, cursor);
    if (idx === -1) return;
    out += content.slice(cursor, idx);
    out += `[[CIT:${i}]]`;
    cursor = idx + c.rawText.length;
  });
  out += content.slice(cursor);
  return { rewritten: out, citations };
}

export function Message({ message, onCitationClick }: MessageProps) {
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
  // Pre-event placeholder: the SSE stream hasn't delivered any text or
  // tool_use yet, but we know we're waiting on the agent.
  const showThinkingDots = message.pending && !message.content && !hasTools;
  // Cursor caret while text is actively streaming in.
  const showCursor = message.pending && !!message.content;
  // "Reasoning..." indicator: armed by iteration_start, cleared the moment
  // any other event lands (text_delta, tool_use, tool_result, done, error
  // — see applyEvent in page.tsx). Only meaningful AFTER something has
  // already happened in this turn — for a fresh turn we still show
  // "Thinking...". So gate on (hasTools || content > 0).
  const showReasoningDots =
    message.pending &&
    !!message.isReasoning &&
    (hasTools || message.content.length > 0);
  // Two pre-passes: widgets first, then citations. Both leave sentinels in
  // the markdown string that the renderer below swaps for components.
  // While streaming, we also append a CURSOR sentinel so the blinking
  // caret renders inline at the end of the most-recent text — handled by
  // renderWithCursor below.
  const { rewritten, citations, widgets } = useMemo(() => {
    const raw = message.content || "";
    const { widgets: parsed, contentWithSentinels } = parseWidgets(raw);
    const { rewritten, citations } = rewriteCitations(contentWithSentinels);
    const withCursor = showCursor ? rewritten + CURSOR_SENTINEL : rewritten;
    return { rewritten: withCursor, citations, widgets: parsed.map((w) => w.widget) };
  }, [message.content, showCursor]);
  // Build the components map once per render — the wrap function closes
  // over the current citations + widgets and the click handler.
  const components = useMemo(() => {
    const wrap =
      (Tag: keyof JSX.IntrinsicElements, base: any) =>
      ({ children, ...rest }: any) => {
        // For paragraphs that contain ONLY widget sentinels, render the
        // widgets as block-level cards instead of nesting <div>s in <p>
        // (invalid HTML — React will hydrate-error). For mixed content
        // we fall through to the normal wrap path; widget sentinels in
        // mid-prose still render via renderWithWidgets.
        if (Tag === "p") {
          const onlyWidgets = widgetIndexesIfWholeParagraph(children);
          if (onlyWidgets) {
            return (
              <>
                {onlyWidgets.map((idx, i) => {
                  const w = widgets[idx];
                  if (!w) return null;
                  return <WidgetView key={`pw-${idx}-${i}`} widget={w} />;
                })}
              </>
            );
          }
        }
        const withCitations = renderWithCitations(
          children,
          citations,
          onCitationClick,
        );
        const withWidgets = renderWithWidgets(withCitations, widgets);
        const wrapped = renderWithCursor(withWidgets);
        return base
          ? base({ children: wrapped, ...rest })
          : (
              <Tag {...rest}>
                {wrapped as any}
              </Tag>
            );
      };
    return {
      ...MD_COMPONENTS,
      p: wrap("p", MD_COMPONENTS.p),
      li: wrap("li", MD_COMPONENTS.li),
      td: wrap("td", MD_COMPONENTS.td),
      th: wrap("th", MD_COMPONENTS.th),
      strong: wrap("strong", MD_COMPONENTS.strong),
    };
  }, [citations, widgets, onCitationClick]);
  return (
    <div className="group flex justify-start animate-fade-in">
      <div className="flex flex-col items-start gap-1 max-w-[85%] sm:max-w-[80%]">
        <div
          className="rounded-bubble bg-[color:var(--surface)] border border-[color:var(--border)] px-4 py-3 text-[15px] leading-relaxed text-ink dark:text-ink-dark"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {hasTools && (
            <>
              <ProcessCallout toolCalls={message.toolCalls!} />
              <div className="mb-3 space-y-1.5">
                <AnimatePresence initial={false}>
                  {message.toolCalls!.map((tc, i) => (
                    <motion.div
                      key={tc.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{
                        duration: 0.22,
                        ease: STAGGER_EASE,
                        delay: i * 0.06,
                      }}
                    >
                      <ToolCallCard call={tc} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
          {showThinkingDots && <ThinkingDots />}
          {showReasoningDots && <ReasoningDots />}
          {message.content && (
            <div className="text-ink dark:text-ink-dark break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {rewritten}
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
