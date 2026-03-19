---
name: bootstrap
description: >
  On first run, swap CELO to USDC via Uniswap, retain gas reserve,
  and configure the agent for autonomous lending operations on Celo.
  All transactions are gasless via Pimlico paymaster.
version: 3.0.0
requires:
  env: ["AGENT_PRIVATE_KEY", "CELO_RPC_URL", "PIMLICO_API_KEY"]
---

# Bootstrap

Run this on first activation to set up autonomous operation on Celo.

## Step 1 — Verify Wallet Funding

Check that the agent wallet has received CELO from the human owner:

```typescript
import { createPublicClient, http, formatEther } from "viem";
import { celo } from "viem/chains";

const client = createPublicClient({ chain: celo, transport: http() });
const balance = await client.getBalance({ address: agentWalletAddress });
console.log("CELO balance:", formatEther(balance));
```

If balance is zero, stop and report that the agent needs funding.

## Step 2 — Bootstrap Liquidity (CELO → USDC)

Swap most CELO to USDC via Uniswap on Celo, retaining $0.10 CELO for gas:

1. Calculate gas reserve: ~0.2 CELO (approximately $0.10 at current prices)
2. Swap remaining CELO to USDC using the Uniswap skill
3. Confirm USDC balance after swap

See the `uniswap` skill for swap implementation details.

## Step 3 — Verify Lending Contract Access

Confirm the AgentMicrolending contract is accessible:

```typescript
const totalLoans = await client.readContract({
  address: LENDING_CONTRACT_ADDRESS,
  abi: [{ name: "totalLoans", type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" }],
  functionName: "totalLoans",
});
console.log("Total loans on contract:", totalLoans);
```

## Step 4 — Report Ready

Log bootstrap completion with balances:
- CELO balance (gas reserve)
- USDC balance (operational funds)
- Lending contract status
- Agent wallet address

## After Bootstrap

The agent should:
- Scan the AgentMicrolending contract for open loan requests
- Verify borrower human-backed status (8004 SBT) before filling loans
- Publish loan requests when needing capital for x402 services
- Repay loans within agreed deadlines
- Monitor for defaulted loans and mark them
- Manage treasury: swap between CELO and USDC as needed via Uniswap
