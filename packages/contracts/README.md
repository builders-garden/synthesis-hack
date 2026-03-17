# Lido Agent Yield

A smart contract protocol on **Base** that lets humans deposit [wstETH](https://docs.lido.fi/guides/lido-tokens-integration-guide/#wsteth) and allocate a configurable share of accrued staking yield to an AI agent wallet.

## How it works

1. A **YieldVaultFactory** (singleton) deploys lightweight [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167) clones — one vault per user / team.
2. The vault **owner** (human) deposits wstETH and configures:
   - **Agent wallet** — the address that receives yield.
   - **Yield share** — percentage (basis points) of accrued yield the agent may withdraw.
   - **Withdrawal frequency** — cooldown between agent withdrawals (e.g. 7 days for a weekly budget).
3. Yield is **never rebased** into extra tokens. Instead it is computed on every call via the **Chainlink wstETH/stETH exchange rate oracle** on Base:

   ```
   yield_stETH  = vault_wstETH_balance * current_rate  -  principalStETH
   yield_wstETH = yield_stETH / current_rate
   ```
4. The **agent** can withdraw up to `yieldShareBps %` of accrued yield, subject to the cooldown. It can never touch the principal.
5. The **owner** has full control: withdraw principal, withdraw yield, update settings, pause, or emergency-exit at any time.

## Key addresses (Base Mainnet)

| Contract | Address |
|---|---|
| wstETH (ERC20Bridged) | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` |
| Chainlink wstETH/stETH exchange rate | `0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061` |

## Project structure

```
src/
  YieldVault.sol            # Per-user vault (clone implementation)
  YieldVaultFactory.sol     # Factory that deploys vault clones
  interfaces/
    IAggregatorV3.sol        # Chainlink price feed interface
test/
  YieldVault.t.sol           # Fork tests (Base mainnet)
script/
  Deploy.s.sol               # Deployment script
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- A Base RPC endpoint (public `https://mainnet.base.org` works for testing)

## Setup

```bash
cp .env.example .env
# edit .env with your RPC URL

source .env
```

## Build

```bash
forge build
```

## Test

Tests run against a Base mainnet fork and use `vm.mockCall` to simulate oracle rate changes (yield accrual).

```bash
forge test --fork-url $BASE_RPC_URL -vvv
```

## Deploy

```bash
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
```

## Security considerations

- **Oracle staleness** — reverts if the Chainlink answer is older than 25 hours (heartbeat + 1 h buffer).
- **Reentrancy** — all state-changing functions use a reentrancy guard.
- **Emergency exit** — `exit()` bypasses the pause flag so the owner can always recover funds.
- **Factory pause** — protocol admin can halt all vault operations globally; individual vault owners can pause their own vault independently.
- **No `receive()` / `fallback()`** — vaults only accept wstETH via `deposit()`.
