"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { blurUp, blurWord, useMagnetic } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const titleWords1 = ["Toute", "votre", "gestion", "locative."]
const titleWords2 = ["Une", "seule", "plateforme."]

function MagneticGlowCTA() {
  const mag = useMagnetic(0.2)

  return (
    <motion.div
      ref={mag.ref}
      animate={{ x: mag.x, y: mag.y }}
      transition={{ type: "spring" as const, stiffness: 150, damping: 15 }}
      className="inline-block"
    >
      {/* Glow pulse around button */}
      <motion.div
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(37, 99, 235, 0)",
            "0 0 30px 8px rgba(37, 99, 235, 0.3)",
            "0 0 0 0 rgba(37, 99, 235, 0)",
          ],
        }}
        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
        className="rounded-xl"
      >
        <Link
          href="/auth/signup"
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* Shine sweep */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative">Commencer gratuitement</span>
        </Link>
      </motion.div>
    </motion.div>
  )
}

export function FinalCTA() {
  return (
    <section id="cta-final" className="relative overflow-hidden py-16 md:py-24">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] bg-[length:200%_200%]"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="relative z-10 mx-auto max-w-[700px] px-4 text-center"
      >
        {/* Split text heading */}
        <motion.h2
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          className="font-display text-2xl font-bold text-white sm:text-3xl md:text-4xl"
        >
          {titleWords1.map((word, i) => (
            <motion.span key={`a${i}`} variants={blurWord(0)} className="mr-[0.3em] inline-block">
              {word}
            </motion.span>
          ))}
          <br />
          {titleWords2.map((word, i) => (
            <motion.span key={`b${i}`} variants={blurWord(0)} className="mr-[0.3em] inline-block">
              {word}
            </motion.span>
          ))}
        </motion.h2>

        <motion.p variants={blurUp} className="mx-auto mt-4 max-w-lg text-base text-slate-300">
          Le logiciel le plus complet du marché pour les propriétaires
          et investisseurs français.
        </motion.p>

        <motion.div
          variants={blurUp}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <MagneticGlowCTA />
        </motion.div>

        <motion.p variants={blurUp} className="mt-6 text-xs text-slate-400">
          Gratuit pour démarrer · Sans carte bancaire · Résiliable à tout moment
        </motion.p>
      </motion.div>
    </section>
  )
}

/* ─── Sticky Mobile CTA ─── */
export function StickyMobileCTA() {
  const [showSticky, setShowSticky] = useState(true)

  useEffect(() => {
    const ctaSection = document.getElementById("cta-final")
    if (!ctaSection) return

    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(ctaSection)
    return () => observer.disconnect()
  }, [])

  if (!showSticky) return null

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-card/90 p-3 backdrop-blur-lg md:hidden"
    >
      <Link
        href="/auth/signup"
        className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white shadow-lg shadow-primary/25"
      >
        Commencer gratuitement
      </Link>
    </motion.div>
  )
}
