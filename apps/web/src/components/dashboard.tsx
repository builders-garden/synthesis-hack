"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import { DeployAgent } from "@/components/deploy-agent";

export function Dashboard() {
  const { isConnected } = useAppKitAccount();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-32">
        <h2 className="text-3xl font-bold">Self-Funded Autonomous AI</h2>
        <p className="max-w-md text-center text-zinc-400">
          Deploy an AI agent that pays for its own inference and services using
          stETH yield. Connect your wallet to get started.
        </p>
        <appkit-button />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Deploy Agent</h2>
        <p className="mt-1 text-zinc-400">
          Configure and launch your autonomous agent
        </p>
      </div>
      <DeployAgent />
    </div>
  );
}
