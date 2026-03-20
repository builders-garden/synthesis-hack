import { createPublicClient, http, encodeFunctionData } from "viem";
import { entryPoint08Address, getUserOperationHash } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const CANDIDE_API_KEY = process.env.CANDIDE_API_KEY || "";
const CANDIDE_URL = CANDIDE_API_KEY
  ? `https://api.candide.dev/api/v3/42220/${CANDIDE_API_KEY}`
  : "https://api.candide.dev/public/v3/42220";
const SPONSORSHIP_POLICY_ID = process.env.CANDIDE_SPONSORSHIP_POLICY_ID || "";

// SimpleAccount v0.8 implementation (deployed on Celo, works with EP v0.8 + 7702)
const SIMPLE_ACCOUNT_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

// SimpleAccount.execute(address dest, uint256 value, bytes calldata func)
const EXECUTE_ABI = [{
  name: "execute",
  type: "function",
  inputs: [
    { name: "dest", type: "address" },
    { name: "value", type: "uint256" },
    { name: "func", type: "bytes" },
  ],
  outputs: [],
}] as const;

function log(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, component: "smart-account", msg, ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

const h = (v: bigint | number) => "0x" + BigInt(v).toString(16);

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  return new PrivyClient({ appId, appSecret });
}

async function candideRpc(method: string, params: any[]) {
  const res = await fetch(CANDIDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: Date.now() }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${method}: ${data.error.message}`);
  return data.result;
}

/**
 * Send a gasless EIP-7702 UserOperation via Candide on Celo.
 *
 * Flow:
 * 1. Sign 7702 authorization (Privy EOA → SimpleAccount delegation)
 * 2. Build UserOp with callData
 * 3. Get Candide sponsorship (pm_sponsorUserOperation)
 * 4. Sign UserOp hash with raw secp256k1 (no EIP-191 prefix)
 * 5. Submit via eth_sendUserOperation
 *
 * The Privy EOA address IS the smart account address (7702).
 */
async function sendUserOp(
  walletId: string,
  walletAddress: `0x${string}`,
  callData: `0x${string}`,
) {
  const privy = getPrivyClient();
  const account = await createViemAccount(privy, { walletId, address: walletAddress });
  const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC_URL) });

  // 1. Sign 7702 authorization
  const txNonce = await publicClient.getTransactionCount({ address: walletAddress });
  const auth = await account.signAuthorization!({
    address: SIMPLE_ACCOUNT_IMPL,
    chainId: celo.id,
    nonce: txNonce,
  }) as any;

  const eip7702Auth = {
    chainId: h(auth.chainId),
    address: auth.address,
    nonce: h(auth.nonce),
    yParity: h(auth.yParity),
    r: auth.r,
    s: auth.s,
  };

  // 2. Build base UserOp
  const epNonce = await publicClient.readContract({
    address: entryPoint08Address,
    abi: [{ name: "getNonce", type: "function", stateMutability: "view", inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "getNonce",
    args: [walletAddress, BigInt(0)],
  });

  const block = await publicClient.getBlock();
  const baseFee = block.baseFeePerGas ?? BigInt(5000000000);
  const dummySig = await account.signMessage({ message: "7702-estimation" });

  const userOp: any = {
    sender: walletAddress,
    nonce: h(epNonce),
    callData,
    callGasLimit: h(100000),
    verificationGasLimit: h(500000),
    preVerificationGas: h(100000),
    maxFeePerGas: h(baseFee * BigInt(2)),
    maxPriorityFeePerGas: h(baseFee / BigInt(5)),
    signature: dummySig,
    eip7702Auth,
  };

  // 3. Get Candide sponsorship
  const sponsor = await candideRpc("pm_sponsorUserOperation", [
    userOp, entryPoint08Address, { sponsorshipPolicyId: SPONSORSHIP_POLICY_ID },
  ]);

  userOp.paymaster = sponsor.paymaster;
  userOp.paymasterData = sponsor.paymasterData;
  userOp.paymasterVerificationGasLimit = sponsor.paymasterVerificationGasLimit;
  userOp.paymasterPostOpGasLimit = sponsor.paymasterPostOpGasLimit;
  if (sponsor.callGasLimit) userOp.callGasLimit = sponsor.callGasLimit;
  if (sponsor.verificationGasLimit) userOp.verificationGasLimit = sponsor.verificationGasLimit;
  if (sponsor.preVerificationGas) userOp.preVerificationGas = sponsor.preVerificationGas;
  if (sponsor.maxFeePerGas) userOp.maxFeePerGas = sponsor.maxFeePerGas;
  if (sponsor.maxPriorityFeePerGas) userOp.maxPriorityFeePerGas = sponsor.maxPriorityFeePerGas;

  // 4. Compute hash and sign with raw secp256k1 (SimpleAccount uses raw ECDSA)
  const opHash = getUserOperationHash({
    userOperation: {
      sender: walletAddress,
      nonce: BigInt(userOp.nonce),
      callData: userOp.callData,
      callGasLimit: BigInt(userOp.callGasLimit),
      verificationGasLimit: BigInt(userOp.verificationGasLimit),
      preVerificationGas: BigInt(userOp.preVerificationGas),
      maxFeePerGas: BigInt(userOp.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
      paymaster: userOp.paymaster,
      paymasterData: userOp.paymasterData || "0x",
      paymasterVerificationGasLimit: BigInt(userOp.paymasterVerificationGasLimit || "0x0"),
      paymasterPostOpGasLimit: BigInt(userOp.paymasterPostOpGasLimit || "0x0"),
      signature: "0x",
    },
    entryPointAddress: entryPoint08Address,
    entryPointVersion: "0.8",
    chainId: celo.id,
  });

  const rawSig = await privy.wallets().ethereum().signSecp256k1(walletId, {
    params: { hash: opHash },
  });
  userOp.signature = (rawSig as any).signature;

  // 5. Send
  const userOpHash = await candideRpc("eth_sendUserOperation", [userOp, entryPoint08Address]);
  return userOpHash;
}

/**
 * Send a gasless contract call via EIP-7702 on Celo.
 * The agent never pays gas — Candide sponsors the UserOperation.
 */
export async function sendGaslessContractCall(
  walletId: string,
  walletAddress: string,
  to: `0x${string}`,
  data: `0x${string}`,
  value?: bigint
) {
  log("info", "Sending gasless contract call", { walletId, to, dataLength: data.length, value: value?.toString() });

  // Wrap in SimpleAccount.execute(to, value, data)
  const callData = encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: "execute",
    args: [to, value ?? BigInt(0), data],
  });

  try {
    const opHash = await sendUserOp(walletId, walletAddress as `0x${string}`, callData as `0x${string}`);
    log("info", "UserOp submitted", { opHash, to });
    return opHash;
  } catch (err: any) {
    log("error", "Contract call failed", {
      walletId, to, error: err.message, stack: err.stack,
      ...(err.details && { details: err.details }),
    });
    throw err;
  }
}

/**
 * Send a gasless native CELO transfer via EIP-7702.
 */
export async function sendGaslessTransfer(
  walletId: string,
  walletAddress: string,
  to: `0x${string}`,
  value: bigint
) {
  log("info", "Sending gasless CELO transfer", { walletId, to, value: value.toString() });

  const callData = encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: "execute",
    args: [to, value, "0x"],
  });

  try {
    const opHash = await sendUserOp(walletId, walletAddress as `0x${string}`, callData as `0x${string}`);
    log("info", "CELO transfer UserOp submitted", { opHash, to, value: value.toString() });
    return opHash;
  } catch (err: any) {
    log("error", "CELO transfer failed", {
      walletId, to, value: value.toString(), error: err.message, stack: err.stack,
      ...(err.details && { details: err.details }),
    });
    throw err;
  }
}
