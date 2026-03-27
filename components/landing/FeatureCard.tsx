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
      "Propri\u00e9taire qui g\u00e8re ses loyers depuis son t\u00e9l\u00e9phone, sereinement",
    badge: "Inclus dans tous les plans",
    title: "Gagnez 3h par semaine",
    bullets: [
      "Loyers encaiss\u00e9s automatiquement chaque mois.",
      "Relance email automatique en cas de retard.",
      "Quittances envoy\u00e9es sans action de votre part.",
      "Historique complet de tous les paiements accessible en un clic.",
    ],
    highlight:
      "3h \u00e9conomis\u00e9es par semaine \u2014 c\u2019est le temps moyen que nos propri\u00e9taires r\u00e9cup\u00e8rent d\u00e8s le premier mois.",
  },
  {
    id: "money",
    imagePosition: "right",
    imageAlt:
      "Propri\u00e9taire qui \u00e9conomise sur les frais d\u2019agence gr\u00e2ce \u00e0 Talok",
    badge: "Inclus dans tous les plans",
    title: "\u00c9conomisez jusqu\u2019\u00e0 2\u202f000\u202f\u20ac/an",
    bullets: [
      "Aucune commission pr\u00e9lev\u00e9e sur vos loyers encaiss\u00e9s.",
      "Talok remplace une agence \u00e0 8\u202f% pour seulement 35\u202f\u20ac/mois.",
      "Pas d\u2019interm\u00e9diaire entre vous et votre locataire.",
      "R\u00e9siliable \u00e0 tout moment, sans engagement ni frais cach\u00e9s.",
    ],
    highlight:
      "Une agence prend 7 \u00e0 8\u202f% de vos loyers. Sur 1\u202f000\u202f\u20ac/mois, c\u2019est 960\u202f\u20ac par an. Talok vous co\u00fbte 35\u202f\u20ac/mois.",
  },
  {
    id: "contract",
    imagePosition: "left",
    imageAlt:
      "Locataire qui signe son bail de location depuis son smartphone",
    badge: "Inclus dans tous les plans",
    title: "Contrats sign\u00e9s en 5 minutes, sans imprimante",
    bullets: [
      "Bail g\u00e9n\u00e9r\u00e9 automatiquement selon le type de location.",
      "Votre locataire signe depuis son t\u00e9l\u00e9phone, o\u00f9 qu\u2019il soit.",
      "La m\u00eame valeur l\u00e9gale qu\u2019un original papier \u2014 sans d\u00e9placement.",
      "Document archiv\u00e9 automatiquement pour les deux parties.",
    ],
    highlight: null,
  },
  {
    id: "sleep",
    imagePosition: "right",
    imageAlt:
      "Propri\u00e9taire tranquille sachant que ses contrats sont conformes \u00e0 la loi",
    badge: "Inclus dans tous les plans",
    title:
      "Dormez tranquille \u2014 vos contrats sont toujours \u00e0 jour",
    bullets: [
      "La loi mise \u00e0 jour automatiquement dans vos contrats.",
      "Plafonnement des loyers int\u00e9gr\u00e9 selon votre zone g\u00e9ographique.",
      "Notices obligatoires incluses automatiquement \u2014 rien \u00e0 v\u00e9rifier.",
      "Z\u00e9ro risque juridique pour vous en tant que propri\u00e9taire.",
    ],
    highlight:
      "La loi locative a chang\u00e9 7 fois depuis 2022. Talok s\u2019est mis \u00e0 jour \u00e0 chaque fois \u2014 automatiquement.",
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
}

export function FeatureCard({ feature, imageSrc }: FeatureCardProps) {
  const isRight = feature.imagePosition === "right";

  return (
    <div className="reveal overflow-visible px-4 py-14 md:px-8 flex justify-center">
      <div
        className={cn(
          "relative max-w-4xl w-full bg-white dark:bg-card",
          "rounded-3xl shadow-2xl overflow-visible",
          "flex flex-col md:flex-row items-center",
          isRight && "md:flex-row-reverse"
        )}
      >
        {/* Photo d\u00e9bordante */}
        <div
          className={cn(
            "relative flex-shrink-0 w-56 h-64 md:w-64 md:h-72 z-10",
            "-mt-10 md:-mt-0",
            !isRight
              ? "md:-ml-8 rotate-[-3deg]"
              : "md:-mr-8 rotate-[3deg]"
          )}
        >
          <div className="w-full h-full rounded-[18px] overflow-hidden border-4 border-white shadow-xl">
            <Image
              src={imageSrc}
              alt={feature.imageAlt}
              fill
              className="object-cover object-top"
              loading="lazy"
              sizes="(max-width: 768px) 224px, 256px"
            />
          </div>
        </div>

        {/* Contenu */}
        <div
          className={cn(
            "flex-1 p-8 md:p-10",
            !isRight ? "md:pl-6" : "md:pr-6"
          )}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
            <Check size={12} strokeWidth={3} />
            {feature.badge}
          </div>

          {/* Titre */}
          <h2
            className="text-xl md:text-2xl font-extrabold text-[#1B2A6B] dark:text-white mb-5 leading-tight"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {feature.title}
          </h2>

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
