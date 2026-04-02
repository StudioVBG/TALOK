"use client"

import { motion } from "framer-motion"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { blurUp, bounceIn, useCountUp } from "@/components/marketing/hooks"

const territories = [
  { name: "Martinique", emoji: "🇲🇶" },
  { name: "Guadeloupe", emoji: "🇬🇵" },
  { name: "Guyane", emoji: "🇬🇫" },
  { name: "Réunion", emoji: "🇷🇪" },
]

function TvaRate({ label, target, decimals = 1 }: { label: string; target: number; decimals?: number }) {
  const { ref, display } = useCountUp(target, 1.2, { suffix: " %", decimals })
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <span ref={ref} className="rounded-lg bg-white/10 px-3 py-1 text-sm font-bold">
        {display}
      </span>
    </div>
  )
}

export function OutreMer() {
  return (
    <section className="relative overflow-hidden bg-[#1E293B] py-16 text-white md:py-24">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] bg-[length:200%_200%]"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative z-10 mx-auto max-w-[1100px] px-4">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          {/* Left: text */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div variants={blurUp} className="mb-3">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                France d&apos;outre-mer
              </span>
            </motion.div>
            <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold sm:text-[32px] md:text-[36px]">
              Conçu pour la France entière — y compris là où les autres s&apos;arrêtent.
            </motion.h2>
            <motion.p variants={blurUp} className="mt-4 text-base leading-relaxed text-slate-300">
              TALOK est né en Martinique. Pas adapté — né ici.
              La TVA spécifique à chaque DROM, les codes postaux,
              les particularités locales : tout est intégré nativement
              dès le premier jour.
            </motion.p>

            {/* Territory cards with staggered blur-in + emoji bounce */}
            <motion.div
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {territories.map((t) => (
                <motion.div
                  key={t.name}
                  variants={{
                    hidden: { opacity: 0, scale: 0.8, filter: "blur(8px)" },
                    visible: {
                      opacity: 1,
                      scale: 1,
                      filter: "blur(0px)",
                      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
                    },
                  }}
                  whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                  className="rounded-xl bg-white/[0.08] p-4 text-center backdrop-blur-sm border border-white/20"
                >
                  <motion.span
                    variants={bounceIn}
                    className="inline-block text-2xl"
                  >
                    {t.emoji}
                  </motion.span>
                  <div className="mt-1 text-xs font-medium">{t.name}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: TVA card */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <motion.div
              variants={fadeUp}
              className="rounded-2xl bg-white/5 p-6 backdrop-blur-sm ring-1 ring-white/10 md:p-8"
            >
              <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-300">
                TVA automatique
              </h3>
              <div className="space-y-4">
                <TvaRate label="Martinique / Guadeloupe / Réunion" target={8.5} />
                <TvaRate label="Guyane" target={2.1} />
                <TvaRate label="Mayotte" target={0} decimals={0} />
                <TvaRate label="Métropole" target={20} decimals={0} />
              </div>
              <div className="mt-6 rounded-xl bg-[#2563EB]/20 p-4">
                <p className="text-sm text-[#93C5FD]">
                  Support basé aux Antilles — nous comprenons votre marché.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
