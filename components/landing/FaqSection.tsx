"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fadeUp, staggerTight, defaultViewport } from "@/lib/marketing/animations";

const FAQ_ITEMS = [
  {
    q: "Combien de temps pour être opérationnel ?",
    a: "10 minutes. Vous créez votre compte, ajoutez votre premier bien, et créez votre premier bail. Pas de formation, pas d'installation. Tout se fait depuis votre navigateur.",
  },
  {
    q: "C'est adapté à la Martinique / Guadeloupe / Réunion ?",
    a: "Oui, c'est même notre point fort. TVA locale, fuseaux horaires, codes postaux DROM-COM — tout est intégré nativement. Pas de bidouillage.",
  },
  {
    q: "Comment mes locataires paient ?",
    a: "Par carte bancaire ou virement SEPA, directement depuis un lien envoyé par Talok. L'argent arrive sur votre compte. La quittance part automatiquement.",
  },
  {
    q: "Je peux gérer une SCI ou plusieurs structures ?",
    a: "Oui, le plan Premium permet de gérer SCI, SARL, SAS ou indivision. Chaque structure a son espace, ses documents et ses flux, mais tout reste accessible depuis un seul compte.",
  },
  {
    q: "Mes données sont en sécurité ?",
    a: "Oui. Chiffrement de bout en bout, accès sécurisé, vérification en deux étapes. Conforme RGPD. Seuls vous et les personnes que vous autorisez peuvent voir vos données.",
  },
  {
    q: "Et si je veux juste essayer ?",
    a: "Le plan Découverte est 100% gratuit, sans limite de durée, pour 2 biens. Pas de carte bancaire demandée. Le plan Pro offre 14 jours d'essai gratuit si vous voulez aller plus loin.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <motion.section
      id="faq"
      className="py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-3xl px-4">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Vous hésitez encore ? On répond à tout.
        </h2>

        <motion.div
          className="mt-14 space-y-2"
          variants={staggerTight}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
        >
          {FAQ_ITEMS.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="rounded-xl border border-border bg-card"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-base font-medium text-foreground"
                aria-expanded={openIndex === i}
              >
                {item.q}
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <p className="px-6 pb-4 text-base leading-relaxed text-muted-foreground">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
