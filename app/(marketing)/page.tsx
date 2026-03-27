"use client";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { HeroSection } from "@/components/landing/HeroSection";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ExperienceSlider } from "@/components/landing/ExperienceSlider";
import { HumanSection } from "@/components/landing/HumanSection";
import { ArgumentsSection } from "@/components/landing/ArgumentsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { DomTomSection } from "@/components/landing/DomTomSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ReassuranceSection } from "@/components/landing/ReassuranceSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";

export default function LandingPage() {
  const containerRef = useScrollReveal();

  return (
    <div ref={containerRef} className="scroll-smooth">
      <HeroSection />
      <BeforeAfterSection />
      <HowItWorksSection />
      <ExperienceSlider />
      <HumanSection />
      <ArgumentsSection />
      <FeaturesSection />
      <TestimonialsSection />
      <DomTomSection />
      <PricingSection />
      <ReassuranceSection />
      <FaqSection />
      <FinalCtaSection />
    </div>
  );
}
