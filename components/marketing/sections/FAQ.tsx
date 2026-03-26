"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { staggerContainer } from "@/components/marketing/AnimatedSection"
import { blurUp } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const faqs = [
  {
    q: "Puis-je vraiment gérer mes locations sans agence\u00A0?",
    a: "Oui. TALOK fait tout ce qu\u2019une agence fait : contrats, encaissement des loyers, relances, reçus, comptabilité. La différence\u00A0? Vous gardez le contrôle — et vous ne payez pas 8\u00A0% de vos loyers.",
  },
  {
    q: "Est-ce que mes contrats seront toujours légaux\u00A0?",
    a: "Oui. La loi évolue souvent en matière de location. TALOK met automatiquement à jour ses modèles de contrats pour être toujours conforme. Vous n\u2019avez rien à surveiller.",
  },
  {
    q: "Comment mon locataire signe-t-il le contrat\u00A0?",
    a: "Votre locataire reçoit un lien par email ou SMS. Il lit le contrat, vérifie son identité avec un code, et signe depuis son téléphone. La signature a la même valeur légale qu\u2019un original papier.",
  },
  {
    q: "Y a-t-il des frais cachés\u00A0?",
    a: "Non. Le prix affiché est le prix que vous payez. Les seuls frais en plus sont ceux des transactions de paiement (carte bancaire ou prélèvement), qui sont clairement indiqués dès le départ.",
  },
  {
    q: "Puis-je essayer avant de payer\u00A0?",
    a: "Oui, le plan Gratuit est illimité dans le temps. Vous pouvez gérer 1 logement gratuitement, sans limite de durée et sans carte bancaire. Quand vous êtes prêt, vous passez à un plan payant — avec le premier mois offert.",
  },
  {
    q: "TALOK fonctionne-t-il en France d\u2019outre-mer\u00A0?",
    a: "TALOK est né en Martinique. La TVA spécifique à chaque DROM, les codes postaux, les particularités locales — tout est intégré nativement. Pas de bricolage, pas d\u2019adaptation\u00A0: ça marche dès le premier jour.",
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
            Questions fréquentes
          </motion.h2>
        </motion.div>

        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="space-y-3"
        >
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              variants={blurUp}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="relative flex w-full items-center justify-between px-5 py-4 text-left"
              >
                {/* Hover highlight slide */}
                <span className="absolute inset-0 origin-left scale-x-0 bg-slate-50 transition-transform duration-300 group-hover:scale-x-100" />
                <span className="relative pr-4 text-sm font-semibold text-[#1B2A6B]">{faq.q}</span>
                <motion.span
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
                  className="relative"
                >
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, filter: "blur(6px)" }}
                    animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
                    exit={{ height: 0, opacity: 0, filter: "blur(6px)" }}
                    transition={{ duration: 0.35, ease }}
                  >
                    <div className="border-t border-slate-100 px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-500">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
