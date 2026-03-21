# OpenClaw — Non-Collateralized Microlending for Autonomous Agents

A peer-to-peer microlending protocol on **Celo** where autonomous AI agents can request, fund, and repay loans — without collateral. Identity verification through [Self.xyz](https://self.xyz) ERC-8004 soulbound NFTs ensures only human-backed agents can borrow, and on-chain reputation (defaults) prevents bad actors from accessing credit.

## Problem

Autonomous agents need working capital to operate — paying for inference, API calls, and services. Traditional DeFi lending requires collateral, which agents rarely have. Without access to credit, agents can't bootstrap or scale.

## Solution

A non-collateralized lending protocol where the collateral is **identity**. A human verifies their identity through Self.xyz, which mints a soulbound NFT (ERC-8004) on Celo. The human then delegates that identity to their agent's wallet. The agent can now request loans from the protocol — any lender (human or agent) can fund them. Defaults are recorded on-chain as a permanent reputation signal, making bad actors visible to all future lenders.

## How it works

1. **Verify** — Human verifies identity via Self.xyz (passport NFC scan, ZK proof for age/OFAC). An ERC-8004 soulbound NFT is minted on Celo.
2. **Delegate** — Human links their identity to the agent's wallet via the Self Agent Registry (`setAgentWallet`).
3. **Borrow** — Agent calls `createLoanRequest` on the lending contract. The contract checks the Self Registry to confirm human-backed identity.
4. **Fund** — Any lender (agent or human) can fund open loan requests. No identity check required to lend.
5. **Repay** — Borrower repays principal + interest before the deadline. If not, anyone can mark the loan as defaulted (on-chain reputation signal).
6. **Earn** — Agents sell services (image generation, inference) via the x402 payment protocol, earning USDC to repay loans and fund operations.

## Key properties

- Non-collateralized — identity is the trust anchor, not locked assets
- Identity-gated borrowing via Self.xyz ERC-8004 soulbound NFTs
- On-chain reputation — defaults are permanently recorded and visible to all lenders
- Agents with bad reputation (defaults) are visible on-chain, discouraging lending to them
- All loan state is queryable via view functions — no indexer or subgraph needed
- Agent-to-agent commerce via x402 payment protocol (USDC on Celo)

## Architecture

```
apps/
  web/          Next.js dashboard — deploy agents, verify identity, manage loans
  agent/        Agent runtime — deploys OpenClaw agents with lending and x402 skills
packages/
  contracts/    Solidity smart contracts (Foundry) — AgentMicrolending protocol
  x402-services/ x402 payment-gated API services (image generation, inference)
  shared/       Shared TypeScript types and utilities
```

## Integrated protocols

- [Self.xyz](https://self.xyz) — Human identity verification via ERC-8004 soulbound NFTs
- [x402](https://x402.org) — Per-request payment protocol (USDC on Celo) for agent services
- [OpenClaw](https://openclaw.ai) — Agent runtime and gateway
- [Privy](https://privy.io) — Wallet creation and management
- [Celo](https://celo.org) — L1 blockchain for all on-chain operations

## Getting started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io) 9+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for smart contracts)

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

## Monorepo structure

| Package | Description |
|---------|-------------|
| `apps/web` | Next.js dashboard for identity verification, agent deployment, and loan management |
| `apps/agent` | Agent runtime server that deploys OpenClaw agents with lending and x402 skills |
| `packages/contracts` | AgentMicrolending Solidity contracts with Self.xyz identity gate |
| `packages/x402-services` | x402 payment-gated API services (image generation, AI inference) |
| `packages/shared` | Shared TypeScript types and utilities |
