"use client";

import { useState } from "react";

const STEPS = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
  {
    id: "documents",
    label: "Step 1: Documents",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    id: "policies",
    label: "Step 2: Policies",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: "rules",
    label: "Step 3: Rules",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    id: "screening",
    label: "Step 4: Screening",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "monitoring",
    label: "Step 5: Monitoring",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "ai-engine",
    label: "AI Engine",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93" />
        <path d="M8 6a4 4 0 018 0" />
        <rect x="3" y="14" width="18" height="8" rx="2" />
        <line x1="7" y1="18" x2="7.01" y2="18" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    id: "storage",
    label: "Storage",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
];

function Badge({ children, variant = "info" }: { children: React.ReactNode; variant?: "info" | "ai" | "api" | "none" | "cron" }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    ai: { bg: "var(--secondary-dim)", color: "var(--secondary-500)", border: "rgba(6,182,212,0.25)" },
    api: { bg: "var(--primary-dim)", color: "var(--primary-400)", border: "rgba(99,102,241,0.25)" },
    info: { bg: "var(--info-dim)", color: "var(--info)", border: "rgba(59,130,246,0.25)" },
    none: { bg: "var(--surface-3)", color: "var(--text-secondary)", border: "var(--border-default)" },
    cron: { bg: "var(--warning-dim)", color: "var(--warning)", border: "rgba(234,179,8,0.25)" },
  };
  const c = colors[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: "var(--radius-full)",
      fontSize: "var(--text-xs)", fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: "var(--surface-3)", padding: "1px 6px",
      borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)",
      fontFamily: "var(--mono)", color: "var(--primary-400)",
    }}>
      {children}
    </code>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div style={{ borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border-subtle)", marginBottom: 16 }}>
      {title && (
        <div style={{
          background: "var(--surface-3)", padding: "6px 14px",
          fontSize: "var(--text-xs)", color: "var(--text-tertiary)",
          fontFamily: "var(--mono)", borderBottom: "1px solid var(--border-subtle)",
        }}>
          {title}
        </div>
      )}
      <pre style={{
        background: "var(--surface-1)", padding: 16, margin: 0,
        fontSize: "var(--text-xs)", fontFamily: "var(--mono)",
        color: "var(--text-secondary)", overflowX: "auto", lineHeight: 1.7,
      }}>
        {children}
      </pre>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: "left", padding: "8px 12px", fontWeight: 600,
                borderBottom: "1px solid var(--border-default)",
                color: "var(--text-primary)", fontSize: "var(--text-xs)",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)", fontFamily: j === 0 ? "var(--mono)" : undefined,
                  fontSize: j === 0 ? "var(--text-xs)" : undefined,
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowStep({ num, title, desc, accent }: { num: number; title: string; desc: string; accent?: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "var(--radius-full)",
        background: accent || "var(--primary-dim)", color: accent ? "white" : "var(--primary-400)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0, marginTop: 2,
        border: accent ? "none" : "1px solid rgba(99,102,241,0.25)",
      }}>
        {num}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--text-sm)", marginBottom: 2 }}>{title}</div>
        <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)", padding: "20px 24px", ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)",
      marginBottom: 8, marginTop: 0,
    }}>
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)",
      marginBottom: 8, marginTop: 24,
    }}>
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7, marginBottom: 16, marginTop: 0 }}>
      {children}
    </p>
  );
}

function FileRef({ path }: { path: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "var(--surface-3)", padding: "2px 8px",
      borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)",
      fontFamily: "var(--mono)", color: "var(--text-secondary)",
      border: "1px solid var(--border-subtle)",
    }}>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
      {path}
    </span>
  );
}

// ─── Section Renderers ────────────────────────────────────────────────────────

