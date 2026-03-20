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
    const skillsDir = join(workspaceDir, "skills", "lending");
    mkdirSync(skillsDir, { recursive: true });

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

    writeFileSync(join(skillsDir, "SKILL.md"), lendingSkill);

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
