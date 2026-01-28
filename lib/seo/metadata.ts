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
 * export const metadata = generatePageMetadata({
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
  // ============================================
  // PAGES MARKETING / PUBLIQUES
  // ============================================
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

  solutions: generatePageMetadata({
    title: "Solutions",
    description: "Solutions de gestion locative adaptées : propriétaires, SCI, agences immobilières, syndics de copropriété.",
    keywords: ["solution gestion locative", "logiciel SCI", "gestion agence immobilière"],
    canonical: `${SITE_URL}/solutions`,
  }),

  guides: generatePageMetadata({
    title: "Guides",
    description: "Guides pratiques pour les propriétaires : déclaration fiscale, gestion SCI, réglementation locative.",
    keywords: ["guide propriétaire", "déclaration 2044", "gestion SCI"],
    canonical: `${SITE_URL}/guides`,
  }),

  outils: generatePageMetadata({
    title: "Outils gratuits",
    description: "Calculateurs et outils gratuits : rendement locatif, simulation charges, générateur de quittance.",
    keywords: ["calculateur rendement locatif", "simulateur charges", "générateur quittance"],
    canonical: `${SITE_URL}/outils`,
  }),

  modeles: generatePageMetadata({
    title: "Modèles de documents",
    description: "Modèles gratuits : bail d'habitation, état des lieux, quittance de loyer, lettre de relance.",
    keywords: ["modèle bail", "modèle état des lieux", "modèle quittance loyer"],
    canonical: `${SITE_URL}/modeles`,
  }),

  // ============================================
  // PAGES AUTH
  // ============================================
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

  forgotPassword: generatePageMetadata({
    title: "Mot de passe oublié",
    description: "Réinitialisez votre mot de passe Talok.",
    noIndex: true,
  }),

  // ============================================
  // PAGES OWNER (Protected - noIndex)
  // ============================================
  ownerDashboard: generatePageMetadata({
    title: "Tableau de bord",
    description: "Tableau de bord propriétaire - Vue d'ensemble de vos locations.",
    noIndex: true,
  }),

  ownerProperties: generatePageMetadata({
    title: "Mes biens",
    description: "Gérez votre portefeuille de biens immobiliers.",
    noIndex: true,
  }),

  ownerLeases: generatePageMetadata({
    title: "Baux & Locataires",
    description: "Gérez vos baux et locataires.",
    noIndex: true,
  }),

  ownerMoney: generatePageMetadata({
    title: "Loyers & Revenus",
    description: "Suivez vos loyers et revenus locatifs.",
    noIndex: true,
  }),

  ownerDocuments: generatePageMetadata({
    title: "Documents",
    description: "Gérez vos documents locatifs.",
    noIndex: true,
  }),

  ownerInspections: generatePageMetadata({
    title: "États des lieux",
    description: "Créez et gérez vos états des lieux.",
    noIndex: true,
  }),

  ownerTickets: generatePageMetadata({
    title: "Tickets & Interventions",
    description: "Gérez les demandes d'intervention.",
    noIndex: true,
  }),

  // ============================================
  // PAGES TENANT (Protected - noIndex)
  // ============================================
  tenantDashboard: generatePageMetadata({
    title: "Mon espace locataire",
    description: "Accédez à votre espace locataire Talok.",
    noIndex: true,
  }),

  tenantLease: generatePageMetadata({
    title: "Mon bail",
    description: "Consultez votre bail et documents associés.",
    noIndex: true,
  }),

  tenantPayments: generatePageMetadata({
    title: "Mes paiements",
    description: "Gérez vos paiements de loyer.",
    noIndex: true,
  }),

  tenantDocuments: generatePageMetadata({
    title: "Mes documents",
    description: "Accédez à vos documents locatifs.",
    noIndex: true,
  }),

  // ============================================
  // PAGES ADMIN (Protected - noIndex)
  // ============================================
  adminDashboard: generatePageMetadata({
    title: "Administration",
    description: "Tableau de bord administrateur.",
    noIndex: true,
  }),

  // ============================================
  // PAGES AGENCY (Protected - noIndex)
  // ============================================
  agencyDashboard: generatePageMetadata({
    title: "Espace Agence",
    description: "Tableau de bord agence immobilière.",
    noIndex: true,
  }),

  agencyMandates: generatePageMetadata({
    title: "Mandats de gestion",
    description: "Gérez vos mandats de gestion locative.",
    noIndex: true,
  }),

  // ============================================
  // PAGES PROVIDER (Protected - noIndex)
  // ============================================
  providerDashboard: generatePageMetadata({
    title: "Espace Prestataire",
    description: "Tableau de bord prestataire.",
    noIndex: true,
  }),

  providerJobs: generatePageMetadata({
    title: "Mes missions",
    description: "Gérez vos missions d'intervention.",
    noIndex: true,
  }),

  // ============================================
  // PAGES SYNDIC (Protected - noIndex)
  // ============================================
  syndicDashboard: generatePageMetadata({
    title: "Espace Syndic",
    description: "Tableau de bord syndic de copropriété.",
    noIndex: true,
  }),

  syndicAssemblies: generatePageMetadata({
    title: "Assemblées générales",
    description: "Gérez les assemblées générales de copropriété.",
    noIndex: true,
  }),

  // ============================================
  // PAGES GUARANTOR (Protected - noIndex)
  // ============================================
  guarantorDashboard: generatePageMetadata({
    title: "Espace Garant",
    description: "Tableau de bord garant.",
    noIndex: true,
  }),

  // ============================================
  // PAGES LEGAL
  // ============================================
  privacy: generatePageMetadata({
    title: "Politique de confidentialité",
    description: "Politique de confidentialité et protection des données personnelles de Talok.",
    canonical: `${SITE_URL}/legal/privacy`,
  }),

  terms: generatePageMetadata({
    title: "Conditions générales d'utilisation",
    description: "Conditions générales d'utilisation du service Talok.",
    canonical: `${SITE_URL}/legal/terms`,
  }),
};

/**
 * Génère les métadonnées pour une page de fonctionnalité spécifique
 */
export function generateFeatureMetadata(
  featureName: string,
  description: string,
  keywords: string[] = []
): Metadata {
  return generatePageMetadata({
    title: `${featureName} - Fonctionnalités`,
    description,
    keywords: ["talok", "gestion locative", ...keywords],
    canonical: `${SITE_URL}/fonctionnalites/${featureName.toLowerCase().replace(/\s+/g, "-")}`,
  });
}

/**
 * Génère les métadonnées pour un article de blog
 */
export function generateBlogPostMetadata(
  title: string,
  description: string,
  slug: string,
  image?: string
): Metadata {
  return generatePageMetadata({
    title,
    description,
    image: image || "/og-blog.png",
    canonical: `${SITE_URL}/blog/${slug}`,
    keywords: ["blog immobilier", "conseil bailleur"],
  });
}

/**
 * Génère les métadonnées pour une page de solution
 */
export function generateSolutionMetadata(
  solutionName: string,
  description: string,
  slug: string
): Metadata {
  return generatePageMetadata({
    title: `${solutionName} - Solutions`,
    description,
    canonical: `${SITE_URL}/solutions/${slug}`,
    keywords: ["solution gestion locative", solutionName.toLowerCase()],
  });
}
