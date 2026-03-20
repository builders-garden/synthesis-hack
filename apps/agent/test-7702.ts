/**
 * Test: EIP-7702 + Candide + Privy (no permissionless)
 *
 * Direct integration: Privy signs, Candide bundles + sponsors
 *
 * Usage: npx tsx test-7702.ts
 */

import { createPublicClient, http, encodeFunctionData, toHex, pad, hashMessage } from "viem";
import { entryPoint08Address, getUserOperationHash } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";

// --- Config ---
const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const WALLET_ID = process.env.AGENT_WALLET_ID || "otieg10rrur0ba0bl42wzsxx";
const WALLET_ADDRESS = (process.env.AGENT_WALLET_ADDRESS || "0xb066DD809898559D6eF3Aeb0E59f9b41e81e5Cb6") as `0x${string}`;
const CANDIDE_API_KEY = process.env.CANDIDE_API_KEY || "";
const CANDIDE_URL = CANDIDE_API_KEY
  ? `https://api.candide.dev/api/v3/42220/${CANDIDE_API_KEY}`
  : "https://api.candide.dev/public/v3/42220";
const SPONSORSHIP_POLICY_ID = process.env.CANDIDE_SPONSORSHIP_POLICY_ID || "";

// SimpleAccount v0.8 implementation (deployed on Celo, works with EP v0.8)
const SIMPLE_ACCOUNT_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

