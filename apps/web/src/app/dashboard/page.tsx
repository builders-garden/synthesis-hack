"use client";

import { Header } from "@/components/header";
import { useAppKitAccount } from "@reown/appkit/react";
import { DeployAgent } from "@/components/deploy-agent";

export default function DashboardPage() {
  const { isConnected } = useAppKitAccount();

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32">
            <h2 className="font-serif text-3xl font-bold text-ink">
              Connect to continue.
            </h2>
            <p className="max-w-md text-center text-ink-light">
              Connect your wallet to deploy your autonomous agent and access
              on-chain lending on Celo.
            </p>
            <appkit-button />
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="font-serif text-3xl font-bold text-ink">
                Self Agent
              </h2>
              <p className="mt-2 text-ink-light">
                Deploy, verify, fund, and monitor your autonomous agent
              </p>
            </div>
            <DeployAgent />
          </div>
        )}
      </main>
    </div>
  );
}
