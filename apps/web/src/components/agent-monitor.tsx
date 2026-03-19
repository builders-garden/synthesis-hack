"use client";

import { useState } from "react";
import { useSendTransaction } from "wagmi";
import { parseEther } from "viem";

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";

interface AgentMonitorProps {
  agentName: string;
  walletAddress: string;
  domain: string;
  celoBalance: number;
}

export function AgentMonitor({
  agentName,
  walletAddress,
  domain,
  celoBalance,
}: AgentMonitorProps) {
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const { sendTransactionAsync } = useSendTransaction();

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) return;

    setTopUpLoading(true);
    try {
      await sendTransactionAsync({
        to: walletAddress as `0x${string}`,
        value: parseEther(topUpAmount),
      });

      setTopUpAmount("");
    } catch (err) {
      console.error("Top-up failed:", err);
    } finally {
      setTopUpLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-serif text-2xl text-ink">{agentName}</h3>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="font-mono text-xs text-ink-light">Running</span>
        </div>
      </div>

      {/* Balances grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>CELO Balance</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {celoBalance.toFixed(4)}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">CELO</p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Gas Reserve</span>
          <p className="mt-3 font-mono text-2xl text-ink">$0.10</p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            Retained for gas fees
          </p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Network</span>
          <p className="mt-3 font-mono text-2xl text-ink">Celo</p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            Mainnet
          </p>
        </div>
      </div>

      {/* Top up */}
      <div className="border border-cream-dark p-6">
        <h4 className={labelClass}>Top Up Agent</h4>
        <p className="mt-2 text-xs text-ink-light">
          Send additional CELO to your agent&apos;s wallet on Celo.
        </p>

        <div className="mt-6 flex items-end gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none"
              />
              <span className="font-mono text-xs text-ink-lighter">CELO</span>
            </div>
          </div>
          <button
            onClick={handleTopUp}
            disabled={
              topUpLoading || !topUpAmount || parseFloat(topUpAmount) <= 0
            }
            className="bg-ink px-6 py-2 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            {topUpLoading ? "Sending..." : "Send CELO"}
          </button>
        </div>
      </div>

      {/* Agent info footer */}
      <div className="border-t border-cream-dark pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="font-mono text-xs text-ink-lighter">
              Agent URL
            </span>
            <p className="mt-1 font-mono text-xs text-ink">{domain}</p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">Wallet</span>
            <p className="mt-1 font-mono text-xs text-ink">{walletAddress}</p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">Network</span>
            <p className="mt-1 font-mono text-xs text-ink">Celo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
