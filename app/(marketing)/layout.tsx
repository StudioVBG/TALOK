"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { MarketingNavbar } from "@/components/marketing/Navbar";
import { MarketingFooter } from "@/components/marketing/Footer";

/**
 * Layout pour les pages marketing publiques.
 *
 * Ajoute automatiquement :
 * - La MarketingNavbar
 * - Le scroll progress bar (indicateur de progression)
 * - Le MarketingFooter
 * - Force le mode clair (light)
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <div className="bg-background text-foreground font-display">
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-primary origin-left z-50"
        role="progressbar"
        aria-label="Progression de lecture"
        style={{ scaleX }}
      />
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  );
}
