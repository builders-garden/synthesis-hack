import { createPublicClient, http, type Hex, encodeFunctionData } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

function getPimlicoUrl() {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    throw new Error("PIMLICO_API_KEY is not set");
  }
  return `https://api.pimlico.io/v2/celo/rpc?apikey=${apiKey}`;
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

/**
 * Send a gasless contract call via the Pimlico paymaster on Celo.
 * The agent never pays gas — Pimlico sponsors the UserOperation.
 */
export async function sendGaslessContractCall(
  privateKey: Hex,
  to: `0x${string}`,
  data: `0x${string}`,
  value?: bigint
) {
  const { client } = await createGaslessClient(privateKey);

  const txHash = await client.sendTransaction({
    to,
    data,
    value,
  });

  return txHash;
}

/**
 * Send a gasless native CELO transfer via the Pimlico paymaster.
 */
export async function sendGaslessTransfer(
  privateKey: Hex,
  to: `0x${string}`,
  value: bigint
) {
  const { client } = await createGaslessClient(privateKey);

  const txHash = await client.sendTransaction({
    to,
    value,
  });

  return txHash;
}
