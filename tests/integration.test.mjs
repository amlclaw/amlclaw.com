/**
 * AMLClaw Web — Integration Test Suite (v3 — width.info API era)
 *
 * Tests API endpoints and page rendering against the running dev server.
 * Run: node --test tests/integration.test.mjs
 * Requires: dev server running on http://localhost:3000
 *
 * NOTE: does NOT run real screenings (external API + slow) — screening POST
 * validation and job polling shape are covered without waiting for results.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const { method = "GET", body, expectStatus } = opts;
  const fetchOpts = { method, headers: {} };
  if (body !== undefined) {
    fetchOpts.headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, fetchOpts);
  if (expectStatus !== undefined) {
    assert.equal(res.status, expectStatus, `${method} ${path} → expected ${expectStatus}, got ${res.status}`);
  }
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text), ok: res.ok };
  } catch {
    return { status: res.status, data: text, ok: res.ok };
  }
}

// ─── 0. Connectivity ─────────────────────────────────────────────────────────

describe("0. Server connectivity", () => {
  it("dev server is reachable", async () => {
    const res = await fetch(`${BASE}/api/settings`);
    assert.equal(res.status, 200);
  });
});

// ─── 1. Settings API ─────────────────────────────────────────────────────────

describe("1. Settings API", () => {
  it("GET returns v3 sections with masked keys", async () => {
    const { data } = await api("/api/settings", { expectStatus: 200 });
    assert.ok(data.api, "has api section");
    assert.ok(data.screening, "has screening section");
    assert.ok(data.monitoring, "has monitoring section");
    assert.equal(data.ai, undefined, "legacy ai section removed");
    assert.equal(data.blockchain, undefined, "legacy blockchain section removed");
    // Masked key never leaks full value
    if (data.api.widthApiKey) {
      assert.ok(data.api.widthApiKey.startsWith("*"), "width key is masked");
    }
  });

  it("PUT rejects unknown sections", async () => {
    await api("/api/settings", {
      method: "PUT",
      body: { bogus: { x: 1 } },
      expectStatus: 400,
    });
  });

  it("PUT rejects out-of-range hops", async () => {
    await api("/api/settings", {
      method: "PUT",
      body: { screening: { defaultInflowHops: 9 } },
      expectStatus: 400,
    });
  });

  it("PUT accepts a valid partial update", async () => {
    const { data } = await api("/api/settings", {
      method: "PUT",
      body: { screening: { defaultInflowHops: 3 } },
      expectStatus: 200,
    });
    assert.equal(data.ok, true);
  });
});

// ─── 2. Screening (KYA) API ──────────────────────────────────────────────────

describe("2. KYA Screening API", () => {
  it("POST without address returns 400", async () => {
    await api("/api/screening", { method: "POST", body: {}, expectStatus: 400 });
  });

  it("GET history returns an array", async () => {
    const { data } = await api("/api/screening/history", { expectStatus: 200 });
    assert.ok(Array.isArray(data));
  });

  it("GET history?type=kya filters by type", async () => {
    const { data } = await api("/api/screening/history?type=kya", { expectStatus: 200 });
    assert.ok(Array.isArray(data));
    for (const e of data) assert.equal(e.type, "kya");
  });

  it("GET unknown job returns 404", async () => {
    await api("/api/screening/nonexistent0", { expectStatus: 404 });
  });
});

// ─── 3. KYT Screening API ────────────────────────────────────────────────────

describe("3. KYT Screening API", () => {
  it("POST without tx hash returns 400", async () => {
    await api("/api/kyt", { method: "POST", body: {}, expectStatus: 400 });
  });

  it("GET unknown job returns 404", async () => {
    await api("/api/kyt/nonexistent0", { expectStatus: 404 });
  });

  it("GET history?type=kyt filters by type", async () => {
    const { data } = await api("/api/screening/history?type=kyt", { expectStatus: 200 });
    assert.ok(Array.isArray(data));
    for (const e of data) assert.equal(e.type, "kyt");
  });
});

// ─── 4. Monitors API ─────────────────────────────────────────────────────────

describe("4. Monitors API", () => {
  it("GET returns an array", async () => {
    const { data } = await api("/api/monitors", { expectStatus: 200 });
    assert.ok(Array.isArray(data));
  });

  it("GET ?type=address filters", async () => {
    const { data } = await api("/api/monitors?type=address", { expectStatus: 200 });
    for (const m of data) assert.equal(m.type, "address");
  });

  it("POST address monitor without address returns 400", async () => {
    await api("/api/monitors", {
      method: "POST",
      body: { type: "address", chain: "Tron" },
      expectStatus: 400,
    });
  });

  it("POST kyt monitor without tx hash returns 400", async () => {
    await api("/api/monitors", {
      method: "POST",
      body: { type: "kyt", chain: "Tron" },
      expectStatus: 400,
    });
  });

  it("GET unknown monitor returns 404", async () => {
    await api("/api/monitors/mon_nonexistent", { expectStatus: 404 });
  });

  it("scheduler status responds", async () => {
    const { data } = await api("/api/monitors/scheduler/status", { expectStatus: 200 });
    assert.equal(typeof data.initialized, "boolean");
    assert.equal(typeof data.active_jobs, "number");
  });
});

// ─── 5. Dashboard API ────────────────────────────────────────────────────────

describe("5. Dashboard API", () => {
  it("returns v3 stats shape", async () => {
    const { data } = await api("/api/dashboard", { expectStatus: 200 });
    assert.equal(typeof data.stats.total_screenings, "number");
    assert.equal(typeof data.stats.kya_count, "number");
    assert.equal(typeof data.stats.kyt_count, "number");
    assert.equal(typeof data.stats.address_monitors_total, "number");
    assert.equal(typeof data.stats.kyt_monitors_total, "number");
    assert.ok(data.risk_distribution);
    assert.ok("critical" in data.risk_distribution, "v3 risk vocabulary");
    assert.equal(typeof data.api_status.width_configured, "boolean");
  });
});

// ─── 6. Page rendering ───────────────────────────────────────────────────────

describe("6. Page rendering", () => {
  const pages = [
    ["/", "landing"],
    ["/dashboard", "dashboard"],
    ["/screening", "KYA screening"],
    ["/kyt", "KYT screening"],
    ["/monitoring", "address monitoring"],
    ["/kyt-monitoring", "KYT monitoring"],
    ["/settings", "settings"],
  ];

  for (const [path, name] of pages) {
    it(`${name} page (${path}) renders`, async () => {
      const res = await fetch(`${BASE}${path}`);
      assert.equal(res.status, 200, `${path} should render`);
      const html = await res.text();
      assert.ok(html.includes("<!DOCTYPE html>") || html.includes("<html"), "returns HTML");
    });
  }

  it("removed pages return 404", async () => {
    for (const path of ["/documents", "/policies", "/rules", "/cases", "/sar", "/audit"]) {
      const res = await fetch(`${BASE}${path}`);
      assert.equal(res.status, 404, `${path} should be removed`);
    }
  });

  it("removed APIs return 404", async () => {
    for (const path of ["/api/rulesets", "/api/policies", "/api/documents", "/api/cases", "/api/sar", "/api/audit"]) {
      const res = await fetch(`${BASE}${path}`);
      assert.equal(res.status, 404, `${path} should be removed`);
    }
  });
});
