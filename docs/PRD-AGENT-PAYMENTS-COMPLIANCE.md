# PRD: Agent Payments — Legal, Compliance & AML/KYC/KYB Framework

### Grip Protocol × PayClaw

**Version 0.1 — March 2026**

---

## 1. Executive Summary

This document defines the product requirements for integrating AML/KYC/KYB compliance into Grip Protocol and PayClaw's agent payment infrastructure. The core principle:

> **"Principal visible, agente identificado, mandato verificable, pago transparente, monitoring continuo y evidencia durable."**

AI agents do not need KYC. The human or corporate principal behind them does. The agent operates under a **verifiable, limited, revocable delegation** — the `AuthorityToActCredential`. This approach aligns with FATF standards, which require institutions to identify anyone acting on behalf of a client.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      LAYER 5: MONITORING                        │
│  Mandate risk · Sanctions · Swarm detection · Evidence packs    │
├─────────────────────────────────────────────────────────────────┤
│                 LAYER 4: PAYMENT TRANSPARENCY                   │
│  R.16 compliant messages · Principal + Beneficiary + Agent ID   │
├─────────────────────────────────────────────────────────────────┤
│              LAYER 3: DELEGATION CREDENTIAL                     │
│  AuthorityToActCredential · Scopes · Limits · Revocation        │
├─────────────────────────────────────────────────────────────────┤
│                LAYER 2: AGENT PASSPORT                          │
│  agent_id · Model · Keys · Environment · Channels · Limits     │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 1: IDENTITY CORE                            │
│  KYC (Person) · KYB (Business) · UBO · Source of funds/wealth  │
└─────────────────────────────────────────────────────────────────┘
```

### Mapping to Existing Smart Contracts

| Layer | Concept | Existing Contract | Extension Needed |
|-------|---------|-------------------|------------------|
| 1 | Identity Core | AgentDID | Add `operator_kyc_hash`, `operator_type`, `ubo_chain` fields |
| 2 | Agent Passport | AgentRegistry | Add `model_version`, `execution_env`, `allowed_jurisdictions` |
| 3 | Delegation | SessionKeyManager | Extend to full `AuthorityToActCredential` |
| 4 | Payment Transparency | ServiceEscrow + PayClaw API | Add R.16 metadata to every tx |
| 5 | Monitoring | **NEW** | Build `MandateMonitor` + `SanctionsOracle` |

---

## 3. Layer 1: Identity Core — Principal Onboarding

### 3.1 Person (KYC)

**Flow:**

```
Person                      PSP / PayClaw              KYC Provider
  │                              │                          │
  │  1. Submit identity docs     │                          │
  │─────────────────────────────▶│                          │
  │                              │  2. Verify identity      │
  │                              │─────────────────────────▶│
  │                              │                          │
  │                              │  3. Result + evidence    │
  │                              │◀─────────────────────────│
  │                              │                          │
  │  4. Link wallet/account      │                          │
  │─────────────────────────────▶│                          │
  │                              │                          │
  │  5. Issue principal_id       │                          │
  │◀─────────────────────────────│                          │
  │                              │                          │
  │                              │  6. Store KYC hash       │
  │                              │  on-chain (AgentDID)     │
```

**Data Object:**

```json
PrincipalIdentity_Person {
  "principal_id": "pri_person_xxxxxx",
  "principal_type": "person",
  "legal_name_hash": "sha256(...)",
  "nationality": "AR",
  "residence_country": "BR",
  "kyc_provider": "sumsub|onfido|jumio",
  "kyc_level": "L2_enhanced",
  "kyc_date": "2026-03-24",
  "kyc_expiry": "2027-03-24",
  "sanctions_clear": true,
  "pep_status": false,
  "source_of_funds": "business_income",
  "linked_wallets": ["0x..."],
  "linked_bank_accounts": ["iban_hash_..."],
  "risk_score": "low|medium|high",
  "review_trigger": "event_based"
}
```

### 3.2 Business (KYB)

**Flow:**

```
Business Rep                PSP / PayClaw              KYB Provider
  │                              │                          │
  │  1. Submit corp docs         │                          │
  │  (incorporation, UBO,        │                          │
  │   directors, licenses)       │                          │
  │─────────────────────────────▶│                          │
  │                              │  2. Verify entity +      │
  │                              │     UBO chain             │
  │                              │─────────────────────────▶│
  │                              │                          │
  │                              │  3. Result + evidence    │
  │                              │◀─────────────────────────│
  │                              │                          │
  │  4. AML policy submission    │                          │
  │─────────────────────────────▶│                          │
  │                              │                          │
  │  5. Issue principal_id       │                          │
  │◀─────────────────────────────│                          │
