# Plan de Unificación Arquitectónica: Grip + PayClaw

Fecha: 22 Mar 2026
Autor: Le + Claude + Peppina (CTO review)
Status: **Aprobado** — ver sección "Revisión Peppina"

---

## Diagnóstico

Existen dos implementaciones de PayClaw que divergieron:

| | /payclaw/ (standalone) | /grip-protocol/payclaw-api/ |
|---|---|---|
| Framework | Hono (Vercel Edge) | NestJS |
| DB | Neon Postgres + Drizzle | Supabase |
| Contrato | PayClawVault (custodial) | ServiceEscrow (trustless) |
| Auth | HMAC-SHA256 signatures | API key + Supabase |
| Features | Circuit breaker, timelock, Brex, whitelist, auto-approve | Escrow, DID, reputation, session keys, Pix |
| SDK | @payclaw/sdk (standalone client) | @grip-protocol/sdk (unified Grip+PayClaw) |
| Deploy | Vercel Edge | No deployado |

### Insight clave

Los dos contratos no compiten — sirven para casos de uso distintos:

- **PayClawVault** = "cuenta de gasto". Modelo custodial: el humano deposita, el agente gasta dentro de límites. Es una cuenta bancaria con tarjeta de débito.
- **ServiceEscrow** = "contrato de servicio". Modelo trustless: Agent A lockea fondos, Agent B entrega, fondos se liberan. Es un escrow de freelance.

Un agente necesita ambos. Paga su API de OpenAI con PayClawVault (gasto directo), y contrata a otro agente para traducir un documento con ServiceEscrow (escrow trustless).

---

## Arquitectura Target

```
┌──────────────────────────────────────────────────────────────────┐
│                          AI AGENTS                               │
│              (Claude, GPT, LangChain, custom)                    │
└────────┬─────────────────────────────────────────┬───────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────┐            ┌──────────────────────────┐
│  @grip-protocol/sdk │            │     PayClaw Plugin       │
│    (TypeScript)     │            │  (Claude Desktop/MCP)    │
└────────┬────────────┘            └──────────┬───────────────┘
         │                                    │
         └──────────────┬─────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                   PayClaw API (Hono)                              │
│                   api.payclaw.me/v1                               │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐            │
│  │  Auth    │ │  Rate    │ │ Logging  │ │ Notify  │            │
│  │ (HMAC)  │ │ Limiter  │ │          │ │  (TG)   │            │
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘            │
│                                                                  │
│  Routes:                                                         │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ POST /pay           → PayClawVault.pay()                 │    │
│  │ POST /escrow        → ServiceEscrow.createEscrow()       │    │
│  │ POST /escrow/:id/release → ServiceEscrow.releaseEscrow() │    │
│  │ GET  /balance       → PayClawVault.balanceOf()           │    │
│  │ GET  /can-pay       → check limits + balance             │    │
│  │ GET  /history       → DB query                           │    │
│  │ POST /topup         → deposit instructions               │    │
│  │ POST /destinations  → whitelist management               │    │
│  │ GET  /agent/:id     → AgentDID.getAgent() + DB           │    │
│  │ POST /agent/register → AgentDID.registerAgent()          │    │
│  │ POST /session-keys  → SessionKeyManager.grantSessionKey()│    │
│  │ POST /pix/deposit   → GlobalPix BRL→USDC                │    │
│  │ POST /pix/withdraw  → GlobalPix USDC→BRL                │    │
│  │ POST /webhooks/brex → Brex card callbacks                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Services:                                                       │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐  │
│  │   vault.ts    │ │   grip.ts     │ │    treasury.ts         │  │
│  │ (PayClawVault)│ │(Grip cntrcts) │ │(unified balance view)  │  │
│  └───────┬───────┘ └───────┬───────┘ └────────────────────────┘  │
│          │                 │                                     │
└──────────┼─────────────────┼─────────────────────────────────────┘
           │                 │
           ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BASE L2 (Mainnet)                           │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │ PayClawVault │ │ServiceEscrow │ │      AgentDID          │   │
│  │ (custodial)  │ │ (trustless)  │ │(identity+reputation)   │   │
│  └──────────────┘ └──────────────┘ └────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │ SessionKey   │ │AgentRegistry │ │   GripPaymaster        │   │
│  │  Manager     │ │ (discovery)  │ │  (gas sponsorship)     │   │
│  └──────────────┘ └──────────────┘ └────────────────────────┘   │
│                                                                  │
│                   ┌──────────────┐                               │
│                   │  USDC (real) │                               │
│                   └──────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
                        │
                        │  Supabase (DB unificada)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│ api_keys │ agents │ payments │ pix_transactions │ session_keys   │
│ destinations │ webhooks │ webhook_deliveries │ used_nonces       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Revisión Peppina (CTO) — 22 Mar 2026

### Aprobado con 3 ajustes:

**1. DB unificada es Paso 1, no Paso 3.** Tener dos DBs con `treasury.ts` cruzando datos es deuda técnica que crece exponencialmente. Joins imposibles entre payments de escrow (Supabase) y payments directos (Neon). Se hace junto con la migración a viem — 2-3h extra ahí ahorra un quilombo después.

**2. EscrowId parsing es blocker explícito.** El `Date.now()` placeholder en NestJS tiene un fix concreto con viem:

```typescript
import { decodeEventLog, keccak256, toBytes } from 'viem'

