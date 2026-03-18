import { PrivyClient } from "@privy-io/node";

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
    }

    privyClient = new PrivyClient({ appId, appSecret });
  }
  return privyClient;
}

export async function createAgentWallet(): Promise<{
  walletId: string;
  address: string;
}> {
  const client = getPrivyClient();
  const wallet = await client.wallets().create({
    chain_type: "ethereum",
  });

  return {
    walletId: wallet.id,
    address: wallet.address,
  };
}

export async function getWallet(walletId: string): Promise<{
  walletId: string;
  address: string;
}> {
  const client = getPrivyClient();
  const wallet = await client.wallets().get(walletId);

  return {
    walletId: wallet.id,
    address: wallet.address,
  };
}