```

**Data Object:**

```json
PrincipalIdentity_Business {
  "principal_id": "pri_biz_xxxxxx",
  "principal_type": "business",
  "legal_name": "Acme AI Corp",
  "registration_country": "AR",
  "registration_number_hash": "sha256(...)",
  "entity_type": "SAS|LLC|SA|Ltd",
  "licenses": ["PSP_AR", "EMI_EU"],
  "directors": [
    {
      "name_hash": "sha256(...)",
      "kyc_status": "verified",
      "pep_status": false
    }
  ],
  "ubos": [
    {
      "name_hash": "sha256(...)",
      "ownership_pct": 75,
      "kyc_status": "verified",
      "pep_status": false
    }
  ],
  "aml_policy_hash": "sha256(...)",
  "kyb_provider": "sumsub|middesk|comply_advantage",
  "kyb_date": "2026-03-24",
  "kyb_expiry": "2027-03-24",
  "sanctions_clear": true,
  "source_of_funds": "operational_revenue",
  "risk_score": "low",
  "linked_wallets": ["0x..."],
  "linked_bank_accounts": ["iban_hash_..."]
}
```

### 3.3 On-chain Representation

Only hashes and status go on-chain. Full PII stays off-chain in encrypted storage with the PSP.

```solidity
// Extension to AgentDID contract
struct PrincipalLink {
    bytes32 principalIdHash;    // hash of principal_id
    uint8 principalType;        // 0=person, 1=business
    bytes32 kycEvidenceHash;    // hash of KYC/KYB evidence pack
    uint64 verifiedAt;          // timestamp
    uint64 expiresAt;           // re-verification deadline
    uint8 riskLevel;            // 0=low, 1=medium, 2=high
    bool sanctionsClear;        // latest screening result
}
```

---

## 4. Layer 2: Agent Passport

**Extended AgentRegistry entry:**

```json
AgentPassport {
  "agent_id": "agent_xxxxxx",
  "principal_id": "pri_biz_xxxxxx",
  "provider": "openai|anthropic|custom",
  "model": "gpt-4o|claude-opus-4-6|custom",
  "model_version": "2026-03",
  "execution_env": "cloud_us|cloud_eu|on_premise",
  "crypto_keys": {
    "signing_key": "0x...",
    "encryption_key": "0x..."
  },
  "allowed_channels": ["api", "telegram", "slack"],
  "allowed_countries": ["US", "EU", "AR", "BR"],
  "allowed_product_categories": ["saas", "data", "compute"],
  "autonomy_level": "L1_supervised|L2_bounded|L3_autonomous",
  "max_single_tx": 500,
  "daily_limit": 2000,
  "monthly_limit": 10000,
  "currency": "USDC",
  "created_at": "2026-03-24T00:00:00Z",
  "expires_at": "2026-06-24T00:00:00Z",
  "revocation_status": "active",
  "did": "did:grip:base:0x..."
}
```

---

## 5. Layer 3: AuthorityToActCredential (Delegation)

This is the core innovation. Maps to an extended `SessionKeyManager`.

### 5.1 Data Object

```json
AuthorityToActCredential {
  "credential_id": "atac_xxxxxx",
  "principal_id": "pri_biz_xxxxxx",
  "principal_type": "business",
  "agent_id": "agent_xxxxxx",
  "issuer": "psp_payclaw",
  "co_signer": "pri_biz_xxxxxx",

  "scopes": ["buy", "sell", "refund"],
  "rails": ["crypto_base", "sepa", "wire_usd"],
  "max_tx_amount": 500,
  "daily_limit": 2000,
  "monthly_limit": 10000,
  "currency": "USDC",

  "allowed_countries": ["US", "DE", "FR", "AR"],
  "blocked_countries": ["KP", "IR", "CU", "SY", "RU"],
  "allowed_counterparty_types": ["verified_merchant", "verified_agent"],
  "allowed_counterparties": ["merchant_xyz", "agent_abc"],
  "allow_new_beneficiary": false,

  "allowed_mccs": ["5817", "7372", "7379"],
  "blocked_mccs": ["7995", "6012"],

  "step_up_threshold": 200,
  "step_up_method": "push_notification|email|sms",

  "valid_from": "2026-03-24T00:00:00Z",
  "valid_until": "2026-06-24T00:00:00Z",
  "revocation_endpoint": "https://api.payclaw.me/credentials/atac_xxxxxx/revoke",
  "revocation_status": "active",

  "policy_hash": "sha256(...)",
  "explainability_hash": "sha256(...)",

  "signature": "0x...",
  "chain_tx": "0x..."
}
```

### 5.2 On-chain Representation

```solidity
// Extension to SessionKeyManager
struct DelegationCredential {
    bytes32 credentialId;
    bytes32 principalHash;
    address agentAccount;
    uint8[] scopes;              // encoded scope flags
    uint8[] rails;               // encoded rail flags
    uint256 maxTxAmount;         // in USDC (6 decimals)
    uint256 dailyLimit;
    uint256 monthlyLimit;
    uint256 dailySpent;          // rolling counter
    uint256 monthlySpent;        // rolling counter
    bytes32 allowedCountriesHash;
    bytes32 blockedCountriesHash;
    bool allowNewBeneficiary;
    uint256 stepUpThreshold;
    uint64 validFrom;
    uint64 validUntil;
    bool revoked;
    bytes32 policyHash;
}
```

### 5.3 Issuance Flow

```
Principal                   PSP / PayClaw              Grip (on-chain)
  │                              │                          │
  │  1. Request delegation       │                          │
  │  for agent_id with params    │                          │
  │─────────────────────────────▶│                          │
  │                              │                          │
  │                              │  2. Validate:            │
  │                              │  - Principal KYC/KYB ✓   │
  │                              │  - Agent registered ✓    │
  │                              │  - Limits within policy ✓│
  │                              │  - Countries allowed ✓   │
  │                              │                          │
  │  3. Sign credential          │                          │
  │  (principal signature)       │                          │
  │─────────────────────────────▶│                          │
  │                              │                          │
  │                              │  4. Co-sign (PSP)        │
  │                              │  + register on-chain     │
  │                              │─────────────────────────▶│
  │                              │                          │
  │                              │  5. Credential active    │
  │  6. Confirmation             │◀─────────────────────────│
  │◀─────────────────────────────│                          │
