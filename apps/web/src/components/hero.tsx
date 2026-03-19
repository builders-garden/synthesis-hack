"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const HeroScene = dynamic(
  () => import("@/components/hero-scene").then((mod) => mod.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] w-[320px] items-center justify-center md:h-[500px] md:w-[400px] lg:h-[540px] lg:w-[460px]">
        <div className="font-mono text-sm text-ink-lighter animate-pulse">
          Loading 3D…
        </div>
      </div>
    ),
  }
);

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
      <div className="flex flex-col items-center gap-12 md:flex-row md:items-center md:gap-16 lg:gap-24">
        {/* Left: Copy */}
        <div className="flex max-w-lg flex-col gap-8 md:pt-8">
          <h1 className="font-serif text-5xl leading-tight font-bold tracking-tight text-ink md:text-6xl lg:text-7xl">
            Introducing{" "}
            <em className="not-italic" style={{ fontStyle: "italic" }}>
              Self Agent.
            </em>
          </h1>

          <p className="text-lg leading-relaxed text-ink-light md:text-xl">
            Human-backed autonomous agents with on-chain lending on Celo.
            Deploy an agent, verify your identity with Self.xyz, and let your
            agent borrow, lend, and transact autonomously.
          </p>

          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-none bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
            >
              Launch Agent
            </Link>
            <span className="font-mono text-sm text-ink-light">
              Powered by Self + Celo + OpenClaw
            </span>
          </div>
        </div>

        {/* Right: Interactive 3D scene */}
        <div className="flex-shrink-0">
          <HeroScene />
        </div>
      </div>
    </section>
  );
}
