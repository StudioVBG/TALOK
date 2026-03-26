"use client"

import { motion } from "framer-motion"
import { fadeUp, staggerContainer } from "@/components/marketing/AnimatedSection"
import { blurUp, slideFromLeft, slideFromRight, drawPath } from "@/components/marketing/hooks"
import {
  ContractMockup,
  PaymentsMockup,
  EDLMockup,
  AccountingMockup,
} from "@/components/marketing/FeatureIllustration"

const ease = [0.22, 1, 0.36, 1] as const

const features = [
  {
    badge: "Inclus",
    title: "Créez et faites signer votre contrat en quelques clics",
    body: "TALOK génère votre contrat selon votre situation (appartement loué vide, meublé, colocation…). Votre locataire signe depuis son téléphone. C\u2019est légal, c\u2019est simple, c\u2019est terminé.",
    checks: [
      "Tous types : appartement, maison, colocation, saisonnier",
      "Signature depuis un téléphone — sans imprimante",
      "Renouvellement automatique rappelé 3 mois avant",
    ],
    Illustration: ContractMockup,
  },
  {
    badge: "Inclus",
    title: "Vos loyers encaissés sans y penser",
    body: "Votre locataire paie par carte bancaire ou prélèvement automatique. Dès réception, son reçu de loyer part automatiquement. Plus de relances à la main.",
    checks: [
      "Paiement par carte bancaire ou prélèvement automatique",
      "Reçu de loyer envoyé automatiquement chaque mois",
      "Relance automatique en cas de retard",
      "Aucun frais supplémentaire pour votre locataire",
    ],
    Illustration: PaymentsMockup,
  },
  {
    badge: "Inclus",
    title: "Protégez votre logement et votre dépôt de garantie",
    body: "Faites l\u2019état des lieux depuis votre téléphone. Photos, état de chaque pièce, relevés des compteurs — tout est signé et archivé. En cas de litige, vous êtes protégé.",
    checks: [
      "Photos et état pièce par pièce depuis l\u2019app",
      "Signé par vous et votre locataire sur place",
      "Archivé automatiquement, retrouvable en 1 clic",
    ],
    Illustration: EDLMockup,
  },
  {
    badge: "Inclus",
    title: "Fini la semaine de galère en fin d\u2019année",
    body: "Tous vos revenus, dépenses et documents sont centralisés. Votre comptable récupère tout en 1 clic. Vous déclarez vos revenus locatifs sans stress.",
    checks: [
      "Historique complet de vos encaissements",
      "Export de toutes vos données pour votre comptable",
      "Tableau de bord de rentabilité par bien",
    ],
    Illustration: AccountingMockup,
  },
]

const featureTitles = [
  "Vos contrats de location",
  "Encaissement des loyers",
  "État des lieux numérique",
  "Votre comptabilité locative",
]

/* SVG animated checkmark */
function AnimatedCheck({ delay }: { delay: number }) {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10">
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
        <motion.path
          d="M2 6.5L5 9.5L10 3"
          stroke="#2563EB"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={drawPath}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay }}
        />
      </svg>
    </span>
  )
}

export function Features() {
  return (
    <section id="fonctionnalites" className="py-20 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4">
        {/* Section header */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 text-center"
        >
          <motion.div variants={blurUp} className="mb-3">
            <span className="inline-block rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-semibold text-[#2563EB]">
              Fonctionnalités
            </span>
          </motion.div>
          <motion.h2 variants={blurUp} className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
            Tout ce dont vous avez besoin, rien de plus
          </motion.h2>
        </motion.div>

        {/* Feature blocks */}
        <div className="space-y-20 md:space-y-28">
          {features.map((feat, i) => {
            const isReversed = i % 2 === 1
            // Illustration slides in from the opposite side
            const illustrationSlide = isReversed ? slideFromLeft : slideFromRight

            return (
              <motion.div
                key={feat.title}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                className={`grid items-center gap-10 md:grid-cols-2 md:gap-[64px] ${
                  isReversed ? "md:[direction:rtl]" : ""
                }`}
              >
                {/* Text */}
                <div className={isReversed ? "md:[direction:ltr]" : ""}>
                  <motion.div variants={blurUp} className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#1B2A6B]">
                      {featureTitles[i]}
                    </span>
                    <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                      {feat.badge}
                    </span>
                  </motion.div>
                  <motion.h3 variants={blurUp} className="font-display text-[20px] font-semibold text-[#1B2A6B] sm:text-[24px]">
                    {feat.title}
                  </motion.h3>
                  <motion.p variants={blurUp} className="mt-3 text-[15px] leading-[1.75] text-slate-500">
                    {feat.body}
                  </motion.p>
                  <motion.div variants={blurUp} className="mt-5 space-y-2">
                    {feat.checks.map((check, ci) => (
                      <div key={check} className="flex items-start gap-2 text-sm text-slate-600">
                        <AnimatedCheck delay={0.3 + ci * 0.1} />
                        {check}
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Illustration — slides in from side */}
                <motion.div
                  variants={illustrationSlide}
                  className={isReversed ? "md:[direction:ltr]" : ""}
                >
                  <feat.Illustration />
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
