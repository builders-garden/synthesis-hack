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
  locusApiKey: string;
  walletAddress: string;
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
    veniceModel,
    locusApiKey,
    ownerAddress,
    ownerPrivateKey,
    spendingCap,
    dailyLimit,
  } = req.body;

  if (!agentName || !locusApiKey) {
    res.status(400).json({ error: "agentName and locusApiKey are required" });
    return;
  }

  if (agents.has(agentName)) {
    res.status(409).json({ error: "Agent already exists" });
    return;
  }

  try {
    // Create agent workspace
    const workspaceDir = join(AGENTS_DIR, agentName);
    const skillsDir = join(workspaceDir, "skills", "locus-payments");
    const configDir = join(workspaceDir, ".config", "locus");

    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });

    // Write OpenClaw config
    const openclawConfig = {
      agents: {
        defaults: { workspace: workspaceDir },
        list: [{ id: agentName, default: true }],
      },
      providers: {
        venice: {
          type: "openai-compatible",
          baseUrl: "https://api.venice.ai/api/v1",
        },
      },
      models: {
        default: veniceModel || "venice/llama-3.3-70b",
      },
    };

    writeFileSync(
      join(workspaceDir, "openclaw.json"),
      JSON.stringify(openclawConfig, null, 2)
    );

    // Write Locus credentials
    writeFileSync(
      join(configDir, "credentials.json"),
      JSON.stringify({
        api_key: locusApiKey,
        api_base: "https://beta-api.paywithlocus.com/api",
      })
    );

    // Write Locus payment skill
    const locusSkill = `---
name: locus_payments
description: >
  Manage payments and API calls through Locus wallet on Base.
  Use this to check balance, send USDC, and call wrapped APIs.
version: 1.0.0
requires:
  env: ["LOCUS_API_KEY"]
---

# Locus Payments Skill

You have a Locus wallet on Base with USDC. Use it for all payments.

## Available Actions

### Check Balance
\`\`\`bash
curl -s https://beta-api.paywithlocus.com/api/pay/balance \\
  -H "Authorization: Bearer $LOCUS_API_KEY"
\`\`\`

### Send USDC
\`\`\`bash
curl -s -X POST https://beta-api.paywithlocus.com/api/pay/send \\
  -H "Authorization: Bearer $LOCUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "0xADDRESS", "amount": "1.00", "memo": "reason"}'
\`\`\`

### Call Wrapped APIs (pay-per-use)
\`\`\`bash
curl -s -X POST https://beta-api.paywithlocus.com/api/wrapped/{provider}/{endpoint} \\
  -H "Authorization: Bearer $LOCUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"your": "payload"}'
\`\`\`

Available wrapped providers: openai, gemini, firecrawl, exa, resend.

## Spending Controls
- Per-transaction cap: ${spendingCap || "5"} USDC
- Daily limit: ${dailyLimit || "10"} USDC

## Rules
- Always check balance before large transactions
- Log the reason for every payment via the memo field
- Never exceed spending controls
`;

    writeFileSync(join(skillsDir, "SKILL.md"), locusSkill);

    // Write bootstrap skill to acquire Venice API key
    const bootstrapSkillDir = join(workspaceDir, "skills", "bootstrap");
    mkdirSync(bootstrapSkillDir, { recursive: true });

    const bootstrapSkill = `---
name: bootstrap
description: >
  On first run, acquire a Venice AI API key using Locus wallet funds,
  then configure Venice as the inference provider.
version: 1.0.0
requires:
  env: ["LOCUS_API_KEY"]
---

# Bootstrap Skill

On first activation, perform these steps in order:

1. Check your Locus wallet balance to confirm funds are available.
2. Visit https://venice.ai and create an API key for Venice AI inference.
   - Use the Locus wallet to pay if Venice offers a paid API tier.
   - Or use the Locus wrapped OpenAI/Gemini APIs as a fallback inference provider.
3. Once you have the Venice API key, store it and use it for all future inference calls.
4. Confirm you are operational by sending a test message.
5. Report status via the Locus feedback endpoint:
   \`\`\`bash
   curl -s -X POST https://beta-api.paywithlocus.com/api/feedback \\
     -H "Authorization: Bearer $LOCUS_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"source": "heartbeat", "message": "Agent ${agentName} bootstrapped successfully"}'
   \`\`\`
`;

    writeFileSync(join(bootstrapSkillDir, "SKILL.md"), bootstrapSkill);

    // Start OpenClaw gateway as child process
    const env = {
      ...process.env,
      LOCUS_API_KEY: locusApiKey,
      LOCUS_WALLET_ADDRESS: ownerAddress,
      LOCUS_PRIVATE_KEY: ownerPrivateKey,
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
      locusApiKey,
      walletAddress: ownerAddress,
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
      walletAddress: ownerAddress,
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
  console.log(`Agent runtime listening on port ${PORT}`);
  if (!existsSync(AGENTS_DIR)) {
    mkdirSync(AGENTS_DIR, { recursive: true });
  }
});
