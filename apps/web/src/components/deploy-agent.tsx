"use client";

import { useState } from "react";

const VENICE_MODELS = [
  { id: "venice/zai-org-glm-5", label: "GLM-5 (Private)" },
  { id: "venice/kimi-k2-5", label: "Kimi K2.5 — Reasoning (Private)" },
  { id: "venice/qwen3-235b", label: "Qwen3 235B — Large (Private)" },
  { id: "venice/llama-3.3-70b", label: "Llama 3.3 70B (Private)" },
  { id: "venice/venice-uncensored", label: "Venice Uncensored (Private)" },
];

const STEPS = [
  { id: "configure", label: "Configure" },
  { id: "fund", label: "Fund" },
  { id: "deploy", label: "Deploy" },
] as const;

type Step = (typeof STEPS)[number]["id"];

const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";
const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";

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
    setFunded(true);
    setStep("deploy");
  };

  const handleDeploy = async () => {
    setDeploying(true);
    // TODO: deploy OpenClaw agent
    console.log({ agentName, veniceModel, spendingCap, dailyLimit });
    setDeploying(false);
  };

  return (
    <div className="space-y-12">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => {
          const currentIdx = STEPS.findIndex((x) => x.id === step);
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
            <h3 className="font-serif text-xl text-ink">Lido Treasury</h3>
            <p className="text-sm text-ink-light">
              Deposit wstETH to fund your agent long-term. Only the yield is
              spendable — principal stays locked.
            </p>
            <div className="max-w-xs">
              <label className={labelClass}>wstETH Amount</label>
              <input
                type="number"
                placeholder="0.0"
                step="0.01"
                className={inputClass}
              />
              <p className="mt-2 text-xs text-ink-lighter">
                Treasury contract deployment coming soon
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <button
              onClick={() => setStep("fund")}
              disabled={!agentName}
              className="bg-ink px-12 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Fund */}
      {step === "fund" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-2xl text-ink">
            Fund agent starter balance.
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            Send 5 USDC to your agent&apos;s Locus wallet. This is the
            bootstrap budget — the agent will use it to autonomously acquire a
            Venice API key and begin operating.
          </p>

          <div className="mt-8 space-y-4 border-t border-cream-dark pt-8">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Amount</span>
              <span className="text-ink">5.00 USDC</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Network</span>
              <span className="text-ink">Base</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-lighter">Purpose</span>
              <span className="text-ink">Venice API key + initial ops</span>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={() => setStep("configure")}
              className="border border-cream-dark px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:border-ink hover:text-ink"
            >
              Back
            </button>
            <button
              onClick={handleFund}
              className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
            >
              {funded ? "\u2713 Funded" : "Send 5 USDC"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Deploy */}
      {step === "deploy" && (
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
              <span className="text-ink-lighter">Starter balance</span>
              <span className="text-ink">5.00 USDC \u2713</span>
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
              disabled={deploying}
              className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {deploying ? "Deploying..." : "Deploy Agent"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
