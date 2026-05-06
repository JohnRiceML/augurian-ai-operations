"use client";

// The frame around the chat. Top bar (logo + connection pills + settings),
// scrollable main area (messages or empty state), composer pinned to the
// bottom. We keep the top bar sticky and the composer sticky at the
// bottom so the messages always have a clear scroll axis.

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ConnectionPills } from "./ConnectionPills";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import { Message as MessageRow } from "./Message";
import type { Message } from "@/lib/types";

interface ChatShellProps {
  messages: Message[];
  composerValue: string;
  onComposerChange: (value: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  onStop?: () => void;
}

export function ChatShell({
  messages,
  composerValue,
  onComposerChange,
  onSubmit,
  streaming,
  onStop,
}: ChatShellProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastLenRef = useRef(0);

  // Auto-scroll on new content, but only if the user is already at the
  // bottom — don't yank them away from a message they're reading. The
  // 200px slack is intentional: people scroll up a little to re-read.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const totalChars = messages.reduce(
      (n, m) => n + m.content.length + (m.toolCalls?.length ?? 0) * 50,
      0,
    );
    const grew = totalChars > lastLenRef.current;
    lastLenRef.current = totalChars;
    if (!grew) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex h-dvh w-full flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--bg)]/80 px-4 sm:px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Augurian — agent home"
          >
            {/* Real Augurian wordmark — triangle + "AUGURIAN" letters in
             * one SVG. Public/logo.svg is the official brand asset
             * (Adobe Illustrator export from the user's brand kit). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="Augurian"
              height={22}
              style={{ height: 22, width: "auto" }}
            />
            <span className="text-muted dark:text-muted-dark text-[14px]">— agent</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionPills />
          <Link
            href="/settings"
            aria-label="settings"
            className="rounded-full p-1.5 text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
          >
            {/* Gear icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M9 1.5v2M9 14.5v2M14.5 9h2M1.5 9h2M13.1 4.9l1.4-1.4M3.5 14.5l1.4-1.4M13.1 13.1l1.4 1.4M3.5 3.5l1.4 1.4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      {/* Scrollable main */}
      <main
        ref={scrollerRef}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <EmptyState onPickExample={onComposerChange} />
        ) : (
          <div className="mx-auto w-full max-w-chat px-4 sm:px-6 py-8 space-y-4">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>
        )}
      </main>

      {/* Composer */}
      <div className="border-t border-[color:var(--border)] bg-[color:var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-chat px-4 sm:px-6 py-3 sm:py-4">
          <Composer
            value={composerValue}
            onChange={onComposerChange}
            onSubmit={onSubmit}
            disabled={streaming}
            streaming={streaming}
            onStop={onStop}
          />
          <p className="mt-2 text-center text-[11.5px] text-muted dark:text-muted-dark">
            Drafter pattern — nothing is sent externally. Cmd+Enter to send.
          </p>
        </div>
      </div>
    </div>
  );
}
