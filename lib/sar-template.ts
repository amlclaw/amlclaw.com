/**
 * SAR Template Renderer — converts structured JSON into consistent formatted Markdown.
 * Every SAR produced by this template has identical structure.
 */

export interface SARStructured {
  subject_address: string;
  subject_chain: string;
  subject_customer_info: string;
  subject_account_relationship: string;

  suspicion_nature: string;
  suspicion_indicators: string[];
  suspicion_patterns: string;

  transactions: {
    date: string;
    description: string;
    amount: string;
    counterparty: string;
    risk_flag: string;
  }[];

  evidence_paths: string[];
  rules_triggered: {
    rule_id: string;
    rule_name: string;
    risk_level: string;
    description: string;
  }[];

  risk_level: string;
  risk_score: string;
  risk_rationale: string;
  risk_categories: string[];
  proximity_analysis: string;

  recommended_actions: {
    freeze_transaction: boolean;
    enhanced_due_diligence: boolean;
    restrict_account: boolean;
    notify_law_enforcement: boolean;
    file_str: boolean;
    internal_escalation: boolean;
  };

  recommendation: string;
}

export interface SARMeta {
  reference: string;
  jurisdiction: string;
  institution_name: string;
  license_number: string;
  compliance_officer: string;
  generated_at: string;
}

const JURISDICTION_LABELS: Record<string, string> = {
  generic: "International",
  singapore: "Singapore (MAS)",
  hongkong: "Hong Kong (SFC)",
  dubai: "Dubai (VARA)",
};

const ACTION_LABELS: Record<string, string> = {
  freeze_transaction: "Transaction frozen / blocked",
  enhanced_due_diligence: "Enhanced Due Diligence (EDD) initiated",
  restrict_account: "Account / wallet restricted",
  notify_law_enforcement: "Law enforcement notified",
  file_str: "STR / SAR filed with regulatory authority",
  internal_escalation: "Internal escalation to MLRO / Compliance",
};

/**
 * Render a structured SAR JSON into formatted Markdown.
 * The output format is 100% consistent across all SARs.
 */
