import { NextRequest, NextResponse } from "next/server";
import { createAgentWallet } from "@/lib/privy-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerAddress } = body;

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "Missing ownerAddress" },
        { status: 400 }
      );
    }

    const wallet = await createAgentWallet();

    return NextResponse.json({
      walletId: wallet.walletId,
      address: wallet.address,
      ownerAddress,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Wallet creation failed";
    console.error("[wallet/create] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
