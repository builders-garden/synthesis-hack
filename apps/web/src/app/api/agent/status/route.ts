import { NextRequest, NextResponse } from "next/server";
import { getWalletStatus } from "@/lib/locus";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-locus-key");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-locus-key header" },
      { status: 400 }
    );
  }

  try {
    const status = await getWalletStatus(apiKey);
    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to get status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
