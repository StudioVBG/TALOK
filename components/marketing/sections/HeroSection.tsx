"use client"

import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { DashboardMockup } from "@/components/marketing/DashboardMockup"
import { staggerContainer } from "@/components/marketing/AnimatedSection"
import { blurWord, blurUp, useMagnetic } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const heroStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const reassurances = [
  "Gratuit pour commencer, sans carte bancaire",
  "Contrats toujours à jour avec la loi",
  "Application mobile iPhone et Android incluse",
]

/* ─── Split Text component ─── */
function SplitHeading() {
  const line1 = ["TALOK", "—"]
  const le = "LE"
  const line2 = ["Logiciel", "de", "Gestion", "Locative"]

  return (
    <motion.h1
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      initial="hidden"
      animate="visible"
      className="mt-6 font-display text-[40px] font-extrabold leading-[1.08] tracking-tight text-[#1B2A6B] sm:text-[48px] md:text-[52px] lg:text-[56px]"
    >
      {line1.map((word, i) => (
        <motion.span key={i} variants={blurWord(0)} className="mr-[0.3em] inline-block">
          {word}
        </motion.span>
      ))}
      {/* Animated gradient "LE" */}
      <motion.span
        variants={blurWord(0)}
        className="mr-[0.3em] inline-block bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#2563EB] bg-[length:200%_auto] bg-clip-text text-transparent"
        style={{ fontSize: "1.2em" }}
        animate={{ backgroundPosition: ["0% center", "200% center"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      >
        {le}
      </motion.span>
      <br className="hidden sm:block" />
      {line2.map((word, i) => (
        <motion.span key={i} variants={blurWord(0)} className="mr-[0.3em] inline-block">
          {word}
        </motion.span>
      ))}
    </motion.h1>
  )
}

/* ─── Magnetic CTA ─── */
function MagneticCTA() {
  const mag = useMagnetic(0.25)

  return (
    <motion.div
      ref={mag.ref}
      animate={{ x: mag.x, y: mag.y }}
      transition={{ type: "spring" as const, stiffness: 150, damping: 15 }}
      className="inline-block"
    >
      <Link
        href="/auth/signup"
        className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-[#2563EB] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#2563EB]/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {/* Glow effect */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <span className="relative">Commencer gratuitement</span>
      </Link>
    </motion.div>
  )
}

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })
  // Parallax: orbs move slower than scroll
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 120])
  // Dashboard moves opposite
  const dashY = useTransform(scrollYProgress, [0, 1], [0, -30])

  return (
    <section ref={sectionRef} className="relative overflow-hidden pb-20 pt-24 md:pb-28 md:pt-28 lg:pt-36">
      {/* Background with parallax orbs */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
      <motion.div
        style={{ y: orbY }}
        className="absolute right-0 top-0 h-[600px] w-[600px] -translate-y-1/3 translate-x-1/3 rounded-full bg-[#2563EB]/5 blur-3xl"
      />
      <motion.div
        style={{ y: orbY }}
        className="absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/3 -translate-x-1/3 rounded-full bg-[#2563EB]/3 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-[1100px] px-4">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* Left: Copy */}
          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div variants={blurUp}>
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-medium text-[#1B2A6B] shadow-sm ring-1 ring-slate-100">
                🇲🇶 Né en Martinique · Pour toute la France
              </span>
            </motion.div>

            {/* H1 — Split text with blur-in per word */}
            <SplitHeading />

            {/* Subtitle — blur-in */}
            <motion.p
              variants={blurUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
              className="mt-6 max-w-lg text-[16px] leading-[1.7] text-slate-500 sm:text-[18px]"
            >
              Gérez vos locations, encaissez vos loyers et dormez tranquille.
              Tout ce qu&apos;une agence fait à 8&nbsp;% — vous le faites seul,
              pour moins de 35&nbsp;€/mois.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={blurUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.55 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <MagneticCTA />
              <a
                href="#fonctionnalites"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-card px-8 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Voir une démo
              </a>
            </motion.div>

            {/* Reassurances — stagger blur-in */}
            <motion.div
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.7 } } }}
              initial="hidden"
              animate="visible"
              className="mt-8 space-y-2"
            >
              {reassurances.map((text) => (
                <motion.div
                  key={text}
                  variants={blurUp}
                  className="flex items-center gap-2 text-sm text-slate-500"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/10 text-[10px] text-[#22C55E]">
                    ✓
                  </span>
                  {text}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: Dashboard with parallax */}
          <motion.div
            style={{ y: dashY }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
