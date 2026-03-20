"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface SelfVerificationProps {
  walletAddress: string;
  onSuccess: (agentAddress: string, agentId?: number) => void;
}

interface RegistrationResponse {
  sessionKey: string;
  deepLink: string;
  agentAddress: string;
  expiresAt: string;
  stage: string;
  humanInstructions: string[];
}

export function SelfVerification({
  walletAddress,
  onSuccess,
}: SelfVerificationProps) {
  const [session, setSession] = useState<RegistrationResponse | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Start registration
  const startRegistration = useCallback(async () => {
    if (!walletAddress) return;

    setStatus("registering");
    setError(null);

    try {
      const res = await fetch("/api/agent-id/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          humanAddress: walletAddress,
          agentName: "OpenClaw Lending Agent",
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSession(data);
      setStatus("waiting");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
      setStatus("error");
    }
  }, [walletAddress]);

  // Auto-start registration on mount
  useEffect(() => {
    if (walletAddress && status === "idle") {
      startRegistration();
    }
  }, [walletAddress, status, startRegistration]);

  // Poll for completion — uses server-side session tracking with rolling tokens
  useEffect(() => {
    if (status !== "waiting" || !session) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/agent-id/register?key=${encodeURIComponent(session.sessionKey)}`
        );
        const data = await res.json();

        if (data.stage === "completed") {
          setStatus("verified");
          if (pollingRef.current) clearInterval(pollingRef.current);
          onSuccess(data.agentAddress || session.agentAddress, data.agentId);
        } else if (data.stage === "failed") {
          setStatus("error");
          setError(data.error || "Registration failed");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Keep polling on transient errors
      }
    };

    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, session, onSuccess]);

  if (status === "idle" || status === "registering") {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="font-serif text-2xl text-ink">
            Registering agent identity...
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            Creating a Self Agent ID linked to your wallet. This proves your
            agent is backed by a verified human.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="h-1 w-48 overflow-hidden rounded bg-cream-dark">
            <div className="h-full w-1/3 animate-pulse rounded bg-ink/30" />
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="font-serif text-2xl text-ink">
            Registration failed.
          </h3>
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        </div>
        <button
          onClick={() => {
            setStatus("idle");
            setSession(null);
            setError(null);
          }}
          className="bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="font-serif text-2xl text-ink">Identity verified.</h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-light">
            Your agent has a Self Agent ID on Celo. It can now operate as a
            verified, human-backed agent in the lending pool.
          </p>
        </div>
        <div className="space-y-3 border-t border-cream-dark pt-6">
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Agent Address</span>
            <span className="text-ink">
              {session?.agentAddress.slice(0, 6)}...
              {session?.agentAddress.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Status</span>
            <span className="text-ink">Verified (Soulbound NFT)</span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Network</span>
            <span className="text-ink">Celo Mainnet</span>
          </div>
        </div>
      </div>
    );
  }

  // status === "waiting" — show QR code
  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-serif text-2xl text-ink">
          Verify your identity.
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-ink-light">
          Scan the QR code with the Self app to link your passport to your
          agent. This creates a soulbound NFT on Celo proving your agent is
          human-backed.
        </p>
      </div>

      {session?.deepLink && (
        <div className="flex justify-center">
          <div className="rounded-lg border border-cream-dark bg-white p-6">
            <QRCodeSVG value={session.deepLink} size={280} />
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-cream-dark pt-6">
        {session?.humanInstructions?.map((instruction, i) => (
          <div key={i} className="flex gap-4">
            <span className="font-mono text-sm text-ink-lighter">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm text-ink">{instruction}</span>
          </div>
        )) || (
          <>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">01</span>
              <span className="text-sm text-ink">
                Open the Self app on your phone
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">02</span>
              <span className="text-sm text-ink">
                Scan the QR code above
              </span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-sm text-ink-lighter">03</span>
              <span className="text-sm text-ink">
                Verify with your passport
              </span>
            </div>
          </>
        )}
      </div>

      {session?.agentAddress && (
        <div className="space-y-3 border-t border-cream-dark pt-6">
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Agent Address</span>
            <span className="text-ink">
              {session.agentAddress.slice(0, 6)}...
              {session.agentAddress.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Status</span>
            <span className="text-ink">Waiting for verification...</span>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-lighter">
        Powered by Self Agent ID (ERC-8004). Zero-knowledge passport
        verification — your personal data never leaves your device.
      </p>
    </div>
  );
}
