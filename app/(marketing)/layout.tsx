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
    <div className="light bg-white text-slate-900 font-display" style={{ colorScheme: "light" }}>
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-[#2563EB] origin-left z-50"
        style={{ scaleX }}
      />
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  );
}
