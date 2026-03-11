# Rules — Rule Engine & Visual Editor

The Rules page (`/rules`) manages detection rulesets — machine-readable JSON rules that power the screening pipeline.

## Concepts

A **Ruleset** is a collection of individual **Rules**. Each rule defines:

- **Name** and description
- **Category** — Deposit, Withdrawal, CDD, or Ongoing Monitoring
- **Severity** — Severe, High, Medium, Low
- **Conditions** — what triggers the rule (entity tags, transaction patterns, thresholds)
- **Direction** — inflow, outflow, or all

During screening, the system matches on-chain evidence paths against rules in the selected ruleset.

## Built-in Rulesets

AMLClaw ships with three production-ready rulesets:

| Ruleset | Jurisdiction | File |
|---------|-------------|------|
| Singapore MAS DPT | Singapore | `data/defaults/singapore_mas.json` |
| Hong Kong SFC VASP | Hong Kong | `data/defaults/hong_kong_sfc.json` |
| Dubai VARA | Dubai / UAE | `data/defaults/dubai_vara.json` |

These are read-only defaults. You can create your own rulesets or generate them from policies using AI.

## Generating Rules from Policies

1. Navigate to **Rules** in the sidebar
2. Click **Generate New Ruleset**
3. Select a policy as the source
4. The AI converts the policy's compliance requirements into structured JSON rules
5. Rules stream in real-time via SSE

## Visual Rule Editor

Each ruleset can be edited through the visual editor:

- **Add/remove rules** within a ruleset
- **Edit rule properties** — name, category, severity, conditions
- **Toggle rules** on/off without deleting them
- **Validate** — check ruleset structure for errors

The editor provides a form-based interface — no need to edit JSON manually.

## Rule Categories and Scenarios

Rules are organized by category and mapped to screening scenarios:

| Scenario | Rule Categories Used | Direction Filter |
|----------|---------------------|-----------------|
| `deposit` | Deposit | all |
| `withdrawal` | Withdrawal | outflow only |
| `cdd` | CDD | all |
| `monitoring` | Ongoing Monitoring | all |
| `all` | ALL categories | all |

When a screening job runs with a specific scenario, only rules in the matching categories are applied.

## Rule Matching

During screening, each rule's conditions are evaluated against on-chain evidence paths from TrustIn:

1. TrustIn returns transaction graph data (entities, addresses, flows)
2. `extractRiskPaths()` filters paths by scenario and direction
3. Each path is checked against rule conditions (entity tags, hop counts, operators)
4. Matched rules are included in the screening result with severity and evidence

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rulesets` | List all rulesets |
| `GET` | `/api/rulesets/{rulesetId}` | Get ruleset details |
| `POST` | `/api/rulesets/generate` | Generate ruleset from policy (SSE) |
| `PUT` | `/api/rulesets/{rulesetId}` | Update ruleset |
| `DELETE` | `/api/rulesets/{rulesetId}` | Delete ruleset |
| `POST` | `/api/rulesets/{rulesetId}/validate` | Validate ruleset structure |
| `GET` | `/api/rulesets/{rulesetId}/rules` | List rules in a ruleset |
| `GET` | `/api/rulesets/{rulesetId}/rules/{ruleId}` | Get a single rule |
| `PUT` | `/api/rulesets/{rulesetId}/rules/{ruleId}` | Update a rule |
| `DELETE` | `/api/rulesets/{rulesetId}/rules/{ruleId}` | Delete a rule |
