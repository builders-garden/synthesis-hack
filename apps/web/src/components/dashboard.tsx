"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import { DeployAgent } from "@/components/deploy-agent";

export function Dashboard() {
  const { isConnected } = useAppKitAccount();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-32">
        <h2 className="text-3xl font-bold">Microlending on Celo</h2>
        <p className="max-w-md text-center text-zinc-400">
          Lend and borrow USDC with Self-verified identity. Connect your wallet
          to get started.
        </p>
        <appkit-button />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Lending Pool</h2>
        <p className="mt-1 text-zinc-400">
          Verify identity, deposit to the pool, or request a loan
        </p>
      </div>
      <DeployAgent />
    </div>
  );
}
