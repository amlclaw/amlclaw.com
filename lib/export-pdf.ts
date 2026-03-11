/**
 * PDF report generator — zero external dependencies
 * Builds a valid PDF 1.4 document with text, tables, and formatting
 */
import { getSettings } from "./settings";

interface PdfObj {
  id: number;
  offset?: number;
  content: string;
}

class PdfWriter {
  private objects: PdfObj[] = [];
  private pageContents: string[] = [];
  private nextId = 1;
  private catalogId = 0;
  private pagesId = 0;
  private fontId = 0;
  private fontBoldId = 0;

  // Page dimensions (A4 in points: 595.28 x 841.89)
  private readonly W = 595.28;
  private readonly H = 841.89;
  private readonly ML = 50; // margin left
  private readonly MR = 50;
  private readonly MT = 50;
  private readonly MB = 60;
  private y = 0;
  private currentPageStream = "";

  constructor() {
    // Reserve IDs: 1=catalog, 2=pages, 3=font-regular, 4=font-bold
    this.catalogId = this.nextId++;
    this.pagesId = this.nextId++;
    this.fontId = this.nextId++;
    this.fontBoldId = this.nextId++;
    this.newPage();
  }

  private contentWidth() {
    return this.W - this.ML - this.MR;
  }

  private newPage() {
    if (this.currentPageStream) {
      this.pageContents.push(this.currentPageStream);
    }
    this.currentPageStream = "";
    this.y = this.H - this.MT;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < this.MB) {
      this.newPage();
    }
  }

  private escPdf(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, "?");
  }

  private setFont(bold: boolean, size: number) {
    const fontRef = bold ? "/F2" : "/F1";
    this.currentPageStream += `${fontRef} ${size} Tf\n`;
  }

  private drawText(text: string, x: number, bold = false, size = 10, color?: [number, number, number]) {
    if (color) {
      this.currentPageStream += `${color[0]} ${color[1]} ${color[2]} rg\n`;
    }
    this.setFont(bold, size);
    this.currentPageStream += `BT\n${x} ${this.y} Td\n(${this.escPdf(text)}) Tj\nET\n`;
    if (color) {
      this.currentPageStream += `0 0 0 rg\n`;
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number, width = 0.5, color?: [number, number, number]) {
    if (color) {
      this.currentPageStream += `${color[0]} ${color[1]} ${color[2]} RG\n`;
    }
    this.currentPageStream += `${width} w\n${x1} ${y1} m\n${x2} ${y2} l\nS\n`;
    if (color) {
      this.currentPageStream += `0 0 0 RG\n`;
    }
  }

  private drawRect(x: number, y: number, w: number, h: number, fill: [number, number, number]) {
    this.currentPageStream += `${fill[0]} ${fill[1]} ${fill[2]} rg\n${x} ${y} ${w} ${h} re\nf\n0 0 0 rg\n`;
  }

  // Approximate char width (Helvetica ~0.5 * fontSize for average)
  private textWidth(text: string, size: number): number {
    return text.length * size * 0.48;
  }

  // Word-wrap text and return lines
  private wrapText(text: string, maxWidth: number, size: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (this.textWidth(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  // ── Public API ──

  title(text: string) {
    this.ensureSpace(40);
    this.drawText(text, this.ML, true, 18, [0.15, 0.15, 0.2]);
    this.y -= 28;
  }

  subtitle(text: string) {
    this.ensureSpace(30);
    this.y -= 8;
    this.drawLine(this.ML, this.y + 16, this.ML + this.contentWidth(), this.y + 16, 0.5, [0.85, 0.85, 0.85]);
    this.drawText(text, this.ML, true, 13, [0.2, 0.2, 0.25]);
    this.y -= 22;
  }

  text(text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number]; indent?: number }) {
    const size = opts?.size ?? 9;
    const indent = opts?.indent ?? 0;
    const maxW = this.contentWidth() - indent;
    const lines = this.wrapText(text, maxW, size);
    for (const line of lines) {
      this.ensureSpace(size + 4);
      this.drawText(line, this.ML + indent, opts?.bold ?? false, size, opts?.color);
      this.y -= size + 4;
    }
  }

  spacer(h = 8) {
    this.y -= h;
  }

  keyValue(key: string, value: string) {
    this.ensureSpace(14);
    this.drawText(key + ":", this.ML, true, 9, [0.4, 0.4, 0.45]);
    this.drawText(value, this.ML + 120, false, 9);
    this.y -= 14;
  }

  badge(text: string, color: [number, number, number]) {
    const w = this.textWidth(text, 9) + 16;
    const h = 16;
    this.ensureSpace(h + 4);
    this.drawRect(this.ML + 120, this.y - 3, w, h, [color[0] * 0.15 + 0.85, color[1] * 0.15 + 0.85, color[2] * 0.15 + 0.85]);
    this.currentPageStream += `${color[0]} ${color[1]} ${color[2]} rg\n`;
    this.setFont(true, 9);
    this.currentPageStream += `BT\n${this.ML + 128} ${this.y + 1} Td\n(${this.escPdf(text)}) Tj\nET\n0 0 0 rg\n`;
    this.y -= h + 6;
  }

  table(headers: string[], rows: string[][], colWidths?: number[]) {
    const cw = this.contentWidth();
    const cols = headers.length;
    const widths = colWidths || headers.map(() => cw / cols);
    const rowH = 18;

    // Header
    this.ensureSpace(rowH * 2);
    this.drawRect(this.ML, this.y - rowH + 4, cw, rowH, [0.94, 0.94, 0.96]);
    let x = this.ML;
    for (let i = 0; i < cols; i++) {
      this.drawText(headers[i], x + 6, true, 8, [0.35, 0.35, 0.4]);
      x += widths[i];
    }
    this.y -= rowH;
    this.drawLine(this.ML, this.y + 4, this.ML + cw, this.y + 4, 0.5, [0.8, 0.8, 0.85]);

    // Rows
    for (let r = 0; r < rows.length; r++) {
      this.ensureSpace(rowH);
      // Alternate row bg
      if (r % 2 === 1) {
        this.drawRect(this.ML, this.y - rowH + 4, cw, rowH, [0.97, 0.97, 0.98]);
      }
      x = this.ML;
      for (let c = 0; c < cols; c++) {
        const cellText = rows[r][c] || "";
        // Truncate if too wide
        const maxChars = Math.floor(widths[c] / (8 * 0.48)) - 2;
        const display = cellText.length > maxChars && maxChars > 3
          ? cellText.slice(0, maxChars - 2) + ".."
          : cellText;
        this.drawText(display, x + 6, false, 8);
        x += widths[c];
      }
      this.y -= rowH;
    }
    this.spacer(4);
  }

  alertBox(text: string, type: "danger" | "success" | "warning") {
    const colors: Record<string, { bg: [number, number, number]; fg: [number, number, number] }> = {
      danger: { bg: [1, 0.92, 0.92], fg: [0.8, 0.15, 0.15] },
      success: { bg: [0.92, 1, 0.94], fg: [0.1, 0.6, 0.25] },
      warning: { bg: [1, 0.97, 0.88], fg: [0.7, 0.5, 0.05] },
    };
    const c = colors[type] || colors.warning;
    const lines = this.wrapText(text, this.contentWidth() - 20, 9);
    const h = lines.length * 14 + 10;
    this.ensureSpace(h);
    this.drawRect(this.ML, this.y - h + 6, this.contentWidth(), h, c.bg);
    for (const line of lines) {
      this.drawText(line, this.ML + 10, true, 9, c.fg);
      this.y -= 14;
    }
    this.y -= 4;
  }

  // Grid of KRI cards
  kriGrid(items: { label: string; value: string }[]) {
    const perRow = 3;
    const cardW = (this.contentWidth() - (perRow - 1) * 8) / perRow;
    const cardH = 40;

    for (let i = 0; i < items.length; i += perRow) {
      this.ensureSpace(cardH + 8);
      for (let j = 0; j < perRow && i + j < items.length; j++) {
        const item = items[i + j];
        const cx = this.ML + j * (cardW + 8);
        this.drawRect(cx, this.y - cardH + 4, cardW, cardH, [0.95, 0.95, 0.97]);
        // Value centered
        const valW = this.textWidth(item.value, 14);
        this.setFont(true, 14);
        this.currentPageStream += `BT\n${cx + (cardW - valW) / 2} ${this.y - 14} Td\n(${this.escPdf(item.value)}) Tj\nET\n`;
        // Label centered
        const lblW = this.textWidth(item.label, 7);
        this.currentPageStream += `0.5 0.5 0.55 rg\n`;
        this.setFont(false, 7);
        this.currentPageStream += `BT\n${cx + (cardW - lblW) / 2} ${this.y - 30} Td\n(${this.escPdf(item.label.toUpperCase())}) Tj\nET\n0 0 0 rg\n`;
      }
      this.y -= cardH + 8;
    }
  }

  // ── Build final PDF ──

  build(): Buffer {
    // Finalize last page
    if (this.currentPageStream) {
      this.pageContents.push(this.currentPageStream);
    }

    // Build objects
    this.objects = [];

    // Font objects
    this.addObj(this.fontId, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    this.addObj(this.fontBoldId, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

    // Page content streams + page objects
    const pageObjIds: number[] = [];
    for (const stream of this.pageContents) {
      const streamId = this.nextId++;
      const pageId = this.nextId++;
      pageObjIds.push(pageId);

      const streamBytes = Buffer.from(stream, "latin1");
      this.addObj(streamId, `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
      this.addObj(pageId, [
        `<< /Type /Page`,
        `/Parent ${this.pagesId} 0 R`,
        `/MediaBox [0 0 ${this.W} ${this.H}]`,
        `/Contents ${streamId} 0 R`,
        `/Resources << /Font << /F1 ${this.fontId} 0 R /F2 ${this.fontBoldId} 0 R >> >>`,
        `>>`,
      ].join("\n"));
    }

    // Pages object
    const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
    this.addObj(this.pagesId, `<< /Type /Pages /Kids [${kids}] /Count ${pageObjIds.length} >>`);

    // Catalog
    this.addObj(this.catalogId, `<< /Type /Catalog /Pages ${this.pagesId} 0 R >>`);

    // Sort by id
    this.objects.sort((a, b) => a.id - b.id);

    // Serialize
    const parts: string[] = [];
    parts.push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    const offsets: number[] = [];
    let pos = Buffer.byteLength(parts[0], "latin1");

    for (const obj of this.objects) {
      const s = `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
      offsets.push(pos);
      parts.push(s);
      pos += Buffer.byteLength(s, "latin1");
    }

    // Cross-reference table
    const xrefOffset = pos;
    parts.push(`xref\n0 ${this.objects.length + 1}\n`);
    parts.push("0000000000 65535 f \n");
    // Build xref by object id order
    const xrefMap = new Map<number, number>();
    this.objects.forEach((obj, i) => xrefMap.set(obj.id, offsets[i]));
    for (let id = 1; id <= this.objects[this.objects.length - 1].id; id++) {
      const off = xrefMap.get(id);
      if (off !== undefined) {
        parts.push(`${String(off).padStart(10, "0")} 00000 n \n`);
      }
    }

    parts.push(`trailer\n<< /Size ${this.objects.length + 1} /Root ${this.catalogId} 0 R >>\n`);
    parts.push(`startxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.from(parts.join(""), "latin1");
  }

  private addObj(id: number, content: string) {
    this.objects.push({ id, content });
  }
}

// ── Report Generation ──

export function generateExportPdf(job: Record<string, unknown>): Buffer {
  const pdf = new PdfWriter();

  const r = (job.result as Record<string, unknown>) || {};
  const req = (job.request as Record<string, unknown>) || {};
  const target = (r.target as Record<string, unknown>) || {};
  const summary = (r.summary as Record<string, unknown>) || {};
  const entities = (r.risk_entities as Record<string, unknown>[]) || [];

  const overall = (summary.highest_severity as string) || computeRisk(entities);
  const riskScore = computeRiskScore(overall);
  const scenario = (r.scenario as string) || (req.scenario as string) || "all";
  const selfTags = (target.tags as Record<string, unknown>[]) || [];
  const selfRules = (target.self_matched_rules as string[]) || [];
  const triggeredRules = (summary.rules_triggered as string[]) || [];
  const rulesLoaded = (summary.rules_loaded as number) || (summary.total_rules as number) || 0;
  const totalRules = (summary.total_rules as number) || rulesLoaded;
  const categoriesApplied = (summary.categories_applied as string[]) || [];
  const pathsDirection = (summary.paths_direction_filtered as string) || "all";

  const recommendation = entities.length === 0 ? "Pass" : (overall === "Severe" || overall === "High") ? "Reject" : "Review";

  // ── Header ──
  const appSettings = getSettings();
  const engineName = appSettings.app.name || "AMLClaw";
  if (appSettings.app.reportHeader) {
    pdf.text(appSettings.app.reportHeader, { size: 8, color: [0.5, 0.5, 0.55] });
    pdf.spacer(6);
  }
  pdf.title("AML Address Screening Report");
  pdf.spacer(4);
  pdf.text(`Generated: ${job.completed_at || "N/A"}  |  Engine: ${engineName} Web  |  Scenario: ${scenario}`, { size: 8, color: [0.5, 0.5, 0.55] });
  if (categoriesApplied.length > 0) {
    pdf.text(`Categories Applied: ${categoriesApplied.join(", ")}`, { size: 8, color: [0.5, 0.5, 0.55] });
  }
  pdf.spacer(8);

  // ── Subject Identification ──
  pdf.subtitle("Subject Identification");
  pdf.keyValue("Network", (target.chain as string) || (req.chain as string) || "-");
  pdf.keyValue("Address", (target.address as string) || (req.address as string) || "-");
  pdf.keyValue("Ruleset", (req.ruleset as string) || "-");
  const validation = selfTags.length > 0 || selfRules.length > 0 ? "FLAGS DETECTED" : "CLEAN";
  pdf.keyValue("Validation", validation);
  pdf.spacer(4);

  // ── Target Self-Risk ──
  if (selfTags.length > 0 || selfRules.length > 0) {
    pdf.subtitle("Target Self-Risk Assessment");
    pdf.alertBox(
      `Address has ${selfTags.length} self-tag(s) and ${selfRules.length} self-triggered rule(s)`,
      "danger"
    );
    if (selfTags.length > 0) {
      pdf.table(
        ["Primary Category", "Secondary Category", "Risk Level"],
        selfTags.map((t) => [
          (t.primary_category as string) || "-",
          (t.secondary_category as string) || "-",
          (t.risk_level as string) || "-",
        ]),
        [200, 200, 95.28]
      );
    }
    if (selfRules.length > 0) {
      pdf.text(`Self-triggered rules: ${selfRules.join(", ")}`, { size: 8 });
    }
    pdf.spacer(4);
  }

  // ── KRI Grid ──
  pdf.subtitle("Key Risk Indicators (KRI)");
  pdf.kriGrid([
    { label: "Risk Score", value: `${riskScore}/100` },
    { label: "Risk Level", value: overall },
    { label: "Scenario", value: scenario },
    { label: "Direction", value: pathsDirection },
    { label: "Paths Analyzed", value: String(entities.length) },
    { label: "Recommendation", value: recommendation },
  ]);
  pdf.spacer(4);

  // ── Custom Policy Enforcement ──
  pdf.subtitle("Custom Policy Enforcement");
  pdf.text(`Loaded ${rulesLoaded || totalRules} of ${totalRules} rules.`, { size: 9, color: [0.4, 0.4, 0.45] });
  pdf.spacer(4);

  if (triggeredRules.length > 0) {
    pdf.alertBox(`${triggeredRules.length} rule(s) triggered`, "danger");
    pdf.table(
      ["Rule ID", "Risk", "Name", "Action"],
      triggeredRules.map((rid) => {
        const detail = findRuleInEntities(rid, entities);
        return [rid, detail.risk_level || "-", detail.name || "-", detail.action || "-"];
      }),
      [100, 70, 230, 95.28]
    );
  } else {
    pdf.alertBox("All rules passed - no policy violations detected", "success");
  }
  pdf.spacer(4);

  // ── On-Chain Graph Discovery ──
  if (entities.length > 0) {
    pdf.subtitle("On-Chain Graph Discovery");
    const groups = groupEntitiesByCategory(entities);
    pdf.table(
      ["Category", "Risk Level", "Min Depth", "Entities"],
      groups.map((g) => [g.category, g.riskLevel, `Hop ${g.minDepth}`, String(g.count)]),
      [180, 100, 100, 115.28]
    );
    pdf.spacer(4);
  }

  // ── Detailed Risk Evidence ──
  if (entities.length > 0) {
    pdf.subtitle("Detailed Risk Evidence");

    const ruleGroups = new Map<string, Record<string, unknown>[]>();
    for (const entity of entities) {
      const matched = (entity.matched_rules as string[]) || [];
      for (const rid of matched) {
        if (!ruleGroups.has(rid)) ruleGroups.set(rid, []);
        ruleGroups.get(rid)!.push(entity);
      }
    }

    for (const [rid, ruleEntities] of ruleGroups) {
      pdf.text(`Trigger: ${rid}`, { bold: true, size: 10 });
      pdf.spacer(4);

      for (const entity of ruleEntities) {
        const addr = (entity.address as string) || "Unknown";
        const tag = entity.tag as Record<string, unknown> | undefined;
        const minDeep = entity.min_deep as number;
        const evidencePaths = (entity.evidence_paths as Record<string, unknown>[]) || [];

        pdf.text(`Entity: ${addr}`, { size: 8, bold: true, indent: 10 });
        if (tag) {
          const parts: string[] = [];
          if (tag.primary_category) parts.push(`Primary: ${tag.primary_category}`);
          if (tag.secondary_category) parts.push(`Secondary: ${tag.secondary_category}`);
          if (tag.risk_level) parts.push(`Risk: ${tag.risk_level}`);
          pdf.text(`Tag: ${parts.join(" | ")}`, { size: 8, indent: 20, color: [0.4, 0.4, 0.45] });
        }
        pdf.text(`Hop Distance: ${minDeep ?? "?"}`, { size: 8, indent: 20, color: [0.4, 0.4, 0.45] });

        if (evidencePaths.length > 0) {
          for (const ep of evidencePaths) {
            pdf.text(`Hop ${ep.deep}: ${ep.flow}`, { size: 7, indent: 30, color: [0.45, 0.45, 0.5] });
          }
        }
        pdf.spacer(6);
      }
    }

    // Ungrouped
    const ungrouped = entities.filter((e) => !((e.matched_rules as string[]) || []).length);
    if (ungrouped.length > 0) {
      pdf.text("Other Risk Entities", { bold: true, size: 10 });
      pdf.spacer(4);
      for (const entity of ungrouped) {
        pdf.text(`- ${(entity.address as string) || "Unknown"}`, { size: 8, indent: 10 });
      }
    }
  } else {
    pdf.subtitle("Result");
    pdf.alertBox("No risk entities detected. Address appears clean.", "success");
  }

  pdf.spacer(16);
  pdf.text(`Generated by ${engineName} Web`, { size: 7, color: [0.6, 0.6, 0.65] });

  return pdf.build();
}

// ── Helpers (duplicated from export-md.ts to avoid coupling) ──

function computeRisk(entities: Record<string, unknown>[]): string {
  for (const level of ["Severe", "High", "Medium"]) {
    for (const e of entities) {
      const tag = e.tag as Record<string, unknown> | undefined;
      if (tag?.risk_level?.toString().toLowerCase() === level.toLowerCase()) return level;
    }
  }
  return "Low";
}

function computeRiskScore(overallRisk: string): number {
  const scores: Record<string, number> = { severe: 100, high: 85, medium: 50, low: 20 };
  return scores[overallRisk.toLowerCase()] || 20;
}

function findRuleInEntities(ruleId: string, entities: Record<string, unknown>[]): { name: string; risk_level: string; action: string } {
  for (const e of entities) {
    const rules = (e.matched_rules_detail as Record<string, unknown>[]) || [];
    for (const r of rules) {
      if (r.rule_id === ruleId) return { name: (r.name as string) || "", risk_level: (r.risk_level as string) || "", action: (r.action as string) || "" };
    }
  }
  for (const e of entities) {
    const matched = (e.matched_rules as string[]) || [];
    if (matched.includes(ruleId)) {
      const tag = e.tag as Record<string, unknown> | undefined;
      return { name: "", risk_level: (tag?.risk_level as string) || "", action: "" };
    }
  }
  return { name: "", risk_level: "", action: "" };
}

function groupEntitiesByCategory(entities: Record<string, unknown>[]): { category: string; riskLevel: string; minDepth: number; count: number }[] {
  const groups = new Map<string, { riskLevel: string; minDepth: number; count: number }>();
  for (const e of entities) {
    const tag = e.tag as Record<string, unknown> | undefined;
    const cat = (tag?.primary_category as string) || "Unknown";
    const risk = (tag?.risk_level as string) || "Low";
    const depth = (e.min_deep as number) || 0;
    const key = `${cat}|${risk}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.minDepth = Math.min(existing.minDepth, depth);
    } else {
      groups.set(key, { riskLevel: risk, minDepth: depth, count: 1 });
    }
  }
  return Array.from(groups.entries()).map(([key, val]) => ({
    category: key.split("|")[0],
    ...val,
  }));
}
