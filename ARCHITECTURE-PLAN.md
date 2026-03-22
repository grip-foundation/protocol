# Plan de Unificación Arquitectónica: Grip + PayClaw

**Fecha:** 22 Mar 2026
**Autor:** Le + Claude + Peppina (CTO review)
**Status:** Pasos 1–5 COMPLETADOS (22 Mar 2026) — Pendiente: Paso 6 (deploy mainnet + e2e)

---

## Diagnóstico

Existen **dos implementaciones de PayClaw** que divergieron:

| | `/payclaw/` (standalone) | `/grip-protocol/payclaw-api/` |
|---|---|---|
| **Framework** | Hono (Vercel Edge) | NestJS |
| **DB** | Neon Postgres + Drizzle | Supabase |
| **Contrato** | PayClawVault (custodial) | ServiceEscrow (trustless) |
| **Auth** | HMAC-SHA256 signatures | API key + Supabase |
| **Features** | Circuit breaker, timelock, Brex, whitelist, auto-approve | Escrow, DID, reputation, session keys, Pix |
| **SDK** | `@payclaw/sdk` (standalone client) | `@grip-protocol/sdk` (unified Grip+PayClaw) |
| **Deploy** | Vercel Edge | No deployado |

### Insight clave

Los dos contratos **no compiten** — sirven para casos de uso distintos:

- **PayClawVault** = "cuenta de gasto". Modelo custodial: el humano deposita, el agente gasta dentro de límites. Ideal para: agent paga APIs, SaaS, merchants. Es una cuenta bancaria con tarjeta de débito.
- **ServiceEscrow** = "contrato de servicio". Modelo trustless: Agent A lockea fondos, Agent B entrega, fondos se liberan. Ideal para: agente contrata a otro agente. Es un escrow de freelance.

Un agente necesita **ambos**. Paga su API de OpenAI con PayClawVault (gasto directo), y contrata a otro agente para traducir un documento con ServiceEscrow (escrow trustless).

---

## Arquitectura Target

