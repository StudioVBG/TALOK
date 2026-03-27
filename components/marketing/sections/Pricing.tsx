"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { blurUp, useCountUp, use3DTilt } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

function PriceCountUp({ target }: { target: number }) {
  const { ref, display } = useCountUp(target, 1, { suffix: "€" })
  return (
    <span ref={ref} className="font-display text-[36px] font-bold text-[#1B2A6B]">
      {display}
    </span>
  )
}

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const tilt = use3DTilt(6)
  return (
    <motion.div
      ref={tilt.ref}
      animate={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
      transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
      style={{ transformPerspective: 800 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const plans = [
  {
    name: "Gratuit",
    price: 0,
    period: "",
    desc: "Pour découvrir",
    features: ["1 logement", "1 contrat", "Tableau de bord basique"],
    cta: "Commencer",
    ctaStyle: "border border-slate-200 bg-card text-slate-700 hover:bg-slate-50",
    featured: false,
  },
  {
    name: "Starter",
    price: 9,
    period: "/mois",
    desc: "1 à 3 logements",
    features: ["3 logements", "1 Go de documents", "Paiements en ligne", "Reçus automatiques"],
    cta: "1er mois offert",
    ctaStyle: "border border-[#2563EB] bg-card text-[#2563EB] hover:bg-[#2563EB]/5",
    featured: false,
  },
  {
    name: "Confort",
    price: 35,
    period: "/mois",
    desc: "Jusqu\u2019à 10 logements",
    features: [
      "10 logements",
      "2 signatures/mois incluses",
      "État des lieux inclus",
      "5 Go de stockage",
      "Relances automatiques",
    ],
    cta: "Choisir Confort",
    ctaStyle: "bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/25 hover:bg-[#2563EB]/90",
    featured: true,
  },
  {
    name: "Pro",
    price: 69,
    period: "/mois",
    desc: "Investisseurs & SCI",
    features: [
      "50 logements",
      "10 signatures/mois",
      "Export comptable complet",
      "30 Go de stockage",
      "Multi-utilisateurs (5)",
    ],
    cta: "1er mois offert",
    ctaStyle: "border border-[#2563EB] bg-card text-[#2563EB] hover:bg-[#2563EB]/5",
    featured: false,
  },
]

/* Glow pulse for featured card */
const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(37, 99, 235, 0)",
      "0 0 24px 6px rgba(37, 99, 235, 0.12)",
      "0 0 0 0 rgba(37, 99, 235, 0)",
    ],
    transition: { duration: 3, repeat: Infinity },
  },
}

export function Pricing() {
  return (
    <section id="tarifs" className="py-16 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4">
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
            Le bon plan pour votre situation
          </motion.h2>
          <motion.p variants={blurUp} className="mx-auto mt-4 max-w-xl text-base text-slate-500">
            Premier mois offert sur tous les plans payants.
            Sans engagement. Résiliable quand vous voulez.
          </motion.p>
        </motion.div>

        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:pb-0"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              style={{ scrollSnapAlign: "center" }}
              className="min-w-[260px] shrink-0 md:min-w-0"
            >
              <TiltCard
                className={`flex h-full flex-col rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-2 border-[#2563EB] bg-[#2563EB]/5 shadow-lg shadow-[#2563EB]/10"
                    : "border-slate-200 bg-card shadow-sm"
                }`}
              >
                <motion.div {...(plan.featured ? glowPulse : {})}>
                  {plan.featured && (
                    <span className="mb-3 inline-block rounded-full bg-[#EFF6FF] px-3 py-1 text-[11px] font-semibold text-[#1D4ED8]">
                      ⭐ Le plus choisi
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-[#1B2A6B]">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <PriceCountUp target={plan.price} />
                    {plan.period && <span className="text-sm text-slate-400">{plan.period}</span>}
                  </div>
                  <p className="mt-1 text-[13px] text-[#64748B]">{plan.desc}</p>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((f, i) => (
                      <motion.li
                        key={f}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: {
                            opacity: 1,
                            x: 0,
                            transition: { delay: 0.3 + i * 0.06, ease },
                          },
                        }}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 text-[8px] text-[#2563EB]">
                          ✓
                        </span>
                        {f}
                      </motion.li>
                    ))}
                  </ul>

                  <Link
                    href="/auth/signup"
                    className={`mt-6 block rounded-xl py-3 text-center text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] ${plan.ctaStyle}`}
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-8 text-center text-sm text-slate-400"
        >
          Plans pour gestionnaires et agences à partir de 249&nbsp;€/mois
        </motion.p>
      </div>
    </section>
  )
}
