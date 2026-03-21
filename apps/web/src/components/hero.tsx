"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const YOUTUBE_VIDEO_ID = "C_MifNcteFM";

const HeroScene = dynamic(
  () => import("@/components/hero-scene").then((mod) => mod.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-[400px] items-center justify-center md:h-[620px] md:w-[520px] lg:h-[700px] lg:w-[600px]">
        <div className="font-mono text-sm text-ink-lighter animate-pulse">
          Loading 3D…
        </div>
      </div>
    ),
  }
);

function VideoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl aspect-video mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 font-mono text-sm text-white/70 hover:text-white transition-colors"
        >
          ESC to close
        </button>
        <iframe
          src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
          title="Demo video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded"
        />
      </div>
    </div>
  );
}

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);
  const openVideo = useCallback(() => setVideoOpen(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  return (
    <>
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
                className="inline-flex items-center justify-center whitespace-nowrap rounded-none bg-ink px-8 py-4 font-mono text-sm uppercase tracking-wider text-cream transition-opacity hover:opacity-80"
              >
                Launch Agent
              </Link>
              <span className="font-mono text-sm text-ink-light">
                Powered by Self + Celo + OpenClaw
              </span>
            </div>
          </div>

          {/* Right: Interactive 3D scene */}
          {!videoOpen && (
            <div className="flex-shrink-0">
              <HeroScene onScreenClick={openVideo} />
            </div>
          )}
        </div>
      </section>

      {videoOpen && <VideoModal onClose={closeVideo} />}
    </>
  );
}
