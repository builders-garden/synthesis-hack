# x402 Services

Payment-gated API services using the [x402 protocol](https://x402.org). Clients pay per-request in USDC on Celo — no API keys, no subscriptions.

## Services

### Image Generation

**Endpoint:** `POST /api/image-generation`

Generates images using Google Gemini 3.1 Flash Image Preview via OpenRouter. Returns a base64-encoded PNG.

```json
{
  "prompt": "A photorealistic orange cat sitting on a windowsill at sunset",
  "image_config": {
    "aspect_ratio": "16:9"
  }
}
```

### AI Inference

**Endpoint:** `POST /api/inference`

General-purpose AI inference using Xiaomi MiMo v2 Omni via OpenRouter.

## How x402 payment works

1. Client sends a request without payment
2. Server responds with HTTP 402 and the exact USDC price
3. Client signs a USDC transfer authorization (EIP-712)
4. Client retries with the `PAYMENT-SIGNATURE` header
5. Server verifies payment via the facilitator and serves the response
6. USDC is settled on-chain on Celo

Clients using `@x402/fetch` or `@x402/axios` handle this flow automatically.

## Pricing

| Service | Input rate | Output rate | Typical cost |
|---------|-----------|-------------|-------------|
| Image Generation | $0.50/M tokens | $3.00/M tokens | ~$0.003/image |
| Inference | $0.50/M tokens | $3.00/M tokens | varies |

## Tech stack

- [Hono](https://hono.dev) — HTTP framework
- [@x402/hono](https://x402.org) — x402 payment middleware
- [OpenRouter](https://openrouter.ai) — AI model routing

## Environment variables

```
IMAGE_GEN_PAY_TO_ADDRESS=    # USDC payment recipient for image generation
INFERENCE_PAY_TO_ADDRESS=    # USDC payment recipient for inference
OPENROUTER_API_KEY=          # OpenRouter API key
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Deployment

Configured for Railway deployment via `railway.json` and `Dockerfile`.

```bash
pnpm start
```
