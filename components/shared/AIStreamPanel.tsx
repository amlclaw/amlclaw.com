"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { renderMarkdown } from "@/lib/utils";

interface Props {
  endpoint: string;
  body: Record<string, unknown>;
  active: boolean;
  onComplete?: (id: string) => void;
  onError?: (error: string) => void;
}

export default function AIStreamPanel({ endpoint, body, active, onComplete, onError }: Props) {
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);
  const cancelledRef = useRef(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const stopStream = useCallback(() => {
    cancelledRef.current = true;
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setStatus("done");
  }, []);

  useEffect(() => {
    if (!active) return;

    cancelledRef.current = false;
    readerRef.current = null;

    setOutput("");
    setStatus("streaming");
    setElapsed(0);
    startTimeRef.current = Date.now();

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (cancelledRef.current) return;

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          if (!cancelledRef.current) {
            setStatus("error");
            onError?.(err.error || "Request failed");
          }
          clearInterval(timer);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          if (!cancelledRef.current) setStatus("error");
          clearInterval(timer);
          return;
        }

        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";
        let gotDone = false;

        while (!cancelledRef.current) {
          const { done, value } = await reader.read();
          if (done || cancelledRef.current) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (cancelledRef.current) break;
            if (line.startsWith("event: done")) {
              gotDone = true;
              setStatus("done");
              continue;
            }
            if (line.startsWith("event: error")) {
              setStatus("error");
              continue;
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  setOutput((prev) => prev + data.text);
                }
                if (data.id && gotDone) {
                  onComplete?.(data.id);
                }
                if (data.error) {
                  setStatus("error");
                  onError?.(data.error);
                }
              } catch { /* non-JSON data line */ }
            }
          }
        }

        if (!cancelledRef.current) {
          setStatus((prev) => (prev === "error" ? "error" : "done"));
        }
      } catch {
        if (!cancelledRef.current) {
          setStatus("error");
          onError?.("Stream failed");
        }
      }
      clearInterval(timer);
    })();

    return () => {
      cancelledRef.current = true;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, endpoint]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>AI Output</span>
          {status === "streaming" && <div className="pulse-dot" />}
        </div>
        {status === "streaming" && (
          <button className="btn btn-sm btn-danger" onClick={stopStream}>
            Stop
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        style={{ flex: 1, padding: "var(--sp-4) var(--sp-5)", overflowY: "auto", minHeight: 200 }}
      >
        {output ? (
          <div
            className="md-content markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
          />
        ) : status === "streaming" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-tertiary)" }}>
            <div className="spinner spinner-sm" />
            Generating...
          </div>
        ) : null}
        {status === "streaming" && output && <span className="ai-cursor" />}
      </div>
      <div
        style={{
          padding: "var(--sp-2) var(--sp-4)",
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          {status === "streaming" && `Generating... (${elapsed}s)`}
          {status === "done" && `Completed in ${elapsed}s`}
          {status === "error" && "Generation failed"}
          {status === "idle" && "Ready"}
        </span>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
          {output.length > 0 && `${(output.length / 1024).toFixed(1)}K`}
        </span>
      </div>
    </div>
  );
}
