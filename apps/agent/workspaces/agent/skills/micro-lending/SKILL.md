---
name: micro-lending
description: >
  Interact with the AgentMicrolending contract on Celo using EIP-7702 gasless
  smart accounts. All loans are denominated in USDC (6 decimals).
  Create loan requests, discover and fund open loans, repay loans, check loan
  status, and mark defaults — all gasless via Candide. Use this skill whenever
  the user wants to borrow, lend, repay, discover loans, or check loan status
  on the microlending protocol.
version: 2.0.0
requires:
  env:
    [
      "PRIVY_APP_ID",
      "PRIVY_APP_SECRET",
      "AGENT_WALLET_ID",
      "AGENT_WALLET_ADDRESS",
      "CELO_RPC_URL",
      "CANDIDE_API_KEY",
      "CANDIDE_SPONSORSHIP_POLICY_ID",
    ]
---

# Micro-Lending Skill

Interact with the AgentMicrolending smart contract on Celo for peer-to-peer
non-collateralized microlending between autonomous agents. All loans are
denominated in **USDC** (`0xcebA9300f2b948710d2653dD7B07f33A8B32118C`) on
Celo — a 6-decimal ERC-20 stablecoin.

Every on-chain transaction is submitted as an ERC-4337 UserOperation via
**EIP-7702** with **Candide** as the bundler and paymaster — the agent never
pays gas directly. Signing is handled by a **Privy server wallet** (no
private key stored locally).

With EIP-7702, the **Privy EOA address IS the smart account address** — no
separate contract deployment is needed (unlike the old Safe approach).

## How Transactions Work (EIP-7702 + Candide)

The agent sends gasless transactions through this flow:

1. **Privy server wallet** (EOA) signs an EIP-7702 authorization delegating
   its code to a SimpleAccount implementation on Celo
2. The call is wrapped in `SimpleAccount.execute(to, value, data)` and packed
   into an ERC-4337 UserOperation
3. **Candide** sponsors the gas (via `pm_sponsorUserOperation`) and fills in
   paymaster fields
4. The UserOp hash is signed with raw secp256k1 via Privy (no EIP-191 prefix)
5. The UserOp is submitted to Candide's bundler (`eth_sendUserOperation`)
6. Candide bundles it and submits to the EntryPoint v0.8 on Celo — gasless

The agent's on-chain address is `process.env.AGENT_WALLET_ADDRESS` (the
Privy EOA itself).

## Sending Transactions

The helper module at `src/smart-account.ts` exposes two functions for all
write operations. Use `publicClient` for reads.

```typescript
import { sendGaslessContractCall } from "../smart-account";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { celo } from "viem/chains";

const WALLET_ID = process.env.AGENT_WALLET_ID!;
const WALLET_ADDR = process.env.AGENT_WALLET_ADDRESS!;

// For read-only calls (free, no gas)
const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org"),
});

// For write calls: encode calldata, then use sendGaslessContractCall
const data = encodeFunctionData({
  abi: SOME_ABI,
  functionName: "someFunction",
  args: [arg1, arg2],
});

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  contractAddress,  // target contract
  data,             // encoded calldata
);
// userOpHash is returned immediately; the bundler executes it async
```

`sendGaslessContractCall` handles the entire 7702 flow internally:
authorization signing, UserOp construction, Candide sponsorship, signing,
and submission. You just provide the target address and encoded calldata.

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
      { name: "agentId", type: "uint256" },
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
import { sendGaslessContractCall } from "../smart-account";

const WALLET_ID = process.env.AGENT_WALLET_ID!;
const WALLET_ADDR = process.env.AGENT_WALLET_ADDRESS!;

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

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  USDC_ADDRESS,
  approveData,
);
```

You can check the current allowance before approving:

```typescript
const allowance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "allowance",
  args: [WALLET_ADDR as `0x${string}`, LENDING_CONTRACT],
});

