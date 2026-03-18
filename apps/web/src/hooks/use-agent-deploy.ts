"use client";

import { useState, useCallback } from "react";

interface DeployInfo {
  projectId: string;
  serviceId: string;
  environmentId: string;
  domain: string;
  setupPassword: string;
}

interface DeployState {
  deployInfo: DeployInfo | null;
  deployStatus: string | null;
  walletAddress: string | null;
  error: string | null;
  loading: boolean;
}

export function useAgentDeploy() {
  const [state, setState] = useState<DeployState>({
    deployInfo: null,
    deployStatus: null,
    walletAddress: null,
    error: null,
    loading: false,
  });

  const deployAgent = useCallback(
    async (config: {
      agentName: string;
      telegramBotToken?: string;
      telegramAllowedUsers?: string;
    }) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch("/api/agent/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const info: DeployInfo = {
          projectId: data.projectId,
          serviceId: data.serviceId,
          environmentId: data.environmentId,
          domain: data.domain,
          setupPassword: data.setupPassword,
        };

        setState((s) => ({
          ...s,
          deployInfo: info,
          deployStatus: "DEPLOYING",
          loading: false,
        }));

        return info;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deploy failed";
        setState((s) => ({ ...s, error: message, loading: false }));
        return null;
      }
    },
    []
  );

  const pollDeployStatus = useCallback(
    async (serviceId: string, environmentId: string) => {
      setState((s) => ({ ...s, loading: true }));
      const maxAttempts = 60; // ~5 minutes with 5s intervals

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const res = await fetch(
            `/api/agent/deploy/status?serviceId=${serviceId}&environmentId=${environmentId}`
          );
          const data = await res.json();

          setState((s) => ({
            ...s,
            deployStatus: data.status,
            walletAddress: data.walletAddress || s.walletAddress,
          }));

          if (data.status === "SUCCESS") {
            setState((s) => ({ ...s, loading: false }));
            return { status: "SUCCESS", walletAddress: data.walletAddress };
          }

          if (data.status === "FAILED" || data.status === "CRASHED") {
            setState((s) => ({
              ...s,
              error: `Deployment ${data.status.toLowerCase()}`,
              loading: false,
            }));
            return { status: data.status, walletAddress: null };
          }
        } catch {
          // retry
        }

        await new Promise((r) => setTimeout(r, 5000));
      }

      setState((s) => ({
        ...s,
        error: "Deployment timed out",
        loading: false,
      }));
      return { status: "TIMEOUT", walletAddress: null };
    },
    []
  );

  const getAgentWallet = useCallback(async (agentUrl: string) => {
    try {
      const res = await fetch(`${agentUrl}/health`);
      const data = await res.json();
      if (data.walletAddress) {
        setState((s) => ({ ...s, walletAddress: data.walletAddress }));
        return data.walletAddress as string;
      }
    } catch {
      // Agent may not be ready yet
    }
    return null;
  }, []);

  return {
    ...state,
    deployAgent,
    pollDeployStatus,
    getAgentWallet,
  };
}
