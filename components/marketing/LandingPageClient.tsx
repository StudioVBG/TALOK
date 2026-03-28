"use client"

import { HeroSection } from "@/components/marketing/sections/HeroSection"
import { InnovationBar } from "@/components/marketing/sections/InnovationBar"
import { ProblemSolution } from "@/components/marketing/sections/ProblemSolution"
import { ArgumentsSection } from "@/components/landing/ArgumentsSection"
import { Features } from "@/components/marketing/sections/Features"
import { Testimonials } from "@/components/marketing/sections/Testimonials"
import { PourQui } from "@/components/marketing/sections/PourQui"
import { OutreMer } from "@/components/marketing/sections/OutreMer"
import { Pricing } from "@/components/marketing/sections/Pricing"
import { FAQ } from "@/components/marketing/sections/FAQ"
import { FinalCTA, StickyMobileCTA } from "@/components/marketing/sections/FinalCTA"

interface Props {
  images: Record<string, string>;
}

export function LandingPageClient({ images }: Props) {
  return (
    <>
      <div className="scroll-smooth">
        <HeroSection />
        <InnovationBar />
        <ProblemSolution images={images} />
        <ArgumentsSection images={images} />
        <Features />
        <Testimonials />
        <PourQui images={images} />
        <OutreMer />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </div>
      <StickyMobileCTA />
    </>
  )
}
