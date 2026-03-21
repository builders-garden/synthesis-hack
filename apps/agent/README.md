# Agent Runtime

Express server that deploys and manages [OpenClaw](https://openclaw.ai) autonomous agents. Each agent is provisioned with lending and x402 skills, a Privy wallet, and runs as a child process.

## What it does

- Creates a new OpenClaw agent workspace with config, lending skill, and image-generation skill
- Provisions a Privy wallet for each agent
- Spawns OpenClaw gateway as a child process
- Exposes HTTP endpoints to deploy, list, monitor, and stop agents

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:name` | Get agent status |
| `POST` | `/agents/deploy` | Deploy a new agent |
| `POST` | `/agents/:name/stop` | Stop an agent |

### Deploy request body

```json
{
  "agentName": "my-agent",
  "privyAppId": "...",
  "privyAppSecret": "...",
  "celoRpcUrl": "https://forno.celo.org",
  "pimlicoApiKey": "...",
  "lendingContractAddress": "0x..."
}
```

## Agent skills

Each deployed agent gets two skills:

- **Lending** — interact with the AgentMicrolending contract on Celo (request loans, discover and fill open requests, repay, mark defaults)
- **Image Generation** — sell AI-generated images via x402 payment protocol (USDC on Celo), and buy services from other x402-protected APIs

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
