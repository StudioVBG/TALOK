"use client";

import { usePathname } from "next/navigation";
import { breadcrumbListSchema } from "@/lib/seo/schemas";

/**
 * Mapping slug URL -> libelle humain pour le breadcrumb.
 * Seuls les segments ici genereront un libelle propre ; les autres
 * segments (slugs dynamiques, uuid, etc.) sont capitalises par defaut.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Sections principales marketing
  fonctionnalites: "Fonctionnalités",
  solutions: "Solutions",
  outils: "Outils",
  guides: "Guides",
  blog: "Blog",
  pricing: "Tarifs",
  faq: "FAQ",
  contact: "Contact",
  "a-propos": "À propos",
  temoignages: "Témoignages",
  "calculateur-roi": "Calculateur d’économies",
  "essai-gratuit": "Essai gratuit",
  presse: "Presse",
  statut: "Statut",
  accessibilite: "Accessibilité",
  legal: "Légal",

  // Fonctionnalites — sous-pages
  "gestion-biens": "Gestion des biens",
  "gestion-locataires": "Gestion des locataires",
  "gestion-des-baux": "Gestion des baux",
  "paiements-en-ligne": "Paiements en ligne",
  "etats-des-lieux": "États des lieux",
  "quittances-loyers": "Quittances",
  "comptabilite-fiscalite": "Comptabilité & fiscalité",
  "signature-electronique": "Signature électronique",
  documents: "Documents",
  "tickets-et-travaux": "Tickets & travaux",
  "immeuble-copropriete": "Immeuble & copropriété",

  // Solutions — sous-pages
  "proprietaires-particuliers": "Propriétaires particuliers",
  investisseurs: "Investisseurs & SCI",
  "administrateurs-biens": "Administrateurs de biens",
  "sci-familiales": "SCI familiales",
  syndics: "Syndics",
  "outre-mer": "France d’outre-mer",

  // Outils — sous-pages
  "calcul-rendement-locatif": "Calcul de rentabilité",
  "calcul-frais-notaire": "Frais de notaire",
  "calcul-revision-irl": "Révision IRL",
  "simulateur-charges": "Simulateur de charges",

  // Légal — sous-pages
  cgu: "CGU",
  cgv: "CGV",
  privacy: "Confidentialité",
  cookies: "Cookies",
  mentions: "Mentions légales",
};

/**
 * Chemins pour lesquels on ne genere PAS de breadcrumb schema
 * (pages authentifiees, API, assets, etc.).
 */
const EXCLUDED_PREFIXES = [
  "/owner",
  "/tenant",
  "/agency",
  "/provider",
  "/guarantor",
  "/syndic",
  "/copro",
  "/admin",
  "/auth",
  "/signup",
  "/api",
  "/_next",
];

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // Fallback : capitalise + remplace les tirets par des espaces
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Genere automatiquement un schema.org BreadcrumbList base sur l'URL.
 * A inclure une seule fois, dans le root layout.
 *
 * Rend null sur la page d'accueil ou les pages authentifiees.
 */
export function AutoBreadcrumbSchema() {
  const pathname = usePathname() || "/";

  // Home : pas de breadcrumb utile
  if (pathname === "/" || pathname === "") return null;

  // Ignorer les pages authentifiees, API, assets
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const items = [
    { name: "Accueil", path: "/" },
    ...segments.map((seg, i) => ({
      name: labelFor(seg),
      path: "/" + segments.slice(0, i + 1).join("/"),
    })),
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(breadcrumbListSchema(items)),
      }}
    />
  );
}
