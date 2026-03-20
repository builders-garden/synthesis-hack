import { createPublicClient, createClient, http, type Hex, encodeFunctionData } from "viem";
import { entryPoint08Address } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const CANDIDE_API_KEY = process.env.CANDIDE_API_KEY || "";
const CANDIDE_BUNDLER_URL = CANDIDE_API_KEY
  ? `https://api.candide.dev/api/v3/42220/${CANDIDE_API_KEY}`
  : "https://api.candide.dev/public/v3/42220";
const CANDIDE_PAYMASTER_URL = process.env.CANDIDE_PAYMASTER_URL
  || (CANDIDE_API_KEY ? `https://api.candide.dev/api/v3/42220/${CANDIDE_API_KEY}` : "https://api.candide.dev/public/v3/42220");
const SPONSORSHIP_POLICY_ID = process.env.CANDIDE_SPONSORSHIP_POLICY_ID || "";

export async function createGaslessClient(privateKey: Hex) {
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC_URL),
  });

  const owner = privateKeyToAccount(privateKey);

  // EIP-7702: EOA address IS the smart account address
  const account = await to7702SimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: entryPoint08Address,
      version: "0.8",
    },
  });

  const paymasterClient = createClient({
    chain: celo,
    transport: http(CANDIDE_PAYMASTER_URL),
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain: celo,
    bundlerTransport: http(CANDIDE_BUNDLER_URL),
    paymaster: {
      getPaymasterData: async (userOp) => {
        const res = await paymasterClient.request({
          method: "pm_sponsorUserOperation" as any,
          params: [userOp, entryPoint08Address, { sponsorshipPolicyId: SPONSORSHIP_POLICY_ID }] as any,
        });
        return res as any;
      },
      getPaymasterStubData: async (userOp) => {
        const res = await paymasterClient.request({
          method: "pm_sponsorUserOperation" as any,
          params: [userOp, entryPoint08Address, { sponsorshipPolicyId: SPONSORSHIP_POLICY_ID }] as any,
        });
        return res as any;
      },
    },
    userOperation: {
      estimateFeesPerGas: async () => {
        const block = await publicClient.getBlock();
        const baseFee = block.baseFeePerGas ?? BigInt(5000000000);
        return {
          maxFeePerGas: baseFee * BigInt(2),
          maxPriorityFeePerGas: baseFee / BigInt(5),
        };
      },
    },
  });

  return {
    client: smartAccountClient,
    account,
    address: account.address, // Same as owner.address (7702)
  };
}

// USDC on Celo
const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const;
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function sendGaslessUSDCTransfer(
  privateKey: Hex,
  to: `0x${string}`,
  amount: bigint
) {
  const { client } = await createGaslessClient(privateKey);

  const txHash = await client.sendTransaction({
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amount],
    }),
  });

  return txHash;
}

export async function sendGaslessContractCall(
  privateKey: Hex,
  to: `0x${string}`,
  data: `0x${string}`
) {
  const { client } = await createGaslessClient(privateKey);

  const txHash = await client.sendTransaction({
    to,
    data,
  });

  return txHash;
}
