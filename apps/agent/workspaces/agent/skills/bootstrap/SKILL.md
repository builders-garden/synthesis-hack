---
name: bootstrap
description: >
  On first run, acquire a Venice AI API key autonomously via web3 wallet
  signing and configure the agent for self-funded operation.
version: 2.0.0
requires:
  env: ["LOCUS_API_KEY"]
---

# Bootstrap

Run this on first activation to set up autonomous operation.

## Step 1 — Verify Wallet Funding

Check Locus balance to confirm the wallet has USDC on Base:

```bash
curl -s https://beta-api.paywithlocus.com/api/pay/balance \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

If balance is zero, stop and report that the agent needs funding.

## Step 2 — Acquire Venice API Key (Autonomous Web3 Flow)

Venice provides private, uncensored inference with no data retention.
API keys can be generated programmatically using a web3 wallet signature.

Reference: https://docs.venice.ai/overview/guides/generating-api-key-agent

### 2a. (Optional) Acquire and Stake VVV for Diem Allocation

For daily Diem inference allocation, the agent needs staked VVV tokens:

- **VVV token (Base):** `0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf`
- **Venice Staking Contract (Base):** `0x321b7ff75154472b18edb199033ff4d116f340ff`

Flow:
1. Swap USDC → VVV via Aerodrome or Uniswap on Base
2. Approve VVV tokens for the staking contract
3. Execute stake transaction — VVV leaves wallet, sVVV is returned

### 2b. Get Validation Token

Request a validation token from Venice (no auth required):

```bash
curl -s https://api.venice.ai/api/v1/api_keys/generate_web3_key
```

Returns: `{ "data": { "token": "<validation_token>" } }`

### 2c. Sign the Validation Token

Sign the token with the agent's wallet private key using `ethers.js` or equivalent:

```javascript
const signature = await wallet.signMessage(token)
```

### 2d. Generate API Key

POST the signed token back to Venice:

```bash
curl -s -X POST https://api.venice.ai/api/v1/api_keys/generate_web3_key \
  -H "Content-Type: application/json" \
  -d '{
    "apiKeyType": "INFERENCE",
    "signature": "<signed_token>",
    "token": "<unsigned_token>",
    "address": "<agent_wallet_address>",
    "description": "OpenClaw yield-agent autonomous key",
    "consumptionLimit": { "diem": 1 }
  }'
```

This returns a Venice API key (format: `vapi_xxxxxxxxxxxx`).
Store it securely for all future inference calls.

## Step 3 — Test Inference

Test with the newly acquired Venice key:

```bash
curl -s -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $VENICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Say hello"}]}'
```

Fallback via Locus wrapped APIs if Venice key is not yet available:

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/wrapped/openai/chat/completions \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Say hello"}]}'
```

## Step 4 — Report Ready

Confirm bootstrap complete:

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/feedback \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "heartbeat", "message": "Agent bootstrapped and operational"}'
```

## After Bootstrap

The agent should:
- Monitor stETH yield accrual in the treasury contract
- Swap yield to USDC via Uniswap when needed
- Renew VVV stake before expiry to maintain Diem allocation
- Pay for services via Locus
- Operate within spending controls at all times
