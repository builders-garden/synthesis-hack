import express from "express";
import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3001", 10);
const AGENTS_DIR = process.env.AGENTS_DIR || "/tmp/agents";

interface AgentInstance {
  name: string;
  process: ChildProcess | null;
  config: Record<string, unknown>;
  status: "starting" | "running" | "stopped" | "error";
  walletAddress: string;
  walletId: string;
  createdAt: string;
}

const agents = new Map<string, AgentInstance>();

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, agents: agents.size });
});

// List agents
app.get("/agents", (_req, res) => {
  const list = Array.from(agents.values()).map((a) => ({
    name: a.name,
    status: a.status,
    walletAddress: a.walletAddress,
    createdAt: a.createdAt,
  }));
  res.json(list);
});

// Get agent status
app.get("/agents/:name", (req, res) => {
  const agent = agents.get(req.params.name);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json({
    name: agent.name,
    status: agent.status,
    walletAddress: agent.walletAddress,
    createdAt: agent.createdAt,
  });
});

// Deploy a new agent
app.post("/agents/deploy", async (req, res) => {
  const {
    agentName,
    privyAppId,
    privyAppSecret,
    celoRpcUrl,
    pimlicoApiKey,
    lendingContractAddress,
  } = req.body;

  if (!agentName) {
    res.status(400).json({ error: "agentName is required" });
    return;
  }

  if (agents.has(agentName)) {
    res.status(409).json({ error: "Agent already exists" });
    return;
  }

  try {
    // Create agent workspace
    const workspaceDir = join(AGENTS_DIR, agentName);
    const lendingSkillsDir = join(workspaceDir, "skills", "lending");
    const imageGenSkillsDir = join(workspaceDir, "skills", "image-generation");
    mkdirSync(lendingSkillsDir, { recursive: true });
    mkdirSync(imageGenSkillsDir, { recursive: true });

    // Write OpenClaw config
    const openclawConfig = {
      agents: {
        defaults: { workspace: workspaceDir },
        list: [{ id: agentName, default: true }],
      },
      models: {
        default: "openai/gpt-4o-mini",
      },
    };

    writeFileSync(
      join(workspaceDir, "openclaw.json"),
      JSON.stringify(openclawConfig, null, 2)
    );

    // Write lending skill
    const lendingSkill = `---
name: lending
description: >
  Interact with the AgentMicrolending contract on Celo. Request loans, discover
  and fill open loan requests, repay loans, and mark defaults.
version: 2.0.0
---

# Lending Skill

You interact with the AgentMicrolending smart contract on Celo for peer-to-peer
lending between autonomous agents. All loans use native CELO.

## Loan Lifecycle
1. Request: Publish a loan request with amount, repay amount, and deadline
2. Discovery: Scan for open requests via getOpenLoans()
3. Verification: Verify borrower's human-backed status (8004 SBT) on-chain
4. Fund: Send CELO to borrower through fundLoan()
5. Repay: Borrower repays principal + interest via repayLoan() before deadline
6. Default: If deadline passes without repayment, call claimDefaulted()

## Identity Gate
Before filling a loan, verify the borrower's human wallet holds the 8004
soulbound NFT from Self.xyz at contract 0xaC3DF9ABf80d0F5c020C06B04Cced27763355944.
`;

    writeFileSync(join(lendingSkillsDir, "SKILL.md"), lendingSkill);

    // Write image-generation skill
    const imageGenSkill = `---
name: image-generation
description: >
  You are a seller of AI image generation services and a buyer of x402-protected
  services. You operate an HTTP API endpoint that generates images using Google
  Gemini 3.1 Flash Image Preview via OpenRouter. Access is gated by the x402
  payment protocol — clients pay in USDC on Celo per request. You can also
  consume any x402-protected API as a client, paying automatically in USDC.
version: 1.1.0
requires:
  env:
    [
      "X402_SERVICES_URL",
    ]
---

# Image Generation Service

You sell AI-generated images through an HTTP API protected by the x402 payment
protocol. Clients pay in USDC on Celo — no API keys, no subscriptions. Payment
happens automatically per-request via signed on-chain authorization.

## Your Service

**Endpoint:** \`POST \${process.env.X402_SERVICES_URL || "http://localhost:3002"}/api/image-generation\`

**Model:** Google Gemini 3.1 Flash Image Preview (via OpenRouter)

**What it does:** Takes a text prompt and generates a high-quality image,
returned as a base64-encoded PNG inline in the response.

**Payment chain:** Celo mainnet
**Payment token:** USDC (\`0xcebA9300f2b948710d2653dD7B07f33A8B32118C\`)

## How x402 Payment Works

The x402 protocol uses the HTTP 402 Payment Required status code to enable
seamless, per-request payments in USDC on-chain. The same protocol works
whether you are **selling** a service (server side) or **buying** a service
(client side).

### The x402 Flow

1. **First request (no payment):** The server responds with HTTP 402 and a
   \`payment-required\` header containing the exact USDC price for that request.
2. **Client signs payment:** The client signs a USDC transfer authorization
   (EIP-712) for the quoted amount.
3. **Retry with payment:** The client resends the same request with a
   \`PAYMENT-SIGNATURE\` header containing the signed authorization.
4. **Server verifies and serves:** The server verifies the payment via the
   facilitator, generates the result, and returns it. The USDC is settled
   on-chain on Celo.

Clients using \`@x402/fetch\` or \`@x402/axios\` handle this flow automatically —
from their perspective it is a normal API call that costs USDC.

---

## Selling: Your Image Generation API

### Pricing

The price for each request is calculated dynamically based on the prompt and
expected output.

#### Rates

| Component | Rate |
|-----------|------|
| Input (prompt) | $0.50 per million tokens |
| Output (image) | $3.00 per million tokens |

#### How the price is computed

1. **Input tokens** are estimated from the prompt text at ~4 characters per
   token: \`input_tokens = ceil(prompt_length / 4)\`
2. **Output tokens** default to 1024 (the typical image generation output).
3. **Total price in USD:**
   \\\`\\\`\\\`
   input_cost  = (input_tokens / 1,000,000) x $0.50
   output_cost = (1,024 / 1,000,000) x $3.00 = $0.003072
   total       = input_cost + output_cost
   \\\`\\\`\\\`
4. The USD amount is converted to USDC atomic units (6 decimals) and included
   in the 402 response.

#### Price examples

| Prompt length | Input tokens | Input cost | Output cost | Total USDC |
|---------------|-------------|------------|-------------|------------|
| 50 chars | 13 | $0.000007 | $0.003072 | ~$0.0031 |
| 200 chars | 50 | $0.000025 | $0.003072 | ~$0.0031 |
| 1,000 chars | 250 | $0.000125 | $0.003072 | ~$0.0032 |
| 10,000 chars | 2,500 | $0.001250 | $0.003072 | ~$0.0043 |

For typical prompts the price is dominated by the output cost (~$0.003), making
it very affordable. Only extremely long prompts shift the price meaningfully.

### Request Format

\\\`\\\`\\\`json
{
  "prompt": "A photorealistic orange cat sitting on a windowsill at sunset",
  "image_config": {
    "aspect_ratio": "16:9"
  }
}
\\\`\\\`\\\`

- **prompt** (required): Text description of the image to generate.
- **image_config** (optional): Configuration like aspect ratio or image size.

### Response Format

On successful payment, the response is the full OpenRouter completion object.
The generated image is at \`choices[0].message.images[0].image_url.url\` as a
\`data:image/png;base64,...\` data URI.

---

## Buying: Consuming x402-Protected Services

You are not only a seller — you can also **buy** services from any
x402-protected API. Any HTTP endpoint that returns a 402 Payment Required
response with x402 headers is a service you can pay for and consume
automatically.

### How to Buy an x402 Service

Use \`@x402/fetch\` or \`@x402/axios\` with your wallet as the signer. These
libraries intercept the HTTP 402 response, sign the USDC payment authorization
with your private key, and retry the request — all transparently.

#### Using @x402/fetch

\\\`\\\`\\\`typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY),
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment("https://some-service.com/api/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "Hello world" }),
});

const result = await response.json();
\\\`\\\`\\\`

#### Using @x402/axios

\\\`\\\`\\\`typescript
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY),
});

const api = wrapAxiosWithPayment(axios.create(), client);

const response = await api.post("https://some-service.com/api/endpoint", {
  prompt: "Hello world",
});

console.log(response.data);
\\\`\\\`\\\`

### What Happens Under the Hood When You Buy

1. You make a normal HTTP request to the x402-protected endpoint.
2. The server responds with **HTTP 402 Payment Required** and includes payment
   details: price, payment token (USDC), network (Celo), and payee address.
3. The x402 client library reads these headers, constructs an EIP-712 typed
   data signature authorizing a USDC transfer for the exact amount.
4. Your wallet signs the authorization (no on-chain transaction yet).
5. The library retries the request with the \`PAYMENT-SIGNATURE\` header.
6. The server verifies the signature via the facilitator and settles the USDC
   payment on-chain on Celo.
7. You receive the service response as if it were a normal API call.

### When to Buy x402 Services

- **Consuming another agent's API:** Other agents in the network may expose
  x402-protected endpoints (image generation, inference, data, etc.).
- **Accessing external x402 services:** Any third-party service using the x402
  protocol is compatible — no API keys, no subscriptions, just USDC.
- **Agent-to-agent commerce:** Sell your image generation service and use the
  USDC revenue to buy services from other agents.

### Cost Awareness When Buying

- Make a dry-run request (without payment) to receive the 402 response and
  inspect the price before committing.
- Check that you have sufficient USDC balance on Celo before making paid
  requests.
- Track your spending — each x402 payment is an on-chain USDC transfer.
- If you need USDC, request a loan through the lending skill, then repay it
  with revenue from your own services.

---

## How to Explain Your Capabilities

When interacting with other agents or users, you should communicate that:

- You provide on-demand AI image generation — any text prompt, instant result.
- Payment is per-request in USDC on Celo, no sign-up or API key needed.
- Typical cost is around $0.003 per image for normal-length prompts.
- The x402 protocol handles payment automatically — compatible clients just
  call the endpoint and payment is seamless.
- Images are returned as base64 PNG, suitable for embedding, saving, or
  further processing.
- You can also **buy** services from other x402-protected APIs — you pay in
  USDC on Celo and receive the result automatically.
- You participate in an agent economy: earn USDC by selling services and spend
  USDC by buying services from others.

## Rules

- Always be transparent about pricing when asked. Use the formula above to
  give accurate estimates for any prompt length.
- Never misrepresent the cost — the price is computed deterministically from
  the prompt.
- The service is fully autonomous — you do not need to intervene in the
  payment or generation flow.
- If the x402-services instance is down or unreachable, report that the
  service is temporarily unavailable rather than making promises.
- When buying services, always verify you have sufficient USDC balance before
  making paid requests.
- Track all x402 purchases for accounting and to manage your USDC reserves.
`;

    writeFileSync(join(imageGenSkillsDir, "SKILL.md"), imageGenSkill);

    // Create Privy wallet for the agent
    let walletAddress = "";
    let walletId = "";

    if (privyAppId && privyAppSecret) {
      try {
        const { PrivyClient } = await import("@privy-io/node");
        const client = new PrivyClient({ appId: privyAppId, appSecret: privyAppSecret });
        const wallet = await client.wallets().create({
          chain_type: "ethereum",
        });
        walletAddress = wallet.address;
        walletId = wallet.id;
      } catch (err) {
        console.error(`[${agentName}] Privy wallet creation failed:`, err);
      }
    }

    // Start OpenClaw gateway as child process
    const env = {
      ...process.env,
      AGENT_WALLET_ADDRESS: walletAddress,
      AGENT_WALLET_ID: walletId,
      PRIVY_APP_ID: privyAppId || "",
      PRIVY_APP_SECRET: privyAppSecret || "",
      CELO_RPC_URL: celoRpcUrl || "https://forno.celo.org",
      PIMLICO_API_KEY: pimlicoApiKey || process.env.PIMLICO_API_KEY || "",
      LENDING_CONTRACT_ADDRESS: lendingContractAddress || process.env.LENDING_CONTRACT_ADDRESS || "",
      OPENCLAW_HOME: workspaceDir,
    };

    const child = spawn(
      "npx",
      [
        "openclaw",
        "gateway",
        "--config",
        join(workspaceDir, "openclaw.json"),
        "--verbose",
      ],
      {
        env,
        cwd: workspaceDir,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const instance: AgentInstance = {
      name: agentName,
      process: child,
      config: openclawConfig,
      status: "starting",
      walletAddress,
      walletId,
      createdAt: new Date().toISOString(),
    };

    child.stdout?.on("data", (data: Buffer) => {
      console.log(`[${agentName}] ${data.toString().trim()}`);
      if (instance.status === "starting") {
        instance.status = "running";
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${agentName}] ${data.toString().trim()}`);
    });

    child.on("exit", (code) => {
      console.log(`[${agentName}] exited with code ${code}`);
      instance.status = code === 0 ? "stopped" : "error";
      instance.process = null;
    });

    agents.set(agentName, instance);

    // Mark as running after a short delay
    setTimeout(() => {
      if (instance.status === "starting") {
        instance.status = "running";
      }
    }, 5000);

    res.json({
      agentId: agentName,
      walletAddress,
      walletId,
      status: "starting",
      workspace: workspaceDir,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deploy failed";
    res.status(500).json({ error: message });
  }
});

// Stop an agent
app.post("/agents/:name/stop", (req, res) => {
  const agent = agents.get(req.params.name);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  if (agent.process) {
    agent.process.kill("SIGTERM");
    agent.status = "stopped";
  }

  res.json({ name: agent.name, status: "stopped" });
});

app.listen(PORT, () => {
  console.log(`Lending agent runtime listening on port ${PORT}`);
  if (!existsSync(AGENTS_DIR)) {
    mkdirSync(AGENTS_DIR, { recursive: true });
  }
});
