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
  { id: "wallet", label: "Create Wallet" },
  { id: "fund", label: "Fund" },
  { id: "deploy", label: "Deploy" },
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
  const [deployResult, setDeployResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  const {
    wallet,
    walletReady,
    walletAddress,
    balance,
    error,
    loading,
    registerWallet,
    pollWalletStatus,
    checkBalance,
    deployAgent,
  } = useAgentDeploy();

  const { sendTransactionAsync } = useSendTransaction();

  const handleCreateWallet = async () => {
    const result = await registerWallet(agentName);
    if (result) {
      // Poll until wallet is deployed
      await pollWalletStatus(result.apiKey);
      setStep("fund");
    }
  };

  const handleFund = async () => {
    if (!walletAddress) return;

    try {
      // Send 5 USDC to the Locus wallet on Base
      const data = encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [walletAddress as `0x${string}`, parseUnits("5", 6)],
      });

      await sendTransactionAsync({
        to: USDC_ADDRESS,
        data,
      });

      // Poll balance until funded
      if (wallet) {
        let funded = false;
        for (let i = 0; i < 30; i++) {
          const bal = await checkBalance(wallet.apiKey);
          if (bal >= 5) {
            funded = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        if (funded) {
          setStep("deploy");
        }
      }
    } catch (err) {
      console.error("Fund failed:", err);
    }
  };

  const handleDeploy = async () => {
    const result = await deployAgent({
      agentName,
      veniceModel,
      spendingCap,
      dailyLimit,
    });
    if (result) {
      setDeployResult(result);
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

          <div className="lg:col-span-2">
            <button
              onClick={() => setStep("wallet")}
              disabled={!agentName}
              className="bg-ink px-12 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Create Locus Wallet */}
      {step === "wallet" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">
            Create agent wallet.
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            We&apos;ll register a non-custodial smart wallet on Base for your
            agent via Locus. The agent gets its own address, API key, and
            spending controls — no manual setup needed.
          </p>

          <div className="mt-8 space-y-3 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Agent</span>
              <span className="text-ink">{agentName}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Network</span>
              <span className="text-ink">Base</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Wallet type</span>
              <span className="text-ink">ERC-4337 Smart Wallet</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Gas</span>
              <span className="text-ink">Sponsored by Locus</span>
            </div>
            {walletAddress && (
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Address</span>
                <span className="text-ink">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
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
              onClick={handleCreateWallet}
              disabled={loading || walletReady}
              className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {loading
                ? "Creating..."
                : walletReady
                  ? "\u2713 Wallet Ready"
                  : "Create Wallet"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Fund */}
      {step === "fund" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">
            Fund starter balance.
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            Send 5 USDC to your agent&apos;s wallet on Base. The agent will use
            this to autonomously acquire a Venice API key and begin operating.
          </p>

          <div className="mt-8 space-y-3 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Wallet</span>
              <span className="text-ink">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Amount</span>
              <span className="text-ink">5.00 USDC</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Network</span>
              <span className="text-ink">Base</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Balance</span>
              <span className="text-ink">
                {balance ? `${balance} USDC` : "0.00 USDC"}
              </span>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={() => setStep("wallet")}
              className="border border-cream-dark px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:border-ink hover:text-ink"
            >
              Back
            </button>
            <button
              onClick={handleFund}
              disabled={loading}
              className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {loading ? "Sending..." : "Send 5 USDC"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Deploy */}
      {step === "deploy" && !deployResult && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">Ready to deploy.</h3>
          <p className="mt-4 text-sm text-ink-light">
            Your agent will autonomously:
          </p>

          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">01</span>
              <span className="text-sm text-ink">
                Purchase a Venice API key using its Locus balance
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">02</span>
              <span className="text-sm text-ink">
                Configure Venice as its private inference provider
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">03</span>
              <span className="text-sm text-ink">
                Begin operating, funded by stETH yield
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
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Balance</span>
              <span className="text-ink">
                {balance ? `${balance} USDC` : "5.00 USDC"} {"\u2713"}
              </span>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={() => setStep("fund")}
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

      {/* Deploy success */}
      {step === "deploy" && deployResult && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">Agent deployed.</h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            Your agent is bootstrapping. It will acquire a Venice API key and
            begin autonomous operation.
          </p>

          <div className="mt-8 space-y-3 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Agent ID</span>
              <span className="text-ink">
                {deployResult.agentId as string}
              </span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Wallet</span>
              <span className="text-ink">
                {(deployResult.walletAddress as string)?.slice(0, 6)}...
                {(deployResult.walletAddress as string)?.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Status</span>
              <span className="text-ink">Bootstrapping...</span>
            </div>
          </div>

          {wallet?.claimUrl && (
            <div className="mt-8 rounded border border-cream-dark p-4">
              <p className="text-xs text-ink-lighter">
                Claim your agent dashboard:
              </p>
              <a
                href={wallet.claimUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block font-mono text-xs text-ink underline"
              >
                {wallet.claimUrl}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
