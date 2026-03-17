import { NextRequest, NextResponse } from "next/server";
import { registerAgent } from "@/lib/locus";

export async function POST(req: NextRequest) {
  const { name, email } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: "Agent name is required" },
      { status: 400 }
    );
  }

  try {
    const registration = await registerAgent(name, email);
    return NextResponse.json(registration);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
