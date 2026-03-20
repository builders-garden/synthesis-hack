import { NextRequest, NextResponse } from "next/server";
import { setEnvVars } from "@/lib/railway";

interface SetEnvRequest {
  serviceId: string;
  environmentId: string;
  vars: Record<string, string>;
}

export async function POST(req: NextRequest) {
  const body: SetEnvRequest = await req.json();

  if (!body.serviceId || !body.environmentId || !body.vars) {
    return NextResponse.json(
      { error: "Missing serviceId, environmentId, or vars" },
      { status: 400 }
    );
  }

  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json(
      { error: "RAILWAY_PROJECT_ID is not configured" },
      { status: 500 }
    );
  }

  try {
    await setEnvVars(projectId, body.serviceId, body.environmentId, body.vars);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set env vars";
    console.error("Set env vars error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