// If allowance is sufficient, skip the approve step
```

## Operations

### 1. Create a Loan Request (Borrower)

Publish a request to borrow USDC. Specify the amount, repay amount (must be
>= amount), a deadline (unix timestamp), optionally a specific lender
(`0x0000000000000000000000000000000000000000` for open to anyone), and the
agent's Self protocol `agentId` (required for identity verification).

No approval is needed to create a request — it only records data on-chain.
The contract verifies via Self protocol that `msg.sender` is the registered
wallet for the given `agentId` and that the agent has a valid human proof.

```typescript
import { encodeFunctionData } from "viem";
import { sendGaslessContractCall } from "../smart-account";

const AGENT_ID = BigInt(process.env.SELF_AGENT_ID || "0");

const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "createLoanRequest",
  args: [
    parseUSDC("10"), // borrow 10 USDC
    parseUSDC("11"), // repay 11 USDC (10% interest)
    BigInt(Math.floor(Date.now() / 1000) + 7 * 86400), // deadline: 7 days from now
    "0x0000000000000000000000000000000000000000", // open to any lender
    AGENT_ID, // Self protocol agent ID (linked to this wallet by a human)
  ],
});

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  data,
);
```

### 2. Cancel a Loan Request (Borrower)

Cancel an open (unfunded) loan request. Only the original borrower can cancel.

```typescript
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "cancelLoanRequest",
  args: [loanId],
});

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  data,
);
```

### 3. Fund a Loan (Lender)

Fund an open loan request. The contract pulls `loan.amount` USDC from the
lender and sends it to the borrower via `transferFrom`.

**The lender must have approved the lending contract to spend at least
`loan.amount` USDC before calling this function.**

Before funding, the agent MUST **check the borrower's reputation** on the
Self Reputation Registry. (Human-backed identity is already enforced by the
smart contract — no need to verify it separately.)

#### Pre-Funding Reputation Check

Before committing USDC, query the borrower's on-chain lending history. This
uses the Reputation Registry (`0x69Da18CF4Ac27121FD99cEB06e38c3DC78F363f4`)
to get both an aggregate score and individual feedback entries.

```typescript
import { keccak256, toBytes, parseAbiItem } from "viem";

const REPUTATION_REGISTRY = "0x69Da18CF4Ac27121FD99cEB06e38c3DC78F363f4" as const;

// Step 1: Get the aggregate reputation summary
const [count, sum, decimals] = await publicClient.readContract({
  address: REPUTATION_REGISTRY,
  abi: REPUTATION_ABI,
  functionName: "getSummary",
  args: [
    borrowerAgentId,                                 // the Self Agent ID of the borrower
    [],                                              // empty = include all reviewers
    keccak256(toBytes("microlending")),               // filter: microlending category only
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
  ],
});

// Step 2: Read individual feedback events from the Reputation Registry
// giveFeedback emits events — read them to see the detailed history
const feedbackLogs = await publicClient.getLogs({
  address: REPUTATION_REGISTRY,
  event: parseAbiItem(
    "event FeedbackGiven(uint256 indexed agentId, address indexed client, int256 value, bytes32 tag1, bytes32 tag2, string uri)"
  ),
  args: {
    agentId: borrowerAgentId,
  },
  fromBlock: BigInt(0),
  toBlock: "latest",
});

// Step 3: Fetch the detailed feedback JSON from Arweave for each entry
// Each log has a `uri` field pointing to the Arweave feedback JSON
for (const log of feedbackLogs) {
  const { value, uri } = log.args;
  // uri is e.g. "https://arweave.net/abc123" or "https://gateway.irys.xyz/abc123"
  const res = await fetch(uri);
  const feedbackDetail = await res.json();

  // feedbackDetail contains:
  // {
  //   type: "loan-feedback",
  //   loanId: 42,
  //   outcome: "repaid" | "defaulted",
  //   comment: "Loan #42: Borrower repaid 11 USDC on time...",
  //   amount: "10000000",
  //   ...
  // }
}
```

#### How to Evaluate Reputation

Use this decision framework before funding:

| Scenario | Action |
|----------|--------|
| `count == 0` (no history) | New borrower — higher risk. Fund only small amounts. |
| `sum > 0` and `count >= 3` | Positive track record — reasonable to fund. |
| `sum < 0` | Net negative reputation — **do NOT fund**. |
| `sum > 0` but recent feedback is negative | Check individual entries. A recent default outweighs older positive history. |

Always read the individual feedback URIs (from Arweave) when making a decision.
The aggregate score gives a quick signal, but the detailed feedback comments
reveal context: was a default due to genuine issues (e.g. network congestion)
or a pattern of non-repayment?

**The agent should weigh:**
- **Recency**: Recent feedback matters more than old feedback.
- **Amount**: A default on a 100 USDC loan is a stronger signal than on 1 USDC.
- **Responses**: Check if the borrower responded to negative feedback with
  a valid explanation (see `appendResponse` in the Reputation section below).
- **Count**: More feedback entries = more reliable signal.

#### Full Fund Flow with Reputation Check

```typescript
// 1. Read the loan to get the borrower and amount
const loan = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLoan",
  args: [loanId],
});

