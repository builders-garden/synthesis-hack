---
name: micro-lending
description: >
  Interact with the AgentMicrolending contract on Celo using a permissionless
  smart account (ERC-4337). All loans are denominated in USDC (6 decimals).
  Create loan requests, discover and fund open loans, repay loans, check loan
  status, and mark defaults — all gasless via Pimlico. Use this skill whenever
  the user wants to borrow, lend, repay, discover loans, or check loan status
  on the microlending protocol.
version: 1.0.0
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

# Micro-Lending Skill

Interact with the AgentMicrolending smart contract on Celo for peer-to-peer
non-collateralized microlending between autonomous agents. All loans are
denominated in **USDC** (`0xcebA9300f2b948710d2653dD7B07f33A8B32118C`) on
Celo — a 6-decimal ERC-20 stablecoin.

Every on-chain transaction is submitted as an ERC-4337 UserOperation via a
permissionless Safe smart account with Pimlico as the paymaster — the agent
never pays gas directly. Signing is handled by a Privy server wallet (no
private key stored locally).

## Smart Account Setup

Before calling any contract function, create a gasless smart account client.
This uses a Privy managed server wallet as the signer, wraps it into a Safe
smart account, and routes all transactions through the Pimlico
bundler/paymaster on Celo.

```typescript
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const PIMLICO_URL = `https://api.pimlico.io/v2/celo/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