```

### 5.4 Revocation

Immediate revocation by:
- Principal (anytime)
- PSP (sanctions hit, suspicious activity, policy breach)
- Circuit breaker (auto-revoke on anomaly detection)

```solidity
function revokeCredential(bytes32 credentialId) external {
    require(
        msg.sender == credential.principal ||
        msg.sender == credential.pspAddress ||
        msg.sender == circuitBreaker,
        "unauthorized"
    );
    credential.revoked = true;
    emit CredentialRevoked(credentialId, msg.sender, block.timestamp);
}
```

---

## 6. Layer 4: Transaction Flows

### 6.1 Purchase (Agent Buys)

```
Agent (Buyer)          PayClaw API           Grip (on-chain)      Merchant/Seller
  │                        │                      │                    │
  │  1. POST /pay          │                      │                    │
  │  {destination,         │                      │                    │
  │   amount, memo}        │                      │                    │
  │───────────────────────▶│                      │                    │
  │                        │                      │                    │
  │                        │  2. Validate:         │                    │
  │                        │  - ATAC valid ✓       │                    │
  │                        │  - Scope: buy ✓       │                    │
  │                        │  - Amount ≤ limit ✓   │                    │
  │                        │  - Country ✓          │                    │
  │                        │  - MCC ✓              │                    │
  │                        │  - Counterparty ✓     │                    │
  │                        │  - Sanctions clear ✓  │                    │
  │                        │                      │                    │
  │                        │  3. Step-up needed?   │                    │
  │                        │  (if amount >         │                    │
  │                        │   step_up_threshold)  │                    │
  │                        │───── notify ─────────▶│ (principal)       │
  │                        │                      │                    │
  │                        │  4. Execute on-chain  │                    │
  │                        │─────────────────────▶│                    │
  │                        │                      │                    │
  │                        │                      │  5. USDC transfer  │
  │                        │                      │───────────────────▶│
  │                        │                      │                    │
  │                        │  6. Build R.16 msg:   │                    │
  │                        │  - principal_id       │                    │
  │                        │  - beneficiary_id     │                    │
  │                        │  - agent_id           │                    │
  │                        │  - credential_id      │                    │
  │                        │  - purpose            │                    │
  │                        │                      │                    │
  │                        │  7. Store evidence    │                    │
  │  8. Confirmation       │  pack                │                    │
  │◀───────────────────────│                      │                    │
