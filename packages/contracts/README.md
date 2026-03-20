# Agent Microlending

P2P non-collateralized microlending protocol for autonomous agents on **Celo**. Only agents with a verified human-backed identity (via [Self.xyz](https://self.xyz) ERC-8004) can borrow.

## How it works

1. A human verifies their identity through Self.xyz, which mints a **Soulbound NFT** (ERC-8004) on Celo and creates an `agentId`.
2. The human deploys an agent and delegates their identity to the agent's wallet by calling `setAgentWallet` on the **Self Agent Registry** — linking the `agentId` to the agent's address on-chain.
3. The agent calls `createLoanRequest` on the lending contract, passing its `agentId`. The contract verifies against the Self Registry that:
   - The agent wallet is linked to that `agentId`
   - The `agentId` has a valid human proof
4. Any lender (agent or human) can fund the loan — no identity check required to lend.
5. The borrower repays principal + interest before the deadline. If not, anyone can mark the loan as defaulted.

All loans are denominated in a single ERC-20 token (e.g. USDC) set at deployment.

## Identity verification flow

```
Human passport (NFC)
  → Self.xyz (ZK proof: age ≥ 18, OFAC clear)
    → ERC-8004 SBT minted on Celo (agentId)
      → setAgentWallet(agentId, agentAddress, sig)
        → Self Registry links agentId → agent wallet
          → Agent calls createLoanRequest(..., agentId)
            → Lending contract reads Self Registry
              → getAgentWallet(agentId) == msg.sender ✓
              → hasHumanProof(agentId) == true ✓
              → Loan request created
```

## Key addresses (Celo Mainnet)

| Contract | Address |
|---|---|
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| Self Agent Registry (ERC-8004) | `0x62E37d0f6c5f67784b8828B3dF68BCDbB2e55095` |
| Self SBT | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |

## Project structure

```
src/
  AgentMicrolending.sol    # Lending protocol with Self identity verification
test/
  AgentMicrolending.t.sol  # Tests with mock Self registry
script/
  Deploy.s.sol             # Deployment script (Celo)
```

## Contract interface

### Borrower (requires verified Self identity)

- `createLoanRequest(amount, repayAmount, deadline, lender, agentId)` — create a loan request. Reverts if `agentId` is not linked to `msg.sender` or has no human proof.
- `repayLoan(loanId)` — repay a funded loan before the deadline.
- `cancelLoanRequest(loanId)` — cancel an unfunded loan request.

### Lender (no identity required)

- `fundLoan(loanId)` — fund an open loan request. Transfers `amount` tokens to the borrower.
- `claimDefaulted(loanId)` — mark a loan as defaulted after the deadline (anyone can call).

### Views

- `getLoan(loanId)` — get loan details.
- `getOpenLoans(offset, limit)` — paginated open loans.
- `getBorrowerLoans(address)` / `getBorrowerOpenLoans(address)` — loans by borrower.
- `getLenderLoans(address)` / `getLenderActiveLoanIds(address)` — loans by lender.
- `totalLoans()` — total loan count.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Build

```bash
forge build
```

## Test

```bash
forge test -vvv
```

Tests use a `MockSelfRegistry` to simulate identity verification without needing the real Self contracts.

## Deploy

```bash
forge script script/Deploy.s.sol --rpc-url $CELO_RPC_URL --broadcast --verify
```

## Security considerations

- **Identity gate** — only `createLoanRequest` is gated behind Self verification. The contract reads the Self Registry at transaction time (no cached/stale state).
- **Non-collateralized** — loans are unsecured. Default only updates on-chain status (reputation signal). There is no collateral to liquidate.
- **Reentrancy** — `fundLoan` and `repayLoan` use a reentrancy guard.
- **Token safety** — all ERC-20 transfers use OpenZeppelin's `SafeERC20`.
