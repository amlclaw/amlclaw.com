"use client";

import { useState, useEffect, useCallback } from "react";
import { Suspense } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import ForceGraph from "@/components/monitor/ForceGraph";

// ---- Mock data generators ----
// In production these would come from /api/monitor-screen endpoints

const ENTITIES = [
  { id: "ent_1", name: "Crypto.com SG", chain: "TRC20", address: "TQn9...3Kfe" },
  { id: "ent_2", name: "Binance SG", chain: "TRC20", address: "TLa2...8xPq" },
  { id: "ent_3", name: "Coinhako", chain: "ERC20", address: "0x4f...a2b1" },
  { id: "ent_4", name: "Independent Reserve", chain: "TRC20", address: "TPxk...9mNv" },
  { id: "ent_5", name: "Gemini APAC", chain: "ERC20", address: "0x8c...f3d7" },
  { id: "ent_6", name: "Paxos SG", chain: "TRC20", address: "TDm3...2wLz" },
];

const TAGS = ["Sanctioned", "Mixer", "Darknet", "Ransomware", "Exchange", "DeFi", "Bridge", "Unknown", "P2P", "OTC"];
const TOKENS = ["USDT", "USDC", "DAI", "BUSD"];
const RISK_TAGS = ["Sanctioned", "Mixer", "Darknet", "Ransomware"];

