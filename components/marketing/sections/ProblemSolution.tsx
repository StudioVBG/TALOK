"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { fadeUp, staggerContainer } from "@/components/marketing/AnimatedSection"
import { blurUp, drawPath } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const before = [
  "Tableur Excel pour suivre les loyers",
  "Contrats perdus dans Google Drive",
  "Relances à la main par SMS",
  "Reçus de loyer à rédiger chaque mois",
  "Déclaration fiscale = 1 semaine de travail",
]

const after = [
  "Loyers encaissés automatiquement",
  "Contrats signés en ligne en 5 minutes",
  "Relances automatiques si retard",
  "Reçus de loyer envoyés automatiquement",
  "Export pour votre comptable en 1 clic",
]

const xStrike = {
  hidden: { opacity: 0, scale: 1.4, rotate: -45 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 12 },
  },
}

const checkBounce = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 600, damping: 12 },
  },
}

/* Animated strikethrough line */
const strikeLine = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 0.4, delay: 0.2, ease },
  },
}

export function ProblemSolution({ images }: { images?: Record<string, string> }) {
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      {images?.landing_beforeafter_img && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={images.landing_beforeafter_img}
            alt=""
            fill
            className="object-cover opacity-[0.04]"
            sizes="100vw"
          />
        </div>
      )}
      <div className="mx-auto max-w-[1100px] px-4">
        {/* Header */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.div variants={blurUp} className="mb-3">
            <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
              Le problème
            </span>
          </motion.div>
          <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
            Vous gérez vos locations avec 5&nbsp;outils différents&nbsp;?
          </motion.h2>
          <motion.p variants={blurUp} className="mx-auto mt-4 max-w-xl text-base text-slate-500">
            Excel, Google Drive, WhatsApp, Word…
            TALOK remplace tout ça en une seule plateforme.
          </motion.p>
        </motion.div>

        {/* Columns */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Before */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="rounded-2xl border-l-4 border-l-[#EF4444] border border-red-100 bg-red-50/50 p-6 md:p-8"
          >
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-red-600">
              Avant TALOK
            </h3>
            <div className="space-y-4">
              {before.map((text) => (
                <motion.div key={text} variants={fadeUp} className="flex items-start gap-3">
                  <motion.span
                    variants={xStrike}
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-[#EF4444]"
                  >
                    ✕
                  </motion.span>
                  <span className="relative text-[14px] text-slate-500">
                    {text}
                    {/* Animated strikethrough */}
                    <motion.span
                      variants={strikeLine}
                      className="absolute left-0 top-1/2 h-[1px] w-full origin-left bg-red-300/60"
                    />
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="rounded-2xl border-l-4 border-l-[#2563EB] border border-[#2563EB]/20 bg-[#2563EB]/5 p-6 md:p-8"
          >
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-[#2563EB]">
              Avec TALOK
            </h3>
            <div className="space-y-4">
              {after.map((text) => (
                <motion.div key={text} variants={fadeUp} className="flex items-start gap-3">
                  {/* SVG checkmark with draw animation */}
                  <motion.span
                    variants={checkBounce}
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/10"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <motion.path
                        d="M2 6.5L5 9.5L10 3"
                        stroke="#22C55E"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        variants={drawPath}
                      />
                    </svg>
                  </motion.span>
                  <span className="text-[14px] text-slate-700">{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