// 2. Check borrower reputation
const [count, sum] = await publicClient.readContract({
  address: REPUTATION_REGISTRY,
  abi: REPUTATION_ABI,
  functionName: "getSummary",
  args: [
    borrowerAgentId,
    [],
    keccak256(toBytes("microlending")),
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
  ],
});

// Refuse to fund if negative reputation
if (sum < BigInt(0)) {
  // Do not fund — borrower has negative lending history
  return;
}

// For new borrowers (no history), consider limiting exposure
if (count === BigInt(0) && loan.amount > parseUSDC("10")) {
  // New borrower requesting large amount — higher risk
  // Consider funding only if amount is small
}

// 3. Optionally read individual feedback for deeper analysis
const feedbackLogs = await publicClient.getLogs({
  address: REPUTATION_REGISTRY,
  event: parseAbiItem(
    "event FeedbackGiven(uint256 indexed agentId, address indexed client, int256 value, bytes32 tag1, bytes32 tag2, string uri)"
  ),
  args: { agentId: borrowerAgentId },
  fromBlock: BigInt(0),
  toBlock: "latest",
});

// Read the Arweave URIs from recent feedback to check details
for (const log of feedbackLogs.slice(-5)) { // last 5 entries
  const res = await fetch(log.args.uri!);
  const detail = await res.json();
  // Analyze: detail.outcome, detail.comment, detail.amount, detail.timestamp
}

// 4. Ensure USDC approval (skip if already approved)
const allowance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "allowance",
  args: [WALLET_ADDR as `0x${string}`, LENDING_CONTRACT],
});

if (allowance < loan.amount) {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_CONTRACT, loan.amount],
  });
  await sendGaslessContractCall(
    WALLET_ID,
    WALLET_ADDR,
    USDC_ADDRESS,
    approveData,
  );
}

// 5. Fund the loan (no value — USDC is pulled via transferFrom)
const fundData = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "fundLoan",
  args: [loanId],
});

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  fundData,
);
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
  args: [WALLET_ADDR as `0x${string}`, LENDING_CONTRACT],
});

if (allowance < loan.repayAmount) {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_CONTRACT, loan.repayAmount],
  });
  await sendGaslessContractCall(
    WALLET_ID,
    WALLET_ADDR,
    USDC_ADDRESS,
    approveData,
  );
}

// Repay (no value — USDC is pulled via transferFrom)
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "repayLoan",
  args: [loanId],
});

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  data,
);
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

const userOpHash = await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  data,
);
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
  args: [WALLET_ADDR as `0x${string}`],
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


## Loan Lifecycle
```
Borrower                          Lender
   |                                |
   |-- createLoanRequest() -------->|  (status: Open)
   |                                |
   |                     getOpenLoans() / discover
   |                     check borrower reputation
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

## Quick Reference

```typescript
import { sendGaslessContractCall } from "../smart-account";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { celo } from "viem/chains";

const WALLET_ID = process.env.AGENT_WALLET_ID!;
const WALLET_ADDR = process.env.AGENT_WALLET_ADDRESS!;
const LENDING_CONTRACT = "0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff" as const;
const AGENT_ID = BigInt(process.env.SELF_AGENT_ID || "0");

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org"),
});

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

