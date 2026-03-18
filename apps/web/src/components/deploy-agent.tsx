"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { SelfVerification } from "@/components/self-verification";
import { LendingDashboard } from "@/components/lending-dashboard";

const STEPS = [
  { id: "verify", label: "Verify" },
  { id: "lend-borrow", label: "Lend & Borrow" },
  { id: "monitor", label: "Monitor" },
] as const;

type Step = (typeof STEPS)[number]["id"];

export function DeployAgent() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>("verify");
  const [isVerified, setIsVerified] = useState(false);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);

  const handleVerificationSuccess = (agentAddr: string) => {
    setIsVerified(true);
    setAgentAddress(agentAddr);
    setStep("lend-borrow");
  };

  const currentIdx = STEPS.findIndex((x) => x.id === step);

  if (!address) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h3 className="font-serif text-2xl text-ink">Connect your wallet.</h3>
        <p className="mt-4 text-sm leading-relaxed text-ink-light">
          Connect your wallet to verify your identity and access the lending
          pool on Celo.
        </p>
      </div>
    );
  }

  const displayAddress = agentAddress || address;

  return (
    <div className="space-y-12">
      {/* Agent info bar */}
      {agentAddress && (
        <div className="flex items-center justify-between border-b border-cream-dark pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
              Agent ID
            </span>
            <p className="mt-1 font-mono text-sm text-ink">
              {agentAddress.slice(0, 6)}...{agentAddress.slice(-4)}
            </p>
          </div>
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
              Network
            </span>
            <p className="mt-1 font-mono text-sm text-ink">Celo</p>
          </div>
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
              Identity
            </span>
            <p className="mt-1 font-mono text-sm text-ink">
              Self (Soulbound NFT)
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

      {/* Step 1: Verify */}
      {step === "verify" && (
        <div className="mx-auto max-w-md">
          <SelfVerification
            walletAddress={address}
            onSuccess={handleVerificationSuccess}
          />

          {/* Skip verification for lending-only (optional) */}
          <div className="mt-8 border-t border-cream-dark pt-6">
            <button
              onClick={() => setStep("lend-borrow")}
              className="font-mono text-xs text-ink-lighter hover:text-ink"
            >
              Skip verification (lending only, no borrowing)
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Lend & Borrow */}
      {step === "lend-borrow" && (
        <LendingDashboard
          walletAddress={displayAddress}
          isVerified={isVerified}
        />
      )}

      {/* Step 3: Monitor */}
      {step === "monitor" && (
        <LendingDashboard
          walletAddress={displayAddress}
          isVerified={isVerified}
        />
      )}

      {/* Navigation */}
      {step === "lend-borrow" && (
        <div className="flex gap-4">
          <button
            onClick={() => setStep("verify")}
            className="border border-cream-dark px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:border-ink hover:text-ink"
          >
            Back to Verify
          </button>
          <button
            onClick={() => setStep("monitor")}
            className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
          >
            View Monitor
          </button>
        </div>
      )}
    </div>
  );
}
