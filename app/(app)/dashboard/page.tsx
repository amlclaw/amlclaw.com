"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { shortenAddr, formatTime } from "@/lib/utils";
import { riskColorVar, riskLabel } from "@/lib/risk-ui";

interface DashboardData {
  stats: {
    total_screenings: number;
    screenings_this_week: number;
    kya_count: number;
    kyt_count: number;
    address_monitors_active: number;
    address_monitors_total: number;
    kyt_monitors_active: number;
    kyt_monitors_total: number;
  };
  risk_distribution: Record<string, number>;
  recent_screenings: Record<string, unknown>[];
  recent_alerts: Record<string, unknown>[];
  api_status: {
    width_configured: boolean;
    etherscan_configured: boolean;
    trongrid_configured: boolean;
    scheduler_active: boolean;
    scheduler_jobs: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "var(--sp-6)", display: "flex", justifyContent: "center", paddingTop: 100 }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "var(--sp-6)", color: "var(--text-tertiary)", textAlign: "center" }}>
        Failed to load dashboard data
      </div>
    );
  }

  const { stats, risk_distribution, recent_screenings, recent_alerts, api_status } = data;
  const riskTotal = Object.values(risk_distribution).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--sp-1)" }}>Dashboard</h1>
        <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
          KYA / KYT screening &amp; monitoring overview — powered by width.info
        </p>
      </div>

      {/* Setup alert */}
      {!api_status.width_configured && (
        <div className="dashboard-alert" style={{ marginBottom: "var(--sp-4)" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            Width.info API key not configured — set it in <Link href="/settings" style={{ color: "var(--primary-500)" }}>Settings</Link> to enable screening.
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="dashboard-stats-grid" style={{ marginBottom: "var(--sp-4)" }}>
        <StatCard value={stats.total_screenings} label="Total Screenings" href="/screening" />
        <StatCard value={stats.screenings_this_week} label="This Week" href="/screening" />
        <StatCard value={stats.kya_count} label="KYA (Address)" href="/screening" />
        <StatCard value={stats.kyt_count} label="KYT (Tx)" href="/kyt" />
        <StatCard value={`${stats.address_monitors_active}/${stats.address_monitors_total}`} label="Address Monitors" href="/monitoring" />
        <StatCard value={`${stats.kyt_monitors_active}/${stats.kyt_monitors_total}`} label="TX Monitors" href="/tx-monitoring" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--sp-4)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {/* Risk Distribution */}
          <div className="card" style={{ padding: "var(--sp-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)" }}>
              Risk Distribution <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>7 days</span>
            </div>
            {riskTotal === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", padding: "var(--sp-4) 0" }}>No screenings yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                {["critical", "high", "medium", "low"].map((level) => {
                  const count = risk_distribution[level] || 0;
                  const pct = riskTotal ? (count / riskTotal) * 100 : 0;
                  return (
                    <div key={level} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                      <span style={{ width: 60, fontSize: "var(--text-xs)", color: riskColorVar(level), fontWeight: 600, textTransform: "uppercase" }}>
                        {riskLabel(level)}
                      </span>
                      <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: riskColorVar(level), borderRadius: 4, transition: "width 0.4s" }} />
                      </div>
                      <span style={{ width: 30, textAlign: "right", fontSize: "var(--text-xs)", fontFamily: "var(--mono)", color: "var(--text-secondary)" }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Screenings */}
          <div className="card" style={{ padding: "var(--sp-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-3)" }}>
              <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>Recent Screenings</span>
            </div>
            {recent_screenings.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>No screenings yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recent_screenings.map((h, i) => (
                  <Link
                    key={i}
                    href={h.type === "kyt" ? "/kyt" : "/screening"}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--sp-2)",
                      padding: "6px 0", borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "var(--text-xs)", textDecoration: "none", color: "inherit",
                    }}
                  >
                    <span className="badge" style={{ flexShrink: 0, textTransform: "uppercase" }}>{h.type as string}</span>
                    <span style={{ fontFamily: "var(--mono)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shortenAddr((h.subject as string) || "")}
                    </span>
                    <span style={{ color: riskColorVar((h.risk_level as string) || "low"), fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem" }}>
                      {riskLabel((h.risk_level as string) || "low")}
                    </span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.65rem", flexShrink: 0 }}>
                      {formatTime(h.completed_at as string)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {/* System Status */}
          <div className="card" style={{ padding: "var(--sp-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)" }}>System Status</div>
            <StatusRow label="Width.info API" ok={api_status.width_configured} okText="Configured" badText="No API key" />
            <StatusRow label="Etherscan" ok={api_status.etherscan_configured} okText="Custom key" badText="Default (rate-limited)" warnOnly />
            <StatusRow label="TronGrid" ok={api_status.trongrid_configured} okText="Custom key" badText="Default (rate-limited)" warnOnly />
            <StatusRow label="Scheduler" ok={api_status.scheduler_jobs > 0} okText={`${api_status.scheduler_jobs} jobs`} badText="No jobs" warnOnly />
          </div>

          {/* Recent Alerts */}
          <div className="card" style={{ padding: "var(--sp-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)" }}>Recent High-Risk</div>
            {recent_alerts.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>No high-risk results</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
                {recent_alerts.map((a, i) => (
                  <div key={i} style={{ fontSize: "0.65rem", fontFamily: "var(--mono)", display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
                    <span style={{ color: riskColorVar((a.risk_level as string) || "high"), fontWeight: 700 }}>●</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shortenAddr((a.subject as string) || "")}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>{(a.chain as string) || ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, href }: { value: string | number; label: string; href: string }) {
  return (
    <Link href={href} className="card" style={{ padding: "var(--sp-3) var(--sp-4)", textDecoration: "none", color: "inherit" }}>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, fontFamily: "var(--mono)" }}>{value}</div>
      <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
        {label}
      </div>
    </Link>
  );
}

function StatusRow({ label, ok, okText, badText, warnOnly }: { label: string; ok: boolean; okText: string; badText: string; warnOnly?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: "var(--text-xs)" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: ok ? "var(--success)" : warnOnly ? "var(--warning)" : "var(--danger)", fontWeight: 600 }}>
        {ok ? okText : badText}
      </span>
    </div>
  );
}
