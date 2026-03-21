# @grip-protocol/sdk

Payment infrastructure for AI agents. Built on [Grip Protocol](https://grip.wtf) (Base L2).

## Install

```bash
npm install @grip-protocol/sdk
```

## 3-line setup

```typescript
import { PayClaw } from '@grip-protocol/sdk'

const payclaw = new PayClaw({
  apiKey: process.env.PAYCLAW_KEY,
  agentId: 'my-agent',
})

await payclaw.pay('OpenAI', 20.00, 'GPT-4 API credits')
// → { status: 'confirmed', txHash: '0x...', balance: 460.00 }
```

## Usage

### Direct payment

```typescript
const result = await payclaw.pay('OpenAI', 20.00, 'GPT-4 API credits')

console.log(result.txHash)   // 0xabc...
console.log(result.balance)  // 460.00 USDC remaining
```

### Trustless escrow (A2A service payments)

```typescript
// Agent A hires Agent B for a transcription
const escrow = await payclaw.escrow('0xagentB...', 0.02, {
  serviceId: 'transcription-v1',
  timeoutSeconds: 300,   // auto-refund after 5 min if not delivered
})

// ... Agent B transcribes the audio ...

// Agent A confirms delivery → funds released to Agent B
await payclaw.release(escrow.escrowId)
```

### Fund via Pix (Brazil)

```typescript
// Generate QR code — user pays R$100 → agent gets USDC
const { qrCode, amountUsdc } = await payclaw.pixDeposit(100)
console.log(`Pay R$100 → receive ${amountUsdc} USDC`)
// Display qrCode to user

// Get current rate
const rate = await payclaw.pixRate()
console.log(`1 USDC = R$${rate.brl_per_usdc}`)
```

### Balance

```typescript
const balance = await payclaw.balance()
console.log(`${balance} USDC`)
```

### Multiple agents

```typescript
// Each agent has its own scoped interface
const researcher = payclaw.agent('researcher-agent')
const writer     = payclaw.agent('writer-agent')

// Pay between agents
await researcher.pay('0xdataset-provider...', 5.00)
await writer.pixDeposit(500) // fund with R$500

// Check reputation on-chain
const info = await researcher.info()
console.log(`Success rate: ${info.onChainInfo?.successRate}`)
```

### Session keys (spending limits)

```typescript
// Issue a scoped session key for an agent
await payclaw.agent('autonomous-agent').issueSessionKey({
  dailyLimitUsdc:    100,    // max $100/day
  perTxLimitUsdc:    10,     // max $10/tx
  escalationUsdc:    50,     // require human approval above $50
  validForHours:     24,
  allowedContracts:  [],     // empty = all contracts allowed
})
```

### Register agent DID on-chain

```typescript
// Register identity on Grip Protocol (Base)
await payclaw.agent('my-agent').registerOnChain('0xwallet-address...')
// Agent now has verifiable on-chain identity + reputation tracking
```

### Error handling

```typescript
import { PayClaw, PayClawError, InsufficientFundsError } from '@grip-protocol/sdk'

try {
  await payclaw.pay('0xabc...', 999)
} catch (err) {
  if (err instanceof InsufficientFundsError) {
    console.log(`Need ${err.details.required} USDC, have ${err.details.available}`)
  } else if (err instanceof PayClawError) {
    console.log(`Error ${err.code}: ${err.message}`)
  }
}
```

## OpenClaw integration

```bash
openclaw skill install @payclaw
```

```
You: pay OpenAI $20 for API credits
Agent: [calls payclaw.pay('OpenAI', 20, 'API credits')]
       Payment confirmed. Balance: $460.00 USDC
```

## API Reference

### `new PayClaw(config)`

| Option    | Type     | Required | Default                    |
|-----------|----------|----------|----------------------------|
| `apiKey`  | `string` | ✓        | —                          |
| `agentId` | `string` | ✓        | —                          |
| `baseUrl` | `string` | —        | `https://api.payclaw.me`   |
| `timeout` | `number` | —        | `30000` (ms)               |

### PayClaw methods

| Method                              | Description                        |
|-------------------------------------|------------------------------------|
| `pay(to, amount, memo?)`            | Direct payment                     |
| `escrow(payee, amount, options?)`   | Create trustless escrow            |
| `release(escrowId)`                 | Release escrow to payee            |
| `balance()`                         | USDC balance                       |
| `agent(agentId)`                    | Get scoped GripAgent interface     |
| `pixDeposit(amountBrl)`             | Fund via Pix (BRL → USDC)          |
| `pixWithdraw(amountBrl, pixKey)`    | Withdraw via Pix (USDC → BRL)      |
| `pixRate()`                         | BRL/USDC exchange rate             |
| `history()`                         | Payment history                    |
| `createAgent(config)`               | Create a new agent                 |
| `agents()`                          | List all agents                    |

### GripAgent methods (via `payclaw.agent(id)`)

All PayClaw payment methods, scoped to the specific agent. Plus:

| Method                           | Description                         |
|----------------------------------|-------------------------------------|
| `info()`                         | Agent details + on-chain reputation |
| `registerOnChain(wallet)`        | Register DID on Grip Protocol       |
| `issueSessionKey(config)`        | Issue scoped session key            |

## License

MIT