// Create a loan request (no approval needed, but agentId required)
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "createLoanRequest",
  args: [parseUSDC("10"), parseUSDC("11"), BigInt(deadline), lenderAddress, AGENT_ID],
});
await sendGaslessContractCall(
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
await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  LENDING_CONTRACT,
  fundData,
);

// Read operations: use publicClient directly (free, no gas)
const loan = await publicClient.readContract({
  address: LENDING_CONTRACT,
  abi: LENDING_ABI,
  functionName: "getLoan",
  args: [loanId],
});
// WALLET_ADDR is the agent's on-chain address (Privy EOA = smart account via 7702)
```

## Reputation Feedback (ERC-8004 Reputation Registry)

After a loan reaches a terminal state (Repaid or Defaulted), agents SHOULD leave
on-chain reputation feedback on the Self Reputation Registry. This builds a
trustworthy lending history that other agents can query before funding loans.

### Contract

```typescript
const REPUTATION_REGISTRY = "0x69Da18CF4Ac27121FD99cEB06e38c3DC78F363f4" as const; // Celo mainnet

const REPUTATION_ABI = [
  {
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int256" },
      { name: "decimals", type: "uint8" },
      { name: "tag1", type: "bytes32" },
      { name: "tag2", type: "bytes32" },
      { name: "endpoint", type: "string" },
      { name: "uri", type: "string" },
      { name: "hash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "appendResponse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint256" },
      { name: "uri", type: "string" },
      { name: "hash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clients", type: "address[]" },
      { name: "tag1", type: "bytes32" },
      { name: "tag2", type: "bytes32" },
    ],
    outputs: [
      { name: "count", type: "uint256" },
      { name: "sum", type: "int256" },
      { name: "decimals", type: "uint8" },
    ],
  },
] as const;
```

### Feedback Parameters

| Parameter | Description |
|-----------|-------------|
| `agentId` | The Self Agent ID of the agent being reviewed |
| `value` | Score: positive = good, negative = bad (e.g. `100` for repaid, `-100` for defaulted) |
| `decimals` | Decimal precision of the value (use `0` for whole numbers) |
| `tag1` | Category tag — use `keccak256("microlending")` for loan feedback |
| `tag2` | Sub-category — use `keccak256("repayment")` or `keccak256("default")` |
| `endpoint` | The lending contract address |
| `uri` | Arweave URI with detailed feedback JSON (uploaded via Irys) |
| `hash` | `keccak256` of the feedback JSON for integrity verification |

### Uploading Feedback to Arweave (via Irys)

Feedback details are stored permanently on Arweave using `@irys/arweave`.
Uploads under 100 KiB are free — no tokens needed, just a generated wallet for signing.

```typescript
import Arweave from "@irys/arweave";

const arweave = new Arweave({ url: "https://arweave.net" });

async function uploadFeedbackToArweave(feedback: Record<string, unknown>): Promise<string> {
  // Generate a throwaway wallet for signing (free uploads < 100KiB don't need funds)
  const key = await arweave.wallets.generate();
  const data = JSON.stringify(feedback);

  const tx = await arweave.createTransaction({ data }, key);
  tx.addTag("Content-Type", "application/json");
  tx.addTag("App-Name", "OpenClaw-Lending");
  tx.addTag("Feedback-Type", "loan-reputation");

  await arweave.transactions.sign(tx, key);
  await arweave.transactions.post(tx);

  return `https://arweave.net/${tx.id}`;
}
```

### When to Leave Feedback

- **After repayment**: The lender should leave positive feedback on the borrower.
- **After default**: The lender should leave negative feedback on the borrower
  after calling `claimDefaulted`. If the deadline has passed and the loan is
  funded but not repaid, call `claimDefaulted` first, then leave feedback.
- **Timing**: Leave feedback immediately after the loan status changes to
  Repaid (status 2) or Defaulted (status 3).

### Feedback JSON Schema

The feedback JSON uploaded to Arweave should follow this structure:

```json
{
  "type": "loan-feedback",
  "loanId": 42,
  "loanContract": "0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff",
  "chain": "celo",
  "chainId": 42220,
  "borrower": "0xBorrowerAddress",
  "lender": "0xLenderAddress",
  "amount": "10000000",
  "repayAmount": "11000000",
  "deadline": 1720000000,
  "outcome": "repaid",
  "comment": "Loan #42: Borrower repaid 11 USDC on time (3 days before deadline). Reliable counterparty.",
  "timestamp": 1719800000
}
```

### Example: Lender Leaves Positive Feedback After Repayment

```typescript
import { encodeFunctionData, keccak256, toBytes, toHex, encodeAbiParameters } from "viem";
import { sendGaslessContractCall } from "../smart-account";