```
┌──────────────────────────────────────────────────────────────────┐
│                        AI AGENTS                                 │
│              (Claude, GPT, LangChain, custom)                    │
└────────┬─────────────────────────────────────────┬───────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────┐              ┌──────────────────────────┐
│  @grip-protocol/sdk │              │  PayClaw Plugin          │
│  (TypeScript)       │              │  (Claude Desktop/MCP)    │
└────────┬────────────┘              └──────────┬───────────────┘
         │                                      │
         └──────────────┬───────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PayClaw API (Hono)                             │
│                    api.payclaw.me/v1                              │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐            │
│  │ Auth     │ │ Rate     │ │ Logging  │ │ Notify  │            │
│  │ (HMAC)   │ │ Limiter  │ │          │ │ (TG)    │            │
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘            │
│                                                                  │
│  Routes:                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ POST /pay          → PayClawVault.pay()                  │   │
│  │ POST /escrow       → ServiceEscrow.createEscrow()        │   │
│  │ POST /escrow/:id/release → ServiceEscrow.releaseEscrow() │   │
│  │ GET  /balance      → PayClawVault.balanceOf()            │   │
│  │ GET  /can-pay      → check limits + balance              │   │
│  │ GET  /history      → DB query                            │   │
│  │ POST /topup        → deposit instructions                │   │
│  │ POST /destinations → whitelist management                │   │
│  │ GET  /agent/:id    → AgentDID.getAgent() + DB            │   │
│  │ POST /agent/register → AgentDID.registerAgent()          │   │
│  │ POST /session-keys → SessionKeyManager.grantSessionKey() │   │
│  │ POST /pix/deposit  → GlobalPix BRL→USDC                  │   │
│  │ POST /pix/withdraw → GlobalPix USDC→BRL                  │   │
│  │ POST /webhooks/brex → Brex card callbacks                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Services:                                                       │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐ │
│  │ vault.ts      │ │ grip.ts       │ │ treasury.ts            │ │
│  │ (PayClawVault)│ │ (Grip cntrcts)│ │ (unified balance view) │ │
│  └───────┬───────┘ └───────┬───────┘ └────────────────────────┘ │
│          │                 │                                     │
└──────────┼─────────────────┼─────────────────────────────────────┘
           │                 │
           ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BASE L2 (Mainnet)                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ PayClawVault │  │ ServiceEscrow│  │ AgentDID               │ │
│  │ (custodial)  │  │ (trustless)  │  │ (identity+reputation)  │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ SessionKey   │  │ AgentRegistry│  │ GripPaymaster          │ │
│  │ Manager      │  │ (discovery)  │  │ (gas sponsorship)      │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐                                                │
│  │ USDC (real)  │                                                │
│  └──────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
           │
           │ Supabase (DB unificada)
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  api_keys │ agents │ payments │ pix_transactions │ session_keys  │
│  destinations │ webhooks │ webhook_deliveries │ used_nonces      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Revisión Peppina (CTO) — 22 Mar 2026

### Aprobado con 3 ajustes:

**1. DB unificada es Paso 1, no Paso 3.**
Tener dos DBs con `treasury.ts` cruzando datos es deuda técnica que crece exponencialmente. Joins imposibles entre payments de escrow (Supabase) y payments directos (Neon). Se hace junto con la migración a viem — 2-3h extra ahí ahorra un quilombo después.

**2. EscrowId parsing es blocker explícito.**
El `Date.now()` placeholder en NestJS tiene un fix concreto con viem:
```typescript
import { decodeEventLog } from 'viem'
const log = receipt.logs.find(l =>
  l.topics[0] === keccak256(toBytes('EscrowCreated(uint256,address,address,uint256,bytes32)'))
)
const { args } = decodeEventLog({
  abi: SERVICE_ESCROW_ABI,
  data: log.data,
  topics: log.topics,
})
const escrowId = args.escrowId // ← real on-chain ID
```
Esto es subtarea explícita del Paso 1.

**3. Reorden de prioridad.**
SDK unificado (ex-Paso 4) baja a Paso 6. Nadie lo consume externamente. El plugin hace HTTP directo. Nuevo orden:

| Orden original | Orden final | Descripción |
|---|---|---|
| Paso 1 | **Paso 1** | viem + grip.ts + DB unificada (Supabase) |
| Paso 3 | ↑ merged | DB migration mergeada en Paso 1 |
| Paso 2 | **Paso 2** | Rutas escrow/agent/pix en Hono |
| Paso 6 | **Paso 3** | Deprecar NestJS |
| Paso 5 | **Paso 4** | Plugin actualizado |
| Paso 4 | **Paso 5** | SDK unificado |
| Paso 7 | **Paso 6** | Deploy + verificación |

### Pregunta abierta: timing de mainnet deploy
Si hay demo/investor meeting próximo, el deploy a Base mainnet sube de prioridad y se puede hacer antes de la API unificada. Si el objetivo es tener la arquitectura limpia antes de mostrar código, el orden actual está bien.

---

## Plan de Ejecución (6 pasos — revisado)

### Paso 1: Fundación — viem + grip.ts + DB unificada

Este paso es el más grande pero es la fundación. Incluye tres sub-tareas que se hacen juntas para evitar un estado intermedio con dos DBs.

#### 1A. Migrar vault.ts de ethers.js a viem

**Archivo:** `/payclaw/api/src/services/vault.ts`

Actualmente usa ethers.js y habla solo con PayClawVault. Hay que:

1. **Migrar de ethers.js a viem** — consistencia con el resto del stack (grip-protocol ya usa viem). Viem es más type-safe y más liviano.

2. **Añadir ABIs de Grip** — copiar los ABIs minificados del `GripService` de NestJS:
   - `AGENT_DID_ABI` (registerAgent, getAgent, agentExists, updateReputation)
   - `SERVICE_ESCROW_ABI` (createEscrow, releaseEscrow, refundOnTimeout, dispute)
   - `SESSION_KEY_ABI` (grantSessionKey, revokeSessionKey, validateSession)
   - `AGENT_REGISTRY_ABI` (register, getProfile)

3. **Crear `grip.ts` como service nuevo** (no reemplazar vault.ts, convivir):
   ```
   /payclaw/api/src/services/
   ├── vault.ts      → PayClawVault (pagos directos)
   ├── grip.ts       → ServiceEscrow + AgentDID + SessionKeyManager (NEW)
   ├── treasury.ts   → Vista unificada de balance
   ├── brex.ts       → Brex card integration (sin cambios)
   └── notifications.ts → Telegram/webhook (sin cambios)
   ```

4. **Config nuevo** — agregar a `config.ts`:
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
- `payclaw/api/src/services/grip.ts` — **NUEVO** (portar lógica de grip-protocol/payclaw-api/src/grip/grip.service.ts)
- `payclaw/api/src/config.ts` — agregar addresses de Grip
- `payclaw/api/.env.example` — agregar vars

#### 1B. DB unificada — Drizzle sobre Supabase PG

**Razón (Peppina):** Dos DBs con `treasury.ts` cruzando datos es inviable. Joins imposibles entre payments de escrow (Supabase) y payments directos (Neon). Se hace ahora, no después.

**Approach:** Mantener Drizzle como ORM (type-safe, migrations), solo cambiar connection string a Supabase Postgres. No perder tooling de Drizzle pero ganar Supabase para dashboard, auth y RLS futuro.

**Schema final unificado** (merge de Supabase 001_initial_schema.sql + Drizzle standalone):

```sql
-- api_keys (de Supabase, sin cambios)
-- agents (merge: Supabase base + standalone fields)
CREATE TABLE agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      uuid REFERENCES api_keys(id),
  agent_id        text NOT NULL,
  wallet_address  text,
  on_chain        boolean DEFAULT false,
  on_chain_tx     text,
  model_version   text,
  name            text,
  -- Fields from standalone:
  auto_approve_limit  numeric(18,6) DEFAULT 50,
  frozen              boolean DEFAULT false,
  brex_card_id        text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- payments (merge — status enum ampliado)
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid REFERENCES agents(id),
  type            text NOT NULL CHECK (type IN ('direct', 'escrow')),
  direction       text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'failed',
                                      'refunded', 'pending_approval', 'paid')),
  amount_usdc     numeric(18,6) NOT NULL,
  fee_usdc        numeric(18,6) DEFAULT 0,
  to_address      text,
  from_address    text,
  memo            text,
  escrow_id       bigint,
  tx_hash         text,
  block_number    bigint,
  payment_method  text CHECK (payment_method IN ('onchain', 'brex_card')),
  nonce           text,
  to_destination  text,
  created_at      timestamptz DEFAULT now(),
  confirmed_at    timestamptz,
  metadata        jsonb DEFAULT '{}'
);

