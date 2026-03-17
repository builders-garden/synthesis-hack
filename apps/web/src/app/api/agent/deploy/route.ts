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

  // Environment variables for the agent container
  const envVars = {
    AGENT_NAME: body.agentName,
    VENICE_MODEL: body.veniceModel || "venice/llama-3.3-70b",
    VENICE_API_KEY: "", // Agent will acquire this autonomously
    LOCUS_API_KEY: body.locusApiKey,
    LOCUS_WALLET_ADDRESS: body.ownerAddress,
    LOCUS_PRIVATE_KEY: body.ownerPrivateKey,
    SETUP_PASSWORD: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
    SPENDING_CAP: body.spendingCap || "5",
    DAILY_LIMIT: body.dailyLimit || "10",
  };

  // TODO: Trigger Railway deployment via API
  // For now, return the env vars so the user can deploy manually
  // Railway API: https://docs.railway.com/reference/public-api
  //
  // Future: use Railway CLI or API to:
  // 1. Create a new service from the apps/agent Dockerfile
  // 2. Set env vars
  // 3. Attach a persistent volume at /data
  // 4. Deploy

  return NextResponse.json({
    agentId: body.agentName,
    walletAddress: body.ownerAddress,
    status: "config_ready",
    envVars,
    deployInstructions: {
      platform: "railway",
      steps: [
        "cd apps/agent",
        "railway link",
        "railway volume add --mount /data",
        `Set environment variables from the envVars object`,
        "railway up",
      ],
    },
  });
}
