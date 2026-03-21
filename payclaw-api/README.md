# PayClaw API

Payment infrastructure for AI agents — built on [Grip Protocol](https://grip.wtf).

## Stack

- **NestJS** — framework
- **Viem** — blockchain interaction (Base / Base Sepolia)
- **Supabase** — database + auth
- **GlobalPix** — Pix BRL↔USDC rails

## Grip Protocol (Base Sepolia)

| Contract          | Address                                    |
|-------------------|--------------------------------------------|
| AgentDID          | `0x18aEC23c4dF2BFD1d6A3bB93920A045F0c3EE029` |
| ServiceEscrow     | `0x770A702C2F0CECBD1f54513fBE850e75FCC76BF8` |
| SessionKeyManager | `0x4351c497ac1d62e2664E4e46D3731c3602d33463` |
| AgentRegistry     | `0x49e0E0486d57592FDa1a673B5d4A154Be7069127` |
| GripPaymaster     | `0xa505Db912C7ee0160F987cAF6E1Cc9914CeeB4Dd` |

## Setup

```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, DEPLOYER_PRIVATE_KEY, etc.

npm install
npm run db:migrate   # push schema to Supabase
npm run start:dev
```

API docs: http://localhost:3000/docs

## API Overview

```
POST /v1/agents                          Create agent
GET  /v1/agents/:agentId                 Get agent + on-chain reputation
POST /v1/agents/:agentId/register-on-chain  Register DID on Grip Protocol
POST /v1/agents/:agentId/session-keys    Issue session key

POST /v1/payments/pay                    Direct payment
POST /v1/payments/escrow                 Create escrow
POST /v1/payments/escrow/:id/release     Release escrow (payer confirms)
POST /v1/payments/escrow/:id/refund      Refund expired escrow
GET  /v1/payments/balance/:agentId       USDC balance

POST /v1/pix/deposit                     Generate Pix QR (BRL → USDC)
POST /v1/pix/withdraw                    Pix withdrawal (USDC → BRL)
GET  /v1/pix/rate                        BRL/USDC rate

POST /v1/webhooks                        Register webhook
GET  /v1/webhooks                        List webhooks
DELETE /v1/webhooks/:id                  Revoke webhook
```

## Deploy

```bash
docker build -t payclaw-api .
docker run -p 3000:3000 --env-file .env payclaw-api
```

## Architecture

```
Agent (OpenClaw / any) 
  → PayClaw API (this repo)
    → Grip Protocol contracts (Base)
    → GlobalPix rails (Pix BRL↔USDC)
    → Supabase (state, history, webhooks)
```

## License

MIT
