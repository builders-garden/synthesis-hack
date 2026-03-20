import { createPublicClient, createClient, http } from "viem";
import { entryPoint08Address } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";
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

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  return new PrivyClient({ appId, appSecret });
}

/**
 * Create a gasless EIP-7702 smart account client using a Privy server wallet.
 * The Privy EOA gets 7702 delegation — same address acts as both EOA and smart account.
 * Candide bundles and sponsors gas on Celo via EntryPoint v0.8.
 */
export async function createGaslessClient(walletId: string, walletAddress: string) {
  log("info", "Creating 7702 gasless smart account client", { walletId, walletAddress });

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

  // EIP-7702: EOA address IS the smart account address
  let account;
  try {
    account = await to7702SimpleSmartAccount({
      client: publicClient,
      owner,
      entryPoint: {
        address: entryPoint08Address,
        version: "0.8",
      },
    });
    log("info", "7702 smart account initialized", { address: account.address });
  } catch (err: any) {
    log("error", "Failed to initialize 7702 smart account", {
      walletId,
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }

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

  log("info", "7702 gasless smart account client ready", { address: account.address });

  return {
    client: smartAccountClient,
    account,
    address: account.address, // Same as walletAddress (7702)
  };
}

/**
 * Send a gasless contract call via Candide paymaster on Celo.
 * The agent never pays gas — Candide sponsors the UserOperation.
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
      ...(err.details && { details: err.details }),
      ...(err.cause && { cause: String(err.cause) }),
    });
    throw err;
  }
}

/**
 * Send a gasless native CELO transfer via the Candide paymaster.
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