-- destinations (del standalone, nuevo en Supabase)
CREATE TABLE destinations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid REFERENCES agents(id),
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('merchant', 'agent', 'address')),
  status      text NOT NULL DEFAULT 'active',
  address     text,
  website     text,
  reason      text,
  created_at  timestamptz DEFAULT now()
);

-- used_nonces (del standalone, nuevo en Supabase)
CREATE TABLE used_nonces (
  agent_id text NOT NULL,
  nonce    text NOT NULL,
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

#### 1C. Fix escrowId parsing (BLOCKER — Peppina)

El `escrowId = Date.now()` en el NestJS es un placeholder que no funciona en producción. Fix concreto con viem:

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

Este fix se implementa directamente en el nuevo `grip.ts` — nunca llega al código viejo.

**Estimación total Paso 1:** 8-10 horas (viem migration 4h + DB unification 3h + escrowId fix 1h)

---

### Paso 2: Añadir rutas de escrow y agente a la API Hono

**Archivos nuevos:**
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

**Rutas nuevas:**

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

**Lógica clave del escrow (portar de NestJS):**
- `createEscrow`: approve USDC → createEscrow → log en DB → return escrowId+txHash
- `releaseEscrow`: releaseEscrow on-chain → update DB → return
- Fix crítico: parsear escrowId del event `EscrowCreated` en los logs del receipt (hoy es `Date.now()` placeholder)

**Estimación:** 6-8 horas

---

### Paso 3: Deprecar grip-protocol/payclaw-api (NestJS)

Una vez que Paso 1+2 están completos, la API Hono tiene toda la funcionalidad. El NestJS se borra.

**Qué preservar antes de borrar:**
1. Los ABIs en `grip.service.ts` → ya portados a `grip.ts` en Hono (Paso 1A)
2. El schema SQL de Supabase → ya mergeado (Paso 1B)
3. La lógica de `payments.service.ts` → ya portada a routes (Paso 2)
4. El escrowId parsing → ya fijado (Paso 1C)
5. Los controllers/modules → no necesarios (Hono es más simple)

**Archivos a borrar:**
```
grip-protocol/payclaw-api/    ← TODO el directorio
```

**Archivos que QUEDAN en grip-protocol:**
```
grip-protocol/
├── src/                    ← Smart contracts (sin cambios)
├── test/                   ← Foundry tests (sin cambios)
├── script/                 ← Deploy scripts (sin cambios)
├── sdk/                    ← SDK (se actualiza en Paso 5)
├── docs/                   ← Litepaper (sin cambios)
├── brand/                  ← Logo (sin cambios)
├── payclaw-web/            ← Dashboard web (sin cambios)
├── foundry.toml
├── README.md
└── .env.example
```

**Estimación:** 1 hora (borrar + verificar que nada dependa del directorio)

---

### Paso 4: Actualizar Plugin (OpenClaw)

El plugin en `/payclaw/plugin/` ya tiene buen SKILL.md con security rules. Actualizar los scripts para hacer HTTP directo a las nuevas rutas (sin SDK — Peppina: SDK puede esperar), y agregar comandos de escrow.

**Scripts a actualizar:**
- `pay.ts` — sin cambios (llama a `/pay`)
- `balance.ts` — sin cambios
- `canpay.ts` — sin cambios
- `history.ts` — sin cambios
- `topup.ts` — sin cambios
- `escrow.ts` — **NUEVO** (crear escrow, listar escrows activos)
- `release.ts` — **NUEVO** (release escrow)
- `identity.ts` — **NUEVO** (ver agent DID, reputation)

**SKILL.md** — agregar sección de escrow con security rules (ej: "ALWAYS confirm escrow amounts > $100 with human").

**Estimación:** 2-3 horas

---

### Paso 5: Unificar SDK

Hoy hay dos SDKs:
- `@payclaw/sdk` (standalone) — HMAC auth, clean DX, pero no sabe de Grip
- `@grip-protocol/sdk` — sabe de Grip, escrow, DID, Pix, pero HTTP client más básico

**Decisión:** Mergear en `@grip-protocol/sdk` (es el nombre correcto a largo plazo — PayClaw es un producto, Grip es el protocolo).

**Lo que se hereda de cada uno:**

Del `@payclaw/sdk`:
- `RateLimiter` class (client-side rate limiting)
- HMAC signature logic
- Error hierarchy (`PayClawError`, `PayClawAuthError`, `PayClawRateLimitError`, etc.)
- `canPay()`, `destinations()`, `requestDestination()` methods

Del `@grip-protocol/sdk`:
- `PayClaw` class como entry point
- `GripAgent` class con scoped agent interface
- `agent.escrow()`, `agent.release()`, `agent.refund()`
- `agent.registerOnChain()`, `agent.issueSessionKey()`
- `agent.pixDeposit()`, `agent.pixWithdraw()`
- All types (`PayClawConfig`, `AgentInfo`, `SessionKeyConfig`, etc.)

**Resultado:**
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

**Archivos a tocar:**
- `grip-protocol/sdk/src/http.ts` — incorporar HMAC auth + rate limiter del standalone
- `grip-protocol/sdk/src/payclaw.ts` — agregar `canPay()`, `destinations()`, `limits()`
- `grip-protocol/sdk/src/agent.ts` — agregar `canPay()` scoped
- `grip-protocol/sdk/src/types.ts` — merge types
- `grip-protocol/sdk/src/errors.ts` — **NUEVO** (portar error hierarchy del standalone)

**El standalone SDK (`/payclaw/sdk/`) se depreca.** Redirect de `@payclaw/sdk` → `@grip-protocol/sdk` en npm.

**Estimación:** 4-6 horas

---

### Paso 6: Deploy pipeline y verificación

1. **Contratos en Base mainnet:**
   - PayClawVault — deploy nuevo (el de testnet no tiene los addresses de USDC real)
   - Los contratos de Grip (AgentDID, ServiceEscrow, etc.) ya están en Base Sepolia → deploy a mainnet
   - Verificar todos en BaseScan

2. **API en Vercel:**
   - PayClaw API ya tiene `vercel.json` — agregar las env vars nuevas de Grip
   - Apuntar `api.payclaw.me` al nuevo deploy

3. **DB:**
   - Correr migration combinada en Supabase
   - Migrar datos existentes de Neon si los hay

4. **SDK:**
   - Publicar `@grip-protocol/sdk` en npm
   - Setup deprecated redirect para `@payclaw/sdk`

5. **Tests end-to-end:**
   - Agent se registra → obtiene DID on-chain
   - Agent paga merchant via PayClawVault → tx confirmed
   - Agent crea escrow → payee entrega → release → reputation updated
   - Agent genera Pix QR → deposita BRL → balance aumenta en USDC
   - Circuit breaker: 3 pagos fallidos → agent frozen

**Estimación:** 8-12 horas

---

## Resumen de esfuerzo (revisado)

| Paso | Descripción | Horas | Crítico? |
|------|-------------|-------|----------|
| 1 | Fundación: viem + grip.ts + DB unificada + escrowId fix | 8-10 | **BLOCKER** |
| 2 | Nuevas rutas en Hono (escrow, agents, pix, sessionKeys) | 6-8 | **BLOCKER** |
| 3 | Deprecar NestJS | 1 | Limpieza |
| 4 | Plugin actualizado (escrow commands) | 2-3 | Nice to have |
| 5 | SDK unificado | 4-6 | Nice to have |
| 6 | Deploy mainnet + verificación e2e | 8-12 | **Para demo** |
| **Total** | | **29-40 horas** | |

**MVP mínimo (Pasos 1+2+3):** 15-19 horas → arquitectura limpia, una sola API, una sola DB.

---

## Qué NO cambia

- Smart contracts de Grip Protocol (AgentDID, ServiceEscrow, SessionKeyManager, AgentRegistry, GripPaymaster) — **intactos**
- PayClawVault contract — **intacto**
- Landing page de PayClaw (`/payclaw/landing/`) — **intacta**
- Litepaper — **intacto**
- Dashboard web (`/grip-protocol/payclaw-web/`) — **intacto**
- Foundry tests — **intactos**

## Qué se BORRA

- `/grip-protocol/payclaw-api/` — todo el directorio NestJS
- `/payclaw/sdk/` — reemplazado por `@grip-protocol/sdk` (Paso 5)

## Qué se CREA

- `/payclaw/api/src/services/grip.ts` — service para contratos Grip (viem)
- `/payclaw/api/src/routes/escrow.ts` — rutas de escrow
- `/payclaw/api/src/routes/agents.ts` — rutas de agentes
- `/payclaw/api/src/routes/sessionKeys.ts` — rutas de session keys
- `/payclaw/api/src/routes/pix.ts` — rutas de Pix
- `/payclaw/api/migrations/002_unified_schema.sql` — migration combinada
- `/payclaw/plugin/scripts/escrow.ts` — plugin escrow commands
- `/payclaw/plugin/scripts/release.ts` — plugin release command
- `/payclaw/plugin/scripts/identity.ts` — plugin identity command

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Supabase tiene latency para writes on-chain | Treasury service ya lee on-chain + DB; los writes van directo al contrato |
| PayClawVault y ServiceEscrow manejan USDC distinto (vault=custodial, escrow=approve+transfer) | Son flujos separados en la API — no interfieren |
| SDK breaking change para usuarios actuales | No hay usuarios externos todavía — ventana perfecta para unificar |
| Drizzle + Supabase compatibilidad | Drizzle soporta Supabase PG nativamente via connection string |
| Escrow ID parsing del receipt | Fix incluido como subtarea explícita del Paso 1C (Peppina) |

---

## Pregunta abierta (Peppina)

**¿El deploy a Base mainnet es para cuándo?**

- **Si hay demo/investor meeting próximo:** Paso 6 (deploy) sube de prioridad. Se puede deployar contratos a mainnet primero y unificar la API después.
- **Si el objetivo es arquitectura limpia antes de mostrar código:** Orden actual está bien (1→2→3→4→5→6).

Decidir esto determina si arrancamos por la fundación (Paso 1) o por el deploy (Paso 6).
