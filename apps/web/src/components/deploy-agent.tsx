"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const VENICE_MODELS = [
  { id: "venice/zai-org-glm-5", label: "GLM-5 (Private)", privacy: "private" },
  {
    id: "venice/kimi-k2-5",
    label: "Kimi K2.5 — Reasoning (Private)",
    privacy: "private",
  },
  {
    id: "venice/qwen3-235b",
    label: "Qwen3 235B — Large (Private)",
    privacy: "private",
  },
  {
    id: "venice/llama-3.3-70b",
    label: "Llama 3.3 70B (Private)",
    privacy: "private",
  },
  {
    id: "venice/venice-uncensored",
    label: "Venice Uncensored (Private)",
    privacy: "private",
  },
];

const STEPS = [
  { id: "configure", label: "Configure" },
  { id: "fund", label: "Fund Locus Wallet" },
  { id: "deploy", label: "Deploy" },
] as const;

type Step = (typeof STEPS)[number]["id"];

export function DeployAgent() {
  const [step, setStep] = useState<Step>("configure");
  const [agentName, setAgentName] = useState("");
  const [veniceModel, setVeniceModel] = useState(VENICE_MODELS[0].id);
  const [spendingCap, setSpendingCap] = useState("50");
  const [dailyLimit, setDailyLimit] = useState("500");
  const [deploying, setDeploying] = useState(false);
  const [funded, setFunded] = useState(false);

  const handleFund = async () => {
    // TODO: send 5 USDC to Locus wallet on Base
    // This will be the agent's starter balance to autonomously acquire Venice API key
    setFunded(true);
    setStep("deploy");
  };

  const handleDeploy = async () => {
    setDeploying(true);
    // TODO: deploy OpenClaw agent with:
    // 1. Locus wallet (already funded with 5 USDC)
    // 2. Agent autonomously purchases Venice API key using Locus balance
    // 3. Agent configures itself with Venice as inference provider
    console.log({
      agentName,
      veniceModel,
      spendingCap,
      dailyLimit,
    });
    setDeploying(false);
  };

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === s.id
                  ? "bg-emerald-600 text-white"
                  : STEPS.findIndex((x) => x.id === step) > i
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {STEPS.findIndex((x) => x.id === step) > i ? "✓" : i + 1}
            </div>
            <span
              className={`text-sm ${step === s.id ? "text-zinc-50" : "text-zinc-500"}`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-2 h-px w-8 bg-zinc-700" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Configure */}
      {step === "configure" && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Agent Config */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">
              Agent Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="my-yield-agent"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Inference Model
                </label>
                <select
                  value={veniceModel}
                  onChange={(e) => setVeniceModel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {VENICE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  Powered by Venice AI — private, no-data-retention inference
                </p>
              </div>
            </div>
          </div>

          {/* Spending Controls */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">
              Spending Controls
              <span className="ml-2 text-xs text-zinc-500">via Locus</span>
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">
                    Per-TX Cap (USDC)
                  </label>
                  <input
                    type="number"
                    value={spendingCap}
                    onChange={(e) => setSpendingCap(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">
                    Daily Limit (USDC)
                  </label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                These limits are enforced by Locus — the agent cannot exceed
                them.
              </p>
            </div>
          </div>

          {/* Lido Treasury */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
            <h3 className="mb-4 text-lg font-semibold">
              Lido Treasury
              <span className="ml-2 text-xs text-zinc-500">Yield Funding</span>
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Deposit wstETH to fund your agent long-term. Only the yield is
                spendable — principal stays locked.
              </p>
              <div className="max-w-xs">
                <label className="mb-1 block text-sm text-zinc-400">
                  wstETH Amount
                </label>
                <input
                  type="number"
                  placeholder="0.0"
                  step="0.01"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Treasury contract deployment coming soon
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Button
              onClick={() => setStep("fund")}
              disabled={!agentName}
              className="w-full bg-emerald-600 py-6 text-lg font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Fund Locus Wallet */}
      {step === "fund" && (
        <div className="mx-auto max-w-lg">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/10">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              Fund Agent Starter Balance
            </h3>
            <p className="mb-6 text-sm text-zinc-400">
              Send <span className="font-mono text-emerald-400">5 USDC</span>{" "}
              to your agent&apos;s Locus wallet. This is the bootstrap budget
              — the agent will use it to autonomously acquire a Venice API key
              and start operating.
            </p>
            <div className="mb-6 rounded-lg bg-zinc-800 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Amount</span>
                <span className="font-mono">5.00 USDC</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Network</span>
                <span>Base</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Purpose</span>
                <span className="text-zinc-300">
                  Venice API key + initial ops
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("configure")}
                className="flex-1 border-zinc-700"
              >
                Back
              </Button>
              <Button
                onClick={handleFund}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                {funded ? "Funded ✓" : "Send 5 USDC"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Deploy */}
      {step === "deploy" && (
        <div className="mx-auto max-w-lg">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/10">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Ready to Deploy</h3>
            <p className="mb-6 text-sm text-zinc-400">
              Your agent will boot up and autonomously:
            </p>
            <div className="mb-6 space-y-3 text-left text-sm">
              <div className="flex items-start gap-3 rounded-lg bg-zinc-800 p-3">
                <span className="mt-0.5 text-emerald-400">1.</span>
                <span className="text-zinc-300">
                  Use Locus wallet to purchase a Venice API key
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-zinc-800 p-3">
                <span className="mt-0.5 text-emerald-400">2.</span>
                <span className="text-zinc-300">
                  Configure Venice as its private inference provider
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-zinc-800 p-3">
                <span className="mt-0.5 text-emerald-400">3.</span>
                <span className="text-zinc-300">
                  Start operating autonomously, funded by stETH yield
                </span>
              </div>
            </div>
            <div className="mb-6 rounded-lg bg-zinc-800/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Agent</span>
                <span className="font-mono">{agentName}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Model</span>
                <span>
                  {VENICE_MODELS.find((m) => m.id === veniceModel)?.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Spending cap</span>
                <span className="font-mono">{spendingCap} USDC/tx</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Daily limit</span>
                <span className="font-mono">{dailyLimit} USDC/day</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Starter balance</span>
                <span className="font-mono text-emerald-400">5.00 USDC ✓</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("fund")}
                className="flex-1 border-zinc-700"
              >
                Back
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={deploying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                {deploying ? "Deploying..." : "Deploy Agent"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
