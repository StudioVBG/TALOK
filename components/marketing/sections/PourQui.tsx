"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { bounceIn, blurUp } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const personas = [
  {
    emoji: "🏡",
    imageKey: "landing_profile_owner_img",
    title: "Propriétaire particulier",
    subtitle: "1 à 10 logements",
    body: "Vous voulez gérer vous-même, sans agence, sans vous tromper juridiquement. TALOK vous guide pas à pas.",
    price: "Gratuit → Confort · 0 à 35 €/mois",
    href: "/solutions/proprietaires-particuliers",
    featured: false,
  },
  {
    emoji: "📈",
    imageKey: "landing_profile_investor_img",
    title: "Investisseur / SCI",
    subtitle: "Plusieurs biens & entités",
    body: "Vision patrimoniale globale, comptabilité pour votre expert-comptable, gestion multi-entités. TALOK s’adapte à votre complexité.",
    price: "Confort → Pro · 35 à 69 €/mois",
    href: "/solutions/investisseurs",
    featured: true,
  },
  {
    emoji: "🏢",
    imageKey: "landing_profile_agency_img",
    title: "Agence / Gestionnaire",
    subtitle: "Portefeuille multi-propriétaires",
    body: "Votre propre marque, vos propres couleurs, API complète. Gérez des centaines de biens sous votre identité.",
    price: "Enterprise · à partir de 249 €/mois",
    href: "/solutions/administrateurs-biens",
    featured: false,
  },
  {
    emoji: "🏛️",
    imageKey: "",
    title: "Syndic de copropriété",
    subtitle: "Bénévole ou professionnel",
    body: "Appels de fonds, AG en ligne, comptabilité copro, extranet copropriétaires. Tout ce qu’il faut pour piloter votre immeuble.",
    price: "Inclus dans Pro & Enterprise",
    href: "/solutions/syndics",
    featured: false,
  },
  {
    emoji: "👥",
    imageKey: "",
    title: "Locataire & colocataire",
    subtitle: "Inclus pour vos locataires",
    body: "Espace dédié pour payer le loyer, signer le bail, déclarer un incident, suivre ses droits. Garants invités gratuitement.",
    price: "Gratuit · Toujours inclus",
    href: "/solutions/locataires",
    featured: false,
  },
  {
    emoji: "🔧",
    imageKey: "",
    title: "Prestataire / Artisan",
    subtitle: "Plombier, électricien, BTP…",
    body: "Recevez des missions, envoyez vos devis, gérez votre planning et facturez en ligne. Visible auprès de milliers de bailleurs.",
    price: "Gratuit · Inscription en 5 min",
    href: "/solutions/prestataires",
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

export function PourQui({ images }: { images?: Record<string, string> }) {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-4">
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.div variants={blurUp} className="mb-3">
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Pour qui ?
            </span>
          </motion.div>
          <motion.h2
            variants={blurUp}
            className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]"
          >
            Une solution pour chaque profil
          </motion.h2>
          <motion.p
            variants={blurUp}
            className="mx-auto mt-3 max-w-2xl text-sm text-slate-500 md:text-base"
          >
            7 espaces, une seule plateforme. Bailleur, locataire, prestataire, syndic — chacun a ses outils, en parlant la même langue.
          </motion.p>
        </motion.div>

        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
              className={`group relative flex flex-col rounded-2xl border bg-card overflow-hidden ${
                p.featured
                  ? "border-primary shadow-lg"
                  : "border-slate-200 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
              }`}
            >
              {p.featured && (
                <span className="absolute top-3 left-3 z-10 inline-block rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold text-white">
                  Le plus populaire
                </span>
              )}
              {/* Image header with gradient overlay */}
              {p.imageKey && images?.[p.imageKey] ? (
                <div className="relative h-32 md:h-40">
                  <Image
                    src={images[p.imageKey]}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                </div>
              ) : (
                <div className="px-6 pt-6 md:px-8 md:pt-8">
                  <motion.span
                    variants={bounceIn}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="inline-block text-3xl"
                  >
                    {p.emoji}
                  </motion.span>
                </div>
              )}
              {/* Card content */}
              <div className="flex flex-1 flex-col p-6 md:p-8">
                <h3 className="font-display text-lg font-bold text-[#1B2A6B]">{p.title}</h3>
                <p className="text-xs text-slate-400">{p.subtitle}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">{p.body}</p>
                <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-[#1B2A6B]">
                  {p.price}
                </div>
                <Link
                  href={p.href}
                  className="mt-4 inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Voir la solution
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
