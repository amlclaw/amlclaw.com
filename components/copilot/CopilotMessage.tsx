"use client";

interface CopilotMessageProps {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

function renderMarkdown(text: string): string {
  // Simple markdown → HTML
  let html = text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="copilot-code">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="copilot-inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap loose <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');

  return `<p>${html}</p>`;
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
            className="copilot-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
      {isUser && <div className="copilot-message-avatar">👤</div>}
    </div>
  );
}
