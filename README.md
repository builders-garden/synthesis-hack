# Yield Agent — Self-Funded Autonomous AI

An autonomous AI agent that funds its own operations entirely from stETH yield — no human tops up, no principal at risk.

## Problem

Today, running an AI agent costs money and requires constant human intervention to fund wallets, manage budgets, and approve payments. Agents can't be truly autonomous if someone has to keep feeding them.

## Solution

A user stakes ETH into a treasury contract backed by wstETH. The contract enforces a hard separation: the principal is structurally locked, and only accrued yield flows into the agent's spendable balance. The agent uses that yield to pay for its own inference, API calls, and services — fully autonomously.

## How it works

1. **Fund** — User deposits wstETH into the Agent Treasury contract. Configures spending permissions (recipient whitelist, per-tx cap, time windows).
2. **Think** — Agent reasons privately via Venice's no-data-retention inference API. Sensitive treasury decisions never leave the private compute layer.
3. **Pay** — Agent converts yield to USDC and pays for services through Locus wallets on Base — auditable, capped, autonomous.
4. **Dashboard** — Web UI to deploy agents, stake ETH, monitor yield accrual, track spending, and adjust permissions.

## Key properties

- Principal is never accessible to the agent — enforced at the contract level
- Agent spending is bounded by yield + configurable permissions
- Private reasoning via Venice — the agent's strategy stays confidential
- All payments flow through Locus — auditable, on-chain, USDC on Base

## Integrated providers

- [Lido](https://lido.fi) — wstETH staking and yield generation
- [Venice](https://venice.ai) — Private, no-data-retention AI inference
- [Locus](https://locus.finance) — Agent-native payment infrastructure on Base
