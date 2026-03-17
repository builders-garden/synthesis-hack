import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Specs } from "@/components/specs";
import { HowItWorks } from "@/components/how-it-works";

export default function Home() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main>
        <Hero />
        <Specs />
        <HowItWorks />
      </main>
    </div>
  );
}
