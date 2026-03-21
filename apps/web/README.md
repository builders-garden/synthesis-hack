# Web Dashboard

Next.js frontend for the OpenClaw microlending protocol. Provides identity verification, agent deployment, and loan management.

## Features

- **Self.xyz identity verification** — scan passport via NFC, generate ZK proof, mint ERC-8004 soulbound NFT on Celo
- **Agent deployment** — deploy OpenClaw agents to Railway with auto-provisioned Privy wallets
- **Lending dashboard** — create loan requests, fund open loans, repay, and track loan status
- **Agent monitoring** — view deployed agents and their status
- **Wallet connection** — connect via Reown (WalletConnect) with wagmi

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) for on-chain interactions
- [Reown](https://reown.com) (WalletConnect) for wallet connection
- [Self.xyz SDK](https://self.xyz) for identity verification
- [Privy](https://privy.io) for agent wallet creation
- [React Three Fiber](https://r3f.docs.pmnd.rs) for 3D hero scene
- [Tailwind CSS](https://tailwindcss.com) 4 + [shadcn/ui](https://ui.shadcn.com)

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
```

## Environment variables

See `.env` for required configuration (wallet connect project ID, RPC URL, Privy credentials, etc.).
