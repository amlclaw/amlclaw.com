# AML/CFT Compliance Policy — Demo (Based on MAS Notice PSN02)

> **⚠️ DEMO DATA** — This is a sample policy for demonstration purposes only. Not for production use.

## 1. Purpose & Scope

This policy establishes the Anti-Money Laundering and Countering the Financing of Terrorism (AML/CFT) framework for digital payment token (DPT) services, aligned with the Monetary Authority of Singapore (MAS) Payment Services Act 2019 and MAS Notice PSN02.

## 2. Customer Due Diligence (CDD)

### 2.1 Standard CDD
- Verify customer identity before establishing business relations
- Obtain beneficial ownership information for corporate customers
- Screen all customers against MAS sanctions lists and UNSC consolidated list

### 2.2 Enhanced Due Diligence (EDD)
Trigger EDD when:
- Customer is from a high-risk jurisdiction (FATF grey/black list)
- Transaction involves privacy coins or mixing services
- On-chain analysis reveals exposure to sanctioned addresses within 3 hops
- Single transaction exceeds SGD 20,000 equivalent

## 3. Transaction Monitoring

### 3.1 Real-Time Screening
All deposit and withdrawal addresses must be screened using blockchain analytics:
- **Deposits**: Screen source addresses for sanctions, terrorism financing, darknet, ransomware, and fraud exposure
- **Withdrawals**: Screen destination addresses for sanctions and illicit activity exposure
- **Hops**: Default screening depth of 3 hops for both inflow and outflow

### 3.2 Ongoing Monitoring
- Active customer addresses monitored every 4 hours
- Alert threshold: any new exposure to Priority 1 (Sanctions/Terrorism) tags
- Monthly batch re-screening of dormant accounts with balance > SGD 1,000

## 4. Suspicious Transaction Reporting (STR)

File STR with the Suspicious Transaction Reporting Office (STRO) within 15 business days when:
- Screening reveals direct (Hop 1) interaction with sanctioned entities → **Immediate freeze + STR**
- Risk score exceeds 80 (Severe/Critical) → STR within 5 business days
- Customer unable to provide satisfactory explanation for flagged transactions

## 5. Record Keeping

- Maintain all CDD records for minimum 5 years after business relationship ends
- Screening results and risk assessments retained for 5 years
- Audit trail of all compliance decisions and overrides

## 6. Governance

- Designated AML/CFT Compliance Officer reports to Board
- Annual independent audit of AML/CFT controls
- Staff training on AML/CFT obligations within 30 days of onboarding, annual refresher
