export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Verify",
      description:
        "Verify your identity with Self protocol. Zero-knowledge proof confirms you are 18+ and not sanctioned — no personal data shared.",
    },
    {
      number: "02",
      title: "Lend",
      description:
        "Deposit USDC into the lending pool on Celo. Earn interest from borrowers, withdraw anytime.",
    },
    {
      number: "03",
      title: "Borrow",
      description:
        "Request a microloan from the pool. Self-verified identity enables uncollateralized lending based on reputation.",
    },
    {
      number: "04",
      title: "Repay",
      description:
        "Repay loans on schedule to build your on-chain reputation score. Higher scores unlock larger loans.",
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