function OverviewSection() {
  return (
    <div>
      <SectionTitle>Architecture Overview</SectionTitle>
      <Paragraph>
        AMLClaw Web implements a five-stage AML compliance pipeline. Each stage transforms data progressively:
        regulatory documents become policies, policies become executable rules, rules power automated screening,
        and screening is orchestrated by continuous monitoring.
      </Paragraph>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
        {[
          { step: "1", name: "Documents", ai: false, desc: "File storage" },
          { step: "2", name: "Policies", ai: true, desc: "AI generation" },
          { step: "3", name: "Rules", ai: true, desc: "AI generation" },
          { step: "4", name: "Screening", ai: false, desc: "API + Engine" },
          { step: "5", name: "Monitoring", ai: false, desc: "Cron scheduler" },
        ].map((s, i) => (
          <Card key={s.step} style={{ textAlign: "center", padding: "16px 8px", position: "relative" }}>
            {i < 4 && (
              <div style={{
                position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-tertiary)", fontSize: 18, zIndex: 1,
              }}>
                &rarr;
              </div>
            )}
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-full)", margin: "0 auto 8px",
              background: s.ai ? "var(--secondary-dim)" : "var(--surface-4)",
              color: s.ai ? "var(--secondary-500)" : "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "var(--text-sm)",
              border: s.ai ? "1px solid rgba(6,182,212,0.25)" : "1px solid var(--border-default)",
            }}>
              {s.step}
            </div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: 4 }}>{s.name}</div>
            <Badge variant={s.ai ? "ai" : "none"}>{s.desc}</Badge>
          </Card>
        ))}
      </div>

      <SubTitle>Tech Stack</SubTitle>
      <Table
        headers={["Component", "Technology"]}
        rows={[
          ["Framework", "Next.js 16 (App Router) + React 19 + TypeScript 5"],
          ["AI Engine", "Claude CLI (child_process.spawn) -- demo only"],
          ["Blockchain Data", "TrustIn KYA v2 API"],
          ["Scheduler", "node-cron (in-process singleton)"],
          ["Storage", "File system (Node.js fs), no database"],
        ]}
      />

      <SubTitle>AI Usage Summary</SubTitle>
      <Table
        headers={["Step", "AI Involved?", "Processing Method"]}
        rows={[
          ["1. Documents", "No", "File storage & retrieval"],
          ["2. Policies", "Yes -- Claude CLI", "SSE streaming, generates Markdown policy"],
          ["3. Rules", "Yes -- Claude CLI", "SSE streaming, generates JSON rule array"],
          ["4. Screening", "No", "TrustIn API + deterministic rule engine"],
          ["5. Monitoring", "No", "node-cron scheduling, reuses Step 4 pipeline"],
        ]}
      />
    </div>
  );
}

function DocumentsSection() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SectionTitle>Step 1: Documents</SectionTitle>
        <Badge variant="none">No AI</Badge>
      </div>
      <Paragraph>
        Manage AML regulatory reference documents (FATF guidelines, regional regulations, etc.).
        This step is pure file management -- no AI processing involved.
      </Paragraph>

      <SubTitle>Data Sources</SubTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 6, color: "var(--text-primary)" }}>Built-in Documents</div>
          <Paragraph>Defined in <Code>data/documents.json</Code>. Actual content lives in <Code>references/</Code> directory (FATF, MAS, SFC, VARA docs).</Paragraph>
        </Card>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 6, color: "var(--text-primary)" }}>User Uploads</div>
          <Paragraph>Users upload <Code>.md</Code> / <Code>.txt</Code> files. Stored in <Code>data/uploads/</Code> with metadata index at <Code>_meta.json</Code>.</Paragraph>
        </Card>
      </div>

      <SubTitle>API Endpoints</SubTitle>
      <Table
        headers={["Method", "Path", "Function"]}
        rows={[
          ["GET", "/api/documents", "List all documents (built-in + uploads)"],
          ["POST", "/api/documents/upload", "Upload new document (FormData)"],
          ["GET", "/api/documents/[docId]/content", "Read document content"],
        ]}
      />

      <SubTitle>Processing Flow</SubTitle>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FlowStep num={1} title="Receive upload" desc="Parse FormData, validate extension (.md / .txt only)" />
        <FlowStep num={2} title="Generate ID" desc={`Format: upload_\${Date.now()}_\${random6chars}`} />
        <FlowStep num={3} title="Write file" desc="Save to data/uploads/{id}.{ext}" />
        <FlowStep num={4} title="Update index" desc="Append metadata to data/uploads/_meta.json" />
      </Card>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          Key files: <FileRef path="app/api/documents/upload/route.ts" /> <FileRef path="app/api/documents/route.ts" />
        </div>
      </div>
    </div>
  );
}