```

### 6.2 Sale (Agent Sells)

```
Buyer                  PayClaw API           Grip (on-chain)      Agent (Seller)
  │                        │                      │                    │
  │  1. Purchase request   │                      │                    │
  │───────────────────────▶│                      │                    │
  │                        │                      │                    │
  │                        │  2. Validate seller:  │                    │
  │                        │  - Agent ATAC valid ✓ │                    │
  │                        │  - Scope: sell ✓      │                    │
  │                        │  - Payout to verified │                    │
  │                        │    account only ✓     │                    │
  │                        │  - No redirect to     │                    │
  │                        │    new beneficiary ✓  │                    │
  │                        │                      │                    │
  │                        │  3. Create escrow     │                    │
  │                        │─────────────────────▶│                    │
  │                        │                      │                    │
  │                        │                      │  4. Notify agent   │
  │                        │                      │───────────────────▶│
  │                        │                      │                    │
  │                        │                      │  5. Deliver service│
  │                        │                      │◀───────────────────│
  │                        │                      │                    │
  │  6. Confirm delivery   │                      │                    │
  │───────────────────────▶│                      │                    │
  │                        │  7. Release escrow   │                    │
  │                        │─────────────────────▶│                    │
  │                        │                      │  8. USDC to seller │
  │                        │                      │  principal account │
  │                        │                      │───────────────────▶│
