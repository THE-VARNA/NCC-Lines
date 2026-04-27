import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ProtocolStats } from "@/components/ProtocolStats";
import { LoanDashboard } from "@/components/LoanDashboard";
import { PrivacyExplainer } from "@/components/PrivacyExplainer";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />
      <HeroSection />
      <ProtocolStats />
      <LoanDashboard />
      <PrivacyExplainer />
      <Footer />
    </main>
  );
}
