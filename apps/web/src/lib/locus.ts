const LOCUS_API_BASE = "https://beta-api.paywithlocus.com/api";

export interface LocusRegistration {
  apiKey: string;
  ownerPrivateKey: string;
  ownerAddress: string;
  walletId: string;
  walletStatus: string;
  claimUrl: string;
  skillFileUrl: string;
  defaults: {
    allowanceUsdc: string;
    maxAllowedTxnSizeUsdc: string;
    chain: string;
  };
}

export interface LocusStatus {
  walletStatus: string;
  walletAddress?: string;
}

export interface LocusBalance {
  balance: string;
  token: string;
  wallet_address: string;
}

export async function registerAgent(
  name: string,
  email?: string
): Promise<LocusRegistration> {
  const res = await fetch(`${LOCUS_API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || "Locus registration failed");
  }
  return json.data;
}

export async function getWalletStatus(
  apiKey: string
): Promise<LocusStatus> {
  const res = await fetch(`${LOCUS_API_BASE}/status`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || "Failed to get wallet status");
  }
  return json.data;
}

export async function getWalletBalance(
  apiKey: string
): Promise<LocusBalance> {
  const res = await fetch(`${LOCUS_API_BASE}/pay/balance`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || "Failed to get balance");
  }
  return json.data;
}
