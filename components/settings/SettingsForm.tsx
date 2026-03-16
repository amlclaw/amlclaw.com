"use client";

import { useState, useEffect, useCallback } from "react";

interface Settings {
  ai: {
    oauthToken: string;
    model: string;
    maxTurns: number;
    maxBudgetUsd: number;
  };
  blockchain: {
    trustinApiKey: string;
    trustinBaseUrl: string;
  };
  screening: {
    defaultInflowHops: number;
    defaultOutflowHops: number;
    maxNodes: number;
    defaultScenario: string;
    defaultRuleset: string;
    pollingTimeout: number;
  };
  monitoring: {
    maxAddressesPerTask: number;
    defaultSchedule: string;
  };
  storage: {
    historyCap: number;
    dataDirectory: string;
  };
  notifications: {
    webhookUrl: string;
    webhookEnabled: boolean;
    alertOnHighRisk: boolean;
  };
  security: {
    apiToken: string;
  };
  demo: {
    enabled: boolean;
  };
  sar: {
    institution_name: string;
    license_number: string;
    compliance_officer: string;
    default_jurisdiction: string;
    auto_reference_prefix: string;
  };
  app: {
    name: string;
    reportHeader: string;
    themeDefault: "dark" | "light";
  };
}

const AI_MODELS = ["claude-sonnet-4-6", "claude-opus-4-6"];

