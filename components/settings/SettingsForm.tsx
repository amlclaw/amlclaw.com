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
    pollingTimeout: number;
  };
  monitoring: {
    defaultSchedule: string;
    maxTxPerRun: number;
    defaultMinAmount: number;
  };
  scoring: {
    inBases: { direct: number; hop2: number; hop3: number };
    outBases: { direct: number; hop2: number; hop3: number };
    severityWeights: { critical: number; high: number; medium: number; low: number };
    selfHitScore: number;
    bands: { review: number; edd: number; block: number };
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

  /** Nested setter for scoring sub-objects (inBases / outBases / severityWeights / bands). */
  const setScoring = (group: keyof Settings["scoring"], field: string, value: number) => {
    setSettings((s) => s ? {
      ...s,
      scoring: { ...s.scoring, [group]: { ...(s.scoring[group] as Record<string, number>), [field]: value } },
    } : s);
  };

  const testChainKey = async (provider: "width" | "etherscan" | "trongrid") => {
    setKeyTests((t) => ({ ...t, [provider]: { testing: true } }));
    try {
      const apiKey =
        provider === "etherscan" ? settings.api.etherscanApiKey
        : provider === "trongrid" ? settings.api.trongridApiKey
        : settings.api.widthApiKey;
      const res = await fetch("/api/settings/test-chain-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          ...(provider === "width" ? { baseUrl: settings.api.widthBaseUrl } : {}),
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
        </div>
      </Section>

      {/* ── Scoring rule engine (资金占比评分) ── */}
      <Section title="Scoring · 评分规则引擎">
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--sp-2)" }}>
          每格贡献 = 基数(方向×跳数桶) × 严重度乘数 × 资金占比,总分封顶 100。钱只算一次,路径不加分。
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="入金基数 0-1跳" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.inBases.direct} onChange={(e) => setScoring("inBases", "direct", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="入金 2跳" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.inBases.hop2} onChange={(e) => setScoring("inBases", "hop2", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="入金 3跳" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.inBases.hop3} onChange={(e) => setScoring("inBases", "hop3", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="出金基数 0-1跳" hint="CFT:直接资助被标记实体,一级信号" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.outBases.direct} onChange={(e) => setScoring("outBases", "direct", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="出金 2跳" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.outBases.hop2} onChange={(e) => setScoring("outBases", "hop2", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="出金 3跳" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.outBases.hop3} onChange={(e) => setScoring("outBases", "hop3", parseFloat(e.target.value) || 0)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="乘数 critical" style={{ flex: 1, minWidth: 100 }}>
            <input className="input" type="number" min={0} max={1} step={0.1} value={settings.scoring.severityWeights.critical} onChange={(e) => setScoring("severityWeights", "critical", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="乘数 high" style={{ flex: 1, minWidth: 100 }}>
            <input className="input" type="number" min={0} max={1} step={0.1} value={settings.scoring.severityWeights.high} onChange={(e) => setScoring("severityWeights", "high", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="乘数 medium" style={{ flex: 1, minWidth: 100 }}>
            <input className="input" type="number" min={0} max={1} step={0.1} value={settings.scoring.severityWeights.medium} onChange={(e) => setScoring("severityWeights", "medium", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="乘数 low" style={{ flex: 1, minWidth: 100 }}>
            <input className="input" type="number" min={0} max={1} step={0.1} value={settings.scoring.severityWeights.low} onChange={(e) => setScoring("severityWeights", "low", parseFloat(e.target.value) || 0)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Field label="SELFHIT 覆盖分" hint="对象本身被制裁/冻结" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.selfHitScore} onChange={(e) => set("scoring", "selfHitScore", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="复核下限" hint="≥此分 → 人工复核" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.bands.review} onChange={(e) => setScoring("bands", "review", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="尽调下限" hint="≥此分 → 加强尽调" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.bands.edd} onChange={(e) => setScoring("bands", "edd", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="拒绝下限" hint="≥此分 → 拒绝" style={{ flex: 1, minWidth: 110 }}>
            <input className="input" type="number" min={0} max={100} value={settings.scoring.bands.block} onChange={(e) => setScoring("bands", "block", parseFloat(e.target.value) || 0)} />
          </Field>
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
