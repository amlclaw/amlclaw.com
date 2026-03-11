# Writing Custom Rules

This guide explains how to create custom detection rules for the AMLClaw screening engine.

## Rule Structure

Each rule is a JSON object within a ruleset:

```json
{
  "id": "custom-rule-001",
  "name": "High-value mixer interaction",
  "description": "Flags addresses that interacted with known mixing services above threshold",
  "category": "Deposit",
  "severity": "High",
  "enabled": true,
  "conditions": {
    "entity_tags": ["mixer", "tornado-cash"],
    "direction": "inflow",
    "min_hops": 1,
    "max_hops": 3,
    "operator": "any"
  }
}
```

## Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier within the ruleset |
| `name` | string | Human-readable rule name |
| `category` | string | `Deposit`, `Withdrawal`, `CDD`, or `Ongoing Monitoring` |
| `severity` | string | `Severe`, `High`, `Medium`, or `Low` |
| `conditions` | object | What triggers this rule |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | `""` | Detailed explanation |
| `enabled` | boolean | `true` | Toggle without deleting |

## Categories

Rules are grouped by category and activated based on the screening scenario:

| Category | Activated By Scenario |
|----------|----------------------|
| `Deposit` | `deposit`, `all` |
| `Withdrawal` | `withdrawal`, `all` |
| `CDD` | `cdd`, `all` |
| `Ongoing Monitoring` | `monitoring`, `all` |

## Severity Levels

| Level | Meaning |
|-------|---------|
| `Severe` | Immediate action required (sanctions, terrorism financing) |
| `High` | Serious risk, escalate to compliance officer |
| `Medium` | Elevated risk, enhanced monitoring recommended |
| `Low` | Minor concern, log and review periodically |

## Conditions

### `entity_tags`

Array of entity tags to match against on-chain entities found by TrustIn. Examples:

- `mixer` — mixing/tumbling services
- `tornado-cash` — Tornado Cash specifically
- `sanctioned` — OFAC/sanctions-listed entities
- `darknet` — darknet marketplace
- `gambling` — gambling platforms
- `scam` — known scam addresses
- `high-risk-exchange` — exchanges with weak KYC

**`operator`:** `"any"` (match any tag) or `"all"` (match all tags).

### `direction`

- `"inflow"` — only check incoming transaction paths
- `"outflow"` — only check outgoing transaction paths
- `"all"` — check both directions

### `min_hops` / `max_hops`

How many transaction hops away the risky entity can be:

- `min_hops: 1, max_hops: 1` — direct interaction only
- `min_hops: 1, max_hops: 3` — up to 3 hops away (indirect exposure)

## Ruleset Structure

A complete ruleset file:

```json
{
  "id": "my-custom-ruleset",
  "name": "My Custom Ruleset",
  "description": "Custom rules for our compliance needs",
  "jurisdiction": "Global",
  "version": "1.0",
  "rules": [
    {
      "id": "rule-001",
      "name": "Direct sanctions interaction",
      "category": "Deposit",
      "severity": "Severe",
      "conditions": {
        "entity_tags": ["sanctioned"],
        "direction": "all",
        "min_hops": 1,
        "max_hops": 1,
        "operator": "any"
      }
    },
    {
      "id": "rule-002",
      "name": "Indirect mixer exposure",
      "category": "Deposit",
      "severity": "Medium",
      "conditions": {
        "entity_tags": ["mixer"],
        "direction": "inflow",
        "min_hops": 2,
        "max_hops": 3,
        "operator": "any"
      }
    }
  ]
}
```

## Creating Rules

### Option 1: AI Generation (Recommended)

1. Generate a policy from regulatory documents
2. Go to **Rules** → **Generate New Ruleset** and select the policy
3. The AI creates rules based on the regulatory requirements
4. Edit individual rules as needed via the visual editor

### Option 2: Visual Editor

1. Go to **Rules** → create a new empty ruleset
2. Add rules one by one using the form-based editor
3. Set category, severity, and conditions through the UI

### Option 3: Direct JSON

1. Create a JSON file following the ruleset structure above
2. Save to `data/rulesets/{id}.json`
3. Add an entry to `data/rulesets/_meta.json`

### Option 4: API

```bash
curl -X PUT http://localhost:3000/api/rulesets/my-ruleset \
  -H "Content-Type: application/json" \
  -d @my-ruleset.json
```

## Validation

Validate your ruleset structure:

```bash
curl -X POST http://localhost:3000/api/rulesets/my-ruleset/validate
```

This checks for:
- Valid rule structure
- Known categories and severities
- Required fields present
- No duplicate rule IDs

## Tips

- **Start with AI-generated rules** and customize from there
- **Use the built-in rulesets** (Singapore MAS, Hong Kong SFC, Dubai VARA) as reference
- **Test rules** by running a screening against a known address
- **Severity matters** — `Severe` and `High` trigger webhook notifications
- **Disable rather than delete** — toggle `enabled: false` to keep rules for reference
- **Direction is key** — use `inflow` for deposit scenarios, `outflow` for withdrawal