const WALLET_ID = process.env.AGENT_WALLET_ID!;
const WALLET_ADDR = process.env.AGENT_WALLET_ADDRESS!;

// 1. Build the feedback JSON
const feedback = {
  type: "loan-feedback",
  loanId: 42,
  loanContract: LENDING_CONTRACT,
  chain: "celo",
  chainId: 42220,
  borrower: "0xBorrowerAddress",
  lender: WALLET_ADDR,
  amount: "10000000",    // 10 USDC
  repayAmount: "11000000", // 11 USDC
  deadline: 1720000000,
  outcome: "repaid",
  comment: "Loan #42: Borrower repaid 11 USDC on time (3 days before deadline). Reliable counterparty.",
  timestamp: Math.floor(Date.now() / 1000),
};

// 2. Upload to Arweave via Irys (free < 100KiB)
const feedbackJson = JSON.stringify(feedback);
const arweaveUri = await uploadFeedbackToArweave(feedback);
const feedbackHash = keccak256(toBytes(feedbackJson));

// 3. Submit on-chain feedback to the Reputation Registry
const borrowerAgentId = BigInt(7); // the Self Agent ID of the borrower

const data = encodeFunctionData({
  abi: REPUTATION_ABI,
  functionName: "giveFeedback",
  args: [
    borrowerAgentId,                                // agentId of the agent being reviewed
    BigInt(100),                                    // positive score for good repayment
    0,                                              // decimals
    keccak256(toBytes("microlending")),              // tag1: category
    keccak256(toBytes("repayment")),                 // tag2: sub-category
    LENDING_CONTRACT,                                // endpoint: the lending contract
    arweaveUri,                                      // uri: Arweave link to feedback details
    feedbackHash,                                    // hash: keccak256 of the feedback JSON
  ],
});

await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  REPUTATION_REGISTRY,
  data,
);
```

### Example: Lender Leaves Negative Feedback After Default

```typescript
const feedback = {
  type: "loan-feedback",
  loanId: 55,
  loanContract: LENDING_CONTRACT,
  chain: "celo",
  chainId: 42220,
  borrower: "0xBorrowerAddress",
  lender: WALLET_ADDR,
  amount: "5000000",     // 5 USDC
  repayAmount: "5500000",  // 5.5 USDC
  deadline: 1719500000,
  outcome: "defaulted",
  comment: "Loan #55: Borrower failed to repay 5.5 USDC. Deadline passed 4 days ago. Marked as defaulted.",
  timestamp: Math.floor(Date.now() / 1000),
};

const feedbackJson = JSON.stringify(feedback);
const arweaveUri = await uploadFeedbackToArweave(feedback);
const feedbackHash = keccak256(toBytes(feedbackJson));

const data = encodeFunctionData({
  abi: REPUTATION_ABI,
  functionName: "giveFeedback",
  args: [
    borrowerAgentId,
    BigInt(-100),                                   // negative score for default
    0,
    keccak256(toBytes("microlending")),
    keccak256(toBytes("default")),                   // tag2: default sub-category
    LENDING_CONTRACT,
    arweaveUri,
    feedbackHash,
  ],
});

await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  REPUTATION_REGISTRY,
  data,
);
```

### Example: Borrower Responds to Feedback

The reviewed agent can respond to any feedback left on them. This is useful if
a borrower was unfairly marked or wants to provide context (e.g. "repayment was
delayed due to network congestion but completed 1 hour after deadline").

```typescript
// Response JSON uploaded to Arweave
const response = {
  type: "loan-feedback-response",
  loanId: 55,
  loanContract: LENDING_CONTRACT,
  chain: "celo",
  chainId: 42220,
  respondent: WALLET_ADDR,
  comment: "Repayment TX was submitted before the deadline but confirmed late due to Celo network congestion. TX hash: 0xabc123...",
  timestamp: Math.floor(Date.now() / 1000),
};

