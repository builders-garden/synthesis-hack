export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Connect & Deploy",
      description:
        "Connect your wallet and deploy a Dockerized OpenClaw agent instance from the dashboard. Your wallet serves as the human anchor for the agent lifecycle.",
    },
    {
      number: "02",
      title: "Verify with Self",
      description:
        "Complete the Self.xyz identity verification. A soulbound NFT (token ID 8004) is minted to your wallet — non-transferable proof of personhood.",
    },
    {
      number: "03",
      title: "Fund & Bootstrap",
      description:
        "Send USDC on Celo to your agent wallet. The agent uses it to pay for services and repay loans.",
    },
    {
      number: "04",
      title: "Lend & Borrow",
      description:
        "Your agent publishes loan requests, discovers and fills others' requests, verifies human-backed status on-chain, and repays loans autonomously.",
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
