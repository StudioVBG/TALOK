import type { Metadata } from "next";

/**
 * Configuration SEO centralisée pour Talok — SOTA 2026
 *
 * Ce fichier contient toutes les métadonnées par défaut, les fonctions
 * utilitaires pour générer des métadonnées SEO optimisées, et les catalogues
 * de métadonnées pour chaque rôle/section de l'application.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
const SITE_NAME = "Talok";
const DEFAULT_DESCRIPTION =
  "Logiciel de gestion locative tout-en-un pour propriétaires. Baux automatiques ALUR, signatures électroniques, scoring IA locataires.";

interface PageMetadataOptions {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
  canonical?: string;
}

/**
 * Métadonnées par défaut
 */
export const defaultMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Talok | Logiciel de Gestion Locative n°1 en France",
    template: "%s | Talok",
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    site: "@talok_fr",
  },
  robots: {
    index: true,
    follow: true,
  },
};

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
 * Génère les métadonnées dynamiques pour une page avec données
 */
export function generateDynamicMetadata(
  titleFn: (data: any) => string,
  descriptionFn: (data: any) => string,
  data: any
): Metadata {
  return {
    title: titleFn(data),
    description: descriptionFn(data),
    openGraph: {
      title: titleFn(data),
      description: descriptionFn(data),
    },
  };
}

/**
 * Métadonnées pour les pages Owner (Propriétaire)
 */
export const ownerMetadata = {
  dashboard: {
    title: "Tableau de bord",
    description: "Gérez vos biens immobiliers, suivez vos revenus locatifs et vos locataires.",
  },
  properties: {
    title: "Mes biens",
    description: "Liste de tous vos biens immobiliers en location.",
  },
  propertiesNew: {
    title: "Ajouter un bien",
    description: "Créez un nouveau bien immobilier dans votre portefeuille.",
  },
  propertiesDetail: (address: string) => ({
    title: `Bien - ${address}`,
    description: `Détails et gestion du bien situé ${address}.`,
  }),
  propertiesEdit: (address: string) => ({
    title: `Modifier - ${address}`,
    description: `Modification des informations du bien situé ${address}.`,
  }),
  leases: {
    title: "Baux & locataires",
    description: "Gérez vos baux et vos relations avec vos locataires.",
  },
  leasesNew: {
    title: "Nouveau bail",
    description: "Créez un nouveau contrat de bail conforme à la loi ALUR.",
  },
  leasesDetail: (tenant: string) => ({
    title: `Bail - ${tenant}`,
    description: `Détails du bail de ${tenant}.`,
  }),
  money: {
    title: "Loyers & revenus",
    description: "Suivez vos encaissements de loyers et vos revenus locatifs.",
  },
  moneySettings: {
    title: "Paramètres financiers",
    description: "Configurez vos préférences de paiement et de facturation.",
  },
  documents: {
    title: "Documents",
    description: "Tous vos documents locatifs : baux, quittances, diagnostics.",
  },
  documentsUpload: {
    title: "Téléverser un document",
    description: "Ajoutez un nouveau document à votre espace.",
  },
  inspections: {
    title: "États des lieux",
    description: "Gérez vos états des lieux d'entrée et de sortie.",
  },
  inspectionsNew: {
    title: "Nouvel état des lieux",
    description: "Créez un nouvel état des lieux numérique.",
  },
  inspectionsDetail: (property: string) => ({
    title: `État des lieux - ${property}`,
    description: `État des lieux du bien situé ${property}.`,
  }),
  tickets: {
    title: "Tickets",
    description: "Suivez les demandes de maintenance et réparations.",
  },
  ticketsNew: {
    title: "Nouveau ticket",
    description: "Créez une nouvelle demande de maintenance.",
  },
  tenants: {
    title: "Mes locataires",
    description: "Liste de tous vos locataires actuels et passés.",
  },
  tenantsDetail: (name: string) => ({
    title: `Locataire - ${name}`,
    description: `Fiche détaillée du locataire ${name}.`,
  }),
  analytics: {
    title: "Analyses",
    description: "Statistiques et analyses de votre patrimoine immobilier.",
  },
  indexation: {
    title: "Indexation des loyers",
    description: "Calculez et appliquez l'indexation annuelle de vos loyers.",
  },
  diagnostics: {
    title: "Diagnostics",
    description: "Gérez les diagnostics obligatoires de vos biens (DPE, amiante, etc.).",
  },
  endOfLease: {
    title: "Fin de bail",
    description: "Gérez les procédures de fin de bail et états des lieux de sortie.",
  },
  profile: {
    title: "Mon profil",
    description: "Gérez vos informations personnelles et paramètres de compte.",
  },
  profileBanking: {
    title: "Informations bancaires",
    description: "Configurez vos coordonnées bancaires pour les encaissements.",
  },
  profileIdentity: {
    title: "Vérification d'identité",
    description: "Vérifiez votre identité pour sécuriser votre compte.",
  },
  support: {
    title: "Aide & services",
    description: "Centre d'aide et services d'accompagnement Talok.",
  },
  legalProtocols: {
    title: "Protocoles juridiques",
    description: "Procédures légales : impayés, expulsion, contentieux.",
  },
  providers: {
    title: "Prestataires",
    description: "Gérez vos prestataires de services et artisans.",
  },
  messages: {
    title: "Messages",
    description: "Communiquez avec vos locataires et prestataires.",
  },
  visits: {
    title: "Visites",
    description: "Planifiez et gérez les visites de vos biens.",
  },
  taxes: {
    title: "Fiscalité",
    description: "Gérez la fiscalité de vos revenus locatifs.",
  },
};

