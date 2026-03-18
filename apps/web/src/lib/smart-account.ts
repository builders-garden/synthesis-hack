import { createPublicClient, http, type Hex, encodeFunctionData } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

function getPimlicoUrl() {
  if (!PIMLICO_API_KEY) {
    throw new Error("PIMLICO_API_KEY is not set");
  }
  return `https://api.pimlico.io/v2/celo/rpc?apikey=${PIMLICO_API_KEY}`;
}

export async function createGaslessClient(privateKey: Hex) {
  const pimlicoUrl = getPimlicoUrl();

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC_URL),
  });

  const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  const owner = privateKeyToAccount(privateKey);

  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
    version: "1.4.1",
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain: celo,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  return {
    client: smartAccountClient,
    account,
    address: account.address,
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