// Self Agent Registry EIP-712 domain
const REGISTRY_ADDRESS = "0x62E37d0f6c5f67784b8828B3dF68BCDbB2e55095" as const;
const EIP712_DOMAIN = {
  name: "SelfAgentRegistry",
  version: "1",
  chainId: 42220,
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

// --- Helpers ---
const h = (v: bigint | number) => "0x" + BigInt(v).toString(16);

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

// SimpleAccount execute(address dest, uint256 value, bytes calldata func)
const executeAbi = [{
  name: "execute",
  type: "function",
  inputs: [
    { name: "dest", type: "address" },
    { name: "value", type: "uint256" },
    { name: "func", type: "bytes" },
  ],
  outputs: [],
}] as const;

async function main() {
  console.log("=== EIP-7702 + Candide + Privy (Direct) ===\n");

  const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const privy = new PrivyClient({ appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET });
  const account = await createViemAccount(privy, { walletId: WALLET_ID, address: WALLET_ADDRESS });

  console.log("Wallet:", account.address);
  console.log("Candide:", CANDIDE_URL.replace(CANDIDE_API_KEY, "***"));
  console.log();

  // --- Test 1: EIP-712 signing ---
  console.log("1. EIP-712 signing (AgentWalletSet)...");
  const sig712 = await account.signTypedData({
    domain: EIP712_DOMAIN,
    types: AGENT_WALLET_SET_TYPES,
    primaryType: "AgentWalletSet",
    message: {
      agentId: BigInt(1),
      newWallet: WALLET_ADDRESS,
      owner: "0x0000000000000000000000000000000000000001" as `0x${string}`,
      nonce: BigInt(0),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    },
  });
  console.log("   ✓ Signature:", sig712.slice(0, 20) + "...");

  // --- Test 2: Sign 7702 authorization ---
  console.log("\n2. Signing EIP-7702 authorization...");
  const txNonce = await publicClient.getTransactionCount({ address: WALLET_ADDRESS });
  const authorization = await account.signAuthorization!({
    address: SIMPLE_ACCOUNT_IMPL,
    chainId: celo.id,
    nonce: txNonce,
  });
  const auth = authorization as any;
  const eip7702Auth = {
    chainId: h(auth.chainId),
    address: auth.address,
    nonce: h(auth.nonce),
    yParity: h(auth.yParity),
    r: auth.r,
    s: auth.s,
  };
  console.log("   ✓ Authorization signed for:", auth.address);

  // --- Test 3: Build + sponsor + send UserOp ---
  console.log("\n3. Building sponsored UserOperation...");

  // EntryPoint nonce
  const epNonce = await publicClient.readContract({
    address: entryPoint08Address,
    abi: [{ name: "getNonce", type: "function", stateMutability: "view", inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "getNonce",
    args: [WALLET_ADDRESS, BigInt(0)],
  });

  // Encode: SimpleAccount.execute(self, 0, "0x") — no-op self-call
  const callData = encodeFunctionData({
    abi: executeAbi,
    functionName: "execute",
    args: [WALLET_ADDRESS, BigInt(0), "0x"],
  });

  // Gas fees
  const block = await publicClient.getBlock();
  const baseFee = block.baseFeePerGas ?? BigInt(5000000000);
  const maxFeePerGas = h(baseFee * BigInt(2));
  const maxPriorityFeePerGas = h(baseFee / BigInt(5));

  // Sign a recoverable dummy signature for estimation
  const dummySig = await account.signMessage({ message: "7702-estimation" });

  // UserOp with dummy gas values — paymaster will estimate
  const userOp = {
    sender: WALLET_ADDRESS,
    nonce: h(epNonce),
    callData,
    callGasLimit: h(100000),
    verificationGasLimit: h(500000),
    preVerificationGas: h(100000),
    maxFeePerGas,
    maxPriorityFeePerGas,
    signature: dummySig,
    eip7702Auth,
  };

  // Step A: Get sponsorship (paymaster does gas estimation internally)
  console.log("   Requesting sponsorship...");
  const sponsorResult = await candideRpc("pm_sponsorUserOperation", [
    userOp,
    entryPoint08Address,
    { sponsorshipPolicyId: SPONSORSHIP_POLICY_ID },
  ]);
  console.log("   ✓ Paymaster:", sponsorResult.paymaster);
  console.log("   ✓ Gas overrides:", {
    callGasLimit: sponsorResult.callGasLimit,
    verificationGasLimit: sponsorResult.verificationGasLimit,
    preVerificationGas: sponsorResult.preVerificationGas,
  });

  // Step B: Build final UserOp with paymaster data
  const finalUserOp: any = {
    ...userOp,
    paymaster: sponsorResult.paymaster,
    paymasterData: sponsorResult.paymasterData,
    paymasterVerificationGasLimit: sponsorResult.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: sponsorResult.paymasterPostOpGasLimit,
  };
  // Apply gas overrides from paymaster if provided
  if (sponsorResult.callGasLimit) finalUserOp.callGasLimit = sponsorResult.callGasLimit;
  if (sponsorResult.verificationGasLimit) finalUserOp.verificationGasLimit = sponsorResult.verificationGasLimit;
  if (sponsorResult.preVerificationGas) finalUserOp.preVerificationGas = sponsorResult.preVerificationGas;
  if (sponsorResult.maxFeePerGas) finalUserOp.maxFeePerGas = sponsorResult.maxFeePerGas;
  if (sponsorResult.maxPriorityFeePerGas) finalUserOp.maxPriorityFeePerGas = sponsorResult.maxPriorityFeePerGas;

  // Step C: Compute UserOp hash using viem's utility (same as permissionless)
  console.log("   Computing UserOp hash...");
  const userOpHash = getUserOperationHash({
    userOperation: {
      sender: WALLET_ADDRESS,
      nonce: BigInt(finalUserOp.nonce),
      callData: finalUserOp.callData as `0x${string}`,
      callGasLimit: BigInt(finalUserOp.callGasLimit),
      verificationGasLimit: BigInt(finalUserOp.verificationGasLimit),
      preVerificationGas: BigInt(finalUserOp.preVerificationGas),
      maxFeePerGas: BigInt(finalUserOp.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(finalUserOp.maxPriorityFeePerGas),
      paymaster: finalUserOp.paymaster as `0x${string}`,
      paymasterData: (finalUserOp.paymasterData || "0x") as `0x${string}`,
      paymasterVerificationGasLimit: BigInt(finalUserOp.paymasterVerificationGasLimit || "0x0"),
      paymasterPostOpGasLimit: BigInt(finalUserOp.paymasterPostOpGasLimit || "0x0"),
      signature: "0x",
    },
    entryPointAddress: entryPoint08Address,
    entryPointVersion: "0.8",
    chainId: celo.id,
  });
  console.log("   ✓ UserOp hash:", userOpHash);

  console.log("   Signing UserOp (raw secp256k1)...");
  // Use raw ECDSA signing — the SimpleAccount impl doesn't use EIP-191 prefix
  const rawSigResult = await privy.wallets().ethereum().signSecp256k1(WALLET_ID, {
    params: { hash: userOpHash },
  });
  const rawSig = (rawSigResult as any).signature;
  finalUserOp.signature = rawSig;
  console.log("   ✓ Signed:", rawSig.slice(0, 20) + "...");

  // Step D: Send
  console.log("   Sending UserOperation...");
  const opHash = await candideRpc("eth_sendUserOperation", [finalUserOp, entryPoint08Address]);
  console.log("   ✓ UserOp hash:", opHash);

  // Step E: Wait for receipt
  console.log("   Waiting for receipt...");
  let receipt = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      receipt = await candideRpc("eth_getUserOperationReceipt", [opHash]);
      if (receipt) break;
    } catch {
      // not mined yet
    }
  }

  if (receipt) {
    console.log("   ✓ Tx hash:", receipt.receipt?.transactionHash);
    console.log("   ✓ Success:", receipt.success);
    console.log("   ✓ View: https://celoscan.io/tx/" + receipt.receipt?.transactionHash);
  } else {
    console.log("   ⏳ Not mined after 90s — check bundler");
  }

  console.log("\n=== All tests complete ===");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
