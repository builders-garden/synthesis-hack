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

export function DeployAgent() {
  const [agentName, setAgentName] = useState("");
  const [veniceApiKey, setVeniceApiKey] = useState("");
  const [veniceModel, setVeniceModel] = useState(VENICE_MODELS[0].id);
  const [locusApiKey, setLocusApiKey] = useState("");
  const [spendingCap, setSpendingCap] = useState("50");
  const [dailyLimit, setDailyLimit] = useState("500");
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    setDeploying(true);
    // TODO: deploy OpenClaw agent with Venice + Locus config
    console.log({
      agentName,
      veniceApiKey,
      veniceModel,
      locusApiKey,
      spendingCap,
      dailyLimit,
    });
    setDeploying(false);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Agent Config */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="mb-4 text-lg font-semibold">Agent Configuration</h3>
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
        </div>
      </div>

      {/* Venice Config */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="mb-4 text-lg font-semibold">
          Venice AI
          <span className="ml-2 text-xs text-zinc-500">Private Inference</span>
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">API Key</label>
            <input
              type="password"
              value={veniceApiKey}
              onChange={(e) => setVeniceApiKey(e.target.value)}
              placeholder="venice-api-key"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Model</label>
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
          </div>
        </div>
      </div>

      {/* Locus Config */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="mb-4 text-lg font-semibold">
          Locus
          <span className="ml-2 text-xs text-zinc-500">Agent Payments</span>
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">API Key</label>
            <input
              type="password"
              value={locusApiKey}
              onChange={(e) => setLocusApiKey(e.target.value)}
              placeholder="locus-api-key"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
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
        </div>
      </div>

      {/* Stake wstETH */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="mb-4 text-lg font-semibold">
          Lido Treasury
          <span className="ml-2 text-xs text-zinc-500">Yield Funding</span>
        </h3>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Deposit wstETH to fund your agent. Only the yield is spendable —
            principal stays locked.
          </p>
          <div>
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

      {/* Deploy Button */}
      <div className="lg:col-span-2">
        <Button
          onClick={handleDeploy}
          disabled={deploying || !agentName || !veniceApiKey}
          className="w-full bg-emerald-600 py-6 text-lg font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {deploying ? "Deploying..." : "Deploy Agent"}
        </Button>
      </div>
    </div>
  );
}