export function renderSARTemplate(data: SARStructured, meta: SARMeta): string {
  const juris = JURISDICTION_LABELS[meta.jurisdiction] || meta.jurisdiction;
  const date = new Date(meta.generated_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lines: string[] = [];

  // ---- Header ----
  lines.push(`# Suspicious Activity Report`);
  lines.push(``);
  lines.push(`| Field | Detail |`);
  lines.push(`|-------|--------|`);
  lines.push(`| **Reference** | ${meta.reference} |`);
  lines.push(`| **Date of Report** | ${date} |`);
  lines.push(`| **Jurisdiction** | ${juris} |`);
  lines.push(`| **Reporting Institution** | ${meta.institution_name || "—"} |`);
  lines.push(`| **License Number** | ${meta.license_number || "—"} |`);
  lines.push(`| **Compliance Officer** | ${meta.compliance_officer || "—"} |`);
  lines.push(`| **Classification** | CONFIDENTIAL |`);
  lines.push(``);
  lines.push(`---`);

  // ---- Section 1: Subject ----
  lines.push(``);
  lines.push(`## 1. Subject of Report`);
  lines.push(``);
  lines.push(`| Field | Detail |`);
  lines.push(`|-------|--------|`);
  lines.push(`| **Blockchain Network** | ${data.subject_chain} |`);
  lines.push(`| **Wallet Address** | \`${data.subject_address}\` |`);
  lines.push(`| **Customer Information** | ${data.subject_customer_info} |`);
  lines.push(`| **Account Relationship** | ${data.subject_account_relationship} |`);

  // ---- Section 2: Grounds for Suspicion ----
  lines.push(``);
  lines.push(`## 2. Grounds for Suspicion`);
  lines.push(``);
  lines.push(`### 2.1 Nature of Suspicious Activity`);
  lines.push(``);
  lines.push(data.suspicion_nature);
  lines.push(``);

  lines.push(`### 2.2 Red Flag Indicators`);
  lines.push(``);
  for (const indicator of data.suspicion_indicators) {
    lines.push(`- ${indicator}`);
  }
  lines.push(``);

  lines.push(`### 2.3 Transaction Patterns`);
  lines.push(``);
  lines.push(data.suspicion_patterns);

  // ---- Section 3: Transaction Details ----
  lines.push(``);
  lines.push(`## 3. Transaction Details`);
  lines.push(``);
  if (data.transactions.length > 0) {
    lines.push(`| Date | Description | Amount | Counterparty | Risk Flag |`);
    lines.push(`|------|-------------|--------|--------------|-----------|`);
    for (const tx of data.transactions) {
      const flag = tx.risk_flag === "None" ? "—" : `**${tx.risk_flag}**`;
      lines.push(`| ${tx.date} | ${tx.description} | ${tx.amount} | \`${tx.counterparty}\` | ${flag} |`);
    }
  } else {
    lines.push(`No individual transactions extracted from screening data.`);
  }

  // ---- Section 4: On-Chain Evidence ----
  lines.push(``);
  lines.push(`## 4. On-Chain Evidence`);
  lines.push(``);

  lines.push(`### 4.1 Evidence Paths`);
  lines.push(``);
  if (data.evidence_paths.length > 0) {
    for (let i = 0; i < data.evidence_paths.length; i++) {
      lines.push(`${i + 1}. \`${data.evidence_paths[i]}\``);
    }
  } else {
    lines.push(`No evidence paths extracted.`);
  }
  lines.push(``);

  lines.push(`### 4.2 Rules Triggered`);
  lines.push(``);
  if (data.rules_triggered.length > 0) {
    lines.push(`| Rule ID | Rule Name | Risk Level | Description |`);
    lines.push(`|---------|-----------|------------|-------------|`);
    for (const rule of data.rules_triggered) {
      lines.push(`| ${rule.rule_id} | ${rule.rule_name} | **${rule.risk_level}** | ${rule.description} |`);
    }
  } else {
    lines.push(`No specific rules triggered.`);
  }

  // ---- Section 5: Risk Assessment ----
  lines.push(``);
  lines.push(`## 5. Risk Assessment`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Overall Risk Level** | **${data.risk_level}** |`);
  lines.push(`| **Risk Score** | ${data.risk_score} |`);
  lines.push(`| **Risk Categories** | ${data.risk_categories.join(", ")} |`);
  lines.push(``);
  lines.push(`**Rationale:** ${data.risk_rationale}`);
  lines.push(``);
  lines.push(`**Proximity Analysis:** ${data.proximity_analysis}`);

  // ---- Section 6: Actions ----
  lines.push(``);
  lines.push(`## 6. Actions Taken / Recommended`);
  lines.push(``);
  const actions = data.recommended_actions;
  for (const [key, label] of Object.entries(ACTION_LABELS)) {
    const checked = actions[key as keyof typeof actions];
    lines.push(`- [${checked ? "x" : " "}] ${label}`);
  }

  // ---- Section 7: Recommendation ----
  lines.push(``);
  lines.push(`## 7. Recommendation`);
  lines.push(``);
  lines.push(data.recommendation);

  // ---- Footer ----
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*This report was generated by AMLClaw automated compliance system on ${date}. All findings are based on on-chain data analysis and should be reviewed by a qualified compliance officer before submission to regulatory authorities.*`);
  lines.push(``);
  lines.push(`**Prepared by:** ${meta.compliance_officer || "AMLClaw System"} | **Institution:** ${meta.institution_name || "—"} | **Ref:** ${meta.reference}`);

  return lines.join("\n");
}

/**
 * Parse AI output as structured SAR JSON.
 * Tries direct parse, then extracts JSON from markdown fences.
 */
export function parseSARJson(raw: string): SARStructured | null {
  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed.subject_address) return parsed;
  } catch { /* */ }

  // Strategy 2: Extract from markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      if (parsed.subject_address) return parsed;
    } catch { /* */ }
  }

  // Strategy 3: Find JSON object in text
  const jsonMatch = raw.match(/\{[\s\S]*"subject_address"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.subject_address) return parsed;
    } catch { /* */ }
  }

  return null;
}
