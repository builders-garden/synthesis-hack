"use client";

import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
      <div className="flex flex-col items-center gap-12 md:flex-row md:items-start md:gap-16 lg:gap-24">
        {/* Left: Copy */}
        <div className="flex max-w-lg flex-col gap-8 md:pt-8">
          <h1 className="font-serif text-5xl leading-tight font-bold tracking-tight text-ink md:text-6xl lg:text-7xl">
            Introducing{" "}
            <em className="not-italic" style={{ fontStyle: "italic" }}>
              Yield Agent.
            </em>
          </h1>

          <p className="text-lg leading-relaxed text-ink-light md:text-xl">
            An autonomous AI that funds its own inference, swaps, and
            payments — entirely from stETH yield. Your principal never
            moves. The agent never stops.
          </p>

          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-none bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
            >
              Deploy Your Agent
            </Link>
            <span className="font-mono text-sm text-ink-light">
              5.00 USDC to bootstrap
            </span>
          </div>
        </div>

        {/* Right: Hero image */}
        <div className="flex-shrink-0">
          <Image
            src="/hero-robot.png"
            alt="Yield Agent — coin-operated autonomous robot"
            width={460}
            height={540}
            priority
            className="h-auto w-[320px] md:w-[400px] lg:w-[460px]"
          />
        </div>
      </div>
    </section>
  );
}
