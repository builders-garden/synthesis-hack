"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { SelfVerification } from "@/components/self-verification";
import { LendingDashboard } from "@/components/lending-dashboard";
import { AgentMetadataForm } from "@/components/agent-metadata-form";
import dynamic from "next/dynamic";
import type { WidgetConfig } from "@lifi/widget";

const LiFiWidgetWrapper = dynamic(
  () => import("@/components/lifi-widget-wrapper"),
  { ssr: false }
);

// USDC on Celo
const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

// Self Agent Registry (ERC-8004) on Celo mainnet
const REGISTRY_ADDRESS =
  "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" as const;

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

// Wallet-check registry (proxy with getAgentWallet)
const WALLET_REGISTRY_ADDRESS =
  "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" as const;

const WALLET_REGISTRY_ABI = [
  {
    name: "getAgentWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const celoClient = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

const STEPS = [
  { id: "deploy", label: "Deploy Agent" },
  { id: "telegram", label: "Telegram" },
  { id: "verify", label: "Verify Identity" },
  { id: "metadata", label: "Set Metadata" },
  { id: "delegate", label: "Delegate" },
  { id: "monitor", label: "Monitor" },
] as const;

// --- localStorage persistence helpers ---
interface DeployedAgentData {
  agentName: string;
  agentAddress: string;
  walletId: string;
  serviceId: string;
  environmentId: string;
  agentId?: number;
  isVerified?: boolean;
  isDelegated?: boolean;
  telegramBotToken?: string;
  telegramUserId?: string;
}

const STORAGE_KEY_PREFIX = "openclaw_deployed_agent_";

function getStorageKey(walletAddress: string) {
  return `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
}

function saveDeployedAgent(walletAddress: string, data: DeployedAgentData) {
  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(data));
  } catch {}
}

function loadDeployedAgent(
  walletAddress: string
): DeployedAgentData | null {
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type Step = (typeof STEPS)[number]["id"];

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

export function DeployAgent() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [step, setStep] = useState<Step>("deploy");
  const [isVerified, setIsVerified] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [showFundWidget, setShowFundWidget] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  // Restore deployed agent from localStorage on wallet connect
  useEffect(() => {
    if (!address) return;
    const saved = loadDeployedAgent(address);
    if (!saved) return;

    setAgentName(saved.agentName);
    setAgentAddress(saved.agentAddress);
    setWalletId(saved.walletId);
    setServiceId(saved.serviceId);
    setEnvironmentId(saved.environmentId);
    if (saved.agentId != null) setAgentId(saved.agentId);
    if (saved.isVerified) setIsVerified(true);
    if (saved.isDelegated) setIsDelegated(true);
    if (saved.telegramBotToken) setTelegramBotToken(saved.telegramBotToken);
    if (saved.telegramUserId) setTelegramUserId(saved.telegramUserId);

    // Check if the agent still has a wallet on the registry
    if (saved.agentId != null) {
      celoClient
        .readContract({
          address: WALLET_REGISTRY_ADDRESS,
          abi: WALLET_REGISTRY_ABI,
          functionName: "getAgentWallet",
          args: [BigInt(saved.agentId)],
        })
        .then((wallet) => {
          if (
            !wallet ||
            wallet === "0x0000000000000000000000000000000000000000"
          ) {
            // Wallet was unset — need to re-verify and re-delegate
            setIsDelegated(false);
            setStep("verify");
          } else {
            setStep("monitor");
          }
        })
        .catch(() => {
          // If query fails, default to monitor
          setStep("monitor");
        });
    } else {
      setStep("monitor");
    }
  }, [address]);

  // Persist current agent state to localStorage
  const persistAgent = useCallback(
    (overrides?: Partial<DeployedAgentData>) => {
      if (!address || !agentAddress || !walletId || !serviceId || !environmentId)
        return;
      saveDeployedAgent(address, {
        agentName,
        agentAddress,
        walletId,
        serviceId,
        environmentId,
        agentId: agentId ?? undefined,
        isVerified,
        isDelegated,
        telegramBotToken: telegramBotToken || undefined,
        telegramUserId: telegramUserId || undefined,
        ...overrides,
      });
    },
    [address, agentName, agentAddress, walletId, serviceId, environmentId, agentId, isVerified, isDelegated, telegramBotToken, telegramUserId]
  );

  // LI.FI widget config — fixed destination: USDC on Celo to agent wallet
  const lifiConfig: WidgetConfig = useMemo(
    () => ({
      integrator: "openclaw-lending",
      toChain: 42220,
      toToken: CELO_USDC,
      toAddress: {
        address: agentAddress || "",
        chainType: "EVM" as any,
      },
      // Lock destination: only Celo allowed as target chain, only USDC as target token
      chains: {
        to: { allow: [42220] },
      },
      tokens: {
        to: {
          allow: [{ chainId: 42220, address: CELO_USDC }],
        },
      },
      hiddenUI: ["toAddress", "toToken"],
      theme: {
        container: {
          border: "1px solid rgb(220, 215, 206)",
          borderRadius: "0px",
        },
      },
    }),
    [agentAddress]
  );

  const handleDeploy = async () => {
    if (!agentName.trim()) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const res = await fetch("/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: agentName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error.includes("already exists")) {
          setDeployError(
            `Name "${agentName.trim()}" is taken — try a different name.`
          );
        } else {
          setDeployError(data.error);
        }
        return;
      }

      setWalletId(data.walletId);
      setServiceId(data.serviceId);
      setEnvironmentId(data.environmentId);
      setAgentAddress(data.walletAddress);
      // Persist immediately after deploy
      if (address) {
        saveDeployedAgent(address, {
          agentName: agentName.trim(),
          agentAddress: data.walletAddress,
          walletId: data.walletId,
          serviceId: data.serviceId,
          environmentId: data.environmentId,
        });
      }
      setStep("telegram");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed";
      setDeployError(msg);
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
    persistAgent({ isVerified: true, agentId: selfAgentId ?? undefined });
    setStep("metadata");
  };

  const handleMetadataSuccess = () => {
    setStep("delegate");
  };

  const handleDelegate = async () => {
    if (!address || agentId == null || !walletId || !agentAddress) return;
    setDelegating(true);
    try {
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

      // Ensure wallet is on Celo
      await switchChainAsync({ chainId: celo.id });
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setAgentWallet",
        chainId: celo.id,
        args: [
          BigInt(agentId),
          data.newWallet as `0x${string}`,
          BigInt(data.deadline),
          data.signature as `0x${string}`,
        ],
      });

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
      persistAgent({ isDelegated: true });
      setStep("monitor");
    } catch (err) {
      console.error("Delegation failed:", err);
    } finally {
      setDelegating(false);
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
            <button
              onClick={() => navigator.clipboard.writeText(agentAddress)}
              title="Copy to clipboard"
              className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink hover:text-ink-light transition-colors cursor-pointer"
            >
              {agentAddress.slice(0, 6)}...{agentAddress.slice(-4)}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
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

            {deployError && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {deployError}
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-ink-lighter">
            Human wallet: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
      )}

      {/* Step 2: Telegram Configuration */}
      {step === "telegram" && (
        <div className="mx-auto max-w-md">
          <h3 className="font-serif text-xl text-ink">
            Connect Telegram
          </h3>
          <p className="mt-2 text-sm text-ink-light">
            Link a Telegram bot so you can chat with your agent directly.
            Create a bot via{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-ink"
            >
              @BotFather
            </a>{" "}
            and paste the token below.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Bot Token</label>
              <input
                type="text"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Your Telegram User ID</label>
              <input
                type="text"
                value={telegramUserId}
                onChange={(e) => setTelegramUserId(e.target.value)}
                placeholder="123456789"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ink-lighter">
                Send /start to{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-ink-light"
                >
                  @userinfobot
                </a>{" "}
                to get your ID.
              </p>
            </div>

            <button
              onClick={async () => {
                if (!telegramBotToken.trim() || !telegramUserId.trim()) return;
                setSavingTelegram(true);
                try {
                  await fetch("/api/agent/set-env", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      serviceId,
                      environmentId,
                      vars: {
                        TELEGRAM_BOT_TOKEN: telegramBotToken.trim(),
                        TELEGRAM_ALLOWED_USERS: telegramUserId.trim(),
                      },
                    }),
                  });
                  persistAgent({
                    telegramBotToken: telegramBotToken.trim(),
                    telegramUserId: telegramUserId.trim(),
                  });
                  setStep("verify");
                } catch (err) {
                  console.error("Failed to set Telegram env vars:", err);
                } finally {
                  setSavingTelegram(false);
                }
              }}
              disabled={
                savingTelegram ||
                !telegramBotToken.trim() ||
                !telegramUserId.trim()
              }
              className="w-full bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {savingTelegram ? "Saving..." : "Save & Continue"}
            </button>
          </div>

          <div className="mt-8 border-t border-cream-dark pt-6">
            <button
              onClick={() => setStep("verify")}
              className="font-mono text-xs text-ink-lighter hover:text-ink"
            >
              Skip (can be configured later)
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Verify Identity */}
      {step === "verify" && (
        <div className="mx-auto max-w-md">
          <SelfVerification
            walletAddress={address}
            onSuccess={handleVerificationSuccess}
          />

          <div className="mt-8 border-t border-cream-dark pt-6">
            <button
              onClick={() => setStep("monitor")}
              className="font-mono text-xs text-ink-lighter hover:text-ink"
            >
              Skip verification (agent cannot borrow without 8004 SBT)
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Set Metadata */}
      {step === "metadata" && agentId != null && (
        <div>
          <AgentMetadataForm
            agentId={agentId}
            agentName={agentName || "OpenClaw Lending Agent"}
            onSuccess={handleMetadataSuccess}
          />
          <div className="mx-auto mt-6 max-w-md border-t border-cream-dark pt-4">
            <button
              onClick={() => setStep("delegate")}
              className="font-mono text-xs text-ink-lighter hover:text-ink"
            >
              Skip metadata (can be set later)
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Delegate Identity to Agent Wallet */}
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

      {/* Step 6: Monitor + Fund */}
      {step === "monitor" && agentAddress && (
        <>
          {/* Fund agent section — always visible at top */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl text-ink">
                  Fund your agent
                </h3>
                <p className="mt-1 text-sm text-ink-light">
                  Send USDC from any chain to your agent wallet on Celo.
                </p>
              </div>
              <button
                onClick={() => setShowFundWidget(!showFundWidget)}
                className="border border-cream-dark px-6 py-3 font-mono text-sm uppercase tracking-wider text-ink transition-colors hover:border-ink"
              >
                {showFundWidget ? "Hide" : "Fund Agent"}
              </button>
            </div>

            {showFundWidget && (
              <div className="mt-6">
                <LiFiWidgetWrapper {...lifiConfig} />
              </div>
            )}
          </div>

          <div className="border-t border-cream-dark pt-8">
            <LendingDashboard
              agentAddress={agentAddress}
              humanAddress={address}
              isVerified={isVerified}
              onVerify={() => setStep("verify")}
            />
          </div>
        </>
      )}
    </div>
  );
}
