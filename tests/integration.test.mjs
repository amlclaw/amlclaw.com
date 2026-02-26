/**
 * AMLClaw Web — Integration Test Suite
 *
 * Tests all API endpoints and core flows against the running dev server.
 * Run: node --test tests/integration.test.mjs
 * Requires: dev server running on http://localhost:3000
 */

import { describe, it, before, after } from "node:test";
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

// Track created resources for cleanup
const cleanup = { policyIds: [], rulesetIds: [], uploadIds: [] };

// ─── Connectivity ────────────────────────────────────────────────────────────

describe("0. Server connectivity", () => {
  it("dev server is reachable", async () => {
    const res = await fetch(`${BASE}/api/ai/status`);
    assert.equal(res.status, 200);
  });
});

// ─── 1. Documents API ────────────────────────────────────────────────────────

describe("1. Documents API", () => {
  it("GET /api/documents — returns 40+ documents", async () => {
    const { data } = await api("/api/documents", { expectStatus: 200 });
    assert.ok(Array.isArray(data), "should be an array");
    assert.ok(data.length >= 40, `expected >= 40 docs, got ${data.length}`);
  });

  it("documents have correct structure", async () => {
    const { data } = await api("/api/documents");
    for (const doc of data) {
      assert.ok(doc.id, "doc must have id");
      assert.ok(doc.name, "doc must have name");
      assert.ok(doc.category, "doc must have category");
      assert.ok(doc.icon, "doc must have icon");
      assert.ok(doc.path, "doc must have path");
    }
  });

  it("covers all expected categories", async () => {
    const { data } = await api("/api/documents");
    const categories = [...new Set(data.map((d) => d.category))].sort();
    assert.ok(categories.includes("FATF"), "should include FATF");
    assert.ok(categories.includes("Singapore"), "should include Singapore");
    assert.ok(categories.includes("Hong Kong"), "should include Hong Kong");
    assert.ok(categories.includes("Dubai"), "should include Dubai");
    assert.ok(categories.includes("Sanctions"), "should include Sanctions");
    assert.ok(categories.includes("Reference"), "should include Reference");
  });

  it("has correct doc counts per category", async () => {
    const { data } = await api("/api/documents");
    const counts = {};
    data.forEach((d) => { counts[d.category] = (counts[d.category] || 0) + 1; });
    assert.equal(counts["FATF"], 5, "FATF should have 5 docs");
    assert.equal(counts["Sanctions"], 3, "Sanctions should have 3 docs");
    assert.ok(counts["Singapore"] >= 10, `Singapore should have >= 10 docs, got ${counts["Singapore"]}`);
    assert.ok(counts["Hong Kong"] >= 10, `Hong Kong should have >= 10 docs, got ${counts["Hong Kong"]}`);
    assert.ok(counts["Dubai"] >= 10, `Dubai should have >= 10 docs, got ${counts["Dubai"]}`);
  });

  it("GET /api/documents/{id}/content — loads FATF doc content", async () => {
    const { data } = await api("/api/documents/fatf-001/content", { expectStatus: 200 });
    assert.ok(data.id === "fatf-001");
    assert.ok(data.content.length > 100, "content should be substantial");
    assert.ok(data.content.includes("FATF") || data.content.includes("Recommendation"), "content should mention FATF");
  });

  it("GET /api/documents/{id}/content — loads Singapore doc", async () => {
    const { data } = await api("/api/documents/sg-001/content", { expectStatus: 200 });
    assert.ok(data.content.length > 100);
  });

  it("GET /api/documents/{id}/content — loads HK doc", async () => {
    const { data } = await api("/api/documents/hk-001/content", { expectStatus: 200 });
    assert.ok(data.content.length > 100);
  });

  it("GET /api/documents/{id}/content — loads UAE doc", async () => {
    const { data } = await api("/api/documents/uae-001/content", { expectStatus: 200 });
    assert.ok(data.content.length > 100);
  });

  it("GET /api/documents/{id}/content — 404 for unknown id", async () => {
    await api("/api/documents/nonexistent-999/content", { expectStatus: 404 });
  });
});

// ─── 2. Document Upload ──────────────────────────────────────────────────────

