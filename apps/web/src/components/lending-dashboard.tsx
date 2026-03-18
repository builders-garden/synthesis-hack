"use client";

import { useState } from "react";

const labelClass =
  "font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter";
const inputClass =
  "w-full border-b border-cream-dark bg-transparent px-0 py-2 text-sm text-ink placeholder:text-ink-lighter focus:border-ink focus:outline-none";

interface Loan {
  id: string;
  type: "lent" | "borrowed";
  amount: number;
  borrower?: string;
  lender?: string;
  apr: number;
  dueDate: string;
  repaid: number;
  status: "active" | "repaid" | "overdue";
}

interface LendingDashboardProps {
  walletAddress: string;
  isVerified: boolean;
}

export function LendingDashboard({
  walletAddress,
  isVerified,
}: LendingDashboardProps) {
  // Mock pool stats
  const [poolStats] = useState({
    totalLiquidity: 25000,
    totalBorrowed: 12500,
    apr: 8.5,
    utilization: 50,
  });

  // Mock loans
  const [loans] = useState<Loan[]>([]);

  // Lending state
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Borrowing state
  const [borrowAmount, setBorrowAmount] = useState("");
  const [borrowing, setBorrowing] = useState(false);

  // Reputation (mock)
  const [reputation] = useState({
    score: 0,
    loansGiven: 0,
    loansReceived: 0,
    onTimeRepayments: 0,
    totalLent: 0,
    totalBorrowed: 0,
  });

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    setDepositing(true);
    // TODO: integrate with Celo USDC contract
    await new Promise((r) => setTimeout(r, 2000));
    setDepositAmount("");
    setDepositing(false);
  };

  const handleBorrow = async () => {
    if (!isVerified) return;
    const amount = parseFloat(borrowAmount);
    if (!amount || amount <= 0) return;

    setBorrowing(true);
    // TODO: integrate with lending contract on Celo
    await new Promise((r) => setTimeout(r, 2000));
    setBorrowAmount("");
    setBorrowing(false);
  };

  return (
    <div className="space-y-12">
      {/* Pool stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Total Liquidity</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {poolStats.totalLiquidity.toLocaleString()}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">USDC</p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Total Borrowed</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {poolStats.totalBorrowed.toLocaleString()}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">USDC</p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Lending APR</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {poolStats.apr.toFixed(1)}%
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">Annual</p>
        </div>
        <div className="border border-cream-dark p-6">
          <span className={labelClass}>Utilization</span>
          <p className="mt-3 font-mono text-2xl text-ink">
            {poolStats.utilization}%
          </p>
          <p className="mt-1 font-mono text-xs text-ink-lighter">
            Pool usage
          </p>
        </div>
      </div>

      {/* Lend + Borrow actions */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Lend */}
        <div className="border border-cream-dark p-6">
          <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
            Deposit to Pool
          </h4>
          <p className="mt-2 text-xs text-ink-light">
            Deposit USDC to the lending pool and earn interest from borrowers.
          </p>

          <div className="mt-6 flex items-end gap-3">
            <div className="flex-1">
              <label className={labelClass}>Amount</label>
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
                <span className="font-mono text-xs text-ink-lighter">USDC</span>
              </div>
            </div>
            <button
              onClick={handleDeposit}
              disabled={
                depositing ||
                !depositAmount ||
                parseFloat(depositAmount) <= 0
              }
              className="bg-ink px-6 py-2 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {depositing ? "Depositing..." : "Deposit"}
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-lighter">
            Current APR: {poolStats.apr.toFixed(1)}% — Earn yield on Celo
          </p>
        </div>

        {/* Borrow */}
        <div className="border border-cream-dark p-6">
          <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
            Request Loan
          </h4>
          <p className="mt-2 text-xs text-ink-light">
            Borrow USDC from the pool. Requires Self identity verification.
          </p>

          {!isVerified && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Identity verification required to borrow. Complete verification
              first.
            </div>
          )}

          <div className="mt-6 flex items-end gap-3">
            <div className="flex-1">
              <label className={labelClass}>Amount</label>
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  value={borrowAmount}
                  onChange={(e) => setBorrowAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={!isVerified}
                  className={inputClass}
                />
                <span className="font-mono text-xs text-ink-lighter">USDC</span>
              </div>
            </div>
            <button
              onClick={handleBorrow}
              disabled={
                borrowing ||
                !isVerified ||
                !borrowAmount ||
                parseFloat(borrowAmount) <= 0
              }
              className="bg-ink px-6 py-2 font-mono text-xs uppercase tracking-wider text-cream transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {borrowing ? "Requesting..." : "Borrow"}
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-lighter">
            Interest rate: {poolStats.apr.toFixed(1)}% APR — Repay anytime on
            Celo
          </p>
        </div>
      </div>

      {/* Active loans */}
      <div className="border border-cream-dark p-6">
        <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
          Active Loans
        </h4>

        {loans.length === 0 ? (
          <p className="mt-4 text-sm text-ink-light">
            No active loans yet. Deposit to the pool to start lending, or
            request a loan after verification.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {loans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between border-b border-cream-dark pb-3"
              >
                <div>
                  <span className="font-mono text-sm text-ink">
                    {loan.amount.toFixed(2)} USDC
                  </span>
                  <span className="ml-2 font-mono text-xs text-ink-lighter">
                    {loan.type === "lent" ? "Lent" : "Borrowed"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-ink-lighter">
                    {loan.apr}% APR
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      loan.status === "active"
                        ? "text-green-600"
                        : loan.status === "overdue"
                          ? "text-red-600"
                          : "text-ink-lighter"
                    }`}
                  >
                    {loan.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reputation */}
      <div className="border border-cream-dark p-6">
        <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-lighter">
          Reputation Score
        </h4>
        <div className="mt-6 grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="font-mono text-xs text-ink-lighter">Score</p>
            <p className="mt-1 font-mono text-lg text-ink">
              {reputation.score}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-lighter">Loans Given</p>
            <p className="mt-1 font-mono text-lg text-ink">
              {reputation.loansGiven}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-lighter">
              Loans Received
            </p>
            <p className="mt-1 font-mono text-lg text-ink">
              {reputation.loansReceived}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-lighter">On-Time</p>
            <p className="mt-1 font-mono text-lg text-ink">
              {reputation.onTimeRepayments}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-lighter">Total Lent</p>
            <p className="mt-1 font-mono text-lg text-ink">
              {reputation.totalLent.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-lighter">
              Total Borrowed
            </p>
            <p className="mt-1 font-mono text-lg text-ink">
              {reputation.totalBorrowed.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="border-t border-cream-dark pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="font-mono text-xs text-ink-lighter">Wallet</span>
            <p className="mt-1 font-mono text-xs text-ink">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">Network</span>
            <p className="mt-1 font-mono text-xs text-ink">Celo</p>
          </div>
          <div>
            <span className="font-mono text-xs text-ink-lighter">
              Verified
            </span>
            <p className="mt-1 font-mono text-xs text-ink">
              {isVerified ? "Yes (Self)" : "No"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
