"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { fadeUp, staggerContainer } from "@/components/marketing/AnimatedSection"
import { bounceIn, blurUp, use3DTilt, useCountUp } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

function CountUpValue({ target, suffix }: { target: number; suffix: string }) {
  const { ref, display } = useCountUp(target, 1.2, { suffix })
  return <span ref={ref}>{display}</span>
}

const cards = [
  {
    emoji: "⏱️",
    imageKey: "landing_arg_time_img",
    title: "Gagnez 3h par semaine",
    body: "Loyers encaissés, reçus envoyés, relances faites — tout automatiquement. Vous vous occupez du reste.",
    badge: "3h économisées par semaine",
    badgeColor: "bg-[#2563EB]/10 text-[#2563EB]",
    countTarget: 3,
    countSuffix: "h",
  },
  {
    emoji: "💶",
    imageKey: "landing_arg_money_img",
    title: "Économisez jusqu\u2019à 2\u00A0000\u00A0€/an",
    body: "Une agence prend 7 à 8\u00A0% de vos loyers. TALOK vous coûte 35\u00A0€/mois. Sans intermédiaire.",
    badge: "Vs une agence classique",
    badgeColor: "bg-[#22C55E]/10 text-[#22C55E]",
    countTarget: 2000,
    countSuffix: " €",
  },
  {
    emoji: "📋",
    imageKey: "landing_arg_contract_img",
    title: "Contrats signés en 5 minutes",
    body: "Votre locataire signe depuis son téléphone. Pas d\u2019imprimante, pas de déplacement. La signature a la même valeur légale qu\u2019un original papier.",
    badge: "Valeur légale garantie",
    badgeColor: "bg-[#F59E0B]/10 text-[#F59E0B]",
    countTarget: 5,
    countSuffix: " min",
  },
  {
    emoji: "🛡️",
    imageKey: "landing_arg_sleep_img",
    title: "Dormez tranquille",
    body: "La loi change souvent. TALOK se met à jour automatiquement. Vos contrats sont toujours dans les règles. Zéro risque juridique.",
    badge: "Mis à jour à chaque nouvelle loi",
    badgeColor: "bg-purple-100 text-purple-700",
    countTarget: 0,
    countSuffix: "",
  },
]

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const tilt = use3DTilt(8)
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

export function Arguments({ images }: { images?: Record<string, string> }) {
  return (
    <section className="bg-slate-50 py-16 md:py-24">
      <motion.div
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="mx-auto grid max-w-[1100px] gap-5 px-4 sm:grid-cols-2"
      >
        {cards.map((card) => (
          <motion.div key={card.title} variants={fadeUp}>
            <TiltCard className="h-full rounded-2xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-lg flex flex-col gap-4">
              {/* Image or emoji fallback */}
              {images?.[card.imageKey] ? (
                <motion.div
                  variants={bounceIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="relative h-32 md:h-40 w-full overflow-hidden rounded-xl"
                >
                  <Image
                    src={images[card.imageKey]}
                    alt={card.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                    loading="lazy"
                  />
                </motion.div>
              ) : (
                <motion.span
                  variants={bounceIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="inline-block text-3xl"
                >
                  {card.emoji}
                </motion.span>
              )}
              <h3 className="font-display text-xl font-extrabold text-[#1B2A6B]">
                {card.title}
              </h3>
              <p className="text-[14px] leading-[1.7] text-[#64748B]">
                {card.body}
              </p>
              {/* Badge with spring entrance */}
              <motion.span
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    transition: { type: "spring" as const, stiffness: 400, damping: 15, delay: 0.2 },
                  },
                }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className={`inline-block rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${card.badgeColor}`}
              >
                {card.badge}
              </motion.span>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