function PoliciesSection() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SectionTitle>Step 2: Policies</SectionTitle>
        <Badge variant="ai">Claude CLI</Badge>
        <Badge variant="info">SSE Stream</Badge>
      </div>
      <Paragraph>
        User selects regulatory documents, AI reads them and generates a structured AML compliance policy document in Markdown format.
        The output streams in real-time via Server-Sent Events (SSE).
      </Paragraph>

      <SubTitle>AI Prompt Template</SubTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <FileRef path="prompts/generate-policy.md" />
        </div>
        <Table
          headers={["Variable", "Source", "Description"]}
          rows={[
            ["{{JURISDICTION}}", "User input", "Target jurisdiction (Singapore, Hong Kong, Dubai, etc.)"],
            ["{{DOCUMENTS}}", "File system", "Full content of all selected documents, joined with --- separators"],
          ]}
        />
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 8 }}>
          AI is instructed to output a 10-section compliance policy: Executive Summary, Regulatory Scope,
          Risk Appetite, CDD/KYC, Inflow Monitoring, Outflow Monitoring, Travel Rule, Ongoing Monitoring,
          Record Keeping, Escalation Matrix.
        </div>
      </Card>

      <SubTitle>API Endpoints</SubTitle>
      <Table
        headers={["Method", "Path", "Function"]}
        rows={[
          ["POST", "/api/policies", "Create policy record (status: generating)"],
          ["POST", "/api/policies/generate", "Trigger AI generation (returns SSE stream)"],
          ["GET", "/api/policies/[policyId]", "Get policy content"],
        ]}
      />

      <SubTitle>Processing Flow</SubTitle>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FlowStep num={1} title="Lock check" desc="isAIBusy() -- if another AI task is running, return 409 Conflict" />
        <FlowStep num={2} title="Load documents" desc="For each documentId: read content from references/ (built-in) or data/uploads/ (uploaded)" />
        <FlowStep num={3} title="Build prompt" desc="loadPrompt('generate-policy', { JURISDICTION, DOCUMENTS }) -- template interpolation" />
        <FlowStep num={4} title="Spawn Claude CLI" desc="claude -p '<prompt>' --output-format stream-json --verbose" accent="var(--secondary-500)" />
        <FlowStep num={5} title="Stream SSE" desc='onData: each text chunk -> data: {"text":"..."}\n\n sent to client in real-time' />
        <FlowStep num={6} title="Save on complete" desc="onComplete: write final output to data/policies/{policyId}.md, update status to 'ready'" />
      </Card>

      <SubTitle>SSE Wire Format</SubTitle>
      <CodeBlock title="Server-Sent Events">{`data: {"text":"# AML Compliance Policy\\n\\n"}     <- streaming chunk
data: {"text":"## 1. Executive Summary\\n"}       <- continues...
data: {"text":"This policy establishes..."}
...
event: done
data: {"id":"policy_1709654321_abc123"}           <- generation complete`}</CodeBlock>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        Key files: <FileRef path="app/api/policies/generate/route.ts" /> <FileRef path="prompts/generate-policy.md" /> <FileRef path="lib/claude.ts" />
      </div>
    </div>
  );
}