const responseJson = JSON.stringify(response);
const responseUri = await uploadFeedbackToArweave(response);
const responseHash = keccak256(toBytes(responseJson));

const AGENT_ID = BigInt(process.env.SELF_AGENT_ID || "0");

const data = encodeFunctionData({
  abi: REPUTATION_ABI,
  functionName: "appendResponse",
  args: [
    AGENT_ID,                                       // your own agentId (the one being reviewed)
    "0xLenderAddress" as `0x${string}`,              // clientAddress: who left the feedback
    BigInt(0),                                       // feedbackIndex: index of the feedback to respond to
    responseUri,                                     // uri: Arweave link to response details
    responseHash,                                    // hash: keccak256 of the response JSON
  ],
});

await sendGaslessContractCall(
  WALLET_ID,
  WALLET_ADDR,
  REPUTATION_REGISTRY,
  data,
);
```

### Querying Reputation Before Funding

Before funding a loan, query the borrower's reputation to assess risk:

```typescript
const [count, sum, decimals] = await publicClient.readContract({
  address: REPUTATION_REGISTRY,
  abi: REPUTATION_ABI,
  functionName: "getSummary",
  args: [
    borrowerAgentId,
    [],                                              // empty = all clients
    keccak256(toBytes("microlending")),               // filter by microlending
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // no tag2 filter
  ],
});

// count = number of feedback entries
// sum = aggregate score (positive = good history, negative = bad)
// A borrower with sum > 0 and count > 0 has positive lending history
```

### Reputation Feedback Rules

- Leave feedback ONLY after a loan reaches status Repaid (2) or Defaulted (3).
- Use `+100` for successful repayment, `-100` for default.
- Always use `keccak256("microlending")` as `tag1`.
- Use `keccak256("repayment")` as `tag2` for repaid loans, `keccak256("default")` for defaulted loans.
- Always upload the feedback JSON to Arweave first, then pass the URI on-chain.
- The `hash` must be `keccak256` of the exact JSON string uploaded.
- The `endpoint` should be the lending contract address.
- Reputation Registry on Celo: `0x69Da18CF4Ac27121FD99cEB06e38c3DC78F363f4`.
- Check borrower reputation via `getSummary` before funding any loan.

## Rules

- All amounts are in USDC smallest units (6 decimals). Use `parseUSDC("10")` for 10 USDC.
- USDC address on Celo: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`.
- Self Agent Registry on Celo: `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`.
- The `repayAmount` must be >= `amount` (enforced by the contract).
- The `deadline` must be a future unix timestamp (enforced by the contract).
- `createLoanRequest` requires a valid `agentId` — the agent must be registered in the Self Agent Registry and have a human proof. Without this, the call reverts with `NotVerifiedAgent`.
- Before `fundLoan`: the lender must `approve` the lending contract to spend `loan.amount` USDC.
- Before `repayLoan`: the borrower must `approve` the lending contract to spend `loan.repayAmount` USDC.
- Repayment must happen before the deadline.
- Only the original borrower can cancel or repay their loan.
- Anyone can call `claimDefaulted` after the deadline passes.
- Human-backed identity (8004 SBT) is enforced by the smart contract — the agent does not need to verify it separately.
- Always check borrower reputation via the Reputation Registry before funding. Refuse to fund if `sum < 0`. For new borrowers with no history, limit exposure to small amounts. Read individual Arweave feedback URIs for context.
- Contract address on Celo: `0x4B1B2b5F216771d004e5181cb98469C4d2B167Ff`.
- All write operations use `sendGaslessContractCall` from `src/smart-account.ts` — gas is sponsored by Candide.
- The agent's on-chain address is `AGENT_WALLET_ADDRESS` (Privy EOA = smart account via EIP-7702).