type Tab = "ai" | "blockchain" | "sar";

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ai");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState<Record<string, { testing: boolean; result?: string; ok?: boolean }>>({});
  const [rawKeys, setRawKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setError("Failed to load settings"));
  }, []);

  const save = useCallback(async (patch: Partial<Settings>) => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const toSave = structuredClone(patch);
      if (toSave.ai && rawKeys["oauthToken"] !== undefined) {
        toSave.ai.oauthToken = rawKeys["oauthToken"];
      }
      if (toSave.blockchain && rawKeys["trustin"] !== undefined) {
        toSave.blockchain.trustinApiKey = rawKeys["trustin"];
      }
      if (rawKeys["apiToken"] !== undefined) {
        if (!toSave.security) toSave.security = { apiToken: "" };
        toSave.security.apiToken = rawKeys["apiToken"];
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) throw new Error("Save failed");
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setSettings(fresh);
      setRawKeys({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [rawKeys]);

  const testConnection = useCallback(async () => {
    setTestStatus((s) => ({ ...s, claude: { testing: true } }));
    try {
      const body: Record<string, string> = {};
      if (rawKeys["oauthToken"]) body.oauthToken = rawKeys["oauthToken"];
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestStatus((s) => ({
        ...s,
        claude: { testing: false, ok: data.ok, result: data.ok ? `Connected (${data.model || "Claude"})` : data.error },
      }));
    } catch {
      setTestStatus((s) => ({ ...s, claude: { testing: false, ok: false, result: "Connection failed" } }));
    }
  }, [rawKeys]);

  if (!settings) {
    return <div style={{ padding: "var(--sp-6)", color: "var(--text-secondary)" }}>Loading settings...</div>;
  }

  const update = (path: string, value: unknown) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const keys = path.split(".");
      let obj: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "ai", label: "AI Engine", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    { id: "blockchain", label: "Address Data", icon: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" },
    { id: "sar", label: "SAR Config", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ];

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      {/* Tab bar */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="settings-panel">
        {activeTab === "ai" && (
          <ClaudeCodeSection
            settings={settings}
            update={update}
            rawKeys={rawKeys}
            setRawKeys={setRawKeys}
            testStatus={testStatus}
            testConnection={testConnection}
          />
        )}
        {activeTab === "blockchain" && (
          <BlockchainSection settings={settings} update={update} rawKeys={rawKeys} setRawKeys={setRawKeys} />
        )}
        {activeTab === "sar" && (
          <SARConfigSection settings={settings} update={update} />
        )}
        {/* Save bar */}
        <div className="settings-save-bar">
          {error && <span style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>{error}</span>}
          {saved && <span style={{ color: "var(--success)", fontSize: "var(--text-sm)" }}>Settings saved</span>}
          <button
            className="btn btn-primary btn-md"
            onClick={() => save(settings)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Components
// ---------------------------------------------------------------------------

function ClaudeCodeSection({
  settings,
  update,
  rawKeys,
  setRawKeys,
  testStatus,
  testConnection,
}: {
  settings: Settings;
  update: (path: string, val: unknown) => void;
  rawKeys: Record<string, string>;
  setRawKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  testStatus: Record<string, { testing: boolean; result?: string; ok?: boolean }>;
  testConnection: () => void;
}) {
  return (
    <>
      <h3 className="settings-section-title">AI Engine (Claude Code)</h3>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "0 0 var(--sp-4) 0" }}>
        This application uses the Claude Agent SDK powered by your Claude Pro/Max subscription.
        Run <code style={{ background: "var(--surface-3)", padding: "1px 4px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>claude setup-token</code> in your terminal to generate an OAuth token.
      </p>

      <div className="settings-field">
        <label>OAuth Token</label>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <input
            type="password"
            className="input input-sm"
            style={{ flex: 1 }}
            value={rawKeys["oauthToken"] !== undefined ? rawKeys["oauthToken"] : settings.ai.oauthToken}
            onChange={(e) => setRawKeys((k) => ({ ...k, oauthToken: e.target.value }))}
            placeholder="sk-ant-oat01-..."
          />
          <button
            className="btn btn-sm"
            style={{ whiteSpace: "nowrap" }}
            onClick={() => testConnection()}
            disabled={testStatus.claude?.testing}
          >
            {testStatus.claude?.testing ? "Testing..." : "Test"}
          </button>
        </div>
        {testStatus.claude?.result && (
          <span
            className="settings-test-result"
            style={{ color: testStatus.claude.ok ? "var(--success)" : "var(--danger)" }}
          >
            {testStatus.claude.result}
          </span>
        )}
        <span className="settings-hint">
          Run <code style={{ fontFamily: "var(--mono)", fontSize: "inherit" }}>claude setup-token</code> in terminal, then paste the token here.
        </span>
      </div>

      <div className="settings-field">
        <label>Model</label>
        <select
          className="input input-sm"
          value={settings.ai.model}
          onChange={(e) => update("ai.model", e.target.value)}
        >
          {AI_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
        <div className="settings-field">
          <label>Max Turns <span style={{ color: "var(--text-tertiary)" }}>(Copilot)</span></label>
          <input
            type="number"
            className="input input-sm"
            value={settings.ai.maxTurns}
            onChange={(e) => update("ai.maxTurns", parseInt(e.target.value) || 10)}
            min={1}
            max={50}
          />
          <span className="settings-hint">Maximum agent iterations for Copilot</span>
        </div>
        <div className="settings-field">
          <label>Max Budget (USD)</label>
          <input
            type="number"
            className="input input-sm"
            value={settings.ai.maxBudgetUsd}
            onChange={(e) => update("ai.maxBudgetUsd", parseFloat(e.target.value) || 1.0)}
            min={0.01}
            max={100}
            step={0.1}
          />
          <span className="settings-hint">Per-task cost cap</span>
        </div>
      </div>
    </>
  );
}

function BlockchainSection({
  settings,
  update,
  rawKeys,
  setRawKeys,
}: {
  settings: Settings;
  update: (path: string, val: unknown) => void;
  rawKeys: Record<string, string>;
  setRawKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [testState, setTestState] = useState<{
    testing: boolean;
    result?: { ok: boolean; message?: string; error?: string; steps?: { step: string; status: string; detail?: string; duration_ms?: number }[] };
  }>({ testing: false });

  const handleTest = async () => {
    setTestState({ testing: true });
    try {
      const res = await fetch("/api/settings/test-trustin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: rawKeys["trustin"] !== undefined ? rawKeys["trustin"] : "",
          baseUrl: settings.blockchain.trustinBaseUrl,
        }),
      });
      const data = await res.json();
      setTestState({ testing: false, result: data });
    } catch {
      setTestState({ testing: false, result: { ok: false, error: "Request failed" } });
    }
  };

  return (
    <>
      <h3 className="settings-section-title">Address Data Source (TrustIn KYA API)</h3>
      <div className="settings-field">
        <label>API Key <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(optional — works without key in desensitized mode)</span></label>
        <input
          type="password"
          className="input input-sm"
          value={rawKeys["trustin"] !== undefined ? rawKeys["trustin"] : settings.blockchain.trustinApiKey}
          onChange={(e) => setRawKeys((k) => ({ ...k, trustin: e.target.value }))}
          placeholder="Enter TrustIn API key (optional)"
        />
        <span className="settings-hint">Optional. Without key: desensitized data. With key: full data. Free key at trustin.info</span>
      </div>
      <div className="settings-field">
        <label>API Base URL</label>
        <input
          type="text"
          className="input input-sm"
          value={settings.blockchain.trustinBaseUrl}
          onChange={(e) => update("blockchain.trustinBaseUrl", e.target.value)}
          placeholder="https://api.trustin.info/api/v2/investigate"
        />
      </div>

      {/* Test Connection */}
      <div style={{ marginTop: "var(--sp-3)" }}>
        <button
          className="btn btn-md btn-secondary"
          onClick={handleTest}
          disabled={testState.testing}
        >
          {testState.testing ? (
            <>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Testing (may take 30-60s)...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Test Connection
            </>
          )}
        </button>

        {testState.result && (
          <div style={{
            marginTop: "var(--sp-2)",
            padding: "var(--sp-3)",
            borderRadius: "var(--radius)",
            background: testState.result.ok ? "var(--success-dim)" : "var(--danger-dim)",
            border: `1px solid ${testState.result.ok ? "rgba(52,168,83,0.25)" : "rgba(234,67,53,0.25)"}`,
            fontSize: "var(--text-xs)",
          }}>
            <div style={{ fontWeight: 600, color: testState.result.ok ? "var(--success)" : "var(--danger)", marginBottom: "var(--sp-1)" }}>
              {testState.result.ok ? "✓ " + testState.result.message : "✗ " + testState.result.error}
            </div>
            {testState.result.steps && testState.result.steps.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--text-secondary)" }}>
                {testState.result.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                    <span style={{ color: s.status === "ok" ? "var(--success)" : s.status === "timeout" ? "var(--warning)" : "var(--danger)" }}>
                      {s.status === "ok" ? "●" : s.status === "timeout" ? "●" : "●"}
                    </span>
                    <span style={{ fontFamily: "var(--mono)" }}>{s.step}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>{s.detail}</span>
                    {s.duration_ms !== undefined && (
                      <span style={{ color: "var(--text-tertiary)", marginLeft: "auto" }}>{(s.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SARConfigSection({
  settings,
  update,
}: {
  settings: Settings;
  update: (path: string, val: unknown) => void;
}) {
  const sar = (settings as unknown as Record<string, unknown>).sar as Record<string, string> | undefined;

  return (
    <>
      <h3 className="settings-section-title">SAR Configuration</h3>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "0 0 var(--sp-4) 0" }}>
        Configure institution details for Suspicious Activity Report generation.
      </p>

      <div className="settings-field">
        <label>Institution Name</label>
        <input
          type="text"
          className="input input-sm"
          value={sar?.institution_name || ""}
          onChange={(e) => update("sar.institution_name", e.target.value)}
          placeholder="Your company name"
        />
      </div>
      <div className="settings-field">
        <label>License Number</label>
        <input
          type="text"
          className="input input-sm"
          value={sar?.license_number || ""}
          onChange={(e) => update("sar.license_number", e.target.value)}
          placeholder="e.g. PS20200001"
        />
      </div>
      <div className="settings-field">
        <label>Compliance Officer</label>
        <input
          type="text"
          className="input input-sm"
          value={sar?.compliance_officer || ""}
          onChange={(e) => update("sar.compliance_officer", e.target.value)}
          placeholder="Name of compliance officer / MLRO"
        />
      </div>
      <div className="settings-field">
        <label>Default Jurisdiction</label>
        <select
          className="input input-sm"
          value={sar?.default_jurisdiction || "generic"}
          onChange={(e) => update("sar.default_jurisdiction", e.target.value)}
        >
          <option value="generic">Generic</option>
          <option value="singapore">Singapore (STRO/SONAR)</option>
          <option value="hongkong">Hong Kong (JFIU/STREAMS)</option>
          <option value="dubai">Dubai (FIU/goAML)</option>
        </select>
      </div>
      <div className="settings-field">
        <label>Reference Prefix</label>
        <input
          type="text"
          className="input input-sm"
          value={sar?.auto_reference_prefix || "SAR"}
          onChange={(e) => update("sar.auto_reference_prefix", e.target.value)}
          placeholder="SAR"
        />
        <span className="settings-hint">Prefix for auto-generated reference numbers (e.g. SAR-2026-00001)</span>
      </div>
    </>
  );
}