```

### 6.3 R.16 Payment Message

Every transaction carries:

```json
PaymentMessage_R16 {
  "tx_id": "tx_xxxxxx",
  "timestamp": "2026-03-24T12:00:00Z",

  "originator": {
    "principal_id": "pri_biz_xxxxxx",
    "principal_type": "business",
    "name_hash": "sha256(...)",
    "country": "AR",
    "account_ref": "wallet_0x..."
  },

  "beneficiary": {
    "principal_id": "pri_biz_yyyyyy",
    "principal_type": "business",
    "name_hash": "sha256(...)",
    "country": "DE",
    "account_ref": "iban_hash_..."
  },

  "agent_metadata": {
    "agent_id": "agent_xxxxxx",
    "credential_id": "atac_xxxxxx",
    "action_scope": "buy",
    "autonomy_level": "L2_bounded"
  },

  "amount": 150.00,
  "currency": "USDC",
  "rail": "crypto_base",
  "purpose": "SaaS subscription payment",

  "compliance": {
    "sanctions_screened": true,
    "sanctions_result": "clear",
    "mandate_validated": true,
    "step_up_required": false,
    "risk_score": "low"
  }
}
```

---

## 7. Layer 5: Monitoring & Risk Engine

### 7.1 Traditional + Mandate Risk

The monitoring engine evaluates two dimensions:

**Customer Risk (traditional):**
- Transaction patterns vs. profile
- Geographic risk
- Volume anomalies
- PEP/sanctions screening (ongoing)

**Mandate Risk (new):**
- Did the agent act within its ATAC scope?
- New beneficiary added without authorization?
- Geographic drift from allowed countries?
- MCC/category deviation?
- Velocity spike (many small txs → structuring)?
- Swarm pattern (multiple agents, one principal)?

### 7.2 New Typologies & Controls

| Typology | Description | Controls |
|----------|-------------|----------|
| **Swarm Structuring** | Principal distributes activity across many "small" agents to stay under limits | Aggregate limits by principal_id, household graph, device fingerprint. Alert when total across agents exceeds individual thresholds |
| **Delegated Mule Networks** | Agents execute on behalf of clean-looking principals to move illicit funds | Beneficiary aging (flag payouts to recently created accounts), payout risk scoring, graph analytics across principal-agent-beneficiary chains |
| **Prompt-Injection Commerce** | Seller manipulates agent context to authorize unauthorized purchases | Separate commercial decision layer from financial authority layer. ATAC limits are enforced at PayClaw API level, not at agent LLM level |
| **Synthetic Merchant/KYB** | Fake merchants with polished UX but weak identity | Require counterparty credentials, registry checks, UBO verification, periodic refresh on trigger events |
| **Agent-to-Agent Invoice Fraud** | Agent A creates invoice, Agent B pays, no human reviews | Dual control (require principal approval above threshold), vendor allowlists, semantic reconciliation (invoice ↔ contract ↔ PO) |

### 7.3 Monitoring Events

```json
MonitoringEvent {
  "event_id": "evt_xxxxxx",
  "timestamp": "2026-03-24T12:00:00Z",
  "event_type": "mandate_breach|velocity_alert|sanctions_hit|swarm_detected|new_beneficiary",
  "severity": "low|medium|high|critical",
  "principal_id": "pri_biz_xxxxxx",
  "agent_id": "agent_xxxxxx",
  "credential_id": "atac_xxxxxx",
  "tx_id": "tx_xxxxxx",
  "details": {
    "rule_triggered": "daily_limit_80pct",
    "current_value": 1600,
    "threshold": 2000
  },
  "action_taken": "alert|step_up|block|revoke_credential",
  "evidence_hash": "sha256(...)"
}
```

### 7.4 Sanctions & PEP Screening

- **Onboarding:** Full screening of principal + UBOs + directors
- **Ongoing:** Dynamic screening against updated lists (OFAC, EU, UN, FATF grey/black lists)
- **Per-transaction:** Counterparty screening before every payment
- **FATF grey/black list update:** Last updated Feb 13, 2026 — geographic policy must be dynamic, not frozen at onboarding

---

## 8. Evidence & Record Keeping

Every transaction produces an **Evidence Pack** stored for minimum 5 years (FATF requirement):

```json
EvidencePack {
  "tx_id": "tx_xxxxxx",
  "timestamp": "2026-03-24T12:00:00Z",

  "principal_evidence": {
    "kyc_kyb_hash": "sha256(...)",
    "verification_date": "2026-03-24",
    "risk_level": "low"
  },

  "agent_evidence": {
    "agent_passport_hash": "sha256(...)",
    "credential_hash": "sha256(...)",
    "credential_valid": true
  },

  "transaction_evidence": {
    "r16_message_hash": "sha256(...)",
    "amount": 150.00,
    "currency": "USDC",
    "originator_hash": "sha256(...)",
    "beneficiary_hash": "sha256(...)"
  },

  "compliance_evidence": {
    "sanctions_result": "clear",
    "mandate_validation": "pass",
    "monitoring_alerts": [],
    "risk_score": "low"
  },

  "on_chain_proof": {
    "chain": "base",
    "tx_hash": "0x...",
    "block_number": 12345678
  },

  "storage": {
    "location": "encrypted_s3 + ipfs_pin",
    "retention_until": "2031-03-24"
  }
}
```

---

## 9. AML/KYC/KYB Control Matrix by Jurisdiction

### 9.1 European Union

| Requirement | Source | Implementation |
|-------------|--------|----------------|
| CDD on principal | AMLA (June 2024) | Layer 1: KYC/KYB via certified provider |
| UBO identification to natural persons | AMLA | Mandatory UBO chain in KYB |
| Enhanced Due Diligence for high risk | AMLA + EBA standards | Risk-based ATAC limits + ongoing monitoring |
| Remote onboarding standards | EBA RTS | Digital identity via EUDI Wallet compatible flow |
| Payment transparency | R.16 updated June 2025 | Layer 4: R.16 message on every tx |
| Sanctions screening | EU regulations | Real-time screening, dynamic list updates |
| Record keeping (5 years) | AMLA | Layer 5: Evidence packs |
| STR/SAR reporting | National FIUs | Monitoring engine → alert → manual review → report |

### 9.2 United States

| Requirement | Source | Implementation |
|-------------|--------|----------------|
| CDD Rule | FinCEN (31 CFR 1010.230) | Layer 1: KYC/KYB |
| BOI reporting | CTA (reduced scope March 2025) | Do NOT rely solely on BOI registry for UBO verification |
| BSA compliance | Bank Secrecy Act | Transaction monitoring + SAR filing |
| OFAC sanctions | OFAC SDN list | Real-time screening per transaction |
| Travel Rule | FinCEN | R.16 metadata on transfers > $3,000 |
| MSB registration | FinCEN | PayClaw registers as MSB if operating in US |
| State MTLs | State-by-state | Evaluate per state of operation |

### 9.3 Latin America (AR/BR focus)

| Requirement | Source | Implementation |
|-------------|--------|----------------|
| KYC/KYB | UIF (AR), COAF (BR) | Layer 1 via local providers |
| PSP regulations | BCRA (AR), BCB (BR) | Leverage existing PSP license (AR) |
| Crypto asset reporting | CNV (AR), CVM (BR) | USDC transactions reportable |
| Sanctions | Local + UN lists | Screening against local + international lists |
| Cross-border reporting | UIF/COAF thresholds | Auto-flag transactions above thresholds |
| Record keeping | 5-10 years depending | Evidence packs retained per local requirement |

---

## 10. Go-to-Market: Risk Curve Strategy

### Phase 1: Minimum Risk (Months 1-3)

```
✅ Domestic transactions only (single jurisdiction)
✅ Low value (max $500/tx, $2,000/day)
✅ Verified merchants only (pre-approved allowlist)
✅ Permitted categories only (SaaS, data, compute)
✅ No new beneficiaries (allowlist only)
✅ L1 autonomy (supervised — principal approves all)
✅ Single agent per principal
```

### Phase 2: Controlled Expansion (Months 4-6)

```
✅ Cross-border within same regulatory zone (EU↔EU, US domestic)
✅ Medium value (max $2,000/tx, $10,000/day)
✅ Verified merchants + verified agents as counterparties
✅ Expanded categories
✅ New beneficiary with step-up approval
✅ L2 autonomy (bounded — agent acts within ATAC, step-up for edge cases)
✅ Up to 5 agents per principal
```

### Phase 3: Full Scale (Months 6-12)

```
✅ Cross-border multi-jurisdiction (EU ↔ US ↔ Latam)
✅ Higher limits (configurable per principal risk level)
✅ Agent-to-agent commerce (ServiceEscrow)
✅ New beneficiary with automated risk scoring
✅ L3 autonomy (autonomous — within ATAC, no step-up below threshold)
✅ Unlimited agents per principal (with aggregate monitoring)
✅ Streaming payments for ongoing services
```

---

## 11. Smart Contract Changes Required

### 11.1 AgentDID — Add Principal Link

```solidity
// New function
function linkPrincipal(
    bytes32 did,
    bytes32 principalHash,
    uint8 principalType,
    bytes32 kycEvidenceHash,
    uint64 expiresAt,
    uint8 riskLevel
) external onlyOperator(did);

