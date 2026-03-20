import { createPublicClient, http } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

function log(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    component: "smart-account",
    msg,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function getPimlicoUrl() {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    throw new Error("PIMLICO_API_KEY is not set");
  }
  return `https://api.pimlico.io/v2/celo/rpc?apikey=${apiKey}`;
}

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  return new PrivyClient({ appId, appSecret });
}

/**
 * Create a gasless smart account client using a Privy server wallet.
 * The Privy wallet signs via Privy's API (no private key needed locally).
 * Pimlico sponsors all gas fees on Celo.
 */
export async function createGaslessClient(walletId: string, walletAddress: string) {
  log("info", "Creating gasless smart account client", { walletId, walletAddress });

  const pimlicoUrl = getPimlicoUrl();
  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch (err: any) {
    log("error", "Failed to initialize Privy client", { error: err.message });
    throw err;
  }

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

  // Create a viem-compatible account backed by Privy's signing API
  let owner;
  try {
    owner = await createViemAccount(privy, {
      walletId,
      address: walletAddress as `0x${string}`,
    });
    log("info", "Privy viem account created", { walletId });
  } catch (err: any) {
    log("error", "Failed to create Privy viem account", {
      walletId,
      walletAddress,
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }

  let account;
  try {
    account = await toSafeSmartAccount({
      client: publicClient,
      owners: [owner],
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
      version: "1.4.1",
    });
    log("info", "Safe smart account initialized", { smartAccountAddress: account.address });
  } catch (err: any) {
    log("error", "Failed to initialize Safe smart account", {
      walletId,
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }

  const smartAccountClient = createSmartAccountClient({
    account,
    chain: celo,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        try {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        } catch (err: any) {
          log("error", "Failed to estimate gas price from Pimlico", {
            error: err.message,
            stack: err.stack,
          });
          throw err;
        }
      },
    },
  });

  log("info", "Gasless smart account client ready", { smartAccountAddress: account.address });

  return {
    client: smartAccountClient,
    account,
    address: account.address,
  };
}

/**
 * Send a gasless contract call via the Pimlico paymaster on Celo.
 * The agent never pays gas — Pimlico sponsors the UserOperation.
 * Signing is handled by Privy's server wallet API.
 */
export async function sendGaslessContractCall(
  walletId: string,
  walletAddress: string,
  to: `0x${string}`,
  data: `0x${string}`,
  value?: bigint
) {
  log("info", "Sending gasless contract call", {
    walletId,
    to,
    dataLength: data.length,
    value: value?.toString(),
  });

  let client;
  try {
    ({ client } = await createGaslessClient(walletId, walletAddress));
  } catch (err: any) {
    log("error", "Failed to create gasless client for contract call", {
      walletId,
      to,
      error: err.message,
    });
    throw err;
  }

  try {
    const txHash = await client.sendTransaction({
      to,
      data,
      value,
    });
    log("info", "Contract call transaction sent", { txHash, to });
    return txHash;
  } catch (err: any) {
    log("error", "Contract call transaction failed", {
      walletId,
      to,
      dataLength: data.length,
      value: value?.toString(),
      error: err.message,
      stack: err.stack,
      // Include Pimlico/bundler error details if present
      ...(err.details && { details: err.details }),
      ...(err.cause && { cause: String(err.cause) }),
    });
    throw err;
  }
}

/**
 * Send a gasless native CELO transfer via the Pimlico paymaster.
 */
export async function sendGaslessTransfer(
  walletId: string,
  walletAddress: string,
  to: `0x${string}`,
  value: bigint
) {
  log("info", "Sending gasless CELO transfer", {
    walletId,
    to,
    value: value.toString(),
  });

  let client;
  try {
    ({ client } = await createGaslessClient(walletId, walletAddress));
  } catch (err: any) {
    log("error", "Failed to create gasless client for transfer", {
      walletId,
      to,
      error: err.message,
    });
    throw err;
  }

  try {
    const txHash = await client.sendTransaction({
      to,
      value,
    });
    log("info", "CELO transfer transaction sent", { txHash, to, value: value.toString() });
    return txHash;
  } catch (err: any) {
    log("error", "CELO transfer transaction failed", {
      walletId,
      to,
      value: value.toString(),
      error: err.message,
      stack: err.stack,
      ...(err.details && { details: err.details }),
      ...(err.cause && { cause: String(err.cause) }),
    });
    throw err;
  }
}
