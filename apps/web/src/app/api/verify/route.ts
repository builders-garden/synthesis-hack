import { NextRequest, NextResponse } from "next/server";

interface VerificationPayload {
  userId: string;
  credentialSubject: {
    minimumAge?: boolean;
    ofac?: boolean;
  };
  proof: unknown;
}

// In-memory store for verified users (replace with DB in production)
const verifiedUsers = new Map<
  string,
  { verifiedAt: string; disclosures: Record<string, boolean> }
>();

export async function POST(req: NextRequest) {
  try {
    const body: VerificationPayload = await req.json();

    if (!body.userId) {
      return NextResponse.json(
        { error: "Missing userId (wallet address)" },
        { status: 400 }
      );
    }

    // TODO: Verify the Self proof on-chain or via Self SDK verification
    // For now, we trust the callback from Self app and store the result

    verifiedUsers.set(body.userId.toLowerCase(), {
      verifiedAt: new Date().toISOString(),
      disclosures: {
        minimumAge: body.credentialSubject?.minimumAge ?? false,
        ofac: body.credentialSubject?.ofac ?? false,
      },
    });

    console.log(`[verify] User verified: ${body.userId}`);

    return NextResponse.json({
      success: true,
      userId: body.userId,
      verified: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Verification failed";
    console.error("[verify] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter" },
      { status: 400 }
    );
  }

  const verification = verifiedUsers.get(address.toLowerCase());

  return NextResponse.json({
    verified: !!verification,
    ...(verification || {}),
  });
}
