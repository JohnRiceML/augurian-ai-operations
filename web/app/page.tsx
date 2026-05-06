"use client";

import { useEffect, useRef, useState } from "react";
import { ChatShell } from "@/components/ChatShell";
import { streamChat } from "@/lib/api";
import type { Message, ToolCall } from "@/lib/types";

const STORAGE_KEY = "augur.messages.v1";
const CLIENT_KEY = "augur.client";
const FOLDER_KEY = "augur.driveFolderId";

function newId() {
  // Random + timestamp. Good enough for client-side message ids; we never
  // round-trip them to the server.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate from localStorage on first render. We avoid useState's lazy
  // initializer so this code doesn't run on the server (where window is
  // undefined). The brief flash of empty state is fine — the EmptyState
  // is the empty state.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // Corrupt localStorage — drop it.
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Persist on change. Skip while streaming — partial assistant messages
  // would survive a crash and look confusingly unfinished.
  useEffect(() => {
    if (streaming) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* quota exceeded — silently drop; v2 will surface this */
    }
  }, [messages, streaming]);

  const handleSubmit = async () => {
    const trimmed = composerValue.trim();
    if (!trimmed || streaming) return;

    const client =
      (typeof window !== "undefined" &&
        window.localStorage.getItem(CLIENT_KEY)) ||
      "sandbox";
    const driveFolderId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(FOLDER_KEY)
        : null;

    const userMsg: Message = {
      id: newId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const assistantMsg: Message = {
      id: newId(),
      role: "assistant",
      content: "",
      toolCalls: [],
      createdAt: Date.now(),
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setComposerValue("");
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    // Build the message list to send: prior turns + the new user turn,
    // each as {role, content}. We don't send tool_calls back to the
    // server — they're regenerated each turn from the system prompt.
    const wireMessages = [
      ...messages
        .filter((m) => m.content) // skip empty/pending turns
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ];

    try {
      for await (const ev of streamChat({
        client,
        messages: wireMessages,
        driveFolderId,
        signal: ac.signal,
      })) {
        setMessages((prev) => applyEvent(prev, assistantMsg.id, ev));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          updateAssistant(prev, assistantMsg.id, (m) => ({
            ...m,
            pending: false,
            content: m.content || "_Stopped._",
          })),
        );
      } else {
        setMessages((prev) =>
          updateAssistant(prev, assistantMsg.id, (m) => ({
            ...m,
            pending: false,
            error: (err as Error).message,
          })),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <ChatShell
      messages={messages}
      composerValue={composerValue}
      onComposerChange={setComposerValue}
      onSubmit={handleSubmit}
      streaming={streaming}
      onStop={handleStop}
    />
  );
}

// Reducer helpers — pulled out of the component so they're easy to read
// and (later) easy to test.

function updateAssistant(
  prev: Message[],
  id: string,
  fn: (m: Message) => Message,
): Message[] {
  return prev.map((m) => (m.id === id ? fn(m) : m));
}

function applyEvent(
  prev: Message[],
  assistantId: string,
  ev: import("@/lib/types").ChatEvent,
): Message[] {
  return updateAssistant(prev, assistantId, (m) => {
    switch (ev.type) {
      case "tool_use": {
        const newCall: ToolCall = {
          // We don't get tool_use_id from the server in events — we
          // generate a client-side id keyed on order + name. That's
          // enough to match the immediately-following tool_result.
          id: `tc-${(m.toolCalls?.length ?? 0)}-${ev.name}`,
          name: ev.name,
          args: ev.args,
          status: "running",
        };
        return { ...m, toolCalls: [...(m.toolCalls ?? []), newCall] };
      }
      case "tool_result": {
        // Match the most recent running call with this name. Server emits
        // tool_use immediately followed by tool_result for each call, so
        // "most recent running with this name" is unambiguous.
        const calls = m.toolCalls ?? [];
        let matched = false;
        const next = calls.map((c) => {
          if (!matched && c.name === ev.name && c.status === "running") {
            matched = true;
            const isErr =
              ev.result &&
              typeof ev.result === "object" &&
              "error" in (ev.result as Record<string, unknown>);
            return {
              ...c,
              result: ev.result,
              status: (isErr ? "error" : "done") as ToolCall["status"],
            };
          }
          return c;
        });
        return { ...m, toolCalls: next };
      }
      case "text_delta":
        return { ...m, content: m.content + ev.text };
      case "done":
        return {
          ...m,
          pending: false,
          usage: {
            in: ev.tokens_in,
            out: ev.tokens_out,
            iterations: ev.iterations,
          },
        };
      case "error":
        return { ...m, pending: false, error: ev.message };
      default:
        return m;
    }
  });
}