const escrowCreatedTopic = keccak256(
  toBytes('EscrowCreated(uint256,address,address,uint256,bytes32)')
)
const log = receipt.logs.find(l => l.topics[0] === escrowCreatedTopic)
if (!log) throw new Error('EscrowCreated event not found in receipt')

const { args } = decodeEventLog({
  abi: SERVICE_ESCROW_ABI,
  data: log.data,
  topics: log.topics,
})
const escrowId = args.escrowId // ← real on-chain ID
```

Esto es subtarea explícita del Paso 1.

**3. Reorden de prioridad.** SDK unificado baja a Paso 5. Nadie lo consume externamente. El plugin hace HTTP directo.

---

## Plan de Ejecución (6 pasos — revisado)

### Paso 1: Fundación — viem + grip.ts + DB unificada + escrowId fix

Este paso es el más grande pero es la fundación. Incluye tres sub-tareas que se hacen juntas para evitar un estado intermedio con dos DBs.

#### 1A. Migrar vault.ts de ethers.js a viem

**Archivo:** `/payclaw/api/src/services/vault.ts`

1. Migrar de ethers.js a viem — consistencia con el resto del stack. Viem es más type-safe y más liviano.
2. Añadir ABIs de Grip — copiar los ABIs minificados del GripService de NestJS:
   - `AGENT_DID_ABI` (registerAgent, getAgent, agentExists, updateReputation)
   - `SERVICE_ESCROW_ABI` (createEscrow, releaseEscrow, refundOnTimeout, dispute)
   - `SESSION_KEY_ABI` (grantSessionKey, revokeSessionKey, validateSession)
   - `AGENT_REGISTRY_ABI` (register, getProfile)
3. Crear `grip.ts` como service nuevo (no reemplazar vault.ts, convivir):

```
/payclaw/api/src/services/
├── vault.ts         → PayClawVault (pagos directos)
├── grip.ts          → ServiceEscrow + AgentDID + SessionKeyManager (NEW)
├── treasury.ts      → Vista unificada de balance
├── brex.ts          → Brex card integration (sin cambios)
└── notifications.ts → Telegram/webhook (sin cambios)
```

4. Config nuevo — agregar a `config.ts`:

```typescript
// Grip contracts (Base)
agentDIDAddress: env("AGENT_DID_ADDRESS"),
serviceEscrowAddress: env("SERVICE_ESCROW_ADDRESS"),
sessionKeyManagerAddress: env("SESSION_KEY_MANAGER_ADDRESS"),
agentRegistryAddress: env("AGENT_REGISTRY_ADDRESS"),
gripPaymasterAddress: env("GRIP_PAYMASTER_ADDRESS"),
```

**Archivos a tocar:**
- `payclaw/api/src/services/vault.ts` — refactor ethers→viem
- `payclaw/api/src/services/grip.ts` — NUEVO
- `payclaw/api/src/config.ts` — agregar addresses de Grip
- `payclaw/api/.env.example` — agregar vars

#### 1B. DB unificada — Drizzle sobre Supabase PG

Mantener Drizzle como ORM (type-safe, migrations), solo cambiar connection string a Supabase Postgres.

**Schema final unificado:**

```sql
-- agents (merge: Supabase base + standalone fields)
CREATE TABLE agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id uuid REFERENCES api_keys(id),
    agent_id text NOT NULL,
    wallet_address text,
    on_chain boolean DEFAULT false,
    on_chain_tx text,
    model_version text,
    name text,
    auto_approve_limit numeric(18,6) DEFAULT 50,
    frozen boolean DEFAULT false,
    brex_card_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- payments (merge)
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid REFERENCES agents(id),
    type text NOT NULL CHECK (type IN ('direct', 'escrow')),
    direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded', 'pending_approval', 'paid')),
    amount_usdc numeric(18,6) NOT NULL,
    fee_usdc numeric(18,6) DEFAULT 0,
    to_address text,
    from_address text,
    memo text,
    escrow_id bigint,
    tx_hash text,
    block_number bigint,
    payment_method text CHECK (payment_method IN ('onchain', 'brex_card')),
    nonce text,
    to_destination text,
    created_at timestamptz DEFAULT now(),
    confirmed_at timestamptz,
    metadata jsonb DEFAULT '{}'
);

