# Screening — Address Screening

The Screening page (`/screening`) performs on-chain blockchain address analysis, cross-referencing transaction data against your detection rules.

## How Screening Works

1. **Submit** an address with chain type and screening parameters
2. **TrustIn KYA API** analyzes the on-chain transaction graph (30-60s polling)
3. **Rule matching** — `extractRiskPaths()` filters evidence by scenario and evaluates rules
4. **Results** — risk entities, matched rules, evidence paths, and severity assessment

## Running a Screening

1. Go to **Screening** in the sidebar
2. Enter a blockchain address
3. Select chain (e.g., ETH, BTC, TRON)
4. Choose screening parameters:
   - **Scenario** — determines which rule categories apply (see below)
   - **Ruleset** — which detection rules to use
   - **Inflow/Outflow hops** — how many transaction hops to trace (1-5)
   - **Max nodes** — limit on graph nodes (10-1000)
5. Click **Screen**

The job runs asynchronously. The client polls `GET /api/screening/{jobId}` every 3 seconds until completion.

## Five Screening Scenarios

| Scenario | Purpose | Rule Categories | Direction |
|----------|---------|----------------|-----------|
| **Deposit** | Analyze fund sources for incoming deposits | Deposit rules | All directions |
| **Withdrawal** | Check destination risk for outgoing transfers | Withdrawal rules | Outflow only |
| **CDD** | Customer due diligence — transaction threshold triggers | CDD rules | All directions |
| **Monitoring** | Ongoing monitoring — detect structuring, smurfing | Ongoing Monitoring rules | All directions |
| **All** | Comprehensive full scan using all rules | All categories | All directions |

### When to Use Each Scenario

- **Deposit**: A customer deposits crypto. You want to verify the funds aren't tainted (mixers, sanctions, darknet).
- **Withdrawal**: A customer requests a withdrawal. Check if the destination address has risk associations.
- **CDD**: Triggered by transaction thresholds (e.g., >$15,000 equivalent). Run enhanced due diligence checks.
- **Monitoring**: Regular periodic checks for existing customers. Detects structuring (splitting large amounts) and other patterns.
- **All**: Initial onboarding or investigation — run every rule against the address.

## Results

A screening result includes:

- **Risk Level** — Severe / High / Medium / Low / None
- **Risk Entities** — flagged entities in the transaction graph (mixers, sanctioned addresses, darknet markets)
- **Matched Rules** — which rules triggered, with severity
- **Evidence Paths** — transaction paths connecting the screened address to risk entities
- **Evidence Graph** — visual flow diagram using `@xyflow/react` with `dagre` layout

## Batch Screening

Screen up to 100 addresses in one operation:

1. Click the **Batch** button on the Screening page
2. Provide a list of addresses with chain types
3. Each address is screened sequentially and saved as an individual history entry

**API:** `POST /api/screening/batch` with `{ addresses: [{chain, address}], scenario, ruleset_id }`

## Export

Screening results can be exported as:

- **Markdown** — formatted report with all details
- **PDF** — branded report with your configured app name and report header

Branding is customizable in Settings > Application.

**API:** `GET /api/screening/{jobId}/export?format=md|pdf`

## History

All screening results are saved and accessible from the history view. History is capped at 100 entries (newest first), stored at `data/history/`.

**API:** `GET /api/screening/history`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/screening` | Start screening job |
| `GET` | `/api/screening/{jobId}` | Poll job status/result |
| `GET` | `/api/screening/{jobId}/export` | Export result (md/pdf) |
| `POST` | `/api/screening/batch` | Batch screening |
| `GET` | `/api/screening/history` | List screening history |
