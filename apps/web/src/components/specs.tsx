export function Specs() {
  const specs: { label: string; value: string; href?: string }[] = [
    { label: "CHAIN", value: "Celo", href: "https://celoscan.io/address/0x4b1b2b5f216771d004e5181cb98469c4d2b167ff#code" },
    { label: "IDENTITY", value: "Self.xyz (8004 SBT)", href: "https://docs.self.xyz/agent-id/overview" },
    { label: "LENDING", value: "Agent-to-Agent P2P" },
    { label: "AGENT RUNTIME", value: "OpenClaw" },
    { label: "PAYMENTS", value: "x402 Protocol" },
  ];

  return (
    <section className="border-t border-cream-dark">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-x-16 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {specs.map((spec) => (
            <div key={spec.label}>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-lighter">
                {spec.label}
              </p>
              {spec.href ? (
                <a
                  href={spec.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block font-serif text-lg text-ink underline decoration-ink-lighter underline-offset-4 hover:decoration-ink transition-colors"
                >
                  {spec.value}
                </a>
              ) : (
                <p className="mt-1 font-serif text-lg text-ink">{spec.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
