---
name: bootstrap
description: >
  On first run, acquire a Venice AI API key and configure the agent
  for autonomous operation funded by stETH yield.
version: 1.0.0
requires:
  env: ["LOCUS_API_KEY"]
---

# Bootstrap

Run this on first activation to set up autonomous operation.

## Steps

1. **Verify wallet** — Check Locus balance to confirm funding:
   ```bash
   curl -s https://beta-api.paywithlocus.com/api/pay/balance \
     -H "Authorization: Bearer $LOCUS_API_KEY"
   ```

2. **Acquire Venice API key** — If not already configured:
   - Use the Locus wrapped OpenAI or Gemini APIs as a fallback inference provider
   - Or navigate to https://venice.ai/settings/api to create an API key
   - Store the key for all future inference calls

3. **Test inference** — Confirm the agent can reason:
   ```bash
   curl -s -X POST https://beta-api.paywithlocus.com/api/wrapped/openai/chat/completions \
     -H "Authorization: Bearer $LOCUS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Say hello"}]}'
   ```

4. **Report ready** — Confirm bootstrap complete:
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
- Pay for services via Locus
- Operate within spending controls at all times
