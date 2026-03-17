"use client";

import { useState, useCallback } from "react";

interface LocusWallet {
  apiKey: string;
  ownerPrivateKey: string;
  ownerAddress: string;
  walletId: string;
  walletStatus: string;
  claimUrl: string;
}

interface DeployState {
  wallet: LocusWallet | null;
  walletReady: boolean;
  walletAddress: string | null;
  balance: string | null;
  error: string | null;
  loading: boolean;
}

export function useAgentDeploy() {
  const [state, setState] = useState<DeployState>({
    wallet: null,
    walletReady: false,
    walletAddress: null,
    balance: null,
    error: null,
    loading: false,
  });

  const registerWallet = useCallback(async (agentName: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/agent/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setState((s) => ({
        ...s,
        wallet: data,
        walletAddress: data.ownerAddress,
        loading: false,
      }));

      return data as LocusWallet;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setState((s) => ({ ...s, error: message, loading: false }));
      return null;
    }
  }, []);

  const pollWalletStatus = useCallback(async (apiKey: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch("/api/agent/status", {
          headers: { "x-locus-key": apiKey },
        });
        const data = await res.json();

        if (data.walletStatus === "deployed" || data.walletAddress) {
          setState((s) => ({
            ...s,
            walletReady: true,
            walletAddress: data.walletAddress || s.walletAddress,
          }));
          return true;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setState((s) => ({
      ...s,
      error: "Wallet deployment timed out",
    }));
    return false;
  }, []);

  const checkBalance = useCallback(async (apiKey: string) => {
    try {
      const res = await fetch("/api/agent/balance", {
        headers: { "x-locus-key": apiKey },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setState((s) => ({ ...s, balance: data.balance }));
      return parseFloat(data.balance);
    } catch {
      return 0;
    }
  }, []);

  const deployAgent = useCallback(
    async (config: {
      agentName: string;
      veniceModel: string;
      spendingCap: string;
      dailyLimit: string;
    }) => {
      if (!state.wallet) return null;

      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch("/api/agent/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...config,
            locusApiKey: state.wallet.apiKey,
            ownerAddress: state.wallet.ownerAddress,
            ownerPrivateKey: state.wallet.ownerPrivateKey,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setState((s) => ({ ...s, loading: false }));
        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deploy failed";
        setState((s) => ({ ...s, error: message, loading: false }));
        return null;
      }
    },
    [state.wallet]
  );

  return {
    ...state,
    registerWallet,
    pollWalletStatus,
    checkBalance,
    deployAgent,
  };
}
