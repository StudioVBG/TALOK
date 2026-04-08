"use client"

import { motion } from "framer-motion"
import { fadeUp } from "@/components/marketing/AnimatedSection"
import { blurUp, bounceIn, drawPath } from "@/components/marketing/hooks"
import { Check, X, Minus } from "lucide-react"

type CellValue = true | false | "partial" | string

interface Competitor {
  name: string
  highlight?: boolean
  features: CellValue[]
}

const featureRows = [
  "Gestion des baux (création + signature)",
  "Encaissement des loyers en ligne",
  "Reçus de loyer automatiques",
  "Relances automatiques",
  "État des lieux numérique",
  "Comptabilité locative + export",
  "Application mobile",
  "France d\u2019outre-mer (TVA, spécificités)",
  "Intelligence artificielle intégrée",
  "Multi-biens illimité (plan Pro)",
  "Support en français",
  "Plan gratuit disponible",
]

const competitors: Competitor[] = [
  {
    name: "TALOK",
    highlight: true,
    features: [true, true, true, true, true, true, true, true, true, true, true, true],
  },
  {
    name: "Rentila",
    features: [true, false, true, "partial", false, true, false, false, false, true, true, true],
  },
  {
    name: "BailFacile",
    features: [true, true, true, "partial", false, false, false, false, false, "partial", true, false],
  },
  {
    name: "Gérerseul",
    features: [true, false, true, false, false, "partial", false, false, false, true, true, true],
  },
]

function CellIcon({ value }: { value: CellValue }) {
  if (value === true) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E]/10">
        <Check className="h-3 w-3 text-[#22C55E]" strokeWidth={3} />
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50">
        <X className="h-3 w-3 text-red-400" strokeWidth={3} />
      </span>
    )
  }
  if (value === "partial") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50">
        <Minus className="h-3 w-3 text-amber-500" strokeWidth={3} />
      </span>
    )
  }
  return <span className="text-xs text-slate-600">{value}</span>
}

export function CompetitorComparison() {
  return (
    <section className="py-16 md:py-24">
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
              Comparatif
            </span>
          </motion.div>
          <motion.h2
            variants={blurUp}
            className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]"
          >
            Pourquoi TALOK plutôt qu&apos;un autre&nbsp;?
          </motion.h2>
          <motion.p variants={blurUp} className="mx-auto mt-4 max-w-xl text-base text-slate-500">
            Comparez les fonctionnalités essentielles. TALOK est le seul
            à tout inclure — y compris l&apos;outre-mer et l&apos;IA.
          </motion.p>
        </motion.div>

        {/* Desktop table */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Fonctionnalité
                  </th>
                  {competitors.map((c) => (
                    <th
                      key={c.name}
                      className={`px-4 py-4 text-center text-sm font-bold ${
                        c.highlight
                          ? "bg-[#2563EB]/5 text-[#2563EB]"
                          : "text-slate-600"
                      }`}
                    >
                      {c.highlight && (
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">
                          Recommandé
                        </span>
                      )}
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureRows.map((feature, i) => (
                  <motion.tr
                    key={feature}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      visible: {
                        opacity: 1,
                        x: 0,
                        transition: { delay: i * 0.03, duration: 0.3 },
                      },
                    }}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-5 py-3 text-slate-600">{feature}</td>
                    {competitors.map((c) => (
                      <td
                        key={`${c.name}-${feature}`}
                        className={`px-4 py-3 text-center ${
                          c.highlight ? "bg-[#2563EB]/[0.02]" : ""
                        }`}
                      >
                        <span className="inline-flex items-center justify-center">
                          <CellIcon value={c.features[i]} />
                        </span>
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Mobile: stacked cards */}
        <div className="space-y-4 md:hidden">
          {competitors.map((comp) => (
            <motion.div
              key={comp.name}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className={`rounded-2xl border p-5 ${
                comp.highlight
                  ? "border-2 border-[#2563EB] bg-[#2563EB]/5"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3
                  className={`font-display text-lg font-bold ${
                    comp.highlight ? "text-[#2563EB]" : "text-[#1B2A6B]"
                  }`}
                >
                  {comp.name}
                </h3>
                {comp.highlight && (
                  <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-bold text-white">
                    Recommandé
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {featureRows.map((feature, i) => (
                  <div key={feature} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">{feature}</span>
                    <CellIcon value={comp.features[i]} />
                  </div>
                ))}
              </div>
              {comp.highlight && (
                <div className="mt-4 text-center">
                  <span className="text-xs font-semibold text-[#22C55E]">
                    12/12 fonctionnalités incluses
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#22C55E]/10">
              <Check className="h-2.5 w-2.5 text-[#22C55E]" strokeWidth={3} />
            </span>
            Inclus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-50">
              <Minus className="h-2.5 w-2.5 text-amber-500" strokeWidth={3} />
            </span>
            Partiel
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-50">
              <X className="h-2.5 w-2.5 text-red-400" strokeWidth={3} />
            </span>
            Non disponible
          </span>
        </motion.div>
      </div>
    </section>
  )
}
