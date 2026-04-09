'use client'

import Image from 'next/image'
import { Check } from 'lucide-react'
import { motion } from 'framer-motion'

export interface FeatureCardData {
  id: string;
  imagePosition: "left" | "right";
  imageAlt: string;
  badge: string;
  title: string;
  bullets: string[];
  highlight: string | null;
  configKey: string;
}

export const FEATURE_CARDS: FeatureCardData[] = [
  {
    id: "time",
    imagePosition: "left",
    imageAlt: "Propriétaire qui gère ses loyers depuis son téléphone, sereinement",
    badge: "Inclus dans tous les plans",
    title: "Gagnez 3h par semaine",
    bullets: [
      "Loyers encaissés automatiquement chaque mois.",
      "Relance email automatique en cas de retard.",
      "Quittances envoyées sans action de votre part.",
      "Historique complet de tous les paiements accessible en un clic.",
    ],
    highlight: "3h économisées par semaine — c\u2019est le temps moyen que nos propriétaires récupèrent dès le premier mois.",
    configKey: "landing_arg_time_img",
  },
  {
    id: "money",
    imagePosition: "right",
    imageAlt: "Propriétaire qui économise sur les frais d\u2019agence grâce à Talok",
    badge: "Inclus dans tous les plans",
    title: "Économisez jusqu\u2019à 2\u202f000\u202f\u20ac/an",
    bullets: [
      "Aucune commission prélevée sur vos loyers encaissés.",
      "Talok remplace une agence à 8\u202f% pour seulement 35\u202f\u20ac/mois.",
      "Pas d\u2019intermédiaire entre vous et votre locataire.",
      "Résiliable à tout moment, sans engagement ni frais cachés.",
    ],
    highlight: "Une agence prend 7 à 8\u202f% de vos loyers. Sur 1\u202f000\u202f\u20ac/mois, c\u2019est 960\u202f\u20ac par an. Talok vous coûte 35\u202f\u20ac/mois.",
    configKey: "landing_arg_money_img",
  },
  {
    id: "contract",
    imagePosition: "left",
    imageAlt: "Locataire qui signe son bail de location depuis son smartphone",
    badge: "Inclus dans tous les plans",
    title: "Contrats signés en 5 minutes, sans imprimante",
    bullets: [
      "Bail généré automatiquement selon le type de location.",
      "Votre locataire signe depuis son téléphone, où qu\u2019il soit.",
      "La même valeur légale qu\u2019un original papier — sans déplacement.",
      "Document archivé automatiquement pour les deux parties.",
    ],
    highlight: null,
    configKey: "landing_arg_contract_img",
  },
  {
    id: "sleep",
    imagePosition: "right",
    imageAlt: "Propriétaire tranquille sachant que ses contrats sont conformes à la loi",
    badge: "Inclus dans tous les plans",
    title: "Dormez tranquille — vos contrats sont toujours à jour",
    bullets: [
      "La loi mise à jour automatiquement dans vos contrats.",
      "Plafonnement des loyers intégré selon votre zone géographique.",
      "Notices obligatoires incluses automatiquement — rien à vérifier.",
      "Zéro risque juridique pour vous en tant que propriétaire.",
    ],
    highlight: "La loi locative a changé 7 fois depuis 2022. Talok s\u2019est mis à jour à chaque fois — automatiquement.",
    configKey: "landing_arg_sleep_img",
  },
];

const cardVariants = {
  hidden: (isRight: boolean) => ({
    opacity: 0,
    x: isRight ? 60 : -60,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const bulletVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.3 + i * 0.08, duration: 0.4 },
  }),
}

interface FeatureCardProps {
  feature: FeatureCardData;
  imageSrc: string;
}

export function FeatureCard({ feature, imageSrc }: FeatureCardProps) {
  const isRight = feature.imagePosition === "right";

  return (
    <motion.div
      custom={isRight}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className="py-8 md:py-12"
    >
      <div
        className={`flex flex-col items-center gap-8 md:gap-12 ${
          isRight ? "md:flex-row-reverse" : "md:flex-row"
        }`}
      >
        {/* Image */}
        <motion.div
          className="w-full md:w-[45%] flex-shrink-0"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
            <Image
              src={imageSrc}
              alt={feature.imageAlt}
              fill
              className="object-cover"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 space-y-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Check size={12} strokeWidth={3} />
            {feature.badge}
          </div>

          <h3 className="text-2xl md:text-3xl font-extrabold text-[#1B2A6B] leading-tight dark:text-white">
            {feature.title}
          </h3>

          <ul className="space-y-3">
            {feature.bullets.map((bullet, i) => (
              <motion.li
                key={i}
                custom={i}
                variants={bulletVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="flex items-start gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-green-500 text-white">
                  <Check size={12} strokeWidth={3.5} />
                </span>
                {bullet}
              </motion.li>
            ))}
          </ul>

          {feature.highlight && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="rounded-lg border-l-[3px] border-[#2563EB] bg-blue-50 px-4 py-3 text-[13px] leading-relaxed text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
            >
              {feature.highlight}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
