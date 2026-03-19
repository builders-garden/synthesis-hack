import { NextRequest, NextResponse } from "next/server";
import { requestRegistration } from "@selfxyz/agent-sdk";

const SELF_API_BASE = "https://app.ai.self.xyz";

// Store active sessions server-side
const activeSessions = new Map<
  string,
  {
    sessionToken: string;
    agentAddress: string;
    result: {
      status: string;
      agentId?: number;
      agentAddress?: string;
      txHash?: string;
      privateKey?: string;
    } | null;
    error: string | null;
  }
>();

// Poll Self API with correct Bearer auth
async function pollSelfStatus(sessionToken: string) {
  const res = await fetch(`${SELF_API_BASE}/api/agent/register/status`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `HTTP ${res.status}`
    );
  }

  return res.json();
}

// Background poller for a session
async function backgroundPoll(sessionKey: string) {
  const entry = activeSessions.get(sessionKey);
  if (!entry) return;

  const deadline = Date.now() + 300_000; // 5 min timeout
  let currentToken = entry.sessionToken;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));

    // Re-check entry still exists
    if (!activeSessions.has(sessionKey)) return;

    try {
      const status = await pollSelfStatus(currentToken);
      console.log("[agent-id/poll] Stage:", status.stage);

      // Update rolling token if provided
      if (status.sessionToken) {
        currentToken = status.sessionToken;
        entry.sessionToken = currentToken;
      }

      if (status.stage === "completed") {
        entry.result = {
          status: "completed",
          agentId: status.agentId,
          agentAddress: status.agentAddress || entry.agentAddress,
          txHash: status.txHash,
        };
        return;
      }

      if (status.stage === "failed") {
        entry.error = "Registration failed on-chain";
        entry.result = { status: "failed" };
        return;
      }

      if (status.stage === "expired") {
        entry.error = "Session expired";
        entry.result = { status: "failed" };
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Poll error";
      console.error("[agent-id/poll] Error:", msg);
      // Don't fail on transient errors, keep polling
    }
  }

  entry.error = "Registration timed out (5 min)";
  entry.result = { status: "failed" };
}

export async function POST(req: NextRequest) {
  try {
    const { humanAddress, agentName } = await req.json();

    if (!humanAddress) {
      return NextResponse.json(
        { error: "Missing humanAddress" },
        { status: 400 }
      );
    }

    console.log("[agent-id/register] Starting for", humanAddress);

    const session = await requestRegistration({
      mode: "linked",
      network: "mainnet",
      humanAddress,
      agentName: agentName || "OpenClaw Lending Agent",
      agentDescription:
        "Microlending agent on Celo with Self-verified identity",
      disclosures: {
        minimumAge: 18,
        ofac: true,
      },
      apiBase: SELF_API_BASE,
    });

    console.log("[agent-id/register] Session created:", {
      stage: session.stage,
      agentAddress: session.agentAddress,
    });

    const sessionKey = crypto.randomUUID();

    activeSessions.set(sessionKey, {
      sessionToken: session.sessionToken,
      agentAddress: session.agentAddress,
      result: null,
      error: null,
    });

    // Start background polling with correct Bearer auth
    backgroundPoll(sessionKey);

    return NextResponse.json({
      sessionKey,
      deepLink: session.deepLink,
      agentAddress: session.agentAddress,
      expiresAt: session.expiresAt,
      stage: session.stage,
      humanInstructions: session.humanInstructions,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Registration failed";
    console.error("[agent-id/register] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("key");

  if (!sessionKey) {
    return NextResponse.json(
      { error: "Missing key parameter" },
      { status: 400 }
    );
  }

  const entry = activeSessions.get(sessionKey);
  if (!entry) {
    return NextResponse.json(
      { error: "Session not found or expired" },
      { status: 404 }
    );
  }

  if (entry.error) {
    activeSessions.delete(sessionKey);
    return NextResponse.json({
      stage: "failed",
      error: entry.error,
    });
  }

  if (entry.result && entry.result.status === "completed") {
    activeSessions.delete(sessionKey);
    return NextResponse.json({
      stage: "completed",
      agentId: entry.result.agentId,
      agentAddress: entry.result.agentAddress,
      txHash: entry.result.txHash,
    });
  }

  return NextResponse.json({
    stage: "waiting",
    agentAddress: entry.agentAddress,
  });
}
