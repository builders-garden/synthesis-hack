"use client";

import { useState } from "react";
import { useAccount, useSendTransaction, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { SelfVerification } from "@/components/self-verification";
import { LendingDashboard } from "@/components/lending-dashboard";

// Self Agent Registry on Celo mainnet
const REGISTRY_ADDRESS =
  "0x62E37d0f6c5f67784b8828B3dF68BCDbB2e55095" as const;

const REGISTRY_ABI = [
  {
    name: "setAgentWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const STEPS = [
  { id: "deploy", label: "Deploy Agent" },
  { id: "verify", label: "Verify Identity" },
  { id: "delegate", label: "Delegate" },
  { id: "fund", label: "Fund Agent" },
  { id: "monitor", label: "Monitor" },
] as const;

type Step = (typeof STEPS)[number]["id"];

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

export function DeployAgent() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step>("deploy");
  const [isVerified, setIsVerified] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  // With EIP-7702, walletAddress (Privy EOA) IS the smart account address
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [funded, setFunded] = useState(false);

  const handleDeploy = async () => {
    if (!agentName.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: agentName.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setWalletId(data.walletId);
      setServiceId(data.serviceId);
      setEnvironmentId(data.environmentId);
      // EIP-7702: EOA address = smart account address
      setAgentAddress(data.walletAddress);
      setStep("verify");
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setDeploying(false);
    }
  };

  const handleVerificationSuccess = (
    _agentAddr: string,
    selfAgentId?: number
  ) => {
    setIsVerified(true);
    if (selfAgentId != null) {
      setAgentId(selfAgentId);
    }
    setStep("delegate");
  };

  const handleDelegate = async () => {
    if (!address || agentId == null || !walletId || !agentAddress) return;
    setDelegating(true);
    try {
      // 1. Backend signs EIP-712 with Privy agent wallet (the EOA that IS the smart account)
      const res = await fetch("/api/agent-id/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          walletId,
          walletAddress: agentAddress,
          ownerAddress: address,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 2. Human submits setAgentWallet tx on the Self registry
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setAgentWallet",
        args: [
          BigInt(agentId),
          data.newWallet as `0x${string}`,
          BigInt(data.deadline),
          data.signature as `0x${string}`,
        ],
      });

      // Push SELF_AGENT_ID to the agent's Railway env vars
      if (serviceId && environmentId) {
        await fetch("/api/agent/set-env", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            environmentId,
            vars: { SELF_AGENT_ID: String(agentId) },
          }),
        });
      }

      setIsDelegated(true);
      setStep("fund");
    } catch (err) {
      console.error("Delegation failed:", err);
    } finally {
      setDelegating(false);
    }
  };

  const handleFund = async () => {
    if (!agentAddress || !fundAmount) return;
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0) return;

    setFunding(true);
    try {
      await sendTransactionAsync({
        to: agentAddress as `0x${string}`,
        value: parseEther(fundAmount),
      });
      setFunded(true);
      setStep("monitor");
    } catch (err) {
      console.error("Funding failed:", err);
    } finally {
      setFunding(false);
    }
  };

  const currentIdx = STEPS.findIndex((x) => x.id === step);

  if (!address) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h3 className="font-serif text-2xl text-ink">Connect your wallet.</h3>
        <p className="mt-4 text-sm leading-relaxed text-ink-light">
          Connect your wallet to deploy your autonomous agent and access
          on-chain lending on Celo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Agent info bar */}
      {agentAddress && (
        <div className="flex items-center justify-between border-b border-cream-dark pb-4">
          <div>
            <span className={labelClass}>Agent Wallet</span>
            <p className="mt-1 font-mono text-sm text-ink">
              {agentAddress.slice(0, 6)}...{agentAddress.slice(-4)}
            </p>
          </div>
          <div>
            <span className={labelClass}>Network</span>
            <p className="mt-1 font-mono text-sm text-ink">Celo</p>
          </div>
          <div>
            <span className={labelClass}>Identity</span>
            <p className="mt-1 font-mono text-sm text-ink">
              {isDelegated
                ? "Self (8004 SBT) — Delegated"
                : isVerified
                  ? "Self (8004 SBT)"
                  : "Not verified"}
            </p>
          </div>
          <div>
            <span className={labelClass}>Status</span>
            <p className="mt-1 font-mono text-sm text-ink">
              {funded ? "Funded" : "Unfunded"}
            </p>
          </div>
        </div>
      )}

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
                <button
                  onClick={() => {
                    if (isDone || isCurrent) setStep(s.id);
                  }}
                  disabled={!isDone && !isCurrent}
                  className={`font-mono text-xs uppercase tracking-wider ${isCurrent ? "text-ink" : isDone ? "text-ink-light cursor-pointer hover:text-ink" : "text-ink-lighter"}`}
                >
                  {s.label}
                </button>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-12 bg-cream-dark" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Deploy Agent */}
      {step === "deploy" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-xl text-ink">Deploy your agent</h3>
          <p className="mt-2 text-sm text-ink-light">
            Deploy a Dockerized OpenClaw agent instance. Your connected wallet
            serves as the human anchor for the agent lifecycle.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Agent Name</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="my-agent"
                className={inputClass}
              />
            </div>

            <button
              onClick={handleDeploy}
              disabled={deploying || !agentName.trim()}
              className="w-full bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {deploying ? "Deploying..." : "Deploy Agent"}
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-lighter">
            Human wallet: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
      )}

      {/* Step 2: Verify Identity */}
      {step === "verify" && (
        <div className="mx-auto max-w-md">
          <SelfVerification
            walletAddress={address}
            onSuccess={handleVerificationSuccess}
          />

          {/* Skip verification */}
          <div className="mt-8 border-t border-cream-dark pt-6">
            <button
              onClick={() => setStep("fund")}
              className="font-mono text-xs text-ink-lighter hover:text-ink"
            >
              Skip verification (agent cannot borrow without 8004 SBT)
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Delegate Identity to Agent Wallet */}
      {step === "delegate" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-xl text-ink">
            Delegate identity to agent
          </h3>
          <p className="mt-2 text-sm text-ink-light">
            Link your Self-verified identity (Agent ID #{agentId}) to your
            agent&apos;s wallet. This calls{" "}
            <span className="font-mono">setAgentWallet</span> on the Self
            registry so the agent can prove it&apos;s human-backed on-chain.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-3 rounded border border-cream-dark bg-cream px-4 py-3">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Self Agent ID</span>
                <span className="text-ink">#{agentId}</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-lighter">Agent Wallet (7702)</span>
                <span className="text-ink">
                  {agentAddress
                    ? `${agentAddress.slice(0, 6)}...${agentAddress.slice(-4)}`
                    : "—"}
                </span>
              </div>
            </div>

            <button
              onClick={handleDelegate}
              disabled={delegating || agentId == null}
              className="w-full bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {delegating ? "Delegating..." : "Delegate Identity"}
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-lighter">
            This transaction is sent from your human wallet and requires one
            on-chain confirmation.
          </p>
        </div>
      )}

      {/* Step 4: Fund Agent */}
      {step === "fund" && agentAddress && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-xl text-ink">Fund your agent</h3>
          <p className="mt-2 text-sm text-ink-light">
            Send CELO to your agent wallet. The agent will automatically swap
            CELO to USDC via Uniswap, retaining a small CELO reserve ($0.10)
            for gas fees.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Amount</label>
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
                <span className="font-mono text-xs text-ink-lighter">CELO</span>
              </div>
            </div>

            <div className="rounded border border-cream-dark bg-cream px-4 py-3">
              <p className="font-mono text-xs text-ink-lighter">
                Agent wallet
              </p>
              <p className="mt-1 font-mono text-sm text-ink break-all">
                {agentAddress}
              </p>
            </div>

            <button
              onClick={handleFund}
              disabled={
                funding || !fundAmount || parseFloat(fundAmount) <= 0
              }
              className="w-full bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {funding ? "Sending CELO..." : "Send CELO"}
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-lighter">
            The agent will bootstrap its liquidity by swapping CELO to USDC
            via Uniswap on Celo.
          </p>
        </div>
      )}

      {/* Step 5: Monitor */}
      {step === "monitor" && agentAddress && (
        <LendingDashboard
          agentAddress={agentAddress}
          humanAddress={address}
          isVerified={isVerified}
        />
      )}

      {/* Navigation */}
      {step === "monitor" && (
        <div className="flex gap-4">
          <button
            onClick={() => setStep("fund")}
            className="border border-cream-dark px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:border-ink hover:text-ink"
          >
            Back to Fund
          </button>
        </div>
      )}
    </div>
  );
}
