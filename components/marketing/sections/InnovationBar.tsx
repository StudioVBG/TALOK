"use client"

import { motion } from "framer-motion"
import { bounceIn, slideFromRight } from "@/components/marketing/hooks"

const items = [
  { emoji: "🤖", title: "Intelligence artificielle", desc: "Incluse dans tous les plans" },
  { emoji: "✅", title: "Toujours conforme à la loi", desc: "Mis à jour automatiquement" },
  { emoji: "📱", title: "App iPhone & Android", desc: "Gérez depuis votre téléphone" },
  { emoji: "🔒", title: "Données sécurisées en France", desc: "Hébergement français certifié" },
  { emoji: "🇲🇶", title: "Né en Martinique", desc: "France d\u2019outre-mer intégrée nativement" },
]

const itemStagger = {
  hidden: {},
  visible: (i: number) => ({
    transition: { staggerChildren: 0.08, delayChildren: i * 0.12 },
  }),
}

export function InnovationBar() {
  return (
    <section className="border-y border-slate-100 bg-slate-50 py-6 md:py-7">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="mx-auto max-w-[1100px] px-4"
      >
        <div
          className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:pb-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              variants={itemStagger}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="flex min-w-[160px] shrink-0 items-center gap-3 lg:min-w-0"
              style={{ scrollSnapAlign: "start" }}
            >
              {/* Emoji with bounce-in */}
              <motion.span variants={bounceIn} className="text-[28px]">
                {item.emoji}
              </motion.span>
              {/* Text slides from right */}
              <motion.div variants={slideFromRight}>
                <div className="text-[14px] font-medium text-[#1B2A6B] whitespace-nowrap">{item.title}</div>
                <div className="text-[12px] text-slate-500 whitespace-nowrap">{item.desc}</div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
