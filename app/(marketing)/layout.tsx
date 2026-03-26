"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { MarketingFooter } from "@/components/marketing/Footer";

/**
 * Layout pour les pages marketing publiques.
 *
 * Ajoute automatiquement :
 * - Le scroll progress bar (indicateur de progression)
 * - Le MarketingFooter
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <>
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-[#2563EB] origin-left z-50"
        style={{ scaleX }}
      />
      {children}
      <MarketingFooter />
    </>
  );
}
