import type { Metadata } from "next";

/**
 * Configuration SEO centralisée pour Talok — SOTA 2026
 *
 * Ce fichier contient toutes les métadonnées par défaut, les fonctions
 * utilitaires pour générer des métadonnées SEO optimisées, et les catalogues
 * de métadonnées pour chaque rôle/section de l'application.
 */

const RAW_SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
const SITE_URL = /^https?:\/\//i.test(RAW_SITE_URL) ? RAW_SITE_URL : `https://${RAW_SITE_URL}`;
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

  // === Pages Fonctionnalités (détail) ===
  featureGestionBiens: generatePageMetadata({
    title: "Gestion des biens immobiliers",
    description: "Centralisez tous vos biens locatifs : photos, documents, diagnostics, historique des travaux. Une fiche claire par bien, alertes automatiques.",
    keywords: ["gestion bien immobilier", "logiciel bailleur", "fiche logement"],
    canonical: `${SITE_URL}/fonctionnalites/gestion-biens`,
  }),
  featureGestionLocataires: generatePageMetadata({
    title: "Gestion des locataires",
    description: "Suivez vos locataires, scoring IA des candidatures, historique des échanges, portail locataire dédié. Tout sur chaque dossier.",
    keywords: ["gestion locataire", "scoring candidat bail", "dossier locataire"],
    canonical: `${SITE_URL}/fonctionnalites/gestion-locataires`,
  }),
  featurePaiements: generatePageMetadata({
    title: "Paiements en ligne des loyers",
    description: "Encaissez vos loyers automatiquement : prélèvement SEPA, CB, virement, Open Banking. Réconciliation automatique, relances intégrées.",
    keywords: ["paiement loyer en ligne", "prélèvement loyer automatique", "SEPA loyer", "open banking loyer"],
    canonical: `${SITE_URL}/fonctionnalites/paiements-en-ligne`,
  }),
  featureEDL: generatePageMetadata({
    title: "États des lieux numériques",
    description: "Réalisez vos états des lieux d'entrée et de sortie en 30 min sur mobile. Photos, signature électronique, PDF conforme à la loi ALUR.",
    keywords: ["état des lieux numérique", "EDL mobile", "état des lieux signature électronique"],
    canonical: `${SITE_URL}/fonctionnalites/etats-des-lieux`,
  }),
  featureQuittances: generatePageMetadata({
    title: "Quittances de loyer automatiques",
    description: "Quittances générées automatiquement à chaque paiement, envoyées par email au locataire, archivées 10 ans. Zéro manipulation.",
    keywords: ["quittance de loyer automatique", "quittance PDF", "envoi quittance email"],
    canonical: `${SITE_URL}/fonctionnalites/quittances-loyers`,
  }),
  featureCompta: generatePageMetadata({
    title: "Comptabilité & fiscalité locative",
    description: "Comptabilité double-entrée, export FEC, déclarations 2044/2072, amortissements, rapprochement bancaire automatique. Adapté aux SCI.",
    keywords: ["comptabilité locative", "export FEC", "déclaration 2044", "revenus fonciers"],
    canonical: `${SITE_URL}/fonctionnalites/comptabilite-fiscalite`,
  }),
  featureSignature: generatePageMetadata({
    title: "Signature électronique eIDAS",
    description: "Signature électronique à valeur légale (même valeur qu'un original papier). Bail signé en 5 minutes, depuis n'importe où, sur mobile.",
    keywords: ["signature électronique bail", "eIDAS immobilier", "bail en ligne signé"],
    canonical: `${SITE_URL}/fonctionnalites/signature-electronique`,
  }),
  featureGestionDesBaux: generatePageMetadata({
    title: "Gestion des baux locatifs",
    description: "Créez, signez et gérez vos baux ALUR/ELAN. Modèles meublé, non-meublé, colocation, bail mobilité. Révision IRL automatique.",
    keywords: ["gestion bail locatif", "bail ALUR", "bail mobilité", "renouvellement bail"],
    canonical: `${SITE_URL}/fonctionnalites/gestion-des-baux`,
  }),
  featureDocuments: generatePageMetadata({
    title: "Coffre-fort documents locatifs",
    description: "Tous vos documents centralisés et chiffrés : baux, quittances, diagnostics, CNI, attestations. Partage sécurisé en un clic.",
    keywords: ["coffre-fort documents", "GED locative", "partage document bail sécurisé"],
    canonical: `${SITE_URL}/fonctionnalites/documents`,
  }),
  featureTickets: generatePageMetadata({
    title: "Tickets & travaux locatifs",
    description: "Vos locataires signalent les problèmes, vous pilotez artisans, devis et factures sans quitter Talok. Suivi temps réel.",
    keywords: ["ticket maintenance bien", "travaux locatif", "artisan gestion locative"],
    canonical: `${SITE_URL}/fonctionnalites/tickets-et-travaux`,
  }),
  featureImmeuble: generatePageMetadata({
    title: "Immeuble & copropriété",
    description: "Gérez vos immeubles, lots, tantièmes, copropriétaires. Assemblées générales, appels de fonds, comptabilité syndic intégrée.",
    keywords: ["gestion immeuble", "copropriété logiciel", "appel de fonds syndic"],
    canonical: `${SITE_URL}/fonctionnalites/immeuble-copropriete`,
  }),

  // === Pages Solutions (segments) ===
  solutionProprios: generatePageMetadata({
    title: "Solution pour propriétaires particuliers",
    description: "Gérez 1 à 5 biens locatifs sans agence. Baux, loyers, fiscalité, déclarations : Talok simplifie tout. À partir de 0€/mois.",
    keywords: ["propriétaire bailleur particulier", "gestion locative 1 bien", "alternative agence"],
    canonical: `${SITE_URL}/solutions/proprietaires-particuliers`,
  }),
  solutionInvestisseurs: generatePageMetadata({
    title: "Solution pour investisseurs immobiliers",
    description: "Consolidez votre portefeuille multi-biens : SCI, indivision, Pinel, LMNP. Comptabilité, rentabilité, fiscalité — tout sous contrôle.",
    keywords: ["investisseur immobilier logiciel", "gestion SCI", "portefeuille locatif"],
    canonical: `${SITE_URL}/solutions/investisseurs`,
  }),
  solutionAdministrateurs: generatePageMetadata({
    title: "Solution pour administrateurs de biens",
    description: "Logiciel d'agence immobilière : multi-propriétaires, gestion équipe, CRG mandant, extranet client, white-label. Adapté aux DROM.",
    keywords: ["logiciel administrateur biens", "logiciel agence immobilière", "gestion mandant"],
    canonical: `${SITE_URL}/solutions/administrateurs-biens`,
  }),
  solutionSCI: generatePageMetadata({
    title: "Solution pour SCI familiales",
    description: "Gérez votre SCI familiale : comptes d'associés, quote-parts, déclaration 2072, assemblées. Talok centralise tout pour l'expert-comptable.",
    keywords: ["logiciel SCI familiale", "comptabilité SCI", "déclaration 2072"],
    canonical: `${SITE_URL}/solutions/sci-familiales`,
  }),
  solutionSyndics: generatePageMetadata({
    title: "Solution pour syndics de copropriété",
    description: "Logiciel complet pour syndics : copropriétés, AG en ligne, appels de fonds, comptabilité copropriété, extranet copropriétaires.",
    keywords: ["logiciel syndic copropriété", "syndic bénévole", "AG en ligne copropriété"],
    canonical: `${SITE_URL}/solutions/syndics`,
  }),
  solutionOutreMer: generatePageMetadata({
    title: "Gestion locative en France d'outre-mer",
    description: "Seul logiciel né en Martinique, adapté aux réalités DROM-COM : TVA 8,5 %, Pinel OM, Girardin, normes cycloniques, délais postaux.",
    keywords: ["gestion locative martinique", "logiciel bailleur guadeloupe", "location réunion", "pinel outre-mer"],
    canonical: `${SITE_URL}/solutions/outre-mer`,
  }),

  // === Pages Outils (calculateurs) ===
  outilRendement: generatePageMetadata({
    title: "Calculateur de rentabilité locative",
    description: "Calculez la rentabilité brute et nette de votre bien locatif : cash-flow, rendement, TRI. Simulateur gratuit, sans inscription.",
    keywords: ["calcul rentabilité locative", "rendement locatif", "simulateur investissement"],
    canonical: `${SITE_URL}/outils/calcul-rendement-locatif`,
  }),
  outilFraisNotaire: generatePageMetadata({
    title: "Calculateur de frais de notaire",
    description: "Estimez les frais de notaire pour l'achat d'un bien immobilier : ancien, neuf, terrain. Mise à jour des barèmes 2026.",
    keywords: ["calcul frais de notaire", "émoluments notaire", "frais acquisition immobilier"],
    canonical: `${SITE_URL}/outils/calcul-frais-notaire`,
  }),
  outilIRL: generatePageMetadata({
    title: "Calculateur de révision IRL du loyer",
    description: "Calculez automatiquement la révision annuelle de votre loyer selon l'IRL (Indice de Référence des Loyers). Gratuit et conforme ALUR.",
    keywords: ["calcul révision IRL", "indice référence loyers", "augmentation loyer annuelle"],
    canonical: `${SITE_URL}/outils/calcul-revision-irl`,
  }),
  outilCharges: generatePageMetadata({
    title: "Simulateur de charges locatives",
    description: "Estimez les charges récupérables et non-récupérables de votre bien locatif. Provisions, forfait, régularisation annuelle.",
    keywords: ["calcul charges locatives", "charges récupérables", "provision charges"],
    canonical: `${SITE_URL}/outils/simulateur-charges`,
  }),
  outilsHub: generatePageMetadata({
    title: "Outils gratuits pour propriétaires bailleurs",
    description: "4 calculateurs gratuits : rentabilité, frais de notaire, révision IRL, charges locatives. Sans inscription, mis à jour 2026.",
    keywords: ["outils propriétaire gratuit", "calculateur immobilier", "simulateur locatif"],
    canonical: `${SITE_URL}/outils`,
  }),
  calculateurROI: generatePageMetadata({
    title: "Calculateur d'économies Talok vs agence",
    description: "Combien économisez-vous en gérant vos biens avec Talok plutôt qu'avec une agence à 8 % ? Simulateur instantané, résultat en temps réel.",
    keywords: ["calculateur roi gestion locative", "talok vs agence", "economie frais agence", "commission agence immobiliere"],
    canonical: `${SITE_URL}/calculateur-roi`,
  }),
  accessibilite: generatePageMetadata({
    title: "Déclaration d'accessibilité",
    description: "Déclaration d'accessibilité RGAA 4.1 de Talok. État de conformité, dérogations, voies de recours, contact accessibilité.",
    canonical: `${SITE_URL}/accessibilite`,
  }),
  presse: generatePageMetadata({
    title: "Espace presse",
    description: "Logos, identité visuelle, chiffres clés et contact presse de Talok — logiciel de gestion locative né en Martinique.",
    keywords: ["talok presse", "media kit talok", "logo talok", "contact presse gestion locative"],
    canonical: `${SITE_URL}/presse`,
  }),
  statut: generatePageMetadata({
    title: "Statut des services",
    description: "État en temps réel des services Talok : application, paiements, emails, notifications. Historique des incidents.",
    canonical: `${SITE_URL}/statut`,
  }),

  // === Pages About/Témoignages ===
  aPropos: generatePageMetadata({
    title: "À propos de Talok",
    description: "Talok, logiciel de gestion locative né en Martinique en 2026. Notre mission : démocratiser l'autogestion locative en France.",
    keywords: ["talok équipe", "logiciel locatif français", "entreprise martinique"],
    canonical: `${SITE_URL}/a-propos`,
  }),
  temoignages: generatePageMetadata({
    title: "Témoignages clients",
    description: "Ils utilisent Talok au quotidien : propriétaires particuliers, investisseurs, SCI, agences. +2 000 clients, 98 % satisfaction.",
    keywords: ["avis talok", "témoignages gestion locative", "clients bailleurs"],
    canonical: `${SITE_URL}/temoignages`,
  }),
};
