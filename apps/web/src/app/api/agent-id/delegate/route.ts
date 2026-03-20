import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, getAddress } from "viem";
import { celo } from "viem/chains";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";

// Self Agent Registry on Celo mainnet
const REGISTRY_ADDRESS = "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" as const;
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

const REGISTRY_ABI = [
  {
    name: "walletSetNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// EIP-712 types matching the registry's AgentWalletSet struct
const EIP712_DOMAIN = {
  name: "SelfAgentRegistry",
  version: "1",
  chainId: 42220, // Celo mainnet
  verifyingContract: REGISTRY_ADDRESS,
} as const;

const AGENT_WALLET_SET_TYPES = {
  AgentWalletSet: [
    { name: "agentId", type: "uint256" },
    { name: "newWallet", type: "address" },
    { name: "owner", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  return new PrivyClient({ appId, appSecret });
}

/**
 * POST /api/agent-id/delegate
 *
 * Signs the EIP-712 AgentWalletSet message with the Privy agent wallet (EOA),
 * so the human can submit setAgentWallet on the Self registry.
 *
 * Body: { agentId: number, walletId: string, walletAddress: string, ownerAddress: string }
 * Returns: { signature, newWallet, deadline, nonce }
 */
export async function POST(req: NextRequest) {
  try {
    const { agentId, walletId, walletAddress, ownerAddress } = await req.json();

    if (agentId == null || !walletId || !walletAddress || !ownerAddress) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, walletId, walletAddress, ownerAddress" },
        { status: 400 }
      );
    }

    const newWallet = getAddress(walletAddress);
    const owner = getAddress(ownerAddress);

    // Read current nonce from registry
    const publicClient = createPublicClient({
      chain: celo,
      transport: http(CELO_RPC_URL),
    });

    const nonce = await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "walletSetNonces",
      args: [BigInt(agentId)],
    });

    // Deadline: 1 hour from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Create Privy-backed viem account for the agent wallet
    const privy = getPrivyClient();
    const account = await createViemAccount(privy, {
      walletId,
      address: newWallet,
    });

    // Sign EIP-712 typed data with the agent's Privy wallet
    const signature = await account.signTypedData({
      domain: EIP712_DOMAIN,
      types: AGENT_WALLET_SET_TYPES,
      primaryType: "AgentWalletSet",
      message: {
        agentId: BigInt(agentId),
        newWallet,
        owner,
        nonce,
        deadline,
      },
    });

    console.log("[agent-id/delegate] Signed AgentWalletSet", {
      agentId,
      newWallet,
      owner,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    });

    return NextResponse.json({
      signature,
      newWallet,
      deadline: deadline.toString(),
      nonce: nonce.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delegation signing failed";
    console.error("[agent-id/delegate] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
