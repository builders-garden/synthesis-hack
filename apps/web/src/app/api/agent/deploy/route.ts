import { NextRequest, NextResponse } from "next/server";

interface DeployRequest {
  agentName: string;
  veniceModel: string;
  locusApiKey: string;
  ownerAddress: string;
  ownerPrivateKey: string;
  spendingCap: string;
  dailyLimit: string;
}

export async function POST(req: NextRequest) {
  const body: DeployRequest = await req.json();

  if (!body.agentName || !body.locusApiKey) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Generate OpenClaw agent configuration
  const openclawConfig = {
    agents: {
      defaults: {
        workspace: `~/.openclaw/workspaces/${body.agentName}`,
      },
      list: [
        {
          id: body.agentName,
          default: true,
        },
      ],
    },
    providers: {
      venice: {
        type: "openai-compatible",
        baseUrl: "https://api.venice.ai/api/v1",
        // Agent will acquire this key autonomously via Locus
        apiKey: "PENDING_AUTONOMOUS_ACQUISITION",
      },
    },
    models: {
      default: body.veniceModel,
    },
    skills: {
      locus: {
        enabled: true,
        config: {
          apiKey: body.locusApiKey,
          apiBase: "https://beta-api.paywithlocus.com/api",
          walletAddress: body.ownerAddress,
          spendingCap: body.spendingCap,
          dailyLimit: body.dailyLimit,
        },
      },
    },
  };

  // Generate the bootstrap skill that will:
  // 1. Use Locus to acquire Venice API key
  // 2. Configure Venice as inference provider
  // 3. Begin autonomous operation
  const bootstrapSkill = `---
name: bootstrap
description: Bootstrap the agent by acquiring a Venice API key using Locus wallet funds.
version: 1.0.0
requires:
  env: ["LOCUS_API_KEY"]
---

# Bootstrap Skill

On first run, perform the following steps:

1. Check Locus wallet balance using the Locus API.
2. If balance >= 5 USDC, acquire a Venice AI API key:
   - Visit https://venice.ai/settings/api and create a new API key
   - Or use Locus wrapped APIs if Venice is available as a wrapped provider
3. Store the Venice API key securely.
4. Configure Venice as the inference provider with base URL https://api.venice.ai/api/v1
5. Confirm the agent is operational by making a test inference call.
6. Report status back via Locus feedback endpoint.
`;

  // TODO: Actually deploy the OpenClaw gateway with this config
  // For now, return the config for the frontend to display/download

  return NextResponse.json({
    config: openclawConfig,
    bootstrapSkill,
    agentId: body.agentName,
    walletAddress: body.ownerAddress,
    status: "config_generated",
  });
}
