"use client";

export function Header() {
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Yield Agent</h1>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
            beta
          </span>
        </div>
        <appkit-button />
      </div>
    </header>
  );
}
