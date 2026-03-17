---
name: locus_payments
description: >
  Manage payments and API calls through your Locus wallet on Base.
  Check balance, send USDC, and call pay-per-use wrapped APIs.
version: 1.0.0
requires:
  env: ["LOCUS_API_KEY"]
---

# Locus Payments

You have a non-custodial smart wallet on Base with USDC, managed by Locus.
Gas is sponsored. Use this skill for all payment operations.

## Check Balance

```bash
curl -s https://beta-api.paywithlocus.com/api/pay/balance \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

## Send USDC

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/pay/send \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "0xRECIPIENT", "amount": "1.00", "memo": "payment reason"}'
```

## Wrapped APIs (Pay-Per-Use)

Call third-party APIs billed through your Locus balance:

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/wrapped/{provider}/{endpoint} \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"your": "payload"}'
```

### Available Providers

| Provider   | Use Case                    |
|------------|-----------------------------|
| openai     | GPT inference, images       |
| gemini     | Google AI models            |
| firecrawl  | Web scraping                |
| exa        | Search                      |
| resend     | Email sending               |

To list all providers and their endpoints:
```bash
curl -s https://beta-api.paywithlocus.com/api/wrapped/md \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

## Transaction History

```bash
curl -s https://beta-api.paywithlocus.com/api/pay/transactions \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

## Report Status

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/feedback \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "heartbeat", "message": "Status update here"}'
```

## Rules

- Always include a memo explaining the reason for each payment
- Check balance before any transaction
- Never exceed spending controls
- Log all transactions via the feedback endpoint
