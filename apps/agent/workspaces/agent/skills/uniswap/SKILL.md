---
name: uniswap
description: >
  Swap tokens on Celo via Uniswap. Used during bootstrap to convert CELO to USDC,
  and for ongoing treasury management. All swaps are gasless via Pimlico paymaster.
version: 1.0.0
requires:
  env: ["AGENT_PRIVATE_KEY", "CELO_RPC_URL", "PIMLICO_API_KEY"]
---

# Uniswap Skill

Swap tokens on Celo using the Uniswap V3 Router. Primary use case: bootstrap
liquidity by swapping CELO to USDC, retaining a small CELO reserve for gas.

**All swap transactions are gasless** — submitted as ERC-4337 UserOperations
via the Pimlico paymaster on Celo.

## Contract Addresses (Celo)

- **Uniswap V3 SwapRouter**: `0x5615CDAb10dc425a742d643d949a7F474C01abc4`
- **USDC (Celo)**: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- **Wrapped CELO (WCELO)**: `0x471EcE3750Da237f93B8E339c536989b8978a438`

## Bootstrap Swap: CELO → USDC

On first activation, swap most CELO to USDC while retaining $0.10 worth of CELO
for gas fees.

```typescript
import { createWalletClient, http, parseEther, encodeFunctionData } from "viem";
import { celo } from "viem/chains";

const SWAP_ROUTER = "0x5615CDAb10dc425a742d643d949a7F474C01abc4";
const WCELO = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

// exactInputSingle ABI
const swapAbi = [{
  name: "exactInputSingle",
  type: "function",
  inputs: [{
    name: "params",
    type: "tuple",
    components: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMinimum", type: "uint256" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ],
  }],
  outputs: [{ name: "amountOut", type: "uint256" }],
}];

// Swap CELO → USDC (use WCELO as tokenIn, send native CELO as value)
const amountIn = celoBalance - gasReserve; // Keep $0.10 CELO for gas
const params = {
  tokenIn: WCELO,
  tokenOut: USDC,
  fee: 3000, // 0.3% pool
  recipient: agentWalletAddress,
  deadline: Math.floor(Date.now() / 1000) + 600,
  amountIn,
  amountOutMinimum: 0, // Use quoter for production
  sqrtPriceLimitX96: 0n,
};
```

## Treasury Management

When the agent needs USDC (e.g., to pay for x402 services), swap CELO → USDC.
When the agent receives USDC (e.g., from selling services), it can hold USDC or
swap back to CELO for lending operations.

## Gasless Swaps (Pimlico)

All swap calls go through a Safe smart account with Pimlico as the ERC-4337
paymaster. The agent never pays gas.

```typescript
import { sendGaslessContractCall } from "../smart-account";
import { encodeFunctionData, type Hex } from "viem";

const SWAP_ROUTER = "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as `0x${string}`;
const AGENT_KEY = process.env.AGENT_PRIVATE_KEY as Hex;

const data = encodeFunctionData({
  abi: swapRouterAbi,
  functionName: "exactInputSingle",
  args: [swapParams],
});

// Gasless swap — Pimlico pays gas
const txHash = await sendGaslessContractCall(
  AGENT_KEY, SWAP_ROUTER, data, celoAmountToSwap
);
```

## Rules

- Always retain at least $0.10 CELO for gas fees (even though gas is sponsored,
  keep a reserve as fallback)
- Check balance before any swap
- Use the Uniswap quoter to estimate output before swapping
- Log all swaps for audit trail
