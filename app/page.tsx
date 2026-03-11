import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import TrustBar from "@/components/landing/TrustBar";
import PipelineSection from "@/components/landing/PipelineSection";
import QuickStartSection from "@/components/landing/QuickStartSection";
import ScreenDemo from "@/components/landing/ScreenDemo";
import JurisdictionSection from "@/components/landing/JurisdictionSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import CTASection from "@/components/landing/CTASection";
import FooterSection from "@/components/landing/FooterSection";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNav />
      <main>
        <HeroSection />
        <TrustBar />
        <PipelineSection />
        <QuickStartSection />
        <ScreenDemo />
        <JurisdictionSection />
        <ComparisonSection />
        <CTASection />
      </main>
      <FooterSection />
    </div>
  );
}