function RulesSection() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SectionTitle>Step 3: Rules</SectionTitle>
        <Badge variant="ai">Claude CLI</Badge>
        <Badge variant="info">SSE Stream</Badge>
      </div>
      <Paragraph>
        AI reads the compliance policy from Step 2 and converts natural language policy descriptions into a
        structured JSON rules array. These rules power the automated screening in Step 4.
      </Paragraph>

      <SubTitle>AI Prompt Template</SubTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <FileRef path="prompts/generate-rules.md" />
        </div>
        <Table
          headers={["Variable", "Source", "Description"]}
          rows={[
            ["{{POLICIES}}", "Step 2 output", "Full Markdown content of the compliance policy"],
            ["{{SCHEMA}}", "data/schema/rule_schema.json", "JSON Schema defining valid rule structure"],
            ["{{LABELS}}", "references/Trustin AML labels.md", "TrustIn tag taxonomy -- valid label values"],
          ]}
        />
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 8 }}>
          AI must output a pure JSON array (no markdown fences). Each rule has category, risk_level, action,
          direction, hop constraints, and conditions using valid TrustIn graph parameters.
        </div>
      </Card>

      <SubTitle>Processing Flow</SubTitle>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FlowStep num={1} title="Load policy content" desc="Read the Markdown from data/policies/{policyId}.md" />
        <FlowStep num={2} title="Load schema + labels" desc="loadRuleSchema() + loadLabels() -- injected into prompt for AI reference" />
        <FlowStep num={3} title="Build prompt & spawn Claude" desc="Same SSE pattern as Step 2, streams text chunks to client" accent="var(--secondary-500)" />
        <FlowStep num={4} title="Parse AI output" desc="Strategy 1: JSON.parse() direct. Strategy 2: strip markdown fences, regex extract JSON array" />
        <FlowStep num={5} title="Save ruleset" desc="data/rulesets/{rulesetId}.json + update _meta.json with name, jurisdiction, source policy" />
      </Card>

      <SubTitle>Rule Structure Example</SubTitle>
      <CodeBlock title="Single Rule Object">{`{
  "rule_id": "DEP-001",
  "category": "Deposit",
  "name": "Reject Direct Sanctioned Inflow",
  "risk_level": "Severe",
  "action": "Freeze",
  "direction": "inflow",
  "max_hops": 2,
  "conditions": [
    {
      "parameter": "path.node.tags.primary_category",
      "operator": "IN",
      "value": ["Sanctioned Entity", "Terrorist Financing"]
    }
  ]
}`}</CodeBlock>

      <SubTitle>Valid Graph Parameters</SubTitle>
      <Table
        headers={["Parameter", "Level", "Description"]}
        rows={[
          ["path.node.tags.primary_category", "Node", "Primary label of a graph node"],
          ["path.node.tags.secondary_category", "Node", "Secondary label"],
          ["path.node.tags.risk_level", "Node", "Risk level tag"],
          ["target.tags.primary_category", "Target", "Target address's own label"],
          ["target.tags.secondary_category", "Target", "Target's secondary label"],
          ["target.tags.risk_level", "Target", "Target's risk level"],
          ["path.risk_percentage", "Path", "Risk exposure percentage"],
          ["path.risk_amount_usd", "Path", "Risk amount in USD"],
        ]}
      />

      <SubTitle>Built-in Rulesets</SubTitle>
      <Table
        headers={["ID", "Name", "Location"]}
        rows={[
          ["singapore_mas", "Singapore MAS DPT", "data/defaults/singapore_mas.json"],
          ["hong_kong_sfc", "Hong Kong SFC VASP", "data/defaults/hong_kong_sfc.json"],
          ["dubai_vara", "Dubai VARA", "data/defaults/dubai_vara.json"],
        ]}
      />

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        Key files: <FileRef path="app/api/rulesets/generate/route.ts" /> <FileRef path="prompts/generate-rules.md" /> <FileRef path="lib/prompts.ts" />
      </div>
    </div>
  );
}

