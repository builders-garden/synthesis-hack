import { createPublicClient, http, type Hex, encodeFunctionData } from "viem";
import { entryPoint08Address, getUserOperationHash } from "viem/account-abstraction";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const CANDIDE_API_KEY = process.env.CANDIDE_API_KEY || "";
const CANDIDE_URL = CANDIDE_API_KEY
  ? `https://api.candide.dev/api/v3/42220/${CANDIDE_API_KEY}`
  : "https://api.candide.dev/public/v3/42220";
const SPONSORSHIP_POLICY_ID = process.env.CANDIDE_SPONSORSHIP_POLICY_ID || "";

// SimpleAccount v0.8 implementation (deployed on Celo, works with EP v0.8 + 7702)
const SIMPLE_ACCOUNT_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

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

/**
 * Send a gasless EIP-7702 UserOperation using a local private key.
 */
async function sendUserOp(privateKey: Hex, callData: `0x${string}`) {
  const owner = privateKeyToAccount(privateKey);
  const walletAddress = owner.address;
  const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC_URL) });

  // 1. Sign 7702 authorization
  const txNonce = await publicClient.getTransactionCount({ address: walletAddress });
  const auth = await owner.signAuthorization({
    contractAddress: SIMPLE_ACCOUNT_IMPL,
    chainId: celo.id,
    nonce: txNonce,
  }) as any;

  const eip7702Auth = {
    chainId: h(auth.chainId),
    address: auth.address ?? auth.contractAddress,
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
  const dummySig = await owner.signMessage({ message: "7702-estimation" });

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

  // 3. Candide sponsorship
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

  // 4. Compute hash and sign with raw secp256k1
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

  // Raw ECDSA sign (no EIP-191 prefix — SimpleAccount v0.8 uses raw ecrecover)
  const sig = await owner.sign({ hash: opHash });
  userOp.signature = sig;

  // 5. Send
  return await candideRpc("eth_sendUserOperation", [userOp, entryPoint08Address]);
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
  const callData = encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: "execute",
    args: [USDC_ADDRESS, BigInt(0), encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amount],
    })],
  });
  return sendUserOp(privateKey, callData as `0x${string}`);
}

export async function sendGaslessContractCall(
  privateKey: Hex,
  to: `0x${string}`,
  data: `0x${string}`
) {
  const callData = encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: "execute",
    args: [to, BigInt(0), data],
  });
  return sendUserOp(privateKey, callData as `0x${string}`);
}
