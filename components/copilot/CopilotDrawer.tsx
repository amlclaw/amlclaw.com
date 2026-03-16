"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import CopilotMessage from "./CopilotMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "amlclaw-copilot-messages";

const SUGGESTIONS = [
  "最近高风险筛查有哪些？",
  "MAS 对混币器怎么规定？",
  "解释一下当前筛查结果",
];

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch { /* */ }
}

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CopilotDrawer({ open, onClose }: CopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      setMessages(loadMessages());
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Get copilot context
    const context = typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>).__amlclaw_copilot_context as Record<string, unknown> | undefined
      : undefined;

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, context }),
      });

      if (!res.ok) {
        const err = await res.text();
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                assistantContent += `\n\n⚠️ ${parsed.error}`;
              } else if (parsed.text) {
                assistantContent += parsed.text;
              }
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev.slice(0, -1).length === prev.length ? prev : prev,
        { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className={`copilot-drawer ${open ? "copilot-drawer-open" : ""}`}>
      <div className="copilot-drawer-header">
        <span>🤖 AML Copilot</span>
        <div style={{ display: "flex", gap: 8 }}>
          {messages.length > 0 && (
            <button className="copilot-header-btn" onClick={clearHistory} title="Clear history">
              🗑️
            </button>
          )}
          <button className="copilot-header-btn" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="copilot-messages">
        {messages.length === 0 ? (
          <div className="copilot-empty">
            <div className="copilot-empty-icon">🤖</div>
            <p>Hi! I&apos;m your AML compliance assistant. Ask me about regulations, screening results, or compliance requirements.</p>
            <div className="copilot-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="copilot-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <CopilotMessage
              key={i}
              role={m.role}
              content={m.content}
              isLoading={isStreaming && i === messages.length - 1 && m.role === "assistant" && !m.content}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="copilot-input">
        <textarea
          ref={textareaRef}
          className="copilot-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about AML compliance..."
          rows={1}
          disabled={isStreaming}
        />
        <button
          className="copilot-send"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
        >
          {isStreaming ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
}