// New function
function updateSanctionsStatus(
    bytes32 did,
    bool sanctionsClear
) external onlyOracle;
```

### 11.2 SessionKeyManager → DelegationManager

Rename and extend to support full ATAC:

```solidity
// New fields in session key struct
uint8[] scopes;
uint8[] rails;
bytes32 allowedCountriesHash;
bytes32 blockedCountriesHash;
bool allowNewBeneficiary;
uint256 stepUpThreshold;
bytes32 policyHash;
uint256 dailySpent;
uint256 monthlySpent;
uint64 lastResetDay;
uint64 lastResetMonth;

// New function
function validateMandate(
    bytes32 credentialId,
    uint8 scope,
    uint8 rail,
    uint256 amount,
    bytes32 counterpartyHash,
    bytes2 countryCode
) external view returns (bool valid, string memory reason);
```

### 11.3 ServiceEscrow — Add R.16 Metadata

```solidity
// Extended escrow creation
function createEscrow(
    bytes32 clientDid,
    bytes32 providerDid,
    uint256 amount,
    bytes32 taskSpecHash,
    bytes32 r16MessageHash,      // NEW
    bytes32 clientCredentialId,  // NEW
    bytes32 providerCredentialId // NEW
) external returns (uint256 escrowId);
```

### 11.4 NEW: MandateMonitor

```solidity
contract MandateMonitor {
    event MandateBreach(bytes32 credentialId, bytes32 agentDid, string reason);
    event VelocityAlert(bytes32 principalHash, uint256 aggregateSpent, uint256 limit);
    event SwarmDetected(bytes32 principalHash, uint256 agentCount, uint256 txCount);

    function reportBreach(
        bytes32 credentialId,
        bytes32 agentDid,
        string calldata reason
    ) external onlyMonitor;

    function checkAggregateLimits(
        bytes32 principalHash
    ) external view returns (bool withinLimits, uint256 totalSpent);
}
```

---

## 12. API Changes (PayClaw)

### 12.1 New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/principals` | Register a new principal (KYC/KYB) |
| GET | `/principals/:id` | Get principal status |
| POST | `/principals/:id/agents` | Register agent under principal |
| POST | `/credentials` | Issue AuthorityToActCredential |
| GET | `/credentials/:id` | Get credential status |
| DELETE | `/credentials/:id` | Revoke credential |
| POST | `/credentials/:id/validate` | Validate a mandate against ATAC |
| GET | `/monitoring/events` | List monitoring events |
| GET | `/evidence/:tx_id` | Retrieve evidence pack |

