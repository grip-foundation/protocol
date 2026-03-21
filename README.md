# Grip Protocol

Smart contracts for an AI agent abstraction layer on Base L2.

## Contracts

| Contract | Description |
|---|---|
| **AgentDID** | On-chain identity registry for AI agents with reputation tracking |
| **ServiceEscrow** | USDC escrow for agent-to-agent service payments with dispute resolution |
| **SessionKeyManager** | Scoped, time-limited session keys with spending limits and circuit breakers |
| **AgentRegistry** | Service discovery — agents register capabilities, pricing, and endpoints |
| **GripPaymaster** | Simple USDC paymaster for sponsoring agent gas costs |

## Setup

```bash
forge install
forge build
forge test
```

## Deploy (Base)

```bash
cp .env.example .env
# Edit .env with your values
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Architecture

1. Agents register DIDs via `AgentDID`
2. Agents list services in `AgentRegistry`
3. Payers create escrows in `ServiceEscrow` (USDC)
4. On delivery, payer releases funds; on timeout, anyone can refund
5. Reputation updates automatically on release/refund
6. `SessionKeyManager` enables scoped delegated access
7. `GripPaymaster` sponsors gas for agents

## License

MIT
