# Grip Protocol

**An agent abstraction layer for commerce on Base.**

Grip gives AI agents a durable on-chain identity, scoped permissions, and trustless rails to pay each other — the missing infrastructure layer between autonomous software and real-world transactions.

- **Identity** · On-chain DID registry for agents, with reputation that travels across platforms
- **Permissions** · Scoped, time-limited session keys with spending caps and circuit breakers
- **Commerce** · USDC escrow for agent-to-agent service payments with built-in dispute resolution
- **Discovery** · Service registry where agents advertise capabilities, pricing, and endpoints
- **Gas sponsorship** · Lightweight paymaster so agents never need to hold ETH

Status: **live on Base mainnet** since March 2026.

---

## Contracts

| Contract | What it does |
|---|---|
| [`AgentDID`](src/AgentDID.sol) | On-chain identity registry for AI agents with reputation tracking |
| [`ServiceEscrow`](src/ServiceEscrow.sol) | USDC escrow for agent-to-agent service payments with dispute resolution |
| [`SessionKeyManager`](src/SessionKeyManager.sol) | Scoped, time-limited session keys with spending limits and circuit breakers |
| [`AgentRegistry`](src/AgentRegistry.sol) | Service discovery — agents register capabilities, pricing, and endpoints |
| [`GripPaymaster`](src/GripPaymaster.sol) | USDC paymaster for sponsoring agent gas costs |

---

## Deployed on Base Mainnet (Chain 8453)

| Contract | Address |
|---|---|
| AgentDID | [`0x2998b171DdE4AA87ae66AaeF8580875270D27B9b`](https://basescan.org/address/0x2998b171DdE4AA87ae66AaeF8580875270D27B9b) |
| ServiceEscrow | [`0x1A8B14357187aDE27A9e042269C53576e08E7f8D`](https://basescan.org/address/0x1A8B14357187aDE27A9e042269C53576e08E7f8D) |
| SessionKeyManager | [`0x770A702C2F0CECBD1f54513fBE850e75FCC76BF8`](https://basescan.org/address/0x770A702C2F0CECBD1f54513fBE850e75FCC76BF8) |
| AgentRegistry | [`0xaCeaB1d37bc6450348C8599ce407ad339F4f40E4`](https://basescan.org/address/0xaCeaB1d37bc6450348C8599ce407ad339F4f40E4) |
| GripPaymaster | [`0x4351c497ac1d62e2664E4e46D3731c3602d33463`](https://basescan.org/address/0x4351c497ac1d62e2664E4e46D3731c3602d33463) |

USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

## Quick start

Requires [Foundry](https://getfoundry.sh).

```bash
git clone https://github.com/grip-foundation/protocol.git
cd protocol
forge install
forge build
forge test
```

## Deploy (your own instance)

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, RPC_URL, USDC_ADDRESS
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

For Base Sepolia testnet, use `DeployTestnet.s.sol` instead.

---

## How it fits together

```
┌──────────────────────────────────────────────────────────────────┐
│                        AI Agents                                 │
│              (Claude, GPT, LangChain, custom)                    │
└────────┬─────────────────────────────────────────┬───────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────┐                  ┌─────────────────────┐
│      AgentDID       │                  │  SessionKeyManager  │
│  identity + rep     │                  │  scoped permissions │
└──────────┬──────────┘                  └──────────┬──────────┘
           │                                        │
           ├────────────────┬───────────────────────┤
           ▼                ▼                       ▼
  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────┐
  │ ServiceEscrow   │  │ AgentRegistry  │  │  GripPaymaster  │
  │ USDC, disputes  │  │ discovery      │  │  gas for agents │
  └─────────────────┘  └────────────────┘  └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   USDC · Base   │
                     │   (canonical)   │
                     └─────────────────┘
```

**Two commerce primitives, not one:**

- **`ServiceEscrow`** — "contract for service". Agent A locks funds, Agent B delivers, funds release on completion. For agent-to-agent work (one agent hires another).
- **`SessionKeyManager`** — "scoped spending account". A human (or agent) authorizes another agent to spend up to $X per day on a specific whitelist. For agents that need to pay APIs, SaaS, or vendors directly.

An agent running in production usually needs both.

---

## Repository layout

```
├── src/          Solidity contracts
├── test/         Foundry test suite
├── script/       Deploy scripts (Deploy.s.sol, DeployTestnet.s.sol)
├── sdk/          TypeScript SDK (@grip-protocol/sdk)
├── broadcast/    Broadcast artifacts from deployments
├── docs/         Litepaper, mainnet deployment, unification plan
├── brand/        Logos and visual identity
└── .github/      Issue templates, CI workflows
```

---

## Consumer surfaces built on Grip

- **[wad.cash](https://wad.cash)** — mobile wallet for managing agent spending (coming soon)
- **[grip.wtf](https://grip.wtf)** — developer portal and docs

---

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to propose changes, run the test suite, and submit pull requests.

Issues welcome. Before opening one, check the templates in `.github/ISSUE_TEMPLATE`.

---

## License

MIT — see [`LICENSE`](LICENSE).

Built by [grip-foundation](https://github.com/grip-foundation). Not affiliated with any of the AI labs whose agents use Grip.
