"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useSwitchChain, useReadContract } from "wagmi";
import { celo } from "viem/chains";
import { Header } from "@/components/header";

const REGISTRY_ADDRESS =
  "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" as const;

const REGISTRY_ABI = [
  {
    name: "unsetAgentWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getAgentWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [agentId, setAgentId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: agentWallet, refetch: refetchWallet, isFetching: lookingUp } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getAgentWallet",
    chainId: celo.id,
    args: lookupId ? [BigInt(lookupId)] : undefined,
    query: { enabled: false },
  });

  const handleUnset = async () => {
    if (!agentId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      await switchChainAsync({ chainId: celo.id });
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "unsetAgentWallet",
        chainId: celo.id,
        args: [BigInt(agentId.trim())],
      });
      setResult(`Transaction sent: ${hash}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main className="mx-auto max-w-md px-6 py-12">
        <h2 className="font-serif text-3xl font-bold text-ink">Admin</h2>
        <p className="mt-2 text-sm text-ink-light">
          Manage Self Agent Registry entries.
        </p>

        {!isConnected ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-ink-light">
              Connect your wallet to continue.
            </p>
            <div className="mt-4">
              <appkit-button />
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="font-serif text-xl text-ink">
                Unset Agent Wallet
              </h3>
              <p className="mt-2 text-sm text-ink-light">
                Remove the wallet delegation for an agent ID on the Self
                registry. Only the agent owner can call this.
              </p>
            </div>

            <div>
              <label className={labelClass}>Agent ID</label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="e.g. 42"
                className={inputClass}
              />
            </div>

            <button
              onClick={handleUnset}
              disabled={loading || !agentId.trim()}
              className="w-full bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {loading ? "Sending..." : "Unset Agent Wallet"}
            </button>

            {result && (
              <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 break-all">
                {result}
              </div>
            )}

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 break-all">
                {error}
              </div>
            )}

            {/* Lookup Agent Wallet */}
            <div className="border-t border-cream-dark pt-8">
              <h3 className="font-serif text-xl text-ink">
                Lookup Agent Wallet
              </h3>
              <p className="mt-2 text-sm text-ink-light">
                Query the wallet address delegated to an agent ID.
              </p>
            </div>

            <div>
              <label className={labelClass}>Agent ID</label>
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder="e.g. 42"
                className={inputClass}
              />
            </div>

            <button
              onClick={() => refetchWallet()}
              disabled={lookingUp || !lookupId.trim()}
              className="w-full border border-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-ink transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {lookingUp ? "Loading..." : "Lookup"}
            </button>

            {agentWallet !== undefined && (
              <div className="rounded border border-cream-dark bg-cream px-4 py-3">
                <span className={labelClass}>Wallet</span>
                <p className="mt-1 font-mono text-sm text-ink break-all">
                  {agentWallet === "0x0000000000000000000000000000000000000000"
                    ? "No wallet set"
                    : agentWallet}
                </p>
              </div>
            )}

            <p className="text-xs text-ink-lighter">
              Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