### 12.2 Modified Endpoints

**POST /pay** — Add mandatory fields:

```json
{
  "destination": "merchant_xyz",
  "amount": 150.00,
  "memo": "SaaS subscription",
  "credential_id": "atac_xxxxxx",     // NEW: mandatory
  "purpose_code": "saas_subscription", // NEW: mandatory
  "beneficiary_country": "DE"          // NEW: mandatory
}
```

---

## 13. Open Questions

1. **Oracle for sanctions:** Build vs. buy? (Chainalysis, Elliptic, or custom oracle)
2. **Dispute resolution for agent-to-agent:** Human arbitrator vs. AI arbitrator vs. DAO?
3. **EUDI Wallet integration timeline:** Wait for EU rollout or build parallel system?
4. **US MSB registration:** Needed for Phase 2 if US counterparties are involved
5. **Insurance/bonding:** Should principals post a bond that covers agent liability?
6. **AI in compliance controls:** Wolfsberg requires legitimate purpose, proportionality, accountability — document our use of AI in monitoring

---

## 14. Next Steps

1. **Review this PRD** with legal counsel in AR, EU, and US
2. **Prioritize smart contract changes** — start with AgentDID principal link + DelegationManager
3. **Select KYC/KYB provider** — Sumsub, Onfido, or Jumio (evaluate API, coverage, cost)
4. **Select sanctions screening provider** — Chainalysis, Elliptic, or ComplyAdvantage
5. **Build ATAC issuance flow** in PayClaw API
6. **Deploy Phase 1** with domestic, low-value, allowlist-only transactions
7. **Engage Circle** for Circle Mint application + compliance alignment

---

*Document version: 0.1*
*Authors: Leandro Onsari, Pi (Claude)*
*Date: March 24, 2026*
