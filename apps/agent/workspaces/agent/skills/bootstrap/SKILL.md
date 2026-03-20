---
name: bootstrap
description: >
  On first run, verify wallet funding and USDC balance, confirm lending
  contract access, and configure the agent for autonomous lending on Celo.
  All transactions are gasless via Pimlico paymaster.
version: 4.0.0
requires:
  env:
    [
      "PRIVY_APP_ID",
      "PRIVY_APP_SECRET",
      "AGENT_WALLET_ID",
      "AGENT_WALLET_ADDRESS",
      "CELO_RPC_URL",
      "PIMLICO_API_KEY",
    ]
---

# Bootstrap

Run this on first activation to set up autonomous operation on Celo.

## Step 1 — Verify Wallet Funding

Check that the agent wallet has received USDC from the human owner:

```typescript
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const;
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const client = createPublicClient({ chain: celo, transport: http() });
const balance = await client.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [agentWalletAddress],
});
// balance is in 6-decimal units: 10_000_000n = 10 USDC
```

If balance is zero, stop and report that the agent needs USDC funding.

## Step 2 — Verify Lending Contract Access

Confirm the AgentMicrolending contract is accessible:

```typescript
const LENDING_CONTRACT = "0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff" as const;

const totalLoans = await client.readContract({
  address: LENDING_CONTRACT,
  abi: [
    {
      name: "totalLoans",
      type: "function",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
    },
  ],
  functionName: "totalLoans",
});
console.log("Total loans on contract:", totalLoans);
```

## Step 3 — Report Ready

Log bootstrap completion with:

- USDC balance (operational funds)
- Lending contract status
- Agent smart account address

## After Bootstrap

The agent should:

- Scan the AgentMicrolending contract for open loan requests
- Verify borrower human-backed status (8004 SBT) before filling loans
- Publish loan requests when needing capital
- Repay loans within agreed deadlines
- Monitor for defaulted loans and mark them