-- destinations (del standalone, nuevo en Supabase)
CREATE TABLE destinations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid REFERENCES agents(id),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('merchant', 'agent', 'address')),
    status text NOT NULL DEFAULT 'active',
    address text,
    website text,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- used_nonces (del standalone, nuevo en Supabase)
CREATE TABLE used_nonces (
    agent_id text NOT NULL,
    nonce text NOT NULL,
    PRIMARY KEY (agent_id, nonce)
);

-- pix_transactions, session_keys, webhooks, webhook_deliveries
-- → sin cambios del schema original de Supabase
```

**Archivos a tocar:**
- `payclaw/api/src/db/schema.ts` — reescribir con tablas mergeadas
- `payclaw/api/src/db/index.ts` — actualizar queries
- `payclaw/api/drizzle.config.ts` — connection string → Supabase
- Crear migration SQL combinada en `payclaw/api/migrations/`

#### 1C. Fix escrowId parsing (BLOCKER)

```typescript
// En grip.ts — después de createEscrow tx
import { decodeEventLog, keccak256, toBytes } from 'viem'

async function parseEscrowIdFromReceipt(receipt: TransactionReceipt): bigint {
  const escrowCreatedTopic = keccak256(
    toBytes('EscrowCreated(uint256,address,address,uint256,bytes32)')
  )
  const log = receipt.logs.find(l => l.topics[0] === escrowCreatedTopic)
  if (!log) throw new Error('EscrowCreated event not found in receipt')

  const { args } = decodeEventLog({
    abi: SERVICE_ESCROW_ABI,
    data: log.data,
    topics: log.topics,
  })
  return args.escrowId
}
```

**Estimación total Paso 1: 8-10 horas**

---

### Paso 2: Añadir rutas de escrow y agente a la API Hono

```
/payclaw/api/src/routes/
├── balance.ts       (existe)
├── pay.ts           (existe)
├── canPay.ts        (existe)
├── history.ts       (existe)
├── topup.ts         (existe)
├── destinations.ts  (existe)
├── limits.ts        (existe)
├── webhooks.ts      (existe)
├── escrow.ts        ← NUEVO
├── agents.ts        ← NUEVO
├── sessionKeys.ts   ← NUEVO
├── pix.ts           ← NUEVO
```

| Método | Ruta | Contrato | Fuente |
|--------|------|----------|--------|
| `POST /escrow` | ServiceEscrow.createEscrow() | grip.ts | NestJS payments.service |
| `POST /escrow/:id/release` | ServiceEscrow.releaseEscrow() | grip.ts | NestJS payments.service |
| `POST /escrow/:id/refund` | ServiceEscrow.refundOnTimeout() | grip.ts | NestJS payments.service |
| `POST /escrow/:id/dispute` | ServiceEscrow.dispute() | grip.ts | NestJS payments.service |
| `GET /agent/:id` | AgentDID.getAgent() + DB | grip.ts | NestJS agents.service |
| `POST /agent/register` | AgentDID.registerAgent() | grip.ts | NestJS agents.service |
| `POST /session-keys` | SessionKeyManager.grantSessionKey() | grip.ts | NestJS |
| `DELETE /session-keys/:keyId` | SessionKeyManager.revokeSessionKey() | grip.ts | NestJS |
| `POST /pix/deposit` | GlobalPix (Avenia) | pix.ts | grip-protocol SDK types |
| `POST /pix/withdraw` | GlobalPix (Avenia) | pix.ts | grip-protocol SDK types |
| `GET /pix/rate` | Bitso/Avenia | pix.ts | - |

**Estimación: 6-8 horas**

---

### Paso 3: Deprecar grip-protocol/payclaw-api (NestJS)

```
grip-protocol/payclaw-api/ ← BORRAR TODO
```

Archivos que QUEDAN en grip-protocol:
```
grip-protocol/
├── src/           ← Smart contracts (sin cambios)
├── test/          ← Foundry tests (sin cambios)
├── script/        ← Deploy scripts (sin cambios)
├── sdk/           ← SDK (se actualiza en Paso 5)
├── docs/          ← Litepaper + this doc
├── brand/         ← Logo
├── payclaw-web/   ← Dashboard web
├── foundry.toml
├── README.md
└── .env.example
```

**Estimación: 1 hora**

---

### Paso 4: Actualizar Plugin (OpenClaw)

Scripts nuevos:
- `escrow.ts` — crear escrow, listar escrows activos
- `release.ts` — release escrow
- `identity.ts` — ver agent DID, reputation

SKILL.md — agregar security rules para escrow (ej: "ALWAYS confirm escrow amounts > $100 with human").

**Estimación: 2-3 horas**

---

### Paso 5: Unificar SDK

Mergear en `@grip-protocol/sdk`. El standalone `@payclaw/sdk` se depreca.

```typescript
import { PayClaw } from '@grip-protocol/sdk'