describe("2. Document Upload", () => {
  let uploadedDocId;

  it("POST /api/documents/upload — uploads a .md file", async () => {
    const content = "# Test Upload\n\nThis is a test regulatory document for automated testing.\n\n## Section 1\n\nSome compliance text here.";
    const blob = new Blob([content], { type: "text/markdown" });
    const formData = new FormData();
    formData.append("file", blob, "test-upload.md");

    const res = await fetch(`${BASE}/api/documents/upload`, {
      method: "POST",
      body: formData,
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id, "should return an id");
    assert.equal(data.name, "test-upload");
    assert.equal(data.category, "User Upload");
    assert.equal(data.type, "upload");
    uploadedDocId = data.id;
    cleanup.uploadIds.push(uploadedDocId);
  });

  it("uploaded doc appears in document list", async () => {
    const { data } = await api("/api/documents");
    const found = data.find((d) => d.id === uploadedDocId);
    assert.ok(found, "uploaded doc should be in the list");
    assert.equal(found.category, "User Upload");
  });

  it("uploaded doc content is loadable", async () => {
    const { data } = await api(`/api/documents/${uploadedDocId}/content`, { expectStatus: 200 });
    assert.ok(data.content.includes("Test Upload"), "should contain uploaded content");
  });

  it("DELETE /api/documents/{id} — deletes uploaded doc", async () => {
    await api(`/api/documents/${uploadedDocId}`, { method: "DELETE", expectStatus: 200 });
    cleanup.uploadIds = cleanup.uploadIds.filter((id) => id !== uploadedDocId);
  });

  it("deleted doc no longer in list", async () => {
    const { data } = await api("/api/documents");
    const found = data.find((d) => d.id === uploadedDocId);
    assert.ok(!found, "deleted doc should not be in the list");
  });
});

// ─── 3. Rulesets API ─────────────────────────────────────────────────────────

describe("3. Rulesets API", () => {
  let customRulesetId;

  it("GET /api/rulesets — returns 3 built-in rulesets", async () => {
    const { data } = await api("/api/rulesets", { expectStatus: 200 });
    assert.ok(Array.isArray(data));
    const builtins = data.filter((r) => r.builtin === true);
    assert.equal(builtins.length, 3, "should have exactly 3 built-in rulesets");

    const ids = builtins.map((r) => r.id).sort();
    assert.deepEqual(ids, ["dubai_vara", "hong_kong_sfc", "singapore_mas"]);
  });

  it("built-in rulesets have correct rule counts", async () => {
    const { data } = await api("/api/rulesets");
    const sg = data.find((r) => r.id === "singapore_mas");
    const hk = data.find((r) => r.id === "hong_kong_sfc");
    const ae = data.find((r) => r.id === "dubai_vara");
    assert.ok(sg.rules_count >= 15, `SG should have >= 15 rules, got ${sg.rules_count}`);
    assert.ok(hk.rules_count >= 15, `HK should have >= 15 rules, got ${hk.rules_count}`);
    assert.ok(ae.rules_count >= 15, `AE should have >= 15 rules, got ${ae.rules_count}`);
  });

  it("GET /api/rulesets/{id} — loads built-in ruleset details", async () => {
    const { data } = await api("/api/rulesets/singapore_mas", { expectStatus: 200 });
    assert.ok(data.rules, "should have rules array");
    assert.ok(Array.isArray(data.rules));
    assert.ok(data.rules.length >= 15);
    // Verify rule structure
    const rule = data.rules[0];
    assert.ok(rule.rule_id, "rule must have rule_id");
    assert.ok(rule.category, "rule must have category");
    assert.ok(rule.name, "rule must have name");
    assert.ok(rule.risk_level, "rule must have risk_level");
    assert.ok(rule.action, "rule must have action");
  });

  it("POST /api/rulesets — creates custom ruleset (empty)", async () => {
    const { data, status } = await api("/api/rulesets", {
      method: "POST",
      body: { name: "Test Ruleset", jurisdiction: "Test" },
    });
    assert.equal(status, 200);
    assert.ok(data.id, "should return id");
    assert.equal(data.name, "Test Ruleset");
    assert.equal(data.rules_count, 0);
    customRulesetId = data.id;
    cleanup.rulesetIds.push(customRulesetId);
  });

  it("POST /api/rulesets — creates cloned ruleset", async () => {
    const { data } = await api("/api/rulesets", {
      method: "POST",
      body: { name: "SG Clone", jurisdiction: "Singapore", clone_from: "singapore_mas" },
    });
    assert.ok(data.id);
    assert.ok(data.rules_count >= 15, "cloned ruleset should have rules");
    cleanup.rulesetIds.push(data.id);
  });

  it("POST /api/rulesets — rejects empty name", async () => {
    await api("/api/rulesets", {
      method: "POST",
      body: { name: "", jurisdiction: "Test" },
      expectStatus: 400,
    });
  });

  it("custom ruleset appears in list", async () => {
    const { data } = await api("/api/rulesets");
    const found = data.find((r) => r.id === customRulesetId);
    assert.ok(found, "custom ruleset should appear in list");
    assert.equal(found.builtin, false);
  });

  it("POST /api/rulesets/{id}/rules — adds rule to custom ruleset", async () => {
    const { status } = await api(`/api/rulesets/${customRulesetId}/rules`, {
      method: "POST",
      body: {
        rule_id: "TEST-001",
        category: "Deposit",
        name: "Test Rule",
        risk_level: "High",
        action: "Reject",
        conditions: [
          { parameter: "path.risk_percentage", operator: ">", value: 50 },
        ],
      },
    });
    assert.equal(status, 200);
  });

  it("added rule is visible in ruleset", async () => {
    const { data } = await api(`/api/rulesets/${customRulesetId}`);
    assert.equal(data.rules.length, 1);
    assert.equal(data.rules[0].rule_id, "TEST-001");
    assert.equal(data.rules[0].risk_level, "High");
  });

  it("DELETE /api/rulesets/{id} — deletes custom ruleset", async () => {
    await api(`/api/rulesets/${customRulesetId}`, { method: "DELETE", expectStatus: 200 });
    cleanup.rulesetIds = cleanup.rulesetIds.filter((id) => id !== customRulesetId);
  });

  it("cannot delete built-in ruleset", async () => {
    const { status } = await api("/api/rulesets/singapore_mas", { method: "DELETE" });
    assert.ok(status >= 400, "should reject deletion of built-in ruleset");
  });
});

// ─── 4. Schema Enums API ────────────────────────────────────────────────────

describe("4. Schema Enums API", () => {
  it("GET /api/schema/enums — returns valid enum values", async () => {
    const { data } = await api("/api/schema/enums", { expectStatus: 200 });
    assert.ok(data.categories, "should have categories");
    assert.ok(data.risk_levels, "should have risk_levels");
    assert.ok(data.actions, "should have actions");
    assert.ok(data.operators, "should have operators");
    assert.ok(data.categories.includes("Deposit"), "categories should include Deposit");
    assert.ok(data.risk_levels.includes("High"), "risk_levels should include High");
    assert.ok(data.actions.includes("Reject"), "actions should include Reject");
  });
});

// ─── 5. Policies API (CRUD) ─────────────────────────────────────────────────

describe("5. Policies API", () => {
  let policyId;

  it("GET /api/policies — initially returns array", async () => {
    const { data } = await api("/api/policies", { expectStatus: 200 });
    assert.ok(Array.isArray(data), "should be an array");
  });

  it("POST /api/policies — creates a new policy", async () => {
    const { data } = await api("/api/policies", {
      method: "POST",
      body: {
        name: "Test SG Policy",
        jurisdiction: "Singapore",
        source_documents: ["sg-001", "sg-004", "fatf-001"],
      },
      expectStatus: 201,
    });
    assert.ok(data.id, "should have id");
    assert.ok(data.id.startsWith("policy_"), "id should start with policy_");
    assert.equal(data.name, "Test SG Policy");
    assert.equal(data.jurisdiction, "Singapore");
    assert.equal(data.status, "generating");
    assert.deepEqual(data.source_documents, ["sg-001", "sg-004", "fatf-001"]);
    assert.ok(data.created_at, "should have created_at");
    policyId = data.id;
    cleanup.policyIds.push(policyId);
  });

  it("POST /api/policies — rejects empty name", async () => {
    await api("/api/policies", {
      method: "POST",
      body: { name: "", jurisdiction: "Test" },
      expectStatus: 400,
    });
  });

  it("GET /api/policies/{id} — loads created policy", async () => {
    const { data } = await api(`/api/policies/${policyId}`, { expectStatus: 200 });
    assert.equal(data.id, policyId);
    assert.equal(data.name, "Test SG Policy");
    assert.equal(data.jurisdiction, "Singapore");
    assert.ok("content" in data, "should have content field");
  });

  it("GET /api/policies/{id} — 404 for unknown", async () => {
    await api("/api/policies/nonexistent_policy_123", { expectStatus: 404 });
  });

  it("PUT /api/policies/{id} — updates policy content and status", async () => {
    const policyContent = "# Singapore MAS DPT Compliance Policy\n\n## 1. Executive Summary\n\nThis is a test policy content.";
    const { data } = await api(`/api/policies/${policyId}`, {
      method: "PUT",
      body: { content: policyContent, status: "ready" },
      expectStatus: 200,
    });
    assert.equal(data.status, "ready");
    assert.equal(data.content, policyContent);
  });

  it("PUT /api/policies/{id} — 404 for unknown", async () => {
    await api("/api/policies/nonexistent_policy_123", {
      method: "PUT",
      body: { content: "test" },
      expectStatus: 404,
    });
  });

  it("updated policy appears in list with correct status", async () => {
    const { data } = await api("/api/policies");
    const found = data.find((p) => p.id === policyId);
    assert.ok(found, "policy should be in list");
    assert.equal(found.status, "ready");
    assert.equal(found.name, "Test SG Policy");
  });

  it("POST /api/policies — creates second policy", async () => {
    const { data } = await api("/api/policies", {
      method: "POST",
      body: {
        name: "Test HK Policy",
        jurisdiction: "Hong Kong",
        source_documents: ["hk-001"],
      },
      expectStatus: 201,
    });
    cleanup.policyIds.push(data.id);
  });

  it("GET /api/policies — returns multiple policies", async () => {
    const { data } = await api("/api/policies");
    const testPolicies = data.filter((p) => p.name.startsWith("Test "));
    assert.ok(testPolicies.length >= 2, "should have at least 2 test policies");
  });

  it("DELETE /api/policies/{id} — deletes policy", async () => {
    await api(`/api/policies/${policyId}`, { method: "DELETE", expectStatus: 200 });
    cleanup.policyIds = cleanup.policyIds.filter((id) => id !== policyId);
  });

  it("DELETE /api/policies/{id} — 404 for unknown", async () => {
    await api("/api/policies/nonexistent_policy_123", { method: "DELETE", expectStatus: 404 });
  });

  it("deleted policy no longer in list", async () => {
    const { data } = await api("/api/policies");
    const found = data.find((p) => p.id === policyId);
    assert.ok(!found, "deleted policy should not be in list");
  });
});

// ─── 6. AI Status API ───────────────────────────────────────────────────────

describe("6. AI Status API", () => {
  it("GET /api/ai/status — returns status", async () => {
    const { data } = await api("/api/ai/status", { expectStatus: 200 });
    assert.equal(typeof data.busy, "boolean");
    assert.equal(data.busy, false, "should not be busy");
    assert.equal(data.job, null, "no active job");
  });
});

// ─── 7. Screening API ──────────────────────────────────────────────────────

describe("7. Screening API", () => {
  it("GET /api/screening/history — returns array", async () => {
    const { data } = await api("/api/screening/history", { expectStatus: 200 });
    assert.ok(Array.isArray(data));
  });

  it("GET /api/screening/{jobId} — 404 for unknown", async () => {
    const { status } = await api("/api/screening/nonexistent_job_123");
    assert.ok(status === 404 || status === 200, "should return 404 or pending job");
  });
});

// ─── 8. Pages render (SSR) ──────────────────────────────────────────────────

describe("8. Page rendering", () => {
  it("GET / — redirects to /documents", async () => {
    const res = await fetch(`${BASE}/`, { redirect: "manual" });
    assert.ok([301, 302, 303, 307, 308].includes(res.status), `expected redirect, got ${res.status}`);
    const location = res.headers.get("location");
    assert.ok(location && location.includes("/documents"), `should redirect to /documents, got ${location}`);
  });

  it("GET /documents — renders HTML", async () => {
    const res = await fetch(`${BASE}/documents`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Document"), "page should contain 'Document'");
  });

  it("GET /policies — renders HTML", async () => {
    const res = await fetch(`${BASE}/policies`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Polic"), "page should contain 'Polic'");
  });

  it("GET /rules — renders HTML", async () => {
    const res = await fetch(`${BASE}/rules`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Rule"), "page should contain 'Rule'");
  });

  it("GET /screening — renders HTML", async () => {
    const res = await fetch(`${BASE}/screening`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Screen"), "page should contain 'Screen'");
  });
});

// ─── 9. Document content integrity ──────────────────────────────────────────

describe("9. Document content integrity", () => {
  const spotChecks = [
    { id: "fatf-001", keyword: "FATF", label: "FATF 40 Recommendations" },
    { id: "fatf-002", keyword: "Virtual Asset", label: "VA/VASP Guidance" },
    { id: "sanc-001", keyword: "High-Risk", label: "FATF High-Risk Jurisdictions" },
    { id: "sg-004", keyword: "MAS", label: "MAS Notice PSN02" },
    { id: "hk-006", keyword: "SFC", label: "SFC VATP Guidelines" },
    { id: "uae-002", keyword: "VARA", label: "VARA Regulations" },
    { id: "trustin-labels", keyword: "Sanctioned", label: "TrustIn AML Labels" },
  ];

  for (const { id, keyword, label } of spotChecks) {
    it(`${label} (${id}) — content contains "${keyword}"`, async () => {
      const { data, status } = await api(`/api/documents/${id}/content`);
      assert.equal(status, 200, `${id} should return 200`);
      assert.ok(
        data.content.toLowerCase().includes(keyword.toLowerCase()),
        `${id} content should contain "${keyword}"`
      );
    });
  }
});

// ─── 10. Full CRUD flow ─────────────────────────────────────────────────────

describe("10. End-to-end CRUD flow", () => {
  let flowPolicyId;
  let flowRulesetId;

  it("step 1: create policy from document selection", async () => {
    const { data } = await api("/api/policies", {
      method: "POST",
      body: {
        name: "E2E Flow Policy",
        jurisdiction: "Singapore",
        source_documents: ["sg-001", "sg-004", "sg-010"],
      },
      expectStatus: 201,
    });
    flowPolicyId = data.id;
    cleanup.policyIds.push(flowPolicyId);
    assert.equal(data.status, "generating");
  });

  it("step 2: update policy with content (simulating AI output)", async () => {
    const content = [
      "# Singapore MAS DPT Compliance Policy",
      "",
      "## 1. Executive Summary",
      "This policy covers AML/CFT obligations under MAS Notice PSN02.",
      "",
      "## 2. Transaction Monitoring",
      "- Reject transactions with > 50% risk exposure to sanctioned entities",
      "- EDD required for > 10% exposure to high-risk entities",
      "",
      "## 3. Escalation Matrix",
      "| Trigger | Action |",
      "| --- | --- |",
      "| Sanctioned Entity | Freeze |",
      "| High Risk > 50% | Reject |",
    ].join("\n");

    const { data } = await api(`/api/policies/${flowPolicyId}`, {
      method: "PUT",
      body: { content, status: "ready" },
      expectStatus: 200,
    });
    assert.equal(data.status, "ready");
    assert.ok(data.content.includes("Executive Summary"));
  });

  it("step 3: create ruleset linked to policy", async () => {
    const { data } = await api("/api/rulesets", {
      method: "POST",
      body: {
        name: "E2E Flow Rules",
        jurisdiction: "Singapore",
      },
    });
    flowRulesetId = data.id;
    cleanup.rulesetIds.push(flowRulesetId);
  });

  it("step 4: add rules to ruleset", async () => {
    const rules = [
      {
        rule_id: "E2E-001",
        category: "Deposit",
        name: "Sanctions Zero Tolerance",
        risk_level: "Severe",
        action: "Freeze",
        conditions: [
          { parameter: "path.node.tags.primary_category", operator: "==", value: "Sanctioned Entity" },
        ],
      },
      {
        rule_id: "E2E-002",
        category: "Deposit",
        name: "High Risk Threshold",
        risk_level: "High",
        action: "Reject",
        conditions: [
          { parameter: "path.risk_percentage", operator: ">", value: 50 },
        ],
      },
    ];

    for (const rule of rules) {
      await api(`/api/rulesets/${flowRulesetId}/rules`, {
        method: "POST",
        body: rule,
        expectStatus: 200,
      });
    }
  });

  it("step 5: verify ruleset has 2 rules", async () => {
    const { data } = await api(`/api/rulesets/${flowRulesetId}`);
    assert.equal(data.rules.length, 2);
    assert.equal(data.rules[0].rule_id, "E2E-001");
    assert.equal(data.rules[1].rule_id, "E2E-002");
  });

  it("step 6: validate ruleset", async () => {
    const { data, status } = await api(`/api/rulesets/${flowRulesetId}/validate`, {
      method: "POST",
    });
    // Validation may pass or return validation results
    assert.equal(status, 200);
    assert.ok("valid" in data || "errors" in data || "results" in data, "should return validation result");
  });

  it("step 7: verify everything shows in lists", async () => {
    const [policies, rulesets] = await Promise.all([
      api("/api/policies"),
      api("/api/rulesets"),
    ]);

    const policy = policies.data.find((p) => p.id === flowPolicyId);
    assert.ok(policy, "policy should be in list");
    assert.equal(policy.status, "ready");

    const ruleset = rulesets.data.find((r) => r.id === flowRulesetId);
    assert.ok(ruleset, "ruleset should be in list");
    assert.equal(ruleset.rules_count, 2);
  });

  it("step 8: cleanup — delete ruleset and policy", async () => {
    await api(`/api/rulesets/${flowRulesetId}`, { method: "DELETE", expectStatus: 200 });
    cleanup.rulesetIds = cleanup.rulesetIds.filter((id) => id !== flowRulesetId);

    await api(`/api/policies/${flowPolicyId}`, { method: "DELETE", expectStatus: 200 });
    cleanup.policyIds = cleanup.policyIds.filter((id) => id !== flowPolicyId);
  });
});

// ─── 11. Upload roundtrip ───────────────────────────────────────────────────

describe("11. Upload roundtrip", () => {
  let docId;

  it("upload → list → content → delete → verify gone", async () => {
    // Upload
    const content = "# Custom Regulation\n\nMy company's internal AML policy.\n\n## Requirements\n- KYC all users\n- Monitor transactions > $1000";
    const blob = new Blob([content], { type: "text/markdown" });
    const formData = new FormData();
    formData.append("file", blob, "custom-regulation.md");

    const uploadRes = await fetch(`${BASE}/api/documents/upload`, {
      method: "POST",
      body: formData,
    });
    assert.equal(uploadRes.status, 201);
    const uploadData = await uploadRes.json();
    docId = uploadData.id;

    // Verify in list
    const { data: docs } = await api("/api/documents");
    assert.ok(docs.find((d) => d.id === docId), "should be in list after upload");

    // Read content
    const { data: contentData } = await api(`/api/documents/${docId}/content`, { expectStatus: 200 });
    assert.ok(contentData.content.includes("Custom Regulation"));

    // Delete
    await api(`/api/documents/${docId}`, { method: "DELETE", expectStatus: 200 });

    // Verify gone
    const { data: docsAfter } = await api("/api/documents");
    assert.ok(!docsAfter.find((d) => d.id === docId), "should not be in list after delete");
  });
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

after(async () => {
  // Clean up any remaining test resources
  for (const id of cleanup.policyIds) {
    await fetch(`${BASE}/api/policies/${id}`, { method: "DELETE" }).catch(() => {});
  }
  for (const id of cleanup.rulesetIds) {
    await fetch(`${BASE}/api/rulesets/${id}`, { method: "DELETE" }).catch(() => {});
  }
  for (const id of cleanup.uploadIds) {
    await fetch(`${BASE}/api/documents/${id}`, { method: "DELETE" }).catch(() => {});
  }
});