function ScreeningSection() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SectionTitle>Step 4: Screening</SectionTitle>
        <Badge variant="api">TrustIn API</Badge>
        <Badge variant="none">No AI</Badge>
      </div>
      <Paragraph>
        Performs AML screening on a blockchain address: calls TrustIn KYA API for the on-chain fund flow graph,
        then runs a deterministic rule engine against every node. No LLM involved -- purely algorithmic.
      </Paragraph>

      <SubTitle>Two Core Engines</SubTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 6, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            TrustIn API Wrapper
            <Badge variant="api">External API</Badge>
          </div>
          <Paragraph>
            <Code>lib/trustin-api.ts</Code> -- submits a task, polls for completion (2s intervals, max 30 retries),
            then fetches the complete graph result including paths, nodes, and tags.
          </Paragraph>
        </Card>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 6, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            Risk Path Extraction
            <Badge variant="none">Algorithm</Badge>
          </div>
          <Paragraph>
            <Code>lib/extract-risk-paths.ts</Code> -- filters rules by scenario, traverses graph paths,
            matches each node against rules using AND-logic conditions, outputs risk entities.
          </Paragraph>
        </Card>
      </div>

      <SubTitle>API Endpoints</SubTitle>
      <Table
        headers={["Method", "Path", "Function"]}
        rows={[
          ["POST", "/api/screening", "Submit screening job, returns jobId immediately"],
          ["GET", "/api/screening/[jobId]", "Poll job status/result (client polls every 3s)"],
          ["GET", "/api/screening/[jobId]/export", "Export screening report"],
          ["GET", "/api/screening/history", "List past screening results"],
        ]}
      />

      <SubTitle>Processing Flow</SubTitle>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <FlowStep num={1} title="Accept request" desc="Validate address, load ruleset, generate jobId, return immediately (non-blocking)" />
        <FlowStep num={2} title="TrustIn API: submit_task" desc='POST { chain_name, address, inflow_hops, outflow_hops, max_nodes_per_hop } -> task_id' accent="var(--primary-500)" />
        <FlowStep num={3} title="TrustIn API: poll status" desc="GET get_status every 2 seconds, max 30 retries (up to 60s wait)" accent="var(--primary-500)" />
        <FlowStep num={4} title="TrustIn API: get_result" desc="Fetch complete graph data with paths, nodes, tags" accent="var(--primary-500)" />
        <FlowStep num={5} title="Rule filtering by scenario" desc="deposit -> Deposit rules only; withdrawal -> Withdrawal + outflow paths only; all -> everything" />
        <FlowStep num={6} title="Target self-tag evaluation" desc="Check if the target address itself has labels (e.g., Sanctioned Entity) matching rules" />
        <FlowStep num={7} title="Path traversal + rule matching" desc="For each node: compute true hop depth, select highest-priority tag, check direction/hop constraints, evaluate all conditions (AND logic)" />
        <FlowStep num={8} title="Aggregate & save" desc="Deduplicate by address, sort by severity, cap evidence paths at 3, save to data/history/{jobId}.json" />
      </Card>

      <SubTitle>Rule Matching Logic</SubTitle>
      <CodeBlock title="Core matching algorithm (extract-risk-paths.ts)">{`for each path in graph.paths:
  for each node in path:
    skip if node.address === targetAddress
    trueDeep = computeTrueDeep(nodeIndex, numNodes, pathDirection)
    skip if trueDeep < 1 or > maxDepth
    tag = prioritizeTag(node.tags)  // lowest priority number wins

    for each rule in filteredRules:
      // 1. Direction check
      if rule.direction && rule.direction !== pathDirection -> skip

      // 2. Hop range check
      if trueDeep < rule.min_hops || trueDeep > rule.max_hops -> skip

      // 3. Condition evaluation (AND logic)
      for each condition in rule.conditions:
        evaluate: IN, ==, !=, NOT_IN operators
        ALL must pass for rule to match`}</CodeBlock>

      <SubTitle>Scenario-Based Filtering</SubTitle>
      <Table
        headers={["Scenario", "Rule Categories", "Path Direction", "Use Case"]}
        rows={[
          ["deposit", "Deposit", "All", "Inflow source risk analysis"],
          ["withdrawal", "Withdrawal", "Outflow only", "Outflow destination screening"],
          ["onboarding", "Deposit", "All", "KYC onboarding check"],
          ["cdd", "CDD", "All", "Transaction threshold triggers"],
          ["monitoring", "Ongoing Monitoring", "All", "Structuring/smurfing detection"],
          ["all", "All categories", "All", "Comprehensive full scan"],
        ]}
      />

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        Key files: <FileRef path="app/api/screening/route.ts" /> <FileRef path="lib/trustin-api.ts" /> <FileRef path="lib/extract-risk-paths.ts" />
      </div>
    </div>
  );
}