const pc = new PayClaw({
  apiKey: 'payclaw_live_xxx',
  agentId: 'my-agent',
})

// Pagos directos (PayClawVault)
await pc.pay('OpenAI', 20.00, 'GPT-4 credits')
await pc.canPay(50.00)
await pc.balance()

// Escrow (ServiceEscrow)
const escrow = await pc.escrow('0xpayee...', 5.00, { serviceId: 'translation' })
await pc.release(escrow.escrowId)

// Identity (AgentDID)
const agent = pc.agent('my-agent')
await agent.registerOnChain('0xwallet...')
await agent.issueSessionKey({ dailyLimitUsdc: 100, validForHours: 24 })

// Pix (GlobalPix)
await pc.pixDeposit(500) // R$500 → USDC
```

**Estimación: 4-6 horas**

---

### Paso 6: Deploy pipeline y verificación

1. **Contratos en Base mainnet** — deploy PayClawVault + Grip contracts, verify en BaseScan
2. **API en Vercel** — agregar env vars de Grip, apuntar api.payclaw.me
3. **DB** — correr migration combinada en Supabase
4. **SDK** — publicar @grip-protocol/sdk en npm
5. **Tests e2e** — register→pay→escrow→release→pix→circuit breaker

**Estimación: 8-12 horas**

---

## Resumen de esfuerzo

| Paso | Descripción | Horas | Crítico? |
|------|-------------|-------|----------|
| 1 | Fundación: viem + grip.ts + DB unificada + escrowId fix | 8-10 | BLOCKER |
| 2 | Nuevas rutas en Hono (escrow, agents, pix, sessionKeys) | 6-8 | BLOCKER |
| 3 | Deprecar NestJS | 1 | Limpieza |
| 4 | Plugin actualizado (escrow commands) | 2-3 | Nice to have |
| 5 | SDK unificado | 4-6 | Nice to have |
| 6 | Deploy mainnet + verificación e2e | 8-12 | Para demo |
| **Total** | | **29-40 horas** | |

**MVP mínimo (Pasos 1+2+3): 15-19 horas** → arquitectura limpia, una sola API, una sola DB.

---

## Qué NO cambia

- Smart contracts (AgentDID, ServiceEscrow, SessionKeyManager, AgentRegistry, GripPaymaster, PayClawVault) — intactos
- Landing page (`/payclaw/landing/`) — intacta
- Litepaper — intacto
- Dashboard web (`/grip-protocol/payclaw-web/`) — intacto
- Foundry tests — intactos

## Qué se BORRA

- `/grip-protocol/payclaw-api/` — todo el directorio NestJS
- `/payclaw/sdk/` — reemplazado por @grip-protocol/sdk (Paso 5)

## Qué se CREA

- `/payclaw/api/src/services/grip.ts`
- `/payclaw/api/src/routes/escrow.ts`
- `/payclaw/api/src/routes/agents.ts`
- `/payclaw/api/src/routes/sessionKeys.ts`
- `/payclaw/api/src/routes/pix.ts`
- `/payclaw/api/migrations/002_unified_schema.sql`
- `/payclaw/plugin/scripts/escrow.ts`
- `/payclaw/plugin/scripts/release.ts`
- `/payclaw/plugin/scripts/identity.ts`

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Supabase latency para writes on-chain | Writes van directo al contrato; DB es para indexing |
| PayClawVault y ServiceEscrow manejan USDC distinto | Flujos separados en la API — no interfieren |
| SDK breaking change | No hay usuarios externos — ventana perfecta |
| Drizzle + Supabase compatibilidad | Drizzle soporta Supabase PG nativamente |
| Escrow ID parsing del receipt | Fix incluido como subtarea explícita del Paso 1C |

---

## Pregunta abierta

¿El deploy a Base mainnet es para cuándo?
- Si hay demo/investor meeting próximo: Paso 6 sube de prioridad
- Si el objetivo es arquitectura limpia primero: orden actual está bien
