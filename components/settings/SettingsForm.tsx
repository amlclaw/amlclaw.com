"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/lib/utils";

interface Settings {
  api: {
    widthApiKey: string;
    widthBaseUrl: string;
    etherscanApiKey: string;
    trongridApiKey: string;
  };
  screening: {
    defaultInflowHops: number;
    defaultOutflowHops: number;
    maxNodesPerHop: number;
    maxOpponentPaths: number;
    minAmount: number;
    defaultScenario: string;
    defaultKyaRulesetId: number;
    defaultKytInRulesetId: number;
    defaultKytOutRulesetId: number;
    defaultScoringRulesetId: number;
    forceTimeSequence: boolean;
    cexImmune: boolean;
    pollingTimeout: number;
  };
  monitoring: {
    defaultSchedule: string;
    maxTxPerRun: number;
    defaultMinAmount: number;
  };
  ai: {
    deepseekApiKey: string;
    model: string;
    baseUrl: string;
  };
  notifications: {
    webhookUrl: string;
    webhookEnabled: boolean;
    alertOnHighRisk: boolean;
  };
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [keyTests, setKeyTests] = useState<Record<string, { testing?: boolean; ok?: boolean; detail?: string }>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setError("Failed to load settings"));
  }, []);

  const save = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Save failed");
      }
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setSettings(fresh);
      showToast("Settings saved", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save settings";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (!settings) {
    return (
      <div style={{ padding: "var(--sp-8)", textAlign: "center" }}>
        {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : <div className="spinner spinner-lg" style={{ margin: "0 auto" }} />}
      </div>
    );
  }

  const set = (section: keyof Settings, field: string, value: unknown) => {
    setSettings((s) => s ? { ...s, [section]: { ...s[section], [field]: value } } : s);
  };


  const testChainKey = async (provider: "width" | "etherscan" | "trongrid" | "deepseek") => {
    setKeyTests((t) => ({ ...t, [provider]: { testing: true } }));
    try {
      const apiKey =
        provider === "etherscan" ? settings.api.etherscanApiKey
        : provider === "trongrid" ? settings.api.trongridApiKey
        : provider === "deepseek" ? settings.ai.deepseekApiKey
        : settings.api.widthApiKey;
      const res = await fetch("/api/settings/test-chain-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      });
      const json = await res.json();
      setKeyTests((t) => ({ ...t, [provider]: { ok: !!json.ok, detail: json.detail } }));
    } catch (e) {
      setKeyTests((t) => ({ ...t, [provider]: { ok: false, detail: e instanceof Error ? e.message : "Request failed" } }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", maxWidth: 720 }}>
      {/* ── API Keys ── */}
      <Section
        title="API Keys"
        description="Width.info powers KYA/KYT screening (rulesets run server-side). Etherscan / TronGrid feed address monitoring — without your own keys, shared defaults are used and may be rate-limited."
      >
        <Field
          label="Width.info API Key"
          hint={<KeyTestHint state={keyTests.width} fallback={<span>Required. Get a free key at <a href="https://width.info/api-keys" target="_blank" rel="noopener" style={{ color: "var(--primary-500)" }}>width.info/api-keys</a></span>} />}
        >
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <input
              className="input"
              type="password"
              value={settings.api.widthApiKey}
              onChange={(e) => {
                set("api", "widthApiKey", e.target.value);
                setKeyTests((t) => ({ ...t, width: {} }));
              }}
              placeholder="Enter width.info API key"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => testChainKey("width")}
              disabled={keyTests.width?.testing}
            >
              {keyTests.width?.testing ? "Testing..." : "Test"}
            </button>
          </div>
        </Field>
        <Field label="API Base URL">
          <input
            className="input"
            value={settings.api.widthBaseUrl}
            onChange={(e) => set("api", "widthBaseUrl", e.target.value)}
            placeholder="https://api.trustin.bond"
          />
        </Field>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Field label="Etherscan API Key" hint={<KeyTestHint state={keyTests.etherscan} fallback="Optional — empty = rate-limited default" />} style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <input
                className="input"
                type="password"
                value={settings.api.etherscanApiKey}
                onChange={(e) => {
                  set("api", "etherscanApiKey", e.target.value);
                  setKeyTests((t) => ({ ...t, etherscan: {} }));
                }}
                placeholder="Optional"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => testChainKey("etherscan")}
                disabled={keyTests.etherscan?.testing}
              >
                {keyTests.etherscan?.testing ? "Testing..." : "Test"}
              </button>
            </div>
          </Field>
          <Field label="TronGrid API Key" hint={<KeyTestHint state={keyTests.trongrid} fallback="Optional — empty = rate-limited default" />} style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <input
                className="input"
                type="password"
                value={settings.api.trongridApiKey}
                onChange={(e) => {
                  set("api", "trongridApiKey", e.target.value);
                  setKeyTests((t) => ({ ...t, trongrid: {} }));
                }}
                placeholder="Optional"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => testChainKey("trongrid")}
                disabled={keyTests.trongrid?.testing}
              >
                {keyTests.trongrid?.testing ? "Testing..." : "Test"}
              </button>
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Screening Defaults ── */}
      <Section title="Screening Defaults">
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="Inflow Hops" style={{ flex: 1, minWidth: 120 }}>
            <select className="input" value={settings.screening.defaultInflowHops} onChange={(e) => set("screening", "defaultInflowHops", parseInt(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Outflow Hops" style={{ flex: 1, minWidth: 120 }}>
            <select className="input" value={settings.screening.defaultOutflowHops} onChange={(e) => set("screening", "defaultOutflowHops", parseInt(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Max Nodes / Hop" style={{ flex: 1, minWidth: 120 }}>
            <input className="input" type="number" min={10} max={1000} value={settings.screening.maxNodesPerHop} onChange={(e) => set("screening", "maxNodesPerHop", parseInt(e.target.value) || 200)} />
          </Field>
          <Field label="Max Opponent Paths" style={{ flex: 1, minWidth: 120 }}>
            <input className="input" type="number" min={1} max={200} value={settings.screening.maxOpponentPaths} onChange={(e) => set("screening", "maxOpponentPaths", parseInt(e.target.value) || 50)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="Default KYA Ruleset ID" hint="0 = server default" style={{ flex: 1, minWidth: 140 }}>
            <input className="input" type="number" min={0} value={settings.screening.defaultKyaRulesetId} onChange={(e) => set("screening", "defaultKyaRulesetId", parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Default KYT-IN Ruleset ID" hint="0 = KYT-IN builtin" style={{ flex: 1, minWidth: 140 }}>
            <input className="input" type="number" min={0} value={settings.screening.defaultKytInRulesetId} onChange={(e) => set("screening", "defaultKytInRulesetId", parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Default KYT-OUT Ruleset ID" hint="0 = KYT-OUT builtin" style={{ flex: 1, minWidth: 140 }}>
            <input className="input" type="number" min={0} value={settings.screening.defaultKytOutRulesetId} onChange={(e) => set("screening", "defaultKytOutRulesetId", parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Scoring Ruleset ID" hint="0 = builtin scoring matrix (server-side)" style={{ flex: 1, minWidth: 140 }}>
            <input className="input" type="number" min={0} value={settings.screening.defaultScoringRulesetId} onChange={(e) => set("screening", "defaultScoringRulesetId", parseInt(e.target.value) || 0)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", marginTop: "var(--sp-2)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input type="checkbox" checked={settings.screening.forceTimeSequence} onChange={(e) => set("screening", "forceTimeSequence", e.target.checked)} />
            强制时间序列(force_time_sequence)—— 只计时间上说得通的资金流
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input type="checkbox" checked={settings.screening.cexImmune} onChange={(e) => set("screening", "cexImmune", e.target.checked)} />
            交易所免疫(cex_immune,仅 KYA)—— 地址若为 CEX 则判 0 分
          </label>
        </div>
      </Section>


      {/* ── Monitoring ── */}
      <Section title="Monitoring">
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="Default Schedule" style={{ flex: 1, minWidth: 140 }}>
            <select className="input" value={settings.monitoring.defaultSchedule} onChange={(e) => set("monitoring", "defaultSchedule", e.target.value)}>
              <option value="every_1h">Every 1 hour</option>
              <option value="every_4h">Every 4 hours</option>
              <option value="every_8h">Every 8 hours</option>
              <option value="every_12h">Every 12 hours</option>
              <option value="every_24h">Every 24 hours</option>
            </select>
          </Field>
          <Field label="Max Txs Screened / Run" hint="Excess txs are marked skipped" style={{ flex: 1, minWidth: 140 }}>
            <input className="input" type="number" min={1} max={100} value={settings.monitoring.maxTxPerRun} onChange={(e) => set("monitoring", "maxTxPerRun", parseInt(e.target.value) || 20)} />
          </Field>
          <Field label="Default Min Amount" hint="Token units, e.g. 10 USDT" style={{ flex: 1, minWidth: 140 }}>
            <input className="input" type="number" min={0} step="any" value={settings.monitoring.defaultMinAmount} onChange={(e) => set("monitoring", "defaultMinAmount", parseFloat(e.target.value) || 10)} />
          </Field>
        </div>
      </Section>

      {/* ── AI Reviewer (DeepSeek) ── */}
      <Section title="AI Reviewer · AI 智能复核（DeepSeek）">
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--sp-2)" }}>
          在地址/交易筛查结果页启用「AI 复核」——当地址本身高风险、或与制裁/黑客等有直接交互时给出独立意见（即便占比分数偏低）。留空则不启用。
        </div>
        <Field label="DeepSeek API Key" hint={<KeyTestHint state={keyTests.deepseek} fallback={<span>Get a key at <a href="https://platform.deepseek.com" target="_blank" rel="noopener" style={{ color: "var(--primary-500)" }}>platform.deepseek.com</a></span>} />}>
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <input
              className="input"
              type="password"
              value={settings.ai.deepseekApiKey}
              onChange={(e) => { set("ai", "deepseekApiKey", e.target.value); setKeyTests((t) => ({ ...t, deepseek: {} })); }}
              placeholder="sk-..."
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => testChainKey("deepseek")} disabled={keyTests.deepseek?.testing}>
              {keyTests.deepseek?.testing ? "Testing..." : "Test"}
            </button>
          </div>
        </Field>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="默认模型" hint="deepseek-chat = V3（快）· deepseek-reasoner = R1（更强推理）" style={{ flex: 1, minWidth: 200 }}>
            <select className="input" value={settings.ai.model} onChange={(e) => set("ai", "model", e.target.value)}>
              <option value="deepseek-chat">deepseek-chat (V3)</option>
              <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
            </select>
          </Field>
          <Field label="API Base URL" style={{ flex: 1, minWidth: 200 }}>
            <input className="input" value={settings.ai.baseUrl} onChange={(e) => set("ai", "baseUrl", e.target.value)} placeholder="https://api.deepseek.com" />
          </Field>
        </div>
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications">
        <Field label="Webhook URL" hint="POST { event, timestamp, data } on high-risk screening / monitor alerts">
          <input className="input" value={settings.notifications.webhookUrl} onChange={(e) => set("notifications", "webhookUrl", e.target.value)} placeholder="https://..." />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
          <input type="checkbox" checked={settings.notifications.webhookEnabled} onChange={(e) => set("notifications", "webhookEnabled", e.target.checked)} />
          Enable webhook notifications
        </label>
      </Section>

      {/* ── Save ── */}
      <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
        <button className="btn btn-md btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {error && <span style={{ color: "var(--danger)", fontSize: "var(--text-xs)" }}>{error}</span>}
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "var(--sp-4)" }}>
      <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: description ? 4 : "var(--sp-3)" }}>{title}</div>
      {description && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--sp-3)" }}>{description}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>{children}</div>
    </div>
  );
}

/** Shows the test result under a key field; falls back to the static hint. */
function KeyTestHint({ state, fallback }: { state?: { testing?: boolean; ok?: boolean; detail?: string }; fallback: React.ReactNode }) {
  if (state?.detail) {
    return (
      <span style={{ color: state.ok ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
        {state.ok ? "✓ " : "✗ "}{state.detail}
      </span>
    );
  }
  return <>{fallback}</>;
}

function Field({ label, hint, style, children }: { label: string; hint?: React.ReactNode; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={style}>
      <label className="label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
