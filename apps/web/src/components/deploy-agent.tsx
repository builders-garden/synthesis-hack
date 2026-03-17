"use client";

import { useState } from "react";
import { useAgentDeploy } from "@/hooks/use-agent-deploy";
import { useSendTransaction } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";

const VENICE_MODELS = [
  { id: "venice/zai-org-glm-5", label: "GLM-5 (Private)" },
  { id: "venice/kimi-k2-5", label: "Kimi K2.5 — Reasoning (Private)" },
  { id: "venice/qwen3-235b", label: "Qwen3 235B — Large (Private)" },
  { id: "venice/llama-3.3-70b", label: "Llama 3.3 70B (Private)" },
  { id: "venice/venice-uncensored", label: "Venice Uncensored (Private)" },
];

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

const STEPS = [
  { id: "configure", label: "Configure" },
  { id: "deploy", label: "Deploy" },
  { id: "fund", label: "Fund" },
] as const;

type Step = (typeof STEPS)[number]["id"];

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

export function DeployAgent() {
  const [step, setStep] = useState<Step>("configure");
  const [agentName, setAgentName] = useState("");
  const [veniceModel, setVeniceModel] = useState(VENICE_MODELS[0].id);
  const [spendingCap, setSpendingCap] = useState("5");
  const [dailyLimit, setDailyLimit] = useState("10");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramAllowedUsers, setTelegramAllowedUsers] = useState("");
  const [fundAmount, setFundAmount] = useState("5");
  const [funded, setFunded] = useState(false);

  const {
    deployInfo,
    deployStatus,
    walletAddress,
    error,
    loading,
    deployAgent,
    pollDeployStatus,
    getAgentWallet,
  } = useAgentDeploy();

  const { sendTransactionAsync } = useSendTransaction();

  const handleDeploy = async () => {
    const info = await deployAgent({
      agentName,
      veniceModel,
      spendingCap,
      dailyLimit,
      telegramBotToken: telegramBotToken || undefined,
      telegramAllowedUsers: telegramAllowedUsers || undefined,
    });

    if (info) {
      // Poll until deployment succeeds
      const result = await pollDeployStatus(info.serviceId, info.environmentId);

      if (result.status === "SUCCESS") {
        // Try to get wallet address from running agent
        if (!result.walletAddress) {
          // Retry a few times with delay
          for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const addr = await getAgentWallet(info.domain);
            if (addr) break;
          }
        }
        setStep("fund");
      }
    }
  };

  const handleFund = async () => {
    if (!walletAddress) return;

    try {
      const amount = parseFloat(fundAmount) || 5;
      const data = encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [walletAddress as `0x${string}`, parseUnits(amount.toString(), 6)],
      });

      await sendTransactionAsync({
        to: USDC_ADDRESS,
        data,
      });

      setFunded(true);
    } catch (err) {
      console.error("Fund failed:", err);
    }
  };

  const currentIdx = STEPS.findIndex((x) => x.id === step);

  return (
    <div className="space-y-12">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => {
          const isDone = currentIdx > i;
          const isCurrent = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs ${isCurrent ? "text-ink" : isDone ? "text-ink-light" : "text-ink-lighter"}`}
                >
                  {isDone ? "\u2713" : `0${i + 1}`}
                </span>
                <span
                  className={`font-mono text-xs uppercase tracking-wider ${isCurrent ? "text-ink" : "text-ink-lighter"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-12 bg-cream-dark" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Step 1: Configure */}
      {step === "configure" && (
        <div className="grid gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            <h3 className="font-serif text-xl text-ink">Agent</h3>
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="my-yield-agent"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Inference Model</label>
                <select
                  value={veniceModel}
                  onChange={(e) => setVeniceModel(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  {VENICE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-ink-lighter">
                  Venice AI — private, no-data-retention inference
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h3 className="font-serif text-xl text-ink">Spending Controls</h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className={labelClass}>Per-TX Cap</label>
                <div className="flex items-baseline gap-2">
                  <input
                    type="number"
                    value={spendingCap}
                    onChange={(e) => setSpendingCap(e.target.value)}
                    className={inputClass}
                  />
                  <span className="font-mono text-xs text-ink-lighter">
                    USDC
                  </span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Daily Limit</label>
                <div className="flex items-baseline gap-2">
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className={inputClass}
                  />
                  <span className="font-mono text-xs text-ink-lighter">
                    USDC
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-lighter">
              Enforced by Locus on Base. The agent cannot exceed these limits.
            </p>
          </div>

          <div className="space-y-8 lg:col-span-2">
            <h3 className="font-serif text-xl text-ink">Telegram (optional)</h3>
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <label className={labelClass}>Bot Token</label>
                <input
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className={inputClass}
                />
                <p className="mt-2 text-xs text-ink-lighter">
                  From @BotFather on Telegram
                </p>
              </div>
              <div>
                <label className={labelClass}>Allowed User IDs</label>
                <input
                  type="text"
                  value={telegramAllowedUsers}
                  onChange={(e) => setTelegramAllowedUsers(e.target.value)}
                  placeholder="123456789, 987654321"
                  className={inputClass}
                />
                <p className="mt-2 text-xs text-ink-lighter">
                  Comma-separated Telegram user IDs
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <button
              onClick={() => setStep("deploy")}
              disabled={!agentName}
              className="bg-ink px-12 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Deploy */}
      {step === "deploy" && !deployInfo && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">Deploy to Railway.</h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            Your agent container will be deployed to Railway. It will
            self-register with Locus, create its own smart wallet, and begin
            operating autonomously.
          </p>

          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">01</span>
              <span className="text-sm text-ink">
                Deploy container with your configuration
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">02</span>
              <span className="text-sm text-ink">
                Self-register with Locus and create smart wallet
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">03</span>
              <span className="text-sm text-ink">
                Purchase Venice API key using its Locus balance
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">04</span>
              <span className="text-sm text-ink">
                Begin autonomous operation
              </span>
            </div>
          </div>

          <div className="mt-10 space-y-3 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Agent</span>
              <span className="text-ink">{agentName}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Model</span>
              <span className="text-ink">
                {VENICE_MODELS.find((m) => m.id === veniceModel)?.label}
              </span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Spending cap</span>
              <span className="text-ink">{spendingCap} USDC/tx</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Daily limit</span>
              <span className="text-ink">{dailyLimit} USDC/day</span>
            </div>
            {telegramBotToken && (
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Telegram</span>
                <span className="text-ink">Configured</span>
              </div>
            )}
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={() => setStep("configure")}
              className="border border-cream-dark px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:border-ink hover:text-ink"
            >
              Back
            </button>
            <button
              onClick={handleDeploy}
              disabled={loading}
              className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {loading ? "Deploying..." : "Deploy Agent"}
            </button>
          </div>
        </div>
      )}

      {/* Deploy in progress / success */}
      {step === "deploy" && deployInfo && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">
            {deployStatus === "SUCCESS" ? "Agent deployed." : "Deploying..."}
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            {deployStatus === "SUCCESS"
              ? "Your agent is running. Continue to fund its wallet."
              : "Your agent container is being built and deployed to Railway."}
          </p>

          <div className="mt-8 space-y-3 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Status</span>
              <span className="text-ink">{deployStatus || "Starting..."}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">URL</span>
              <span className="text-ink text-xs">{deployInfo.domain}</span>
            </div>
            {walletAddress && (
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Wallet</span>
                <span className="text-ink">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            )}
          </div>

          {deployStatus === "SUCCESS" && (
            <div className="mt-10">
              <button
                onClick={() => setStep("fund")}
                className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
              >
                Continue to Fund
              </button>
            </div>
          )}

          {loading && (
            <div className="mt-8">
              <div className="h-1 w-full overflow-hidden rounded bg-cream-dark">
                <div className="h-full w-1/3 animate-pulse rounded bg-ink/30" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Fund */}
      {step === "fund" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">
            {funded ? "Agent funded." : "Fund starter balance."}
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            {funded
              ? "Your agent is funded and operational."
              : "Send USDC to your agent\u2019s wallet on Base. The agent will use this to autonomously acquire a Venice API key and begin operating."}
          </p>

          <div className="mt-8 space-y-3 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Wallet</span>
              <span className="text-ink">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : "Fetching..."}
              </span>
            </div>
            {!funded && (
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Amount</span>
                <div className="flex items-baseline gap-2">
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-16 border-b border-cream-dark bg-transparent text-right text-sm text-ink focus:border-ink focus:outline-none"
                  />
                  <span className="text-ink">USDC</span>
                </div>
              </div>
            )}
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Network</span>
              <span className="text-ink">Base</span>
            </div>
            {deployInfo && (
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Agent URL</span>
                <span className="text-ink text-xs">{deployInfo.domain}</span>
              </div>
            )}
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={() => setStep("deploy")}
              className="border border-cream-dark px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:border-ink hover:text-ink"
            >
              Back
            </button>
            {!funded ? (
              <button
                onClick={handleFund}
                disabled={loading || !walletAddress}
                className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                {loading ? "Sending..." : `Send ${fundAmount} USDC`}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-8 py-4 font-mono text-sm text-ink">
                {"\u2713"} Funded
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
