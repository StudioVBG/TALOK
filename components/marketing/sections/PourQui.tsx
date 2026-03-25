"use client"

import { motion } from "framer-motion"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { bounceIn, blurUp } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const personas = [
  {
    emoji: "🏡",
    title: "Propriétaire particulier",
    subtitle: "1 à 10 logements",
    body: "Vous voulez gérer vous-même, sans agence, sans vous tromper juridiquement. TALOK vous guide pas à pas.",
    price: "Gratuit → Confort · 0 à 35\u00A0€/mois",
    featured: false,
  },
  {
    emoji: "📈",
    title: "Investisseur / SCI",
    subtitle: "Plusieurs biens & entités",
    body: "Vision patrimoniale globale, comptabilité pour votre expert-comptable, gestion multi-entités. TALOK s\u2019adapte à votre complexité.",
    price: "Confort → Pro · 35 à 69\u00A0€/mois",
    featured: true,
  },
  {
    emoji: "🏢",
    title: "Agence / Gestionnaire",
    subtitle: "Portefeuille multi-propriétaires",
    body: "Votre propre marque, vos propres couleurs, API complète. Gérez des centaines de biens sous votre identité.",
    price: "Enterprise · à partir de 249\u00A0€/mois",
    featured: false,
  },
]

/* Glow animation for featured card */
const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(37, 99, 235, 0)",
      "0 0 20px 4px rgba(37, 99, 235, 0.15)",
      "0 0 0 0 rgba(37, 99, 235, 0)",
    ],
    transition: { duration: 3, repeat: Infinity },
  },
}

export function PourQui() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4">
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.div variants={blurUp} className="mb-3">
            <span className="inline-block rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-semibold text-[#2563EB]">
              Pour qui ?
            </span>
          </motion.div>
          <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
            Une solution pour chaque profil
          </motion.h2>
        </motion.div>

        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 md:grid-cols-3"
        >
          {personas.map((p) => (
            <motion.div
              key={p.title}
              variants={p.featured ? {
                hidden: { opacity: 0, scale: 0.9, filter: "blur(10px)" },
                visible: {
                  opacity: 1,
                  scale: 1,
                  filter: "blur(0px)",
                  transition: { duration: 0.7, ease },
                },
              } : fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              {...(p.featured ? glowPulse : {})}
              className={`rounded-2xl border p-6 md:p-8 ${
                p.featured
                  ? "border-[#2563EB] bg-[#2563EB]/5 shadow-lg"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {p.featured && (
                <span className="mb-4 inline-block rounded-full bg-[#2563EB] px-3 py-0.5 text-[10px] font-bold text-white">
                  Le plus populaire
                </span>
              )}
              <motion.span
                variants={bounceIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="inline-block text-3xl"
              >
                {p.emoji}
              </motion.span>
              <h3 className="mt-3 font-display text-lg font-bold text-[#1B2A6B]">{p.title}</h3>
              <p className="text-xs text-slate-400">{p.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.body}</p>
              <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-[#1B2A6B]">
                {p.price}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
