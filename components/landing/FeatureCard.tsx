"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeatureCardData {
  id: string;
  imagePosition: "left" | "right";
  imageAlt: string;
  badge: string;
  title: string;
  bullets: string[];
  highlight: string | null;
  imageSrc: string;
}

export const FEATURE_CARDS: Omit<FeatureCardData, "imageSrc">[] = [
  {
    id: "time",
    imagePosition: "left",
    imageAlt:
      "Propriétaire qui gère ses loyers depuis son téléphone, sereinement",
    badge: "Inclus dans tous les plans",
    title: "Gagnez 3h par semaine",
    bullets: [
      "Loyers encaissés automatiquement chaque mois.",
      "Relance email automatique en cas de retard.",
      "Quittances envoyées sans action de votre part.",
      "Historique complet de tous les paiements accessible en un clic.",
    ],
    highlight:
      "3h économisées par semaine \u2014 c\u2019est le temps moyen que nos propriétaires récupèrent dès le premier mois.",
  },
  {
    id: "money",
    imagePosition: "right",
    imageAlt:
      "Propriétaire qui économise sur les frais d\u2019agence grâce à Talok",
    badge: "Inclus dans tous les plans",
    title: "Économisez jusqu\u2019à 2\u202f000\u202f\u20ac/an",
    bullets: [
      "Aucune commission prélevée sur vos loyers encaissés.",
      "Talok remplace une agence à 8\u202f% pour seulement 35\u202f\u20ac/mois.",
      "Pas d\u2019intermédiaire entre vous et votre locataire.",
      "Résiliable à tout moment, sans engagement ni frais cachés.",
    ],
    highlight:
      "Une agence prend 7 à 8\u202f% de vos loyers. Sur 1\u202f000\u202f\u20ac/mois, c\u2019est 960\u202f\u20ac par an. Talok vous coûte 35\u202f\u20ac/mois.",
  },
  {
    id: "contract",
    imagePosition: "left",
    imageAlt:
      "Locataire qui signe son bail de location depuis son smartphone",
    badge: "Inclus dans tous les plans",
    title: "Contrats signés en 5 minutes, sans imprimante",
    bullets: [
      "Bail généré automatiquement selon le type de location.",
      "Votre locataire signe depuis son téléphone, où qu\u2019il soit.",
      "La même valeur légale qu\u2019un original papier \u2014 sans déplacement.",
      "Document archivé automatiquement pour les deux parties.",
    ],
    highlight: null,
  },
  {
    id: "sleep",
    imagePosition: "right",
    imageAlt:
      "Propriétaire tranquille sachant que ses contrats sont conformes à la loi",
    badge: "Inclus dans tous les plans",
    title:
      "Dormez tranquille \u2014 vos contrats sont toujours à jour",
    bullets: [
      "La loi mise à jour automatiquement dans vos contrats.",
      "Plafonnement des loyers intégré selon votre zone géographique.",
      "Notices obligatoires incluses automatiquement \u2014 rien à vérifier.",
      "Zéro risque juridique pour vous en tant que propriétaire.",
    ],
    highlight:
      "La loi locative a changé 7 fois depuis 2022. Talok s\u2019est mis à jour à chaque fois \u2014 automatiquement.",
  },
];

export const DEFAULT_IMAGES: Record<string, string> = {
  time: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80",
  money:
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80",
  contract:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80",
  sleep:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80",
};

interface FeatureCardProps {
  feature: Omit<FeatureCardData, "imageSrc">;
  imageSrc: string;
  index: number;
}

export function FeatureCard({ feature, imageSrc, index }: FeatureCardProps) {
  const isRight = feature.imagePosition === "right";
  const isOdd = index % 2 === 0; // 0-indexed: cards 0,2 = "impaires" (1st,3rd)
  const rotation = isOdd ? "rotate-[-3deg]" : "rotate-[3deg]";

  return (
    <div className="reveal overflow-visible flex justify-center">
      <div
        className={cn(
          "relative max-w-4xl w-full bg-white dark:bg-card",
          "rounded-3xl shadow-2xl overflow-visible",
          "flex flex-col md:flex-row items-stretch",
          isRight && "md:flex-row-reverse"
        )}
      >
        {/* Photo débordante */}
        <div
          className={cn(
            "relative flex-shrink-0 z-10",
            "w-60 h-64 md:w-72 md:h-80",
            "mx-auto md:mx-0",
            "-mt-12 md:-mt-8",
            !isRight
              ? "md:-ml-10 md:self-center"
              : "md:-mr-10 md:self-center",
            rotation
          )}
        >
          <div className="w-full h-full rounded-[18px] overflow-hidden border-4 border-white shadow-xl">
            <Image
              src={imageSrc}
              alt={feature.imageAlt}
              fill
              className="object-cover object-top"
              loading="lazy"
              sizes="(max-width: 768px) 240px, 288px"
            />
          </div>
        </div>

        {/* Contenu */}
        <div
          className={cn(
            "flex-1 p-8 md:py-10",
            !isRight ? "md:pl-8 md:pr-10" : "md:pr-8 md:pl-10"
          )}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
            <Check size={12} strokeWidth={3} />
            {feature.badge}
          </div>

          {/* Titre */}
          <h3
            className="text-xl md:text-2xl font-extrabold text-[#1B2A6B] dark:text-white mb-5 leading-tight"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {feature.title}
          </h3>

          {/* Bullets */}
          <ul className="space-y-3 mb-5">
            {feature.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-[18px] h-[18px] rounded bg-green-500 flex items-center justify-center">
                  <Check size={11} className="text-white" strokeWidth={3.5} />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {bullet}
                </span>
              </li>
            ))}
          </ul>

          {/* Highlight stat */}
          {feature.highlight && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border-l-[3px] border-[#2563EB] rounded-r-lg px-4 py-3">
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                {feature.highlight}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
