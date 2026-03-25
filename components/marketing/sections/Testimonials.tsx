"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { blurUp, bounceIn, scaleSpring } from "@/components/marketing/hooks"

const testimonials = [
  {
    name: "Sophie L.",
    role: "Propriétaire · Martinique",
    initials: "SL",
    color: "bg-blue-100 text-blue-700",
    text: "J\u2019ai arrêté de payer mon agence et je gère mes 3 appartements seule depuis TALOK. J\u2019économise plus de 2\u00A0000\u00A0€ par an et je passe 10 fois moins de temps sur l\u2019administratif.",
  },
  {
    name: "David M.",
    role: "Investisseur, SCI · Lyon",
    initials: "DM",
    color: "bg-green-100 text-green-700",
    text: "Mon comptable m\u2019avait dit que ma gestion était un chaos. Depuis TALOK, tout est organisé. En fin d\u2019année, j\u2019exporte mes données et c\u2019est réglé en 30 minutes au lieu d\u2019une semaine.",
  },
  {
    name: "Marie-K.",
    role: "Propriétaire · Guadeloupe",
    initials: "MK",
    color: "bg-amber-100 text-amber-700",
    text: "Enfin un logiciel qui comprend les spécificités de la Guadeloupe. La TVA, les contrats locaux — tout est déjà configuré. Je recommande à tous les propriétaires de France d\u2019outre-mer.",
  },
]

export function Testimonials() {
  const [current, setCurrent] = useState(0)

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -60 && current < testimonials.length - 1) {
      setCurrent(current + 1)
    } else if (info.offset.x > 60 && current > 0) {
      setCurrent(current - 1)
    }
  }

  return (
    <section className="bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4">
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.div variants={blurUp} className="mb-3">
            <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
              Témoignages
            </span>
          </motion.div>
          <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
            Ils gèrent seuls grâce à TALOK
          </motion.h2>
        </motion.div>

        {/* Desktop: 3 cols */}
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="hidden gap-6 md:grid md:grid-cols-3"
        >
          {testimonials.map((t) => (
            <TestimonialCard key={t.name} t={t} />
          ))}
        </motion.div>

        {/* Mobile: swipeable carousel */}
        <div className="md:hidden">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 40, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -40, filter: "blur(6px)" }}
                transition={{ duration: 0.3 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                className="cursor-grab active:cursor-grabbing"
              >
                <TestimonialCard t={testimonials[current]} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-6 bg-[#2563EB]" : "w-2 bg-slate-300"
                }`}
                aria-label={`Témoignage ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({ t }: { t: (typeof testimonials)[number] }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
    >
      {/* Stars with sequential scale-in */}
      <div className="mb-4 flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            variants={scaleSpring}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="text-[18px] text-[#F59E0B]"
          >
            ★
          </motion.span>
        ))}
      </div>
      {/* Text with blur-in */}
      <motion.p
        variants={blurUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="text-[14px] italic leading-[1.75] text-slate-600"
      >
        &ldquo;{t.text}&rdquo;
      </motion.p>
      <div className="mt-5 flex items-center gap-3">
        {/* Avatar with bounce */}
        <motion.div
          variants={bounceIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${t.color}`}
        >
          {t.initials}
        </motion.div>
        <div>
          <div className="text-sm font-semibold text-[#1B2A6B]">{t.name}</div>
          <div className="text-xs text-slate-400">{t.role}</div>
        </div>
      </div>
    </motion.div>
  )
}
