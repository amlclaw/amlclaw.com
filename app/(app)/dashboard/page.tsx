"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { shortenAddr, formatTime } from "@/lib/utils";

interface MetricsData {
  system: {
    start_time: string;
    uptime_seconds: number;
    last_screening_at: string | null;
  };
  screening: {
    total: number;
    successful: number;
    failed: number;
    avg_latency_ms: number;
    today: number;
    this_week: number;
  };
  ai: {
    total_calls: number;
    successful: number;
    failed: number;
    by_provider: Record<string, { total: number; successful: number; failed: number }>;
  };
  monitors: {
    total: number;
    active: number;
    paused: number;
    total_addresses: number;
  };
  connections: {
    ai_configured: boolean;
    ai_provider: string;
    trustin_configured: boolean;
    scheduler_active: boolean;
  };
}

interface DashboardData {
  stats: {
    total_screenings: number;
    screenings_this_week: number;
    policies_count: number;
    rulesets_count: number;
    monitors_active: number;
    monitors_running: number;
    monitored_addresses: number;
  };
  risk_distribution: Record<string, number>;
  recent_screenings: Record<string, unknown>[];
  api_status: {
    ai_configured: boolean;
    ai_provider: string;
    ai_mode?: string;
    trustin_configured: boolean;
    scheduler_active: boolean;
    scheduler_jobs: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/metrics").then((r) => r.json()),
    ])
      .then(([dashData, metricsData]) => {
        setData(dashData);
        setMetrics(metricsData);
      })
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

  const { stats, risk_distribution, recent_screenings, api_status } = data;
  const riskTotal = Object.values(risk_distribution).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--sp-1)" }}>Dashboard</h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            Overview of your AML compliance operations
          </p>
        </div>
        {metrics && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
            Uptime {formatUptime(metrics.system.uptime_seconds)}
          </span>
        )}
      </div>

      {/* Setup Alert — only shows if AI is truly not available */}
      {!api_status.ai_configured && (
        <div className="dashboard-alert" style={{ marginBottom: "var(--sp-4)" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            Claude Code not detected. Install Claude Code CLI and run <code style={{ fontFamily: "var(--mono)" }}>claude login</code> to enable AI features.
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="dashboard-stats-grid">
        <StatCard label="Total Screenings" value={stats.total_screenings} icon="search" href="/screening" />
        <StatCard label="This Week" value={stats.screenings_this_week} icon="calendar" />
        <StatCard label="Policies" value={stats.policies_count} icon="doc" href="/policies" />
        <StatCard label="Rule Sets" value={stats.rulesets_count} icon="rules" href="/rules" />
        <StatCard label="Active Monitors" value={stats.monitors_active} icon="monitor" href="/monitoring" />
        <StatCard label="Monitored Addrs" value={stats.monitored_addresses} icon="address" />
      </div>

      {/* Three-column layout: Risk + Recent + Status */}
      <div className="dashboard-main-grid">
        {/* Risk Distribution */}
        <div className="card" style={{ padding: "var(--sp-4)" }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-4)" }}>
            Risk Distribution
            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", marginLeft: "var(--sp-2)", fontSize: "var(--text-xs)" }}>7 days</span>
          </div>
          {riskTotal === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--sp-6)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              No screenings yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {(["Severe", "High", "Medium", "Low"] as const).map((level) => {
                const count = risk_distribution[level] || 0;
                const pct = riskTotal > 0 ? (count / riskTotal) * 100 : 0;
                return (
                  <div key={level}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "var(--text-xs)" }}>
                      <span style={{ color: `var(--risk-${level.toLowerCase()})`, fontWeight: 600 }}>{level}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>{count} ({Math.round(pct)}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, borderRadius: 3,
                        background: `var(--risk-${level.toLowerCase()})`,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Screenings */}
        <div className="card" style={{ padding: "var(--sp-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Recent Screenings</span>
            <Link href="/screening" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {recent_screenings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--sp-6)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              No screenings yet.{" "}
              <Link href="/screening" style={{ color: "var(--primary-400)" }}>Start one →</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent_screenings.slice(0, 8).map((s, i) => {
                const riskLevel = ((s.risk_level as string) || "Low").toLowerCase();
                return (
                  <Link
                    key={i}
                    href={`/screening?job=${s.job_id}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "var(--sp-2)",
                      borderBottom: i < Math.min(recent_screenings.length, 8) - 1 ? "1px solid var(--border-subtle)" : "none",
                      textDecoration: "none", color: "inherit",
                      transition: "background var(--transition)",
                      borderRadius: "var(--radius-sm)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1, minWidth: 0 }}>
                      <span className={`risk-pill ${riskLevel}`} style={{ fontSize: "0.6rem", padding: "1px 6px", flexShrink: 0 }}>
                        {(s.risk_level as string) || "Low"}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }} className="truncate">
                        {shortenAddr((s.address as string) || "")}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>
                        {(s.chain as string) || ""}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
                      {formatTime((s.completed_at as string) || "")}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* System Status (merged) */}
        <div className="card" style={{ padding: "var(--sp-4)" }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-4)" }}>System Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <StatusRow
              label="AI Engine"
              value={api_status.ai_configured ? `Claude Code (${api_status.ai_mode || "cli"})` : "Not connected"}
              ok={api_status.ai_configured}
              hint={api_status.ai_configured && metrics ? `${metrics.ai.total_calls} calls (${metrics.ai.failed} failed)` : undefined}
            />
            <StatusRow
              label="Address Data"
              value={api_status.trustin_configured ? "TrustIn connected" : "Desensitized mode"}
              ok={api_status.trustin_configured}
              hint={!api_status.trustin_configured ? "Add TrustIn key for full data" : undefined}
            />
            <StatusRow
              label="Scheduler"
              value={api_status.scheduler_active ? `${api_status.scheduler_jobs} active jobs` : "No jobs"}
              ok={api_status.scheduler_active}
            />
            <StatusRow
              label="Avg Latency"
              value={metrics && metrics.screening.avg_latency_ms > 0 ? `${(metrics.screening.avg_latency_ms / 1000).toFixed(1)}s` : "N/A"}
              ok={!metrics || metrics.screening.avg_latency_ms < 60000}
            />
            <StatusRow
              label="Last Screening"
              value={metrics?.system.last_screening_at ? formatTime(metrics.system.last_screening_at) : "Never"}
              ok={!!metrics?.system.last_screening_at}
            />
            <StatusRow
              label="Today / Week"
              value={metrics ? `${metrics.screening.today} / ${metrics.screening.this_week}` : "0 / 0"}
              ok={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, icon, href }: { label: string; value: number; icon: string; href?: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    search: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    doc: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    rules: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
    monitor: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    address: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  };

  const content = (
    <div className="dashboard-stat-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, fontFamily: "var(--mono)", lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-1)" }}>
            {label}
          </div>
        </div>
        {iconMap[icon]}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{content}</Link>;
  }
  return content;
}

/* ── Status Row ── */
function StatusRow({ label, value, ok, hint }: { label: string; value: string; ok: boolean; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: ok ? "var(--success)" : "var(--text-tertiary)",
        }} />
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{label}</span>
      </div>
      <div style={{ textAlign: "right", minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", textTransform: "capitalize" }}>{value}</div>
        {hint && <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)" }}>{hint}</div>}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
