"use client";

import { renderMarkdown } from "@/lib/utils";

interface CopilotMessageProps {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

export default function CopilotMessage({ role, content, isLoading }: CopilotMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`copilot-message ${isUser ? "copilot-message-user" : "copilot-message-assistant"}`}>
      {!isUser && <div className="copilot-message-avatar">🤖</div>}
      <div className={`copilot-message-bubble ${isUser ? "copilot-bubble-user" : "copilot-bubble-assistant"}`}>
        {isLoading ? (
          <div className="copilot-loading">
            <span className="copilot-dot" />
            <span className="copilot-dot" />
            <span className="copilot-dot" />
          </div>
        ) : isUser ? (
          <p>{content}</p>
        ) : (
          <div
            className="copilot-markdown markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
      {isUser && <div className="copilot-message-avatar">👤</div>}
    </div>
  );
}