/**
 * Métadonnées pour les pages Tenant (Locataire)
 */
export const tenantMetadata = {
  dashboard: {
    title: "Mon espace locataire",
    description: "Accédez à toutes les informations de votre location.",
  },
  lease: {
    title: "Mon logement",
    description: "Détails de votre contrat de location et de votre logement.",
  },
  payments: {
    title: "Paiements",
    description: "Payez votre loyer et consultez votre historique de paiements.",
  },
  receipts: {
    title: "Quittances",
    description: "Téléchargez vos quittances de loyer.",
  },
  documents: {
    title: "Documents",
    description: "Accédez à tous vos documents locatifs.",
  },
  requests: {
    title: "Demandes",
    description: "Soumettez et suivez vos demandes de maintenance.",
  },
  requestsNew: {
    title: "Nouvelle demande",
    description: "Créez une nouvelle demande auprès de votre propriétaire.",
  },
  inspections: {
    title: "États des lieux",
    description: "Consultez vos états des lieux d'entrée et de sortie.",
  },
  meters: {
    title: "Relevés de compteurs",
    description: "Transmettez vos relevés de compteurs.",
  },
  identity: {
    title: "Mon identité",
    description: "Gérez vos documents d'identité.",
  },
  legalRights: {
    title: "Droits du locataire",
    description: "Informations sur vos droits en tant que locataire.",
  },
};

/**
 * Métadonnées pour les pages Provider (Prestataire)
 */
export const providerMetadata = {
  dashboard: {
    title: "Espace prestataire",
    description: "Tableau de bord de vos interventions et devis.",
  },
  jobs: {
    title: "Interventions",
    description: "Gérez vos interventions en cours et à venir.",
  },
  quotes: {
    title: "Devis",
    description: "Créez et suivez vos devis.",
  },
  quotesNew: {
    title: "Nouveau devis",
    description: "Créez un nouveau devis pour une intervention.",
  },
  invoices: {
    title: "Factures",
    description: "Gérez vos factures et suivez vos paiements.",
  },
  calendar: {
    title: "Calendrier",
    description: "Planifiez vos interventions.",
  },
  compliance: {
    title: "Conformité",
    description: "Gérez vos documents de conformité professionnelle.",
  },
};

/**
 * Métadonnées pour les pages Admin
 */
export const adminMetadata = {
  dashboard: {
    title: "Administration",
    description: "Tableau de bord d'administration Talok.",
  },
  properties: {
    title: "Gestion des biens",
    description: "Administration des biens immobiliers.",
  },
  tenants: {
    title: "Gestion des locataires",
    description: "Administration des comptes locataires.",
  },
  people: {
    title: "Utilisateurs",
    description: "Gestion des utilisateurs de la plateforme.",
  },
  templates: {
    title: "Modèles de documents",
    description: "Gestion des modèles de documents.",
  },
  branding: {
    title: "Personnalisation",
    description: "Personnalisation de l'interface.",
  },
  emails: {
    title: "Emails",
    description: "Configuration des emails automatiques.",
  },
  plans: {
    title: "Plans & tarifs",
    description: "Gestion des plans d'abonnement.",
  },
  compliance: {
    title: "Conformité",
    description: "Gestion de la conformité légale.",
  },
  moderation: {
    title: "Modération",
    description: "Modération du contenu utilisateur.",
  },
  reports: {
    title: "Rapports",
    description: "Rapports et statistiques de la plateforme.",
  },
  accounting: {
    title: "Comptabilité",
    description: "Gestion comptable de la plateforme.",
  },
};

/**
 * Métadonnées pour les pages publiques
 */
export const publicMetadata = {
  home: {
    title: "Talok | Logiciel de Gestion Locative n°1 en France",
    description: DEFAULT_DESCRIPTION,
  },
  pricing: {
    title: "Tarifs",
    description: "Découvrez nos offres de gestion locative adaptées à vos besoins. Essai gratuit 30 jours.",
  },
  features: {
    title: "Fonctionnalités",
    description: "Découvrez toutes les fonctionnalités de Talok : baux ALUR, signatures électroniques, scoring IA.",
  },
  blog: {
    title: "Blog",
    description: "Conseils et actualités sur la gestion locative en France.",
  },
  contact: {
    title: "Contact",
    description: "Contactez l'équipe Talok pour toute question.",
  },
  showcase: {
    title: "Cas clients",
    description: "Découvrez comment nos clients utilisent Talok au quotidien.",
  },
  legal: {
    terms: {
      title: "Conditions d'utilisation",
      description: "Conditions générales d'utilisation de Talok.",
    },
    privacy: {
      title: "Politique de confidentialité",
      description: "Politique de protection des données personnelles.",
    },
  },
};

/**
 * Métadonnées pour les pages d'authentification
 */
export const authMetadata = {
  signin: {
    title: "Connexion",
    description: "Connectez-vous à votre espace Talok.",
  },
  signup: {
    title: "Inscription",
    description: "Créez votre compte Talok gratuitement.",
  },
  forgotPassword: {
    title: "Mot de passe oublié",
    description: "Réinitialisez votre mot de passe Talok.",
  },
  resetPassword: {
    title: "Réinitialiser le mot de passe",
    description: "Créez un nouveau mot de passe pour votre compte.",
  },
  verifyEmail: {
    title: "Vérification email",
    description: "Vérifiez votre adresse email pour activer votre compte.",
  },
};

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