function MonitoringSection() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SectionTitle>Step 5: Monitoring</SectionTitle>
        <Badge variant="cron">node-cron</Badge>
        <Badge variant="none">No AI</Badge>
      </div>
      <Paragraph>
        Sets up recurring automated screening for a list of addresses. Uses an in-process node-cron singleton scheduler.
        Each run executes the full Step 4 pipeline for every address in the monitor task.
      </Paragraph>

      <SubTitle>API Endpoints</SubTitle>
      <Table
        headers={["Method", "Path", "Function"]}
        rows={[
          ["POST", "/api/monitors", "Create monitor task"],
          ["GET", "/api/monitors", "List all monitor tasks"],
          ["PATCH", "/api/monitors/[id]", "Update task (enable/disable, change schedule)"],
          ["POST", "/api/monitors/[id]/run", "Manually trigger a run"],
          ["GET", "/api/monitors/[id]/history", "Get run history"],
        ]}
      />

      <SubTitle>Processing Flow</SubTitle>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <FlowStep num={1} title="Create task" desc="Save config: addresses[], scenario, ruleset_id, schedule (cron expression)" />
        <FlowStep num={2} title="Register cron job" desc="node-cron validates expression, registers ScheduledTask in memory Map" accent="var(--warning)" />
        <FlowStep num={3} title="Trigger (scheduled or manual)" desc="executeMonitorTask() -- checks runningTasks Set for concurrency guard" />
        <FlowStep num={4} title="Batch screening" desc="For each address: kyaProDetect() -> extractRiskPaths() -> saveHistoryEntry() (source: 'monitor')" />
        <FlowStep num={5} title="Aggregate results" desc="Count: total, completed, flagged, highest_risk across all addresses" />
        <FlowStep num={6} title="Save run record" desc="data/monitors/{id}/runs/{runId}.json -- includes per-address results + summary" />
        <FlowStep num={7} title="Update task" desc="Set last_run_at, next_run_at, last_result_summary on the monitor task" />
      </Card>

      <SubTitle>Schedule Presets</SubTitle>
      <Table
        headers={["Key", "Cron Expression", "Description"]}
        rows={[
          ["every_1h", "0 * * * *", "Every hour"],
          ["every_4h", "0 */4 * * *", "Every 4 hours"],
          ["every_8h", "0 */8 * * *", "Every 8 hours"],
          ["every_12h", "0 */12 * * *", "Every 12 hours"],
          ["every_24h", "0 0 * * *", "Daily at midnight"],
        ]}
      />

      <SubTitle>Cross-linking with Screening History</SubTitle>
      <Paragraph>
        Each address in a monitor run creates a separate screening history entry with <Code>source: &quot;monitor&quot;</Code>,
        <Code>monitor_task_id</Code>, and <Code>monitor_run_id</Code>. This allows viewing individual address results
        in the screening history while keeping them linked to their monitor context.
      </Paragraph>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        Key files: <FileRef path="lib/scheduler.ts" /> <FileRef path="app/api/monitors/[monitorId]/run/route.ts" />
      </div>
    </div>
  );
}

function AIEngineSection() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <SectionTitle>AI Engine: Claude CLI Wrapper</SectionTitle>
        <Badge variant="ai">Demo Only</Badge>
      </div>
      <Paragraph>
        The current demo spawns the Claude CLI as a child process. Production will migrate to
        the <Code>@anthropic-ai/sdk</Code> API for better concurrency and reliability.
      </Paragraph>

      <SubTitle>Command</SubTitle>
      <CodeBlock>{`claude -p "<prompt>" --output-format stream-json --verbose`}</CodeBlock>

      <SubTitle>Execution Flow</SubTitle>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <FlowStep num={1} title="Acquire lock" desc="Write data/.ai-lock.json with { id, type, startedAt, pid }. Stale locks auto-clear when PID is dead." />
        <FlowStep num={2} title="Clean environment" desc="Delete CLAUDECODE env var from child process to prevent nested session rejection." />
        <FlowStep num={3} title="Spawn process" desc="child_process.spawn('claude', args) with stdin: ignore, stdout/stderr: pipe" accent="var(--secondary-500)" />
        <FlowStep num={4} title="Parse NDJSON stream" desc='stdout emits one JSON object per line. type:"assistant" = incremental chunk, type:"result" = final output.' />
        <FlowStep num={5} title="Release lock" desc="On process exit: remove lock file, call onComplete (code 0) or onError (non-zero)." />
      </Card>

      <SubTitle>NDJSON Stream Format</SubTitle>
      <CodeBlock title="Claude CLI stdout">{`{"type":"assistant","message":{"content":[{"type":"text","text":"# Policy\\n"}]}}
{"type":"assistant","message":{"content":[{"type":"text","text":"## Section 1\\n"}]}}
...
{"type":"result","result":"# Policy\\n## Section 1\\n...full output..."}`}</CodeBlock>
      <Paragraph>
        <strong>Important:</strong> The <Code>type:&quot;result&quot;</Code> line contains the authoritative final output used for saving.
        Streaming <Code>type:&quot;assistant&quot;</Code> chunks are for real-time display only and may contain duplicates.
      </Paragraph>

      <SubTitle>Single-Task Lock</SubTitle>
      <Paragraph>
        Only one AI task can run at a time. The lock file records the process PID. If the process dies
        unexpectedly, the next <Code>isAIBusy()</Code> call detects the dead PID via <Code>process.kill(pid, 0)</Code> and
        auto-clears the stale lock. Callers get HTTP 409 if another task is running.
      </Paragraph>

      <SubTitle>Prompt Template System</SubTitle>
      <Table
        headers={["Template", "Input -> Output", "Used By"]}
        rows={[
          ["generate-policy.md", "Documents -> Markdown policy", "Step 2: Policies"],
          ["generate-rules.md", "Policy + Schema + Labels -> JSON rules", "Step 3: Rules"],
          ["refine-rules.md", "Existing rules + instruction -> Updated rules", "Rule refinement (reserved)"],
          ["explain.md", "AML content -> Plain explanation", "Content explainer (reserved)"],
        ]}
      />

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        Key files: <FileRef path="lib/claude.ts" /> <FileRef path="lib/prompts.ts" /> <FileRef path="prompts/" />
      </div>
    </div>
  );
}

