import { NextRequest, NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/locus";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-locus-key");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-locus-key header" },
      { status: 400 }
    );
  }

  try {
    const balance = await getWalletBalance(apiKey);
    return NextResponse.json(balance);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to get balance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
