# Task: Create Grip Protocol Smart Contracts Repo

Create a complete Foundry project for Grip Protocol — smart contracts for an AI agent abstraction layer on Base.

## Contracts to build:

### 1. AgentDID.sol
- On-chain identity registry for AI agents
- Fields: address, createdBy (owner), modelVersion, skillset (bytes32[]), operationalSince, reputationScore, totalTxs, successRate
- Functions: registerAgent(), updateAgent(), getAgent(), exists()
- reputationScore and successRate are ONLY updatable by ServiceEscrow contract (not by owner)
- Events: AgentRegistered, AgentUpdated

### 2. SessionKeyManager.sol  
- ERC-7715 inspired granular permissions for agents
- SessionKey struct: validUntil, allowedContracts[], dailySpendingLimit, perTxLimit, escalationThreshold, circuitBreaker
- Functions: grantSessionKey(), revokeSessionKey(), validateSession(), getSessionKey()
- Tracks daily spending per key
- Auto-expires based on validUntil

### 3. ServiceEscrow.sol
- Agent-to-agent payment escrow with USDC
- Escrow struct: payer, payee, amount, serviceId, commitHash, timeout, status (Created/Released/Refunded/Disputed)
- Functions: createEscrow(), releaseEscrow(), refundOnTimeout(), dispute()
- 0.1% protocol fee on release (sent to treasury)
- Updates AgentDID reputation on completion (successRate, totalTxs)
- Events: EscrowCreated, EscrowReleased, EscrowRefunded, EscrowDisputed

### 4. AgentRegistry.sol
- Discovery marketplace for agent services
- AgentProfile struct: did (address), capabilities (string[]), pricePerCall, endpoint (string), slaSeconds
- Functions: register(), updateProfile(), query() by capability, deregister()
- Links to AgentDID for reputation data

### 5. GripPaymaster.sol
- ERC-4337 compatible paymaster for gas abstraction
- Owner deposits USDC, agent transactions are sponsored
- Functions: deposit(), withdraw(), validatePaymasterUserOp()
- Balance tracking per owner

## Technical Requirements:
- Solidity ^0.8.24
- Foundry (forge) project structure
- OpenZeppelin for access control, ReentrancyGuard, Pausable
- USDC interface (IERC20 with 6 decimals)
- Comprehensive tests for each contract
- Deploy script for Base Sepolia
- Use USDC address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Base mainnet) with configurable address for testnet
- .env.example with RPC_URL, PRIVATE_KEY, USDC_ADDRESS, ETHERSCAN_API_KEY
- Clean README.md explaining the protocol

## Project Structure:
```
src/
  AgentDID.sol
  SessionKeyManager.sol
  ServiceEscrow.sol
  AgentRegistry.sol
  GripPaymaster.sol
  interfaces/
    IAgentDID.sol
test/
  AgentDID.t.sol
  SessionKeyManager.t.sol
  ServiceEscrow.t.sol
  AgentRegistry.t.sol
  GripPaymaster.t.sol
script/
  Deploy.s.sol
```

## Important:
- All contracts should be production-quality with proper NatSpec docs
- Use custom errors (not require strings) for gas efficiency
- Add proper access control (Ownable2Step)
- ServiceEscrow is the ONLY contract that can update reputation in AgentDID
- Treasury address configurable in ServiceEscrow
- Make it clean, professional, ready for audit

When completely finished, run: openclaw system event --text "Done: Grip Protocol contracts built — 5 contracts + tests + deploy script" --mode now
