"use client";

import { useState, useEffect, useCallback } from "react";

type AIProvider = "claude" | "deepseek" | "gemini";

interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface Settings {
  ai: {
    activeProvider: AIProvider;
    providers: Record<AIProvider, ProviderConfig>;
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
  app: {
    name: string;
    reportHeader: string;
    themeDefault: "dark" | "light";
  };
}

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  claude: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  gemini: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  claude: "Claude (Anthropic)",
  deepseek: "DeepSeek",
  gemini: "Gemini (Google)",
};

const SCENARIO_OPTIONS = ["deposit", "withdrawal", "cdd", "monitoring", "all"];
const SCHEDULE_OPTIONS = [
  { value: "every_1h", label: "Every 1 hour" },
  { value: "every_4h", label: "Every 4 hours" },
  { value: "every_8h", label: "Every 8 hours" },
  { value: "every_12h", label: "Every 12 hours" },
  { value: "every_24h", label: "Every 24 hours" },
];

type Tab = "ai" | "blockchain";

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ai");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState<Record<string, { testing: boolean; result?: string; ok?: boolean }>>({});
  // Track raw (unmasked) API keys entered by the user
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
      // Merge raw keys into the patch before saving
      const toSave = structuredClone(patch);
      if (toSave.ai?.providers) {
        for (const p of ["claude", "deepseek", "gemini"] as AIProvider[]) {
          if (rawKeys[`ai_${p}`] !== undefined && toSave.ai.providers[p]) {
            toSave.ai.providers[p].apiKey = rawKeys[`ai_${p}`];
          }
        }
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
      // Reload masked settings
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

  const testConnection = useCallback(async (provider: AIProvider) => {
    setTestStatus((s) => ({ ...s, [provider]: { testing: true } }));
    try {
      const body: Record<string, string> = { provider };
      if (rawKeys[`ai_${provider}`]) body.apiKey = rawKeys[`ai_${provider}`];
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestStatus((s) => ({
        ...s,
        [provider]: { testing: false, ok: data.ok, result: data.ok ? `Connected (${data.model || provider})` : data.error },
      }));
    } catch {
      setTestStatus((s) => ({ ...s, [provider]: { testing: false, ok: false, result: "Connection failed" } }));
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
    { id: "ai", label: "AI Provider", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    { id: "blockchain", label: "Address Data", icon: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" },
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
          <AIProviderSection
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

function AIProviderSection({
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
  testConnection: (p: AIProvider) => void;
}) {
  const providers: AIProvider[] = ["claude", "deepseek", "gemini"];
  const [expanded, setExpanded] = useState<AIProvider | null>(settings.ai.activeProvider);

  const handleToggleActive = (p: AIProvider) => {
    // If clicking the already-active provider, do nothing (must have one active)
    if (settings.ai.activeProvider === p) return;
    update("ai.activeProvider", p);
  };

  return (
    <>
      <h3 className="settings-section-title">AI Provider</h3>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "0 0 var(--sp-4) 0" }}>
        Select and configure your AI provider. Only one provider can be active at a time.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {providers.map((p) => {
          const isActive = settings.ai.activeProvider === p;
          const isExpanded = expanded === p;
          const hasKey = !!(rawKeys[`ai_${p}`] || settings.ai.providers[p].apiKey);

          return (
            <div
              key={p}
              className={`settings-provider-config${isActive ? " settings-provider-active" : ""}`}
              style={{ marginBottom: 0 }}
            >
              {/* Header — always visible, clickable to expand */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => setExpanded(isExpanded ? null : p)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{PROVIDER_LABELS[p]}</span>
                  {hasKey && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", padding: "1px 6px", background: "var(--surface-3)", borderRadius: 4 }}>
                      configured
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }} onClick={(e) => e.stopPropagation()}>
                  {isActive && (
                    <span className="settings-provider-badge">Active</span>
                  )}
                  <button
                    className={`settings-toggle${isActive ? " active" : ""}`}
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => handleToggleActive(p)}
                    title={isActive ? "Currently active" : `Switch to ${PROVIDER_LABELS[p]}`}
                  />
                </div>
              </div>

              {/* Expandable config */}
              {isExpanded && (
                <div style={{ marginTop: "var(--sp-4)", paddingTop: "var(--sp-4)", borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="settings-field">
                    <label>API Key</label>
                    <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                      <input
                        type="password"
                        className="input input-sm"
                        style={{ flex: 1 }}
                        value={rawKeys[`ai_${p}`] !== undefined ? rawKeys[`ai_${p}`] : settings.ai.providers[p].apiKey}
                        onChange={(e) => setRawKeys((k) => ({ ...k, [`ai_${p}`]: e.target.value }))}
                        placeholder={`Enter ${PROVIDER_LABELS[p]} API key`}
                      />
                      <button
                        className="btn btn-sm"
                        style={{ whiteSpace: "nowrap" }}
                        onClick={() => testConnection(p)}
                        disabled={testStatus[p]?.testing}
                      >
                        {testStatus[p]?.testing ? "Testing..." : "Test"}
                      </button>
                    </div>
                    {testStatus[p]?.result && (
                      <span
                        className="settings-test-result"
                        style={{ color: testStatus[p].ok ? "var(--success)" : "var(--danger)" }}
                      >
                        {testStatus[p].result}
                      </span>
                    )}
                  </div>
                  <div className="settings-field">
                    <label>Model</label>
                    <select
                      className="input input-sm"
                      value={settings.ai.providers[p].model}
                      onChange={(e) => update(`ai.providers.${p}.model`, e.target.value)}
                    >
                      {PROVIDER_MODELS[p].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {(p === "deepseek") && (
                    <div className="settings-field">
                      <label>Base URL <span style={{ color: "var(--text-tertiary)" }}>(optional)</span></label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={settings.ai.providers[p].baseUrl || ""}
                        onChange={(e) => update(`ai.providers.${p}.baseUrl`, e.target.value)}
                        placeholder="https://api.deepseek.com"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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

