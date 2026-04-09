"use client"

import { motion } from "framer-motion"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { blurUp, bounceIn } from "@/components/marketing/hooks"
import { Building2, Home, BedDouble, Users } from "lucide-react"

const propertyTypes = [
  {
    icon: Building2,
    title: "Appartement",
    desc: "Du studio au T5, en location vide ou meublée. Gestion complète du bail à la quittance.",
    features: ["Bail vide ou meublé", "Charges récupérables", "Régularisation annuelle"],
    gradient: "from-blue-500 to-indigo-500",
    bgLight: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    icon: Home,
    title: "Maison",
    desc: "Maison individuelle ou mitoyenne. Jardin, garage, dépendances — tout est prévu.",
    features: ["Annexes & dépendances", "Compteurs individuels", "Entretien extérieur"],
    gradient: "from-emerald-500 to-teal-500",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
  },
  {
    icon: BedDouble,
    title: "Studio / Meublé",
    desc: "Inventaire du mobilier intégré. Bail meublé conforme avec préavis réduit à 1 mois.",
    features: ["Inventaire mobilier", "Bail meublé conforme", "Préavis 1 mois"],
    gradient: "from-amber-500 to-orange-500",
    bgLight: "bg-amber-50",
    textColor: "text-amber-700",
  },
  {
    icon: Users,
    title: "Colocation",
    desc: "Bail unique ou individuel par colocataire. Clause de solidarité et répartition des charges.",
    features: ["Bail individuel ou collectif", "Clause de solidarité", "Répartition des charges"],
    gradient: "from-violet-500 to-purple-500",
    bgLight: "bg-violet-50",
    textColor: "text-violet-700",
  },
]

export function PropertyTypes() {
  return (
    <section className="bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4">
        {/* Header */}
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.div variants={blurUp} className="mb-3">
            <span className="inline-block rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-semibold text-[#2563EB]">
              Types de biens
            </span>
          </motion.div>
          <motion.h2
            variants={blurUp}
            className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]"
          >
            Quel que soit votre bien, TALOK s&apos;adapte
          </motion.h2>
          <motion.p variants={blurUp} className="mx-auto mt-4 max-w-xl text-base text-slate-500">
            Appartement, maison, studio ou colocation — chaque type de bien
            a ses particularités. TALOK les connaît toutes.
          </motion.p>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {propertyTypes.map((type) => (
            <motion.div
              key={type.title}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg"
            >
              {/* Icon */}
              <motion.div
                variants={bounceIn}
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${type.gradient}`}
              >
                <type.icon className="h-6 w-6 text-white" />
              </motion.div>

              {/* Title & description */}
              <h3 className="mb-2 font-display text-lg font-bold text-[#1B2A6B]">
                {type.title}
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-slate-500">
                {type.desc}
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5">
                {type.features.map((f) => (
                  <span
                    key={f}
                    className={`rounded-full ${type.bgLight} px-2.5 py-0.5 text-[11px] font-medium ${type.textColor}`}
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${type.gradient} opacity-[0.06]`} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
