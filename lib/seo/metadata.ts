import type { Metadata } from "next";

/**
 * Helper SEO Metadata - SOTA 2026
 *
 * Génère des métadonnées cohérentes pour toutes les pages
 * avec support Open Graph et Twitter Cards
 */

const SITE_NAME = "Talok";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";

interface PageMetadataOptions {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
  canonical?: string;
}

/**
 * Génère les métadonnées SEO pour une page
 *
 * @example
 * // Dans un layout.tsx ou page.tsx (Server Component)
 * export const metadata = generateMetadata({
 *   title: "Tarifs",
 *   description: "Découvrez nos offres de gestion locative"
 * })
 */
export function generatePageMetadata({
  title,
  description,
  keywords = [],
  image = "/og-image.png",
  noIndex = false,
  canonical,
}: PageMetadataOptions): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    robots: noIndex ? { index: false, follow: false } : undefined,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url: canonical || SITE_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "fr_FR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      site: "@talok_fr",
    },
  };
}

/**
 * Métadonnées pré-définies pour les pages courantes
 */
export const PAGE_METADATA = {
  pricing: generatePageMetadata({
    title: "Tarifs",
    description: "Tarifs transparents de gestion locative. Gratuit (1 bien), Starter 9€, Confort 35€, Pro 69€. 1er mois offert. Sans engagement.",
    keywords: ["tarif gestion locative", "prix logiciel bailleur", "gestion locative gratuite", "abonnement propriétaire"],
    canonical: `${SITE_URL}/pricing`,
  }),

  contact: generatePageMetadata({
    title: "Contact",
    description: "Contactez l'équipe Talok. Support réactif, réponse sous 24h. Demandez une démo ou renseignez-vous sur nos offres Enterprise.",
    keywords: ["contact talok", "support gestion locative", "démo logiciel bailleur"],
    canonical: `${SITE_URL}/contact`,
  }),

  fonctionnalites: generatePageMetadata({
    title: "Fonctionnalités",
    description: "Toutes les fonctionnalités Talok : baux ALUR automatiques, signatures électroniques, états des lieux numériques, comptabilité, Open Banking.",
    keywords: ["fonctionnalités gestion locative", "bail automatique", "signature électronique bail", "état des lieux numérique"],
    canonical: `${SITE_URL}/fonctionnalites`,
  }),

  blog: generatePageMetadata({
    title: "Blog",
    description: "Conseils et actualités pour les propriétaires bailleurs. Fiscalité immobilière, réglementation ALUR, astuces gestion locative.",
    keywords: ["blog propriétaire", "conseil bailleur", "actualité immobilier locatif"],
    canonical: `${SITE_URL}/blog`,
  }),

  faq: generatePageMetadata({
    title: "FAQ",
    description: "Questions fréquentes sur Talok. Comment créer un bail ? Comment fonctionne la signature électronique ? Toutes les réponses.",
    keywords: ["faq gestion locative", "aide talok", "questions propriétaire"],
    canonical: `${SITE_URL}/faq`,
  }),

  // Auth pages
  signin: generatePageMetadata({
    title: "Connexion",
    description: "Connectez-vous à votre espace Talok pour gérer vos locations.",
    noIndex: true,
  }),

  signup: generatePageMetadata({
    title: "Inscription",
    description: "Créez votre compte Talok gratuitement. Gérez vos locations en quelques clics.",
    keywords: ["inscription gestion locative", "créer compte bailleur"],
  }),
};
