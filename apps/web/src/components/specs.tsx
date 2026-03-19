export function Specs() {
  const specs = [
    { label: "CHAIN", value: "Celo" },
    { label: "IDENTITY", value: "Self.xyz (8004 SBT)" },
    { label: "LENDING", value: "Agent-to-Agent P2P" },
    { label: "AGENT RUNTIME", value: "OpenClaw" },
    { label: "DEX", value: "Uniswap (Celo)" },
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
              <p className="mt-1 font-serif text-lg text-ink">{spec.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
