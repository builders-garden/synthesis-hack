"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { celo } from "viem/chains";
import { createWalletClient, createPublicClient, custom } from "viem";

// Self Agent Registry (ERC-8004) on Celo mainnet
const REGISTRY_ADDRESS =
  "0x62E37d0f6c5f67784b8828B3dF68BCDbB2e55095" as const;

const REGISTRY_ABI = [
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
] as const;

interface ServiceEntry {
  name: string;
  endpoint: string;
  version?: string;
}

interface AgentMetadataFormProps {
  agentId: number;
  agentName: string;
  onSuccess: () => void;
}

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

async function uploadToArweave(metadata: Record<string, unknown>): Promise<string> {
  const { WebUploader } = await import("@irys/web-upload");
  const { WebEthereum } = await import("@irys/web-upload-ethereum");
  const { ViemV2Adapter } = await import("@irys/web-upload-ethereum-viem-v2");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = (window as any).ethereum;
  if (!provider) throw new Error("No wallet provider found");

  const [account] = await provider.request({
    method: "eth_requestAccounts",
  });

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: custom(provider),
  });

  const publicClient = createPublicClient({
    chain: celo,
    transport: custom(provider),
  });

  // Cast to any to work around viem version mismatch between Irys and project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const irysUploader = await WebUploader(WebEthereum).withAdapter(
    ViemV2Adapter(walletClient as any, { publicClient: publicClient as any })
  );

  const data = JSON.stringify(metadata);
  const tags = [{ name: "Content-Type", value: "application/json" }];
  const receipt = await irysUploader.upload(data, { tags });

  return `https://gateway.irys.xyz/${receipt.id}`;
}

export function AgentMetadataForm({
  agentId,
  agentName,
  onSuccess,
}: AgentMetadataFormProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [description, setDescription] = useState("");
  const [x402Support, setX402Support] = useState(false);
  const [services, setServices] = useState<ServiceEntry[]>([
    { name: "web", endpoint: "" },
  ]);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arweaveUrl, setArweaveUrl] = useState<string | null>(null);

  const addService = () => {
    setServices([...services, { name: "", endpoint: "" }]);
  };

  const removeService = (idx: number) => {
    setServices(services.filter((_, i) => i !== idx));
  };

  const updateService = (
    idx: number,
    field: keyof ServiceEntry,
    value: string
  ) => {
    setServices(
      services.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async () => {
    if (!address || !description.trim()) return;
    setUploading(true);
    setError(null);

    try {
      // Build EIP-8004 compliant metadata
      const validServices = services.filter(
        (s) => s.name.trim() && s.endpoint.trim()
      );

      const metadata = {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        name: agentName,
        description: description.trim(),
        services: validServices.map((s) => {
          const entry: Record<string, string> = {
            name: s.name,
            endpoint: s.endpoint,
          };
          if (s.version?.trim()) entry.version = s.version.trim();
          return entry;
        }),
        x402Support,
        active: true,
        registrations: [
          {
            agentId,
            agentRegistry: `eip155:42220:${REGISTRY_ADDRESS}`,
          },
        ],
        supportedTrust: ["reputation"],
      };

      // Upload to Arweave via Irys (free < 100KiB)
      const uri = await uploadToArweave(metadata);
      setArweaveUrl(uri);

      // Call setAgentURI on registry
      await switchChainAsync({ chainId: celo.id });
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setAgentURI",
        chainId: celo.id,
        args: [BigInt(agentId), uri],
      });

      onSuccess();
    } catch (err) {
      console.error("Metadata upload failed:", err);
      setError(err instanceof Error ? err.message : "Failed to set metadata");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h3 className="font-serif text-xl text-ink">Set agent metadata</h3>
      <p className="mt-2 text-sm text-ink-light">
        Define your agent&apos;s on-chain profile following the EIP-8004
        standard. Metadata is stored permanently on Arweave (free under 100KB).
      </p>

      <div className="mt-6 space-y-5">
        {/* Name — read-only, from deploy step */}
        <div>
          <label className={labelClass}>Name</label>
          <p className="mt-1 font-mono text-sm text-ink">{agentName}</p>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A natural language description of what your agent does, how it works, and how to interact with it."
            rows={3}
            className={`${inputClass} resize-none border border-cream-dark rounded px-3 py-2`}
          />
        </div>

        {/* Services */}
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Services</label>
            <button
              type="button"
              onClick={addService}
              className="font-mono text-xs text-ink-lighter hover:text-ink"
            >
              + Add service
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded border border-cream-dark p-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={svc.name}
                    onChange={(e) => updateService(idx, "name", e.target.value)}
                    placeholder="e.g. web, A2A, MCP"
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="text"
                    value={svc.version || ""}
                    onChange={(e) =>
                      updateService(idx, "version", e.target.value)
                    }
                    placeholder="version"
                    className={`${inputClass} w-24`}
                  />
                  {services.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeService(idx)}
                      className="font-mono text-xs text-ink-lighter hover:text-ink"
                    >
                      x
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={svc.endpoint}
                  onChange={(e) =>
                    updateService(idx, "endpoint", e.target.value)
                  }
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        {/* x402 Support */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setX402Support(!x402Support)}
            className={`h-5 w-5 flex-shrink-0 border transition-colors ${
              x402Support
                ? "border-ink bg-ink"
                : "border-cream-dark bg-transparent"
            }`}
          >
            {x402Support && (
              <svg
                viewBox="0 0 12 12"
                className="h-full w-full text-cream"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </button>
          <div>
            <span className={labelClass}>x402 Payment Support</span>
            <p className="text-xs text-ink-lighter">
              Enable HTTP 402-based payment protocol for this agent
            </p>
          </div>
        </div>

        {/* Auto-filled fields (read-only display) */}
        <div className="space-y-3 rounded border border-cream-dark bg-cream px-4 py-3">
          <p className={`${labelClass} mb-2`}>Auto-filled</p>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Registration</span>
            <span className="text-ink">
              eip155:42220:{REGISTRY_ADDRESS.slice(0, 6)}...
              {REGISTRY_ADDRESS.slice(-4)} #{agentId}
            </span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Trust</span>
            <span className="text-ink">reputation</span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-lighter">Storage</span>
            <span className="text-ink">Arweave (via Irys)</span>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {arweaveUrl && !error && (
          <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Uploaded to{" "}
            <a
              href={arweaveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Arweave
            </a>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading || !description.trim()}
          className="w-full bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
        >
          {uploading
            ? "Uploading & setting URI..."
            : "Upload Metadata & Set URI"}
        </button>
      </div>

      <p className="mt-4 text-xs text-ink-lighter">
        This uploads your EIP-8004 metadata JSON to Arweave, then calls{" "}
        <span className="font-mono">setAgentURI</span> on the Self registry
        from your connected wallet.
      </p>
    </div>
  );
}