function StorageSection() {
  return (
    <div>
      <SectionTitle>Storage Layer</SectionTitle>
      <Paragraph>
        Pure file-system storage with no database. Each entity type has an index file for metadata and individual
        files for content. In-memory <Code>Map</Code> fallback for serverless environments where <Code>fs.writeFileSync</Code> fails.
      </Paragraph>

      <SubTitle>Directory Layout</SubTitle>
      <CodeBlock title="data/">{`data/
  .ai-lock.json                    <- AI task lock (PID-based)
  documents.json                   <- Built-in document metadata
  schema/
    rule_schema.json               <- Rule JSON Schema
  defaults/                        <- Built-in rulesets (read-only)
    singapore_mas.json
    hong_kong_sfc.json
    dubai_vara.json
  uploads/                         <- User-uploaded documents
    _meta.json                     <- Upload index
    upload_*.md
  policies/                        <- AI-generated policies
    _index.json                    <- Policy metadata index
    policy_*.md                    <- Policy content (Markdown)
  rulesets/                        <- AI-generated custom rulesets
    _meta.json                     <- Ruleset metadata index
    custom_ai_*.json               <- Rule arrays (JSON)
  history/                         <- Screening results
    index.json                     <- History index (max 100 entries)
    {jobId}.json                   <- Full screening result
  monitors/                        <- Continuous monitoring
    _index.json                    <- Monitor task index
    {monitorId}.json               <- Task configuration
    {monitorId}/runs/              <- Run records
      {runId}.json`}</CodeBlock>

      <SubTitle>Storage Patterns</SubTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: 4 }}>Index + Content</div>
          <Paragraph>Policies and rulesets use a two-file pattern: <Code>_index.json</Code> (metadata array) + individual content files. Both are updated atomically.</Paragraph>
        </Card>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: 4 }}>History Capping</div>
          <Paragraph>Screening history is capped at 100 entries (newest first). Older entries&apos; index records are dropped but JSON files remain on disk.</Paragraph>
        </Card>
      </div>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        Key file: <FileRef path="lib/storage.ts" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const SECTIONS: Record<string, () => React.ReactNode> = {
    overview: OverviewSection,
    documents: DocumentsSection,
    policies: PoliciesSection,
    rules: RulesSection,
    screening: ScreeningSection,
    monitoring: MonitoringSection,
    "ai-engine": AIEngineSection,
    storage: StorageSection,
  };

  const ActiveComponent = SECTIONS[activeSection] || OverviewSection;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: "calc(100vh - 56px)" }}>
      {/* Left nav */}
      <nav style={{
        width: 220, flexShrink: 0, padding: "20px 0",
        borderRight: "1px solid var(--border-subtle)",
        background: "var(--surface-1)",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "auto",
      }}>
        <div style={{
          padding: "0 16px 16px", fontSize: "var(--text-xs)", fontWeight: 600,
          color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Technical Docs
        </div>
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => setActiveSection(step.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "8px 16px", border: "none",
              background: activeSection === step.id ? "var(--primary-dim)" : "transparent",
              color: activeSection === step.id ? "var(--primary-400)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: "var(--text-sm)", textAlign: "left",
              borderRight: activeSection === step.id ? "2px solid var(--primary-500)" : "2px solid transparent",
              transition: "all var(--transition-fast)",
              fontFamily: "var(--font)",
            }}
            onMouseEnter={(e) => {
              if (activeSection !== step.id) {
                e.currentTarget.style.background = "var(--surface-3)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeSection !== step.id) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            <span style={{ flexShrink: 0, opacity: 0.7 }}>{step.icon}</span>
            <span>{step.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{
        flex: 1, padding: "32px 48px", maxWidth: 900,
        overflowY: "auto",
      }}>
        <ActiveComponent />
      </main>
    </div>
  );
}
