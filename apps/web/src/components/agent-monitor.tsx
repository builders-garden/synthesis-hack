"use client";

import { useState, useEffect, useCallback } from "react";
import { useSendTransaction } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";

// Lido stETH APY on Base (approximate)
const LIDO_APY = 0.033;

// USDC on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";

interface AgentMonitorProps {
  agentName: string;
  walletAddress: string;
  domain: string;
  fundedAmount: number;
}

export function AgentMonitor({
  agentName,
  walletAddress,
  domain,
  fundedAmount,
}: AgentMonitorProps) {
  const [usdcBalance, setUsdcBalance] = useState(fundedAmount);
  const [stEthStaked, setStEthStaked] = useState(0);
  const [stakeAmount, setStakeAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [yieldAccrued, setYieldAccrued] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const { sendTransactionAsync } = useSendTransaction();

  const dailyYield = (stEthStaked * LIDO_APY) / 365;
  const monthlyYield = dailyYield * 30;
  const annualYield = stEthStaked * LIDO_APY;

  // Simulate yield accrual every 10 seconds (accelerated for demo)
  useEffect(() => {
    if (stEthStaked <= 0) return;

    const interval = setInterval(() => {
      // Each tick = ~1 hour of yield (accelerated for demo)
      const hourlyYield = (stEthStaked * LIDO_APY) / 365 / 24;
      setYieldAccrued((prev) => prev + hourlyYield);
    }, 10000);

    return () => clearInterval(interval);
  }, [stEthStaked]);

  const handleStake = useCallback(async () => {
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0 || amount > usdcBalance) return;

    setStaking(true);
    // Mock: simulate staking delay
    await new Promise((r) => setTimeout(r, 2000));

    setUsdcBalance((prev) => prev - amount);
    setStEthStaked((prev) => prev + amount);
    setStakeAmount("");
    setStaking(false);
  }, [stakeAmount, usdcBalance]);

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) return;

    setTopUpLoading(true);
    try {
      const data = encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [
          walletAddress as `0x${string}`,
          parseUnits(amount.toString(), 6),
        ],
      });

      await sendTransactionAsync({
        to: USDC_ADDRESS,
        data,
      });

      setUsdcBalance((prev) => prev + amount);
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* USDC Balance */}
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>USDC Balance</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {usdcBalance.toFixed(2)}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">USDC</p>
        </div>

        {/* stETH Staked */}
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Lido Stake</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {stEthStaked.toFixed(2)}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            stETH (USDC value)
          </p>
        </div>

        {/* APY */}
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Lido APY</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {(LIDO_APY * 100).toFixed(1)}%
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">Annual</p>
        </div>

        {/* Daily Yield */}
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Daily Yield</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {dailyYield > 0 ? dailyYield.toFixed(4) : "0.00"}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">USDC/day</p>
        </div>
      </div>

      {/* Yield projection + Accrued */}
      {stEthStaked > 0 && (
        <div className="border border-cream-dark p-6">
          <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
            Yield Projection
          </h4>
          <div className="mt-6 grid gap-6 sm:grid-cols-4">
            <div>
              <p className="font-mono text-xs text-ink-lighter">Accrued</p>
              <p className="mt-1 font-mono text-lg text-ink">
                {yieldAccrued.toFixed(6)}
              </p>
              <p className="font-mono text-xs text-ink-lighter">USDC</p>
            </div>
            <div>
              <p className="font-mono text-xs text-ink-lighter">Daily</p>
              <p className="mt-1 font-mono text-lg text-ink">
                {dailyYield.toFixed(4)}
              </p>
              <p className="font-mono text-xs text-ink-lighter">USDC</p>
            </div>
            <div>
              <p className="font-mono text-xs text-ink-lighter">Monthly</p>
              <p className="mt-1 font-mono text-lg text-ink">
                {monthlyYield.toFixed(4)}
              </p>
              <p className="font-mono text-xs text-ink-lighter">USDC</p>
            </div>
            <div>
              <p className="font-mono text-xs text-ink-lighter">Annual</p>
              <p className="mt-1 font-mono text-lg text-ink">
                {annualYield.toFixed(2)}
              </p>
              <p className="font-mono text-xs text-ink-lighter">USDC</p>
            </div>
          </div>

          {/* Agent funding runway */}
          <div className="mt-6 border-t border-cream-dark pt-6">
            <p className="font-mono text-xs text-ink-lighter">
              At {dailyYield.toFixed(4)} USDC/day yield, your agent can sustain
              approximately{" "}
              <span className="text-ink">
                {dailyYield > 0
                  ? Math.floor(dailyYield / 0.001) // ~$0.001 per inference call estimate
                  : 0}{" "}
                inference calls/day
              </span>{" "}
              from yield alone.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Stake to Lido */}
        <div className="border border-cream-dark p-6">
          <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
            Stake to Lido
          </h4>
          <p className="mt-2 text-xs text-ink-light">
            Stake USDC to earn stETH yield. Yield funds your agent&apos;s
            operations.
          </p>

          <div className="mt-6 flex items-end gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none"
                />
                <span className="font-mono text-xs text-ink-lighter">USDC</span>
              </div>
              <div className="mt-2 flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() =>
                      setStakeAmount(
                        ((usdcBalance * pct) / 100).toFixed(2)
                      )
                    }
                    className="font-mono text-[10px] text-ink-lighter hover:text-ink"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleStake}
              disabled={
                staking ||
                !stakeAmount ||
                parseFloat(stakeAmount) <= 0 ||
                parseFloat(stakeAmount) > usdcBalance
              }
              className="bg-ink px-6 py-2 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {staking ? "Staking..." : "Stake"}
            </button>
          </div>
        </div>

        {/* Top up */}
        <div className="border border-cream-dark p-6">
          <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
            Top Up Balance
          </h4>
          <p className="mt-2 text-xs text-ink-light">
            Send additional USDC to your agent&apos;s wallet on Base.
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
                <span className="font-mono text-xs text-ink-lighter">USDC</span>
              </div>
            </div>
            <button
              onClick={handleTopUp}
              disabled={
                topUpLoading || !topUpAmount || parseFloat(topUpAmount) <= 0
              }
              className="bg-ink px-6 py-2 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {topUpLoading ? "Sending..." : "Send"}
            </button>
          </div>
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
            <p className="mt-1 font-mono text-xs text-ink">Base</p>
          </div>
        </div>
      </div>
    </div>
  );
}
