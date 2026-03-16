export function shortenAddr(addr: string): string {
  if (!addr || addr.length < 16) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function formatTime(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function iconText(icon: string): string {
  const map: Record<string, string> = {
    globe: "\u{1F310}",
    alert: "\u26A0",
    sg: "\u{1F1F8}\u{1F1EC}",
    hk: "\u{1F1ED}\u{1F1F0}",
    ae: "\u{1F1E6}\u{1F1EA}",
    tag: "\u{1F3F7}",
    upload: "\u{1F4C4}",
    rules: "\u{1F4CB}",
  };
  return map[icon] || "\u{1F4C4}";
}

export function renderMarkdown(md: string): string {
  if (!md) return "";
  let html = escHtml(md);

  // Code blocks (before inline processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings (h4 before h3 before h2 before h1)
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Bold, italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, "");

  // Numbered lists
  html = html.replace(/^(\d+)\. (.+)$/gm, "<oli>$2</oli>");
  html = html.replace(/(<oli>[\s\S]*?<\/oli>)/g, "<ol>$1</ol>");
  html = html.replace(/<\/ol>\s*<ol>/g, "");
  html = html.replace(/<oli>/g, "<li>");
  html = html.replace(/<\/oli>/g, "</li>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?![^<]*<\/ol>)/g, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Tables — first row as thead
  html = html.replace(/^\|(.+)\|$/gm, (_match, content: string) => {
    const cells = content.split("|").map((c) => c.trim());
    if (cells.every((c) => /^[-:]+$/.test(c))) return "<!-- sep -->";
    return "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
  });
  html = html.replace(/<!-- sep -->/g, "");
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, "<table>$1</table>");
  html = html.replace(/<\/table>\s*<table>/g, "");
  // Promote first row to thead
  html = html.replace(/<table><tr>([\s\S]*?)<\/tr>/, (_, firstRow: string) => {
    const headerCells = firstRow.replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>");
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>`;
  });
  html = html.replace(/<\/table>/g, "</tbody></table>");

  // Paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = "<p>" + html + "</p>";

  // Clean up: remove empty paragraphs and fix block elements inside paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p><(h[1-4]|pre|ul|ol|table|blockquote|hr)/g, "<$1");
  html = html.replace(/<\/(h[1-4]|pre|ul|ol|table|blockquote)><\/p>/g, "</$1>");
  html = html.replace(/<hr><\/p>/g, "<hr>");
  html = html.replace(/<p><hr>/g, "<hr>");

  return html;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function humanizeCondition(condition: { parameter: string; operator: string; value: unknown; unit?: string }): string {
  const { parameter, operator, value } = condition;
  const paramLabels: Record<string, string> = {
    "path.node.tags.primary_category": "Source tagged as",
    "path.node.tags.secondary_category": "Source sub-tagged as",
    "path.node.tags.risk_level": "Source risk level",
    "target.tags.primary_category": "Target tagged as",
    "target.tags.secondary_category": "Target sub-tagged as",
    "target.tags.risk_level": "Target risk level",
    "path.risk_percentage": "Risk percentage",
    "path.risk_amount_usd": "Risk amount",
    "path.amount": "Transaction amount",
    "path.hops_total": "Total hops",
    "target.daily_deposit_usd": "Daily deposits",
    "target.daily_withdrawal_usd": "Daily withdrawals",
  };

  const paramLabel = paramLabels[parameter] || parameter;

  const formatVal = (v: unknown): string => {
    if (Array.isArray(v)) return v.map((x) => `**${x}**`).join(", ");
    if (typeof v === "number") {
      if (parameter.includes("usd") || parameter.includes("amount")) return `**$${v.toLocaleString()} USD**`;
      if (parameter.includes("percentage")) return `**${v}%**`;
      return `**${v}**`;
    }
    return `**${String(v)}**`;
  };

  const opLabels: Record<string, string> = {
    ">": ">", "<": "<", ">=": "\u2265", "<=": "\u2264",
    "==": "is", "!=": "is not",
    "CONTAINS": "includes", "IN": "", "NOT_IN": "not",
  };
  const opLabel = opLabels[operator] || operator;

  if (operator === "IN") return `${paramLabel} ${formatVal(value)}`;
  if (operator === "NOT_IN") return `${paramLabel} not ${formatVal(value)}`;
  if (operator === "CONTAINS") return `${paramLabel} includes ${formatVal(value)}`;
  if (["==", "!="].includes(operator)) return `${paramLabel} ${opLabel} ${formatVal(value)}`;
  return `${paramLabel} ${opLabel} ${formatVal(value)}`;
}

export function showToast(msg: string, type: "success" | "error" = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
