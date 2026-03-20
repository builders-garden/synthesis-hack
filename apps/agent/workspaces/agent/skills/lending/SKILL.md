---
name: lending
description: >
  Interact with the AgentMicrolending contract on Celo. Request loans, discover
  and fill open loan requests, repay loans, and mark defaults. All transactions
  are gasless via Pimlico paymaster.
version: 2.0.0
requires:
  env: ["PRIVY_APP_ID", "PRIVY_APP_SECRET", "AGENT_WALLET_ID", "AGENT_WALLET_ADDRESS", "CELO_RPC_URL", "PIMLICO_API_KEY"]
---

# Lending Skill

You interact with the AgentMicrolending smart contract on Celo for peer-to-peer
lending between autonomous agents. All loans use native CELO.

**All on-chain transactions are gasless** — they are submitted as ERC-4337
UserOperations via the Pimlico paymaster on Celo. The agent never pays gas
directly. Signing is handled by a Privy server wallet (no private key stored
locally).

## Contract Interface

The AgentMicrolending contract is deployed on Celo. All functions use native CELO
(not ERC-20 tokens).

### Request a Loan (Borrower)

Publish a loan request specifying amount, repay amount (principal + interest),
deadline, and optionally a specific lender:

```solidity
function createLoanRequest(
    uint256 amount,        // CELO to borrow (in wei)
    uint256 repayAmount,   // Total to repay: principal + interest (in wei)
    uint256 deadline,      // Unix timestamp — must repay by this time
    address lender         // Specific lender, or address(0) for open request
) external returns (uint256 loanId);
```

### Cancel a Loan Request (Borrower)

Cancel an unfunded loan request:

```solidity
function cancelLoanRequest(uint256 loanId) external;
```

### Fund a Loan (Lender)

Fill an open loan request by sending the exact `amount` as msg.value:

```solidity
function fundLoan(uint256 loanId) external payable;
```

Before funding, verify the borrower is human-backed by checking their associated
human wallet holds the 8004 soulbound NFT from Self.xyz.

### Repay a Loan (Borrower)

Repay a funded loan by sending the exact `repayAmount` as msg.value:

```solidity
function repayLoan(uint256 loanId) external payable;
```

Must be called before the deadline.

### Mark as Defaulted (Anyone)

After the deadline passes without repayment, anyone can mark the loan as defaulted:

```solidity
function claimDefaulted(uint256 loanId) external;
```

## Discovery

### Find Open Loan Requests

```solidity
function getOpenLoans(uint256 offset, uint256 limit)
    external view returns (LoanRequest[] memory);
```

### Check Your Loans

```solidity
function getBorrowerLoans(address borrower) external view returns (uint256[] memory);
function getLenderLoans(address lender) external view returns (uint256[] memory);
function getLenderActiveLoanIds(address lender) external view returns (uint256[] memory);
```

### Get Loan Details

```solidity
function getLoan(uint256 loanId) external view returns (LoanRequest memory);
```

## Loan Lifecycle

1. **Request**: Borrower publishes a loan request with amount, repay amount, and deadline
2. **Discovery**: Lender agents scan for open requests via `getOpenLoans()`
3. **Verification**: Lender verifies borrower's human-backed status (8004 SBT) on-chain
4. **Fund**: Lender sends CELO to borrower through `fundLoan()`
5. **Repay**: Borrower repays principal + interest via `repayLoan()` before deadline
6. **Default**: If deadline passes without repayment, anyone calls `claimDefaulted()`

## Identity Verification

Before filling a loan, verify the borrower's human wallet holds the 8004 SBT:

```typescript
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

const SELF_SBT = "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944";

const client = createPublicClient({ chain: celo, transport: http() });

const balance = await client.readContract({
  address: SELF_SBT,
  abi: [{ name: "balanceOf", type: "function", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" }],
  functionName: "balanceOf",
  args: [humanWalletAddress],
});

const isVerified = balance > 0n;
```

## Gasless Transactions (Pimlico)

All on-chain calls go through a Safe smart account with Pimlico as the ERC-4337
paymaster. The agent never pays gas — Pimlico sponsors the UserOperation.

```typescript
import { createGaslessClient, sendGaslessContractCall } from "../smart-account";
import { encodeFunctionData } from "viem";

const LENDING_CONTRACT = process.env.LENDING_CONTRACT_ADDRESS as `0x${string}`;
const WALLET_ID = process.env.AGENT_WALLET_ID!;
const WALLET_ADDR = process.env.AGENT_WALLET_ADDRESS!;

// Example: create a loan request (gasless)
const data = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "createLoanRequest",
  args: [amount, repayAmount, deadline, lenderAddress],
});
const txHash = await sendGaslessContractCall(WALLET_ID, WALLET_ADDR, LENDING_CONTRACT, data);

// Example: fund a loan (gasless, with value)
const fundData = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "fundLoan",
  args: [loanId],
});
const txHash2 = await sendGaslessContractCall(
  WALLET_ID, WALLET_ADDR, LENDING_CONTRACT, fundData, loanAmount
);

// Example: repay a loan (gasless, with value)
const repayData = encodeFunctionData({
  abi: LENDING_ABI,
  functionName: "repayLoan",
  args: [loanId],
});
const txHash3 = await sendGaslessContractCall(
  WALLET_ID, WALLET_ADDR, LENDING_CONTRACT, repayData, repayAmount
);
```

## Contract Address

- AgentMicrolending: `$LENDING_CONTRACT_ADDRESS` (set via environment variable)

## Watchtower

A watchtower service monitors loan outcomes and writes reputation reviews
on-chain for each agent, building a transparent credit history over time.
The agent does not need to interact with the watchtower directly.
