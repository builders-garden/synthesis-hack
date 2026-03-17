"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="mx-auto max-w-6xl px-6 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-serif text-xl font-bold text-ink">
          Yield Agent
        </Link>
        <nav className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="font-mono text-sm uppercase tracking-wider text-ink-light transition-colors hover:text-ink"
          >
            Dashboard
          </Link>
          <appkit-button />
        </nav>
      </div>
    </header>
  );
}
