import { NextRequest, NextResponse } from "next/server";
import {
  createService,
  setEnvVars,
  createVolume,
  createDomain,
} from "@/lib/railway";

interface DeployRequest {
  agentName: string;
  telegramBotToken?: string;
  telegramAllowedUsers?: string;
}

export async function POST(req: NextRequest) {
  const body: DeployRequest = await req.json();

  if (!body.agentName) {
    return NextResponse.json(
      { error: "Missing agent name" },
      { status: 400 }
    );
  }

  try {
    const projectId = process.env.RAILWAY_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json(
        { error: "RAILWAY_PROJECT_ID is not configured" },
        { status: 500 }
      );
    }

    // 1. Create service from GitHub repo (name = agent name for uniqueness)
    const repo = "builders-garden/synthesis-hack";
    const { serviceId, environmentId } = await createService(
      projectId,
      body.agentName,
      repo,
      "main",
      "apps/agent"
    );

    // 2. Set env vars (bulk, single API call)
    const setupPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const envVars: Record<string, string> = {
      AGENT_NAME: body.agentName,
      SETUP_PASSWORD: setupPassword,
      CELO_RPC_URL: process.env.CELO_RPC_URL || "https://forno.celo.org",
    };

    // Privy: pass through from server env for agent wallet creation
    const privyAppId = process.env.PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;
    if (privyAppId) {
      envVars.PRIVY_APP_ID = privyAppId;
    }
    if (privyAppSecret) {
      envVars.PRIVY_APP_SECRET = privyAppSecret;
    }

    // Telegram: use frontend values, fall back to server env vars, skip if neither
    const telegramToken = body.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const telegramUsers = body.telegramAllowedUsers || process.env.TELEGRAM_ALLOWED_USERS;
    if (telegramToken) {
      envVars.TELEGRAM_BOT_TOKEN = telegramToken;
    }
    if (telegramUsers) {
      envVars.TELEGRAM_ALLOWED_USERS = telegramUsers;
    }

    await setEnvVars(projectId, serviceId, environmentId, envVars);

    // 3. Create persistent volume
    await createVolume(projectId, serviceId, environmentId, "/data");

    // 4. Generate public domain
    const domain = await createDomain(serviceId, environmentId);

    // Railway auto-deploys when service is created with a linked repo + env vars set

    return NextResponse.json({
      projectId,
      serviceId,
      environmentId,
      domain: `https://${domain}`,
      setupPassword,
      status: "deploying",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deploy failed";
    console.error("Railway deploy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
