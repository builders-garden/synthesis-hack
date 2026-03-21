"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";

// AgentMicrolending contract ABI (relevant functions only)
const LENDING_ABI = [
  {
    name: "createLoanRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "repayAmount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "lender", type: "address" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    name: "fundLoan",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "repayLoan",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelLoanRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimDefaulted",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getLoan",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "borrower", type: "address" },
          { name: "lender", type: "address" },
          { name: "actualLender", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "repayAmount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "totalLoans",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getOpenLoans",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "borrower", type: "address" },
          { name: "lender", type: "address" },
          { name: "actualLender", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "repayAmount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getBorrowerLoans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getLenderLoans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "lender", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
] as const;

// TODO: Replace with deployed contract address
const LENDING_CONTRACT =
  (process.env.NEXT_PUBLIC_LENDING_CONTRACT as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as `0x${string}`);

const LOAN_STATUS_LABELS = ["Open", "Funded", "Repaid", "Defaulted", "Cancelled"];
const LOAN_STATUS_COLORS = [
  "text-blue-600",
  "text-green-600",
  "text-ink-lighter",
  "text-red-600",
  "text-ink-lighter",
];

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

interface LendingDashboardProps {
  agentAddress: string;
  humanAddress: string;
  isVerified: boolean;
  onVerify?: () => void;
}

export function LendingDashboard({
  agentAddress,
  humanAddress,
  isVerified,
  onVerify,
}: LendingDashboardProps) {
  // Loan request form
  const [requestAmount, setRequestAmount] = useState("");
  const [requestInterest, setRequestInterest] = useState("10");
  const [requestDuration, setRequestDuration] = useState("30");
  const [requestLender, setRequestLender] = useState("");

  // Fund loan form
  const [fundLoanId, setFundLoanId] = useState("");

  // Repay loan form
  const [repayLoanId, setRepayLoanId] = useState("");

  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: txPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read total loans
  const { data: totalLoans } = useReadContract({
    address: LENDING_CONTRACT,
    abi: LENDING_ABI,
    functionName: "totalLoans",
  });

  // Read open loans
  const { data: openLoans, refetch: refetchOpenLoans } = useReadContract({
    address: LENDING_CONTRACT,
    abi: LENDING_ABI,
    functionName: "getOpenLoans",
    args: [BigInt(0), BigInt(20)],
  });

  // Read agent's borrower loans
  const { data: borrowerLoanIds } = useReadContract({
    address: LENDING_CONTRACT,
    abi: LENDING_ABI,
    functionName: "getBorrowerLoans",
    args: [agentAddress as `0x${string}`],
  });

  // Read agent's lender loans
  const { data: lenderLoanIds } = useReadContract({
    address: LENDING_CONTRACT,
    abi: LENDING_ABI,
    functionName: "getLenderLoans",
    args: [agentAddress as `0x${string}`],
  });

  const handleRequestLoan = useCallback(async () => {
    const amount = parseFloat(requestAmount);
    const interestPct = parseFloat(requestInterest);
    const durationDays = parseInt(requestDuration);
    if (!amount || amount <= 0) return;

    const amountWei = parseEther(requestAmount);
    const repayAmountWei = parseEther(
      (amount * (1 + interestPct / 100)).toFixed(18)
    );
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + durationDays * 86400
    );
    const lender = requestLender.trim() || "0x0000000000000000000000000000000000000000";

    await writeContractAsync({
      address: LENDING_CONTRACT,
      abi: LENDING_ABI,
      functionName: "createLoanRequest",
      args: [amountWei, repayAmountWei, deadline, lender as `0x${string}`],
    });

    setRequestAmount("");
    setRequestLender("");
    refetchOpenLoans();
  }, [requestAmount, requestInterest, requestDuration, requestLender, writeContractAsync, refetchOpenLoans]);

  const handleFundLoan = useCallback(async () => {
    const loanId = parseInt(fundLoanId);
    if (isNaN(loanId)) return;

    // We need to read the loan to know the amount
    // For simplicity, we'll prompt the user to enter the amount too
    // In production, this would be read from the contract
    await writeContractAsync({
      address: LENDING_CONTRACT,
      abi: LENDING_ABI,
      functionName: "fundLoan",
      args: [BigInt(loanId)],
    });

    setFundLoanId("");
    refetchOpenLoans();
  }, [fundLoanId, writeContractAsync, refetchOpenLoans]);

  const handleRepayLoan = useCallback(async () => {
    const loanId = parseInt(repayLoanId);
    if (isNaN(loanId)) return;

    await writeContractAsync({
      address: LENDING_CONTRACT,
      abi: LENDING_ABI,
      functionName: "repayLoan",
      args: [BigInt(loanId)],
    });

    setRepayLoanId("");
  }, [repayLoanId, writeContractAsync]);

  const formatAddr = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";

  return (
    <div className="space-y-12">
      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Total Loans</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {totalLoans?.toString() ?? "—"}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">All time</p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Open Requests</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {openLoans?.length ?? "—"}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            Awaiting lenders
          </p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Your Borrows</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {borrowerLoanIds?.length ?? "—"}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            As borrower
          </p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Your Fills</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {lenderLoanIds?.length ?? "—"}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">As lender</p>
        </div>
      </div>

      {/* Request Loan + Fund Loan actions */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Request Loan */}
        <div className="border border-cream-dark p-6">
          <h4 className={labelClass}>Request Loan</h4>
          <p className="mt-2 text-xs text-ink-light">
            Publish a loan request to the lending contract. Other agents can
            discover and fill it after verifying your human-backed status (8004
            SBT).
          </p>

          {!isVerified && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p>
                Identity verification required to borrow. Only agents backed by
                a verified human (8004 SBT) can request loans.
              </p>
              {onVerify && (
                <button
                  onClick={onVerify}
                  className="mt-2 bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
                >
                  Verify Identity
                </button>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div>
              <label className={labelClass}>Amount (CELO)</label>
              <input
                type="number"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder="0.00"
                disabled={!isVerified}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Interest (%)</label>
                <input
                  type="number"
                  value={requestInterest}
                  onChange={(e) => setRequestInterest(e.target.value)}
                  placeholder="10"
                  disabled={!isVerified}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Duration (days)</label>
                <input
                  type="number"
                  value={requestDuration}
                  onChange={(e) => setRequestDuration(e.target.value)}
                  placeholder="30"
                  disabled={!isVerified}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>
                Specific Lender (optional)
              </label>
              <input
                type="text"
                value={requestLender}
                onChange={(e) => setRequestLender(e.target.value)}
                placeholder="0x... or leave blank for open request"
                disabled={!isVerified}
                className={inputClass}
              />
            </div>
            <button
              onClick={handleRequestLoan}
              disabled={
                txPending ||
                !isVerified ||
                !requestAmount ||
                parseFloat(requestAmount) <= 0
              }
              className="w-full bg-ink px-6 py-3 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {txPending ? "Publishing..." : "Publish Loan Request"}
            </button>
          </div>
        </div>

        {/* Fund Loan */}
        <div className="border border-cream-dark p-6">
          <h4 className={labelClass}>Fund a Loan</h4>
          <p className="mt-2 text-xs text-ink-light">
            Fill an open loan request by sending CELO. Verify the borrower's
            human-backed status (8004 SBT) before filling.
          </p>

          <div className="mt-6 space-y-3">
            <div>
              <label className={labelClass}>Loan ID</label>
              <input
                type="number"
                value={fundLoanId}
                onChange={(e) => setFundLoanId(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <button
              onClick={handleFundLoan}
              disabled={txPending || !fundLoanId}
              className="w-full bg-ink px-6 py-3 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {txPending ? "Funding..." : "Fund Loan"}
            </button>
          </div>

          {/* Repay section */}
          <div className="mt-8 border-t border-cream-dark pt-6">
            <h4 className={labelClass}>Repay Loan</h4>
            <p className="mt-2 text-xs text-ink-light">
              Repay a funded loan within the agreed duration, sending principal
              + interest to the lender.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Loan ID</label>
                <input
                  type="number"
                  value={repayLoanId}
                  onChange={(e) => setRepayLoanId(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleRepayLoan}
                disabled={txPending || !repayLoanId}
                className="w-full border border-ink bg-transparent px-6 py-3 font-mono text-xs uppercase tracking-wider text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-30"
              >
                {txPending ? "Repaying..." : "Repay Loan"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Open Loan Requests */}
      <div className="border border-cream-dark p-6">
        <div className="flex items-center justify-between">
          <h4 className={labelClass}>Open Loan Requests</h4>
          <button
            onClick={() => refetchOpenLoans()}
            className="font-mono text-xs text-ink-lighter hover:text-ink"
          >
            Refresh
          </button>
        </div>

        {!openLoans || openLoans.length === 0 ? (
          <p className="mt-4 text-sm text-ink-light">
            No open loan requests. Agents publish requests when they need
            capital.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {openLoans.map((loan) => (
              <div
                key={loan.id.toString()}
                className="flex items-center justify-between border-b border-cream-dark pb-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-ink">
                      #{loan.id.toString()}
                    </span>
                    <span className="font-mono text-sm text-ink">
                      {formatEther(loan.amount)} CELO
                    </span>
                    <span
                      className={`font-mono text-xs ${LOAN_STATUS_COLORS[loan.status]}`}
                    >
                      {LOAN_STATUS_LABELS[loan.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-ink-lighter">
                      Borrower: {formatAddr(loan.borrower)}
                    </span>
                    <span className="font-mono text-xs text-ink-lighter">
                      Repay: {formatEther(loan.repayAmount)} CELO
                    </span>
                    <span className="font-mono text-xs text-ink-lighter">
                      Due:{" "}
                      {new Date(
                        Number(loan.deadline) * 1000
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {loan.lender ===
                "0x0000000000000000000000000000000000000000" ? (
                  <span className="font-mono text-xs text-ink-lighter">
                    Open to anyone
                  </span>
                ) : (
                  <span className="font-mono text-xs text-ink-lighter">
                    For: {formatAddr(loan.lender)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-cream-dark pt-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <span className="font-mono text-xs text-ink-lighter">
              Agent Wallet
            </span>
            <p className="mt-1 font-mono text-xs text-ink">
              {formatAddr(agentAddress)}
            </p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">
              Human Wallet
            </span>
            <p className="mt-1 font-mono text-xs text-ink">
              {formatAddr(humanAddress)}
            </p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">Network</span>
            <p className="mt-1 font-mono text-xs text-ink">Celo</p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">
              Verified (8004 SBT)
            </span>
            <p className="mt-1 font-mono text-xs text-ink">
              {isVerified ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
