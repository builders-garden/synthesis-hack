import { NextRequest, NextResponse } from "next/server";
import {
  createService,
  setEnvVars,
  createVolume,
  createDomain,
} from "@/lib/railway";

interface DeployRequest {
  agentName: string;
  veniceModel: string;
  spendingCap: string;
  dailyLimit: string;
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
      VENICE_MODEL: body.veniceModel || "venice/llama-3.3-70b",
      SPENDING_CAP: body.spendingCap || "5",
      DAILY_LIMIT: body.dailyLimit || "10",
    };

    if (body.telegramBotToken) {
      envVars.TELEGRAM_BOT_TOKEN = body.telegramBotToken;
    }
    if (body.telegramAllowedUsers) {
      envVars.TELEGRAM_ALLOWED_USERS = body.telegramAllowedUsers;
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
