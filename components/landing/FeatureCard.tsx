'use client'

import Image from 'next/image'
import { Check } from 'lucide-react'

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

interface FeatureCardProps {
  feature: FeatureCardData;
  imageSrc: string;
}

export function FeatureCard({ feature, imageSrc }: FeatureCardProps) {
  const isRight = feature.imagePosition === "right";

  return (
    /*
     * STRUCTURE CRITIQUE — 3 niveaux d'overflow :
     * [Section]  → overflow: visible (défaut)
     * [Carte]    → overflow: visible  ← LE FIX (sinon la photo est clippée)
     * [Photo div intérieure] → overflow: hidden  (pour clipper l'image)
     */
    <div
      className="relative py-16 px-4 md:px-8 flex justify-center"
      style={{ overflow: "visible" }}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-card shadow-2xl"
        style={{
          borderRadius: "24px",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div className="w-full flex flex-col md:flex-row items-center">
          <div
            className="w-full flex items-center"
            style={{ flexDirection: isRight ? "row-reverse" : "row" }}
          >
            {/* ===== PHOTO DESKTOP — déborde hors de la carte ===== */}
            <div
              className="flex-shrink-0 hidden md:block"
              style={{
                position: "relative",
                width: "260px",
                height: "300px",
                marginTop: "-32px",
                marginBottom: "-32px",
                ...(isRight
                  ? { marginRight: "-28px" }
                  : { marginLeft: "-28px" }),
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "18px",
                  overflow: "hidden",
                  border: "4px solid white",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
                  transform: isRight ? "rotate(3deg)" : "rotate(-3deg)",
                }}
              >
                <Image
                  src={imageSrc}
                  alt={feature.imageAlt}
                  fill
                  className="object-cover object-top"
                  loading="lazy"
                  sizes="260px"
                />
              </div>
            </div>

            {/* ===== PHOTO MOBILE — déborde par le haut ===== */}
            <div
              className="block md:hidden flex-shrink-0 self-start"
              style={{
                position: "relative",
                width: "180px",
                height: "200px",
                marginTop: "-28px",
                marginLeft: "auto",
                marginRight: "auto",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "3px solid white",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.20)",
                  transform: "rotate(-2deg)",
                }}
              >
                <Image
                  src={imageSrc}
                  alt={feature.imageAlt}
                  fill
                  className="object-cover object-top"
                  loading="lazy"
                  sizes="180px"
                />
              </div>
            </div>

            {/* ===== CONTENU ===== */}
            <div
              className="flex-1"
              style={{
                padding: isRight
                  ? "40px 40px 40px 28px"
                  : "40px 28px 40px 40px",
              }}
            >
              {/* Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#DCFCE7",
                  color: "#15803D",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: "20px",
                  marginBottom: "12px",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                <Check size={12} strokeWidth={3} />
                {feature.badge}
              </div>

              {/* Titre */}
              <h2
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(18px, 2.2vw, 24px)",
                  color: "#1B2A6B",
                  marginBottom: "20px",
                  lineHeight: 1.25,
                }}
                className="dark:!text-white"
              >
                {feature.title}
              </h2>

              {/* Bullets */}
              <ul style={{ listStyle: "none", marginBottom: "16px" }}>
                {feature.bullets.map((bullet, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      marginBottom: "10px",
                      fontFamily: "Manrope, sans-serif",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      color: "#475569",
                    }}
                    className="dark:!text-slate-400"
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: "18px",
                        height: "18px",
                        background: "#22C55E",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: "2px",
                      }}
                    >
                      <Check size={11} color="white" strokeWidth={3.5} />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>

              {/* Highlight stat */}
              {feature.highlight && (
                <div
                  style={{
                    background: "#EFF6FF",
                    borderLeft: "3px solid #2563EB",
                    borderRadius: "0 8px 8px 0",
                    padding: "10px 14px",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: "13px",
                    color: "#1E40AF",
                    lineHeight: 1.6,
                  }}
                  className="dark:!bg-blue-900/30 dark:!text-blue-200"
                >
                  {feature.highlight}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
