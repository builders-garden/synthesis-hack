export function Specs() {
  const specs = [
    { label: "CHAIN", value: "Celo" },
    { label: "IDENTITY", value: "Self Protocol" },
    { label: "LENDING", value: "Microlending Pool" },
    { label: "AGENT WALLET", value: "Privy" },
  ];

  return (
    <section className="border-t border-cream-dark">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-x-16 gap-y-10 md:grid-cols-4">
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
