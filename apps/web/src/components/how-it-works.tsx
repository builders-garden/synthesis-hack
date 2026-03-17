export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Fund",
      description:
        "Deposit wstETH into the Agent Treasury. Your principal is locked — only yield flows to the agent.",
    },
    {
      number: "02",
      title: "Swap",
      description:
        "The agent converts accrued yield to USDC or VVV via Uniswap, autonomously.",
    },
    {
      number: "03",
      title: "Think",
      description:
        "Private inference through Venice AI. No data retention. The agent's reasoning stays confidential.",
    },
    {
      number: "04",
      title: "Pay",
      description:
        "Services paid through Locus on Base. Auditable, capped, fully autonomous.",
    },
  ];

  return (
    <section className="border-t border-cream-dark">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-serif text-3xl font-bold text-ink md:text-4xl">
          How it works.
        </h2>
        <div className="mt-12 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number}>
              <p className="font-mono text-sm text-ink-lighter">
                {step.number}
              </p>
              <h3 className="mt-2 font-serif text-xl font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-light">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