const pimlicoClient = createPimlicoClient({
  transport: http(PIMLICO_URL),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

// Create a Privy client and derive a viem-compatible signer
const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

const owner = await createViemAccount(privy, {
  walletId: process.env.AGENT_WALLET_ID!,
  address: process.env.AGENT_WALLET_ADDRESS! as `0x${string}`,
});

const safeAccount = await toSafeSmartAccount({
  client: publicClient,
  owners: [owner],
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
  version: "1.4.1",
});

const smartAccountClient = createSmartAccountClient({
  account: safeAccount,
  chain: celo,
  bundlerTransport: http(PIMLICO_URL),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () =>
      (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
});
```

The `smartAccountClient` is used for all write operations. The `publicClient`
is used for all read-only view calls. The smart account address
(`safeAccount.address`) is the agent's on-chain identity.

## Token Constants

```typescript
const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const;
const USDC_DECIMALS = 6;
const LENDING_CONTRACT = "0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff" as const;

// Helper: convert human-readable USDC amount to smallest unit
function parseUSDC(amount: string | number): bigint {
  return BigInt(Math.round(Number(amount) * 10 ** USDC_DECIMALS));
}
// parseUSDC("10")    => 10_000_000n   (10 USDC)
// parseUSDC("0.50")  => 500_000n      (0.50 USDC)
```

## Contract ABI

Use this ABI for all interactions with the AgentMicrolending contract:

```typescript
const LENDING_ABI = [
  {
    name: "createLoanRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "repayAmount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "lender", type: "address" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    name: "cancelLoanRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "fundLoan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "repayLoan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimDefaulted",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "token",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getLoan",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "borrower", type: "address" },
          { name: "lender", type: "address" },
          { name: "actualLender", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "repayAmount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "totalLoans",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getBorrowerLoans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getLenderLoans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "lender", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getLenderActiveLoanIds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "lender", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getOpenLoans",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "borrower", type: "address" },
          { name: "lender", type: "address" },
          { name: "actualLender", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "repayAmount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getBorrowerOpenLoans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "borrower", type: "address" },
          { name: "lender", type: "address" },
          { name: "actualLender", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "repayAmount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Loan Status Codes

The `status` field in a LoanRequest is a uint8 enum:

| Value | Status    | Meaning                                   |
| ----- | --------- | ----------------------------------------- |
| 0     | Open      | Waiting for a lender to fund              |
| 1     | Funded    | Lender sent USDC, borrower received funds |
| 2     | Repaid    | Borrower repaid principal + interest      |
| 3     | Defaulted | Deadline passed without repayment         |
| 4     | Cancelled | Borrower cancelled before funding         |

## ERC-20 Approval

The contract uses `transferFrom` to move USDC. Before calling `fundLoan` or
`repayLoan`, the caller must approve the lending contract to spend their USDC.
A single max-approval is sufficient for all future operations:

```typescript
import { encodeFunctionData } from "viem";

// Approve the lending contract to spend USDC (one-time or per-operation)
const approveData = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "approve",
  args: [
    LENDING_CONTRACT,
    BigInt(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    ),
  ],
});

const txHash = await smartAccountClient.sendTransaction({
  to: USDC_ADDRESS,
  data: approveData,
});
```

You can check the current allowance before approving:

```typescript
const allowance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "allowance",
  args: [safeAccount.address, LENDING_CONTRACT],
});

// If allowance is sufficient, skip the approve step
```

## Operations

### 1. Create a Loan Request (Borrower)

Publish a request to borrow USDC. Specify the amount, repay amount (must be

> = amount), a deadline (unix timestamp), and optionally a specific lender
> (`0x0000000000000000000000000000000000000000` for open to anyone).

No approval is needed to create a request — it only records data on-chain.

```typescript
import { encodeFunctionData } from "viem";

const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "createLoanRequest",
  args: [
    parseUSDC("10"), // borrow 10 USDC
    parseUSDC("11"), // repay 11 USDC (10% interest)
    BigInt(Math.floor(Date.now() / 1000) + 7 * 86400), // deadline: 7 days from now
    "0x0000000000000000000000000000000000000000", // open to any lender
  ],
});

const txHash = await smartAccountClient.sendTransaction({
  to: LENDING_CONTRACT,
  data,
});
```

### 2. Cancel a Loan Request (Borrower)

Cancel an open (unfunded) loan request. Only the original borrower can cancel.

```typescript
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "cancelLoanRequest",
  args: [loanId],
});

const txHash = await smartAccountClient.sendTransaction({
  to: LENDING_CONTRACT,
  data,
});
```

### 3. Fund a Loan (Lender)

Fund an open loan request. The contract pulls `loan.amount` USDC from the
lender and sends it to the borrower via `transferFrom`.

**The lender must have approved the lending contract to spend at least
`loan.amount` USDC before calling this function.**

Before funding, verify the borrower is human-backed (see Identity Verification
section below).

```typescript
// 1. Read the loan to get the amount
const loan = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLoan",
  args: [loanId],
});

// 2. Ensure USDC approval (skip if already approved)
const allowance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "allowance",
  args: [safeAccount.address, LENDING_CONTRACT],
});

if (allowance < loan.amount) {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_CONTRACT, loan.amount],
  });
  await smartAccountClient.sendTransaction({
    to: USDC_ADDRESS,
    data: approveData,
  });
}

// 3. Fund the loan (no value — USDC is pulled via transferFrom)
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "fundLoan",
  args: [loanId],
});

const txHash = await smartAccountClient.sendTransaction({
  to: LENDING_CONTRACT,
  data,
});
```

### 4. Repay a Loan (Borrower)

Repay a funded loan. The contract pulls `loan.repayAmount` USDC from the
borrower and sends it to the lender via `transferFrom`.

**The borrower must have approved the lending contract to spend at least
`loan.repayAmount` USDC before calling this function.**

Must be called before the deadline.

```typescript
const loan = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLoan",
  args: [loanId],
});

// Ensure USDC approval
const allowance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "allowance",
  args: [safeAccount.address, LENDING_CONTRACT],
});

if (allowance < loan.repayAmount) {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_CONTRACT, loan.repayAmount],
  });
  await smartAccountClient.sendTransaction({
    to: USDC_ADDRESS,
    data: approveData,
  });
}

// Repay (no value — USDC is pulled via transferFrom)
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "repayLoan",
  args: [loanId],
});

const txHash = await smartAccountClient.sendTransaction({
  to: LENDING_CONTRACT,
  data,
});
```

### 5. Mark a Loan as Defaulted (Anyone)

After the repayment deadline has passed without repayment, anyone can mark
the loan as defaulted. This is a reputation signal — since loans are
non-collateralized, there is no collateral to seize.

```typescript
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "claimDefaulted",
  args: [loanId],
});

const txHash = await smartAccountClient.sendTransaction({
  to: LENDING_CONTRACT,
  data,
});
```

## Discovery & Status Queries

All read operations use `publicClient.readContract` — they are free and
require no gas.

### Check USDC Balance

```typescript
const balance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [safeAccount.address],
});
// balance is in 6-decimal units: 10_000_000n = 10 USDC
```

### Discover Open Loan Requests

Paginated list of all open (unfunded) loan requests:

```typescript
const openLoans = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getOpenLoans",
  args: [0n, 20n], // offset, limit
});
```

### Get a Single Loan by ID

```typescript
const loan = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLoan",
  args: [loanId],
});

// loan.status: 0=Open, 1=Funded, 2=Repaid, 3=Defaulted, 4=Cancelled
// loan.borrower: address of the borrower
// loan.actualLender: address of who funded it (0x0 if not funded)
// loan.amount: USDC to borrow (6-decimal units, e.g. 10_000_000n = 10 USDC)
// loan.repayAmount: USDC owed (6-decimal units)
// loan.deadline: unix timestamp
// loan.fundedAt: unix timestamp (0 if not funded)
```

### Get Total Number of Loans

```typescript
const total = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "totalLoans",
});
```

### Get All Loan IDs for a Borrower

```typescript
const loanIds = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getBorrowerLoans",
  args: [borrowerAddress],
});
```

### Get Open Loans for a Specific Borrower

```typescript
const openLoans = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getBorrowerOpenLoans",
  args: [borrowerAddress],
});
```

### Get All Loan IDs Funded by a Lender

```typescript
const loanIds = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLenderLoans",
  args: [lenderAddress],
});
```

### Get Active (Funded, Not Yet Repaid/Defaulted) Loans for a Lender

```typescript
const activeLoanIds = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLenderActiveLoanIds",
  args: [lenderAddress],
});
```

## Identity Verification

Before funding a loan, verify the borrower is human-backed by checking that
their associated human wallet holds the 8004 soulbound NFT from Self.xyz.
This prevents funding loans from unverified or purely bot-controlled addresses.

```typescript
const SELF_SBT = "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944";

const balance = await publicClient.readContract({
  address: SELF_SBT,
  abi: [
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ],
  functionName: "balanceOf",
  args: [humanWalletAddress],
});

const isHumanBacked = balance > 0n;
```

Do not fund a loan if `isHumanBacked` is false.

## Loan Lifecycle

```
Borrower                          Lender
   |                                |
   |-- createLoanRequest() -------->|  (status: Open)
   |                                |
   |                     getOpenLoans() / discover
   |                     verify 8004 SBT
   |                     approve USDC to lending contract
   |                                |
   |<-------- fundLoan() ---------- |  (status: Funded, USDC sent to borrower)
   |                                |
   |  approve USDC to contract      |
   |-- repayLoan() ---------------->|  (status: Repaid, USDC sent to lender)
   |                                |
   |  -- OR if deadline passes --   |
   |                                |
   |         claimDefaulted() ----->|  (status: Defaulted)
```

## Using the Helper Module

The agent codebase provides a helper module at `src/smart-account.ts` that
wraps the smart account setup. You can use it directly instead of setting up
the client manually:

```typescript
import { createGaslessClient, sendGaslessContractCall } from "../smart-account";
import { encodeFunctionData } from "viem";

const WALLET_ID = process.env.AGENT_WALLET_ID!;
const WALLET_ADDR = process.env.AGENT_WALLET_ADDRESS!;
const LENDING_CONTRACT = "0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff" as const;

// Approve USDC first
const approveData = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "approve",
  args: [LENDING_CONTRACT, parseUSDC("100")],
});
await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  USDC_ADDRESS,
  approveData,
);

// Create a loan request (no approval needed)
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "createLoanRequest",
  args: [parseUSDC("10"), parseUSDC("11"), BigInt(deadline), lenderAddress],
});
const txHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  data,
);

// Fund a loan (approval must be done first)
const fundData = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "fundLoan",
  args: [loanId],
});
const txHash2 = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  fundData,
);

// Read operation: use publicClient directly (no gas needed)
const { address } = await createGaslessClient(WALLET_ID, WALLET_ADDR);
// address is the agent's smart account address on-chain
```

## Rules

- All amounts are in USDC smallest units (6 decimals). Use `parseUSDC("10")` for 10 USDC.
- USDC address on Celo: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`.
- The `repayAmount` must be >= `amount` (enforced by the contract).
- The `deadline` must be a future unix timestamp (enforced by the contract).
- Before `fundLoan`: the lender must `approve` the lending contract to spend `loan.amount` USDC.
- Before `repayLoan`: the borrower must `approve` the lending contract to spend `loan.repayAmount` USDC.
- Repayment must happen before the deadline.
- Only the original borrower can cancel or repay their loan.
- Anyone can call `claimDefaulted` after the deadline passes.
- Always verify 8004 SBT before funding a loan.
- Contract address on Celo: `0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff`.
