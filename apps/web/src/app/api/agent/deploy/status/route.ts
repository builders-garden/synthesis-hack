import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDeployment,
  getDeploymentStatus,
  getDeploymentLogs,
} from "@/lib/railway";

export async function GET(req: NextRequest) {
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  const environmentId = req.nextUrl.searchParams.get("environmentId");
  const deploymentId = req.nextUrl.searchParams.get("deploymentId");

  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!projectId || !serviceId || !environmentId) {
    return NextResponse.json(
      { error: "Missing projectId, serviceId, or environmentId" },
      { status: 400 }
    );
  }

  try {
    let status: string;
    let currentDeploymentId = deploymentId;

    if (currentDeploymentId) {
      const result = await getDeploymentStatus(currentDeploymentId);
      status = result.status;
    } else {
      const latest = await getLatestDeployment(projectId, serviceId, environmentId);
      if (!latest) {
        return NextResponse.json({ status: "WAITING", deploymentId: null });
      }
      status = latest.status;
      currentDeploymentId = latest.id;
    }

    // Try to extract wallet address from logs if deployment is running
    let walletAddress: string | null = null;
    if (status === "SUCCESS" && currentDeploymentId) {
      try {
        const logs = await getDeploymentLogs(currentDeploymentId);
        for (const line of logs) {
          // The init script logs: "[init]   Wallet:   0x..."
          const match = line.match(/Wallet:\s+(0x[a-fA-F0-9]{40})/i);
          if (match) {
            walletAddress = match[1];
            break;
          }
        }
      } catch {
        // Logs may not be available yet
      }
    }

    return NextResponse.json({
      status,
      deploymentId: currentDeploymentId,
      walletAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