function randomTag() { return TAGS[Math.floor(Math.random() * TAGS.length)]; }
function randomToken() { return TOKENS[Math.floor(Math.random() * TOKENS.length)]; }
function randomAmount() { return Math.floor(100 + Math.random() * 500000); }
function shortAddr() { return "T" + Math.random().toString(36).slice(2, 8) + "..." + Math.random().toString(36).slice(2, 6); }
function timeAgo(s: number) { return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`; }

interface Tx {
  id: string;
  from: string;
  to: string;
  amount: number;
  token: string;
  tag: string;
  risk: boolean;
  timestamp: number;
}

function generateTx(): Tx {
  const tag = randomTag();
  const isInflow = Math.random() > 0.5;
  const entity = ENTITIES[Math.floor(Math.random() * ENTITIES.length)];
  return {
    id: Math.random().toString(36).slice(2),
    from: isInflow ? shortAddr() : entity.address,
    to: isInflow ? entity.address : shortAddr(),
    amount: randomAmount(),
    token: randomToken(),
    tag,
    risk: RISK_TAGS.includes(tag),
    timestamp: Date.now(),
  };
}

function generateInitialTxs(count: number): Tx[] {
  return Array.from({ length: count }, (_, i) => ({
    ...generateTx(),
    timestamp: Date.now() - (count - i) * 5000,
  }));
}

// ---- Graph data ----
function buildGraphData(entities: typeof ENTITIES) {
  const nodes = [
    ...entities.map((e) => ({ id: e.id, label: e.name, type: "entity" as const, risk: "low" as const })),
    { id: "ext_1", label: "Binance Hot", type: "exchange" as const, risk: "low" as const },
    { id: "ext_2", label: "OKX", type: "exchange" as const, risk: "low" as const },
    { id: "ext_3", label: "Tornado Cash", type: "risk" as const, risk: "severe" as const },
    { id: "ext_4", label: "Uniswap V3", type: "defi" as const, risk: "low" as const },
    { id: "ext_5", label: "Unknown Wallet", type: "unknown" as const, risk: "medium" as const },
    { id: "ext_6", label: "Sanctioned Addr", type: "risk" as const, risk: "severe" as const },
    { id: "ext_7", label: "ChipMixer", type: "risk" as const, risk: "high" as const },
    { id: "ext_8", label: "dYdX", type: "defi" as const, risk: "low" as const },
    { id: "ext_9", label: "Circle Treasury", type: "exchange" as const, risk: "low" as const },
  ];

  const edges = [
    { source: "ext_1", target: "ent_1", amount: 125000, token: "USDT", timestamp: Date.now(), risk: false },
    { source: "ent_1", target: "ext_2", amount: 89000, token: "USDT", timestamp: Date.now(), risk: false },
    { source: "ext_3", target: "ent_2", amount: 45000, token: "USDT", timestamp: Date.now(), risk: true },
    { source: "ent_2", target: "ext_4", amount: 230000, token: "USDC", timestamp: Date.now(), risk: false },
    { source: "ext_5", target: "ent_3", amount: 18000, token: "USDT", timestamp: Date.now(), risk: false },
    { source: "ent_3", target: "ext_1", amount: 67000, token: "USDC", timestamp: Date.now(), risk: false },
    { source: "ext_6", target: "ent_4", amount: 92000, token: "USDT", timestamp: Date.now(), risk: true },
    { source: "ent_4", target: "ext_8", amount: 31000, token: "DAI", timestamp: Date.now(), risk: false },
    { source: "ext_7", target: "ent_5", amount: 55000, token: "USDT", timestamp: Date.now(), risk: true },
    { source: "ent_5", target: "ext_9", amount: 178000, token: "USDC", timestamp: Date.now(), risk: false },
    { source: "ext_9", target: "ent_6", amount: 340000, token: "USDC", timestamp: Date.now(), risk: false },
    { source: "ent_6", target: "ext_2", amount: 115000, token: "USDT", timestamp: Date.now(), risk: false },
    { source: "ext_1", target: "ent_5", amount: 44000, token: "USDT", timestamp: Date.now(), risk: false },
    { source: "ent_1", target: "ext_4", amount: 76000, token: "USDC", timestamp: Date.now(), risk: false },
  ];

  return { nodes, edges };
}

// ---- Charts data ----
function generateHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    volume: 50000 + Math.random() * 450000,
    alerts: Math.floor(Math.random() * 5),
  }));
}

const STABLECOIN_DATA = [
  { name: "USDT", value: 62, color: "#26a17b" },
  { name: "USDC", value: 28, color: "#2775ca" },
  { name: "DAI", value: 7, color: "#f5ac37" },
  { name: "BUSD", value: 3, color: "#f0b90b" },
];

const CHAIN_DATA = [
  { name: "Tron", value: 55, color: "#ff0013" },
  { name: "ETH", value: 30, color: "#627eea" },
  { name: "BSC", value: 12, color: "#f0b90b" },
  { name: "Other", value: 3, color: "#6b7280" },
];

const RISK_TAG_DATA = [
  { name: "Sanctions", count: 12, color: "#f87171" },
  { name: "Mixer", count: 8, color: "#fb923c" },
  { name: "Darknet", count: 5, color: "#a78bfa" },
  { name: "Ransomware", count: 3, color: "#f472b6" },
  { name: "Unknown", count: 15, color: "#6b7280" },
];

// ---- Main Component ----

function MonitorScreenInner() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [txs, setTxs] = useState<Tx[]>(() => generateInitialTxs(30));
  const [hourlyData] = useState(generateHourlyData);
  const [graphData] = useState(() => buildGraphData(ENTITIES));

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Simulated live transactions
  useEffect(() => {
    const t = setInterval(() => {
      setTxs((prev) => [generateTx(), ...prev.slice(0, 49)]);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((f) => !f);
  }, []);

  // KPI values
  const totalTxToday = 1847 + txs.length;
  const totalVolume = 12.4;
  const activeAddresses = 342;
  const pendingAlerts = txs.filter((t) => t.risk).length;

  // Entity summary
  const entitySummary = ENTITIES.map((e) => ({
    ...e,
    inflow: Math.floor(100000 + Math.random() * 900000),
    outflow: Math.floor(80000 + Math.random() * 700000),
    balance: Math.floor(500000 + Math.random() * 5000000),
  }));

  // Alerts
  const alerts = txs.filter((t) => t.risk).slice(0, 8);

  const content = (
    <div className="monitor-screen">
      {/* Header */}
      <div className="monitor-header">
        <div className="monitor-header-title">AMLClaw Surveillance — MAS Regulatory Monitor</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="monitor-live">
            <span className="monitor-live-dot" />
            LIVE
          </div>
          <div className="monitor-header-time">
            {time.toLocaleDateString("en-SG", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
            {" "}
            {time.toLocaleTimeString("en-SG", { hour12: false })}
          </div>
        </div>
        <div className="monitor-header-actions">
          <button className="monitor-btn" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Body: Graph + Right sidebar */}
      <div className="monitor-body">
        {/* Force Graph */}
        <div className="monitor-graph monitor-panel">
          <div className="monitor-panel-title">Network Flow — Real-time Transaction Graph</div>
          <ForceGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
          />
        </div>

        {/* Right: 3 stacked panels */}
        <div className="monitor-right">
          {/* Transaction Feed */}
          <div className="monitor-panel">
            <div className="monitor-panel-title">Live Transactions</div>
            <div className="monitor-tx-list">
              {txs.slice(0, 15).map((tx) => (
                <div key={tx.id} className={`monitor-tx ${tx.risk ? "high-risk" : ""}`}>
                  <span className="monitor-tx-amount">
                    ${tx.amount.toLocaleString()}
                  </span>
                  <span className="monitor-tx-tag">{tx.token}</span>
                  <span className={`monitor-tx-tag ${tx.risk ? "danger" : ""}`}>{tx.tag}</span>
                  <span className="monitor-tx-time">
                    {timeAgo(Math.floor((Date.now() - tx.timestamp) / 1000))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="monitor-panel">
            <div className="monitor-panel-title" style={{ color: alerts.length > 0 ? "#f87171" : undefined }}>
              Risk Alerts ({alerts.length})
            </div>
            <div className="monitor-tx-list">
              {alerts.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, padding: 16, textAlign: "center" }}>
                  No active alerts
                </div>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="monitor-alert">
                    <span className="monitor-alert-icon">&#9888;</span>
                    <span className="monitor-alert-text">
                      <strong>{a.tag}</strong> detected: ${a.amount.toLocaleString()} {a.token} from {a.from.slice(0, 10)}...
                    </span>
                    <span className="monitor-alert-time">
                      {timeAgo(Math.floor((Date.now() - a.timestamp) / 1000))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Entity List */}
          <div className="monitor-panel">
            <div className="monitor-panel-title">Monitored Entities</div>
            <div className="monitor-entity-list">
              {entitySummary.map((e) => (
                <div key={e.id} className="monitor-entity">
                  <span className="monitor-entity-name">{e.name}</span>
                  <span className="monitor-entity-val inflow">+${(e.inflow / 1000).toFixed(0)}K</span>
                  <span className="monitor-entity-val outflow">-${(e.outflow / 1000).toFixed(0)}K</span>
                  <span className="monitor-entity-val">${(e.balance / 1000000).toFixed(1)}M</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Far right: charts column */}
        <div className="monitor-right">
          {/* Stablecoin Distribution */}
          <div className="monitor-panel">
            <div className="monitor-panel-title">Stablecoin Distribution</div>
            <div className="monitor-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={STABLECOIN_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    dataKey="value"
                    stroke="none"
                  >
                    {STABLECOIN_DATA.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(0,240,255,0.2)", borderRadius: 6, fontSize: 11 }}
                    itemStyle={{ color: "#e0e6ed" }}
                    formatter={(v) => `${v}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Tag Distribution */}
          <div className="monitor-panel">
            <div className="monitor-panel-title">Risk Tag Distribution</div>
            <div className="monitor-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={RISK_TAG_DATA} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={70} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {RISK_TAG_DATA.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(0,240,255,0.2)", borderRadius: 6, fontSize: 11 }}
                    itemStyle={{ color: "#e0e6ed" }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chain Distribution */}
          <div className="monitor-panel">
            <div className="monitor-panel-title">Chain Distribution</div>
            <div className="monitor-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={CHAIN_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    dataKey="value"
                    stroke="none"
                  >
                    {CHAIN_DATA.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(0,240,255,0.2)", borderRadius: 6, fontSize: 11 }}
                    itemStyle={{ color: "#e0e6ed" }}
                    formatter={(v) => `${v}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom KPI + Charts */}
      <div className="monitor-bottom">
        {/* KPI 1 */}
        <div className="monitor-panel monitor-kpi">
          <div className="monitor-kpi-value">{totalTxToday.toLocaleString()}</div>
          <div className="monitor-kpi-label">Transactions Today</div>
          <div className="monitor-kpi-delta up">+12.3% vs yesterday</div>
        </div>

        {/* KPI 2 */}
        <div className="monitor-panel monitor-kpi">
          <div className="monitor-kpi-value">${totalVolume.toFixed(1)}M</div>
          <div className="monitor-kpi-label">Total Volume (USD)</div>
          <div className="monitor-kpi-delta up">+8.7% vs yesterday</div>
        </div>

        {/* 24h Trend */}
        <div className="monitor-panel">
          <div className="monitor-panel-title">24h Volume Trend</div>
          <div className="monitor-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} interval={5} />
                <YAxis hide />
                <Area type="monotone" dataKey="volume" stroke="#00f0ff" strokeWidth={1.5} fill="url(#volumeGrad)" />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(0,240,255,0.2)", borderRadius: 6, fontSize: 11 }}
                  itemStyle={{ color: "#e0e6ed" }}
                  formatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3 + 4 */}
        <div className="monitor-panel" style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 1 }}>
          <div className="monitor-kpi">
            <div className="monitor-kpi-value" style={{ fontSize: 24 }}>{activeAddresses}</div>
            <div className="monitor-kpi-label">Active Addresses</div>
          </div>
          <div className="monitor-kpi">
            <div className="monitor-kpi-value" style={{ fontSize: 24, background: pendingAlerts > 0 ? "linear-gradient(180deg, #fff 0%, #f87171 100%)" : undefined, WebkitBackgroundClip: "text" }}>
              {pendingAlerts}
            </div>
            <div className="monitor-kpi-label" style={{ color: pendingAlerts > 0 ? "rgba(248,113,113,0.6)" : undefined }}>
              Pending Alerts
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return <div className="monitor-fullscreen">{content}</div>;
  }

  return content;
}

export default function MonitorScreenPage() {
  return (
    <Suspense fallback={<div style={{ background: "#06060f", height: "100%" }} />}>
      <MonitorScreenInner />
    </Suspense>
  );
}
