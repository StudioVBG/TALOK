/**
 * Types et définitions pour le système White-Label
 *
 * Niveaux :
 * - none: Pas de white-label (Gratuit → Pro)
 * - basic: White-label basique (Enterprise M - 349€)
 * - full: White-label complet (Enterprise L - 499€)
 * - premium: White-label premium + SSO (Enterprise XL - 799€)
 */

// ============================================
// TYPES DE BASE
// ============================================

export type WhiteLabelLevel = 'none' | 'basic' | 'full' | 'premium';

export type WhiteLabelFeature =
  | 'custom_logo'
  | 'custom_favicon'
  | 'primary_color'
  | 'secondary_color'
  | 'accent_color'
  | 'company_name'
  | 'custom_email_from'
  | 'custom_email_logo'
  | 'custom_email_footer'
  | 'custom_email_colors'
  | 'branded_login_page'
  | 'remove_powered_by'
  | 'custom_domain'
  | 'custom_css'
  | 'sso_saml'
  | 'sso_oidc'
  | 'multi_organizations'
  | 'branding_api';

// ============================================
// CONFIGURATION PAR NIVEAU
// ============================================

export const WHITE_LABEL_FEATURES: Record<WhiteLabelLevel, WhiteLabelFeature[]> = {
  none: [],

  // Enterprise M (349€/mois)
  basic: [
    'custom_logo',
    'primary_color',
    'company_name',
    'custom_email_from',
    'custom_email_logo',
  ],

  // Enterprise L (499€/mois)
  full: [
    // Inclut tout de basic
    'custom_logo',
    'primary_color',
    'company_name',
    'custom_email_from',
    'custom_email_logo',
    // + nouvelles features
    'custom_favicon',
    'secondary_color',
    'accent_color',
    'custom_email_footer',
    'custom_email_colors',
    'branded_login_page',
    'remove_powered_by',
    'custom_domain',
  ],

  // Enterprise XL (799€/mois)
  premium: [
    // Inclut tout de full
    'custom_logo',
    'primary_color',
    'company_name',
    'custom_email_from',
    'custom_email_logo',
    'custom_favicon',
    'secondary_color',
    'accent_color',
    'custom_email_footer',
    'custom_email_colors',
    'branded_login_page',
    'remove_powered_by',
    'custom_domain',
    // + nouvelles features premium
    'custom_css',
    'sso_saml',
    'sso_oidc',
    'multi_organizations',
    'branding_api',
  ],
};

// ============================================
// LABELS ET DESCRIPTIONS
// ============================================

export const WHITE_LABEL_FEATURE_INFO: Record<WhiteLabelFeature, {
  label: string;
  description: string;
  icon: string;
  category: 'branding' | 'email' | 'domain' | 'advanced';
}> = {
  custom_logo: {
    label: 'Logo personnalisé',
    description: 'Remplacez le logo Talok par le vôtre dans l\'application',
    icon: 'Image',
    category: 'branding',
  },
  custom_favicon: {
    label: 'Favicon personnalisé',
    description: 'Icône personnalisée dans les onglets du navigateur',
    icon: 'Globe',
    category: 'branding',
  },
  primary_color: {
    label: 'Couleur principale',
    description: 'Personnalisez la couleur principale de l\'interface',
    icon: 'Palette',
    category: 'branding',
  },
  secondary_color: {
    label: 'Couleur secondaire',
    description: 'Couleur secondaire pour les éléments d\'accent',
    icon: 'Palette',
    category: 'branding',
  },
  accent_color: {
    label: 'Couleur d\'accent',
    description: 'Couleur pour les boutons et actions importantes',
    icon: 'Palette',
    category: 'branding',
  },
  company_name: {
    label: 'Nom d\'entreprise',
    description: 'Affichez votre nom d\'entreprise au lieu de Talok',
    icon: 'Building2',
    category: 'branding',
  },
  custom_email_from: {
    label: 'Email expéditeur',
    description: 'Envoyez les emails depuis votre propre adresse',
    icon: 'Mail',
    category: 'email',
  },
  custom_email_logo: {
    label: 'Logo dans les emails',
    description: 'Votre logo dans tous les emails envoyés',
    icon: 'Image',
    category: 'email',
  },
  custom_email_footer: {
    label: 'Pied de page email',
    description: 'Personnalisez le footer des emails',
    icon: 'FileText',
    category: 'email',
  },
  custom_email_colors: {
    label: 'Couleurs des emails',
    description: 'Appliquez vos couleurs aux templates d\'emails',
    icon: 'Palette',
    category: 'email',
  },
  branded_login_page: {
    label: 'Page de connexion brandée',
    description: 'Page de connexion 100% à vos couleurs',
    icon: 'LogIn',
    category: 'branding',
  },
  remove_powered_by: {
    label: 'Supprimer "Powered by Talok"',
    description: 'Retirez toute mention de Talok',
    icon: 'EyeOff',
    category: 'branding',
  },
  custom_domain: {
    label: 'Domaine personnalisé',
    description: 'Utilisez votre propre domaine (app.votreentreprise.com)',
    icon: 'Globe',
    category: 'domain',
  },
  custom_css: {
    label: 'CSS personnalisé',
    description: 'Ajoutez du CSS custom pour un contrôle total',
    icon: 'Code',
    category: 'advanced',
  },
  sso_saml: {
    label: 'SSO SAML',
    description: 'Authentification unique via SAML 2.0',
    icon: 'Key',
    category: 'advanced',
  },
  sso_oidc: {
    label: 'SSO OpenID Connect',
    description: 'Authentification unique via OIDC',
    icon: 'Key',
    category: 'advanced',
  },
  multi_organizations: {
    label: 'Multi-organisations',
    description: 'Gérez plusieurs marques/filiales',
    icon: 'Building',
    category: 'advanced',
  },
  branding_api: {
    label: 'API Branding',
    description: 'Gérez le branding via API',
    icon: 'Code',
    category: 'advanced',
  },
};

// ============================================
// INTERFACES DONNÉES
// ============================================

export interface OrganizationBranding {
  id: string;
  organization_id: string;

  // Infos de base
  company_name: string | null;
  tagline: string | null;

  // Logos et images
  logo_url: string | null;
  logo_dark_url: string | null; // Logo pour dark mode
  favicon_url: string | null;
  login_background_url: string | null;

  // Couleurs (format hex #RRGGBB)
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;

  // Email
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  email_logo_url: string | null;
  email_footer_html: string | null;
  email_primary_color: string | null;

  // Avancé
  custom_css: string | null;
  remove_powered_by: boolean;

  // SSO
  sso_enabled: boolean;
  sso_provider: 'saml' | 'oidc' | null;
  sso_config: Record<string, any> | null;

  // Métadonnées
  created_at: string;
  updated_at: string;
}

export interface CustomDomain {
  id: string;
  organization_id: string;
  domain: string;
  subdomain: string | null; // Si sous-domaine de talok.app

  // Vérification
  verified: boolean;
  verification_token: string;
  verification_method: 'dns_txt' | 'dns_cname' | 'file';
  verified_at: string | null;

  // SSL
  ssl_status: 'pending' | 'active' | 'failed' | 'expired';
  ssl_expires_at: string | null;

  // État
  is_primary: boolean;
  is_active: boolean;

  // Métadonnées
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;

  // Abonnement lié
  subscription_id: string | null;
  white_label_level: WhiteLabelLevel;

  // État
  is_active: boolean;

  // Relations
  branding?: OrganizationBranding;
  domains?: CustomDomain[];

  // Métadonnées
  created_at: string;
  updated_at: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Convertit le niveau du plan en niveau white-label
 */
export function planToWhiteLabelLevel(planSlug: string): WhiteLabelLevel {
  switch (planSlug) {
    case 'enterprise_m':
      return 'basic';
    case 'enterprise_l':
      return 'full';
    case 'enterprise_xl':
      return 'premium';
    default:
      return 'none';
  }
}

/**
 * Vérifie si une feature est disponible pour un niveau
 */
export function hasWhiteLabelFeature(
  level: WhiteLabelLevel,
  feature: WhiteLabelFeature
): boolean {
  return WHITE_LABEL_FEATURES[level].includes(feature);
}

/**
 * Obtient les features disponibles pour un niveau
 */
export function getAvailableFeatures(level: WhiteLabelLevel): WhiteLabelFeature[] {
  return WHITE_LABEL_FEATURES[level];
}

/**
 * Obtient les features manquantes pour passer au niveau supérieur
 */
export function getMissingFeatures(
  currentLevel: WhiteLabelLevel,
  targetLevel: WhiteLabelLevel
): WhiteLabelFeature[] {
  const current = new Set(WHITE_LABEL_FEATURES[currentLevel]);
  return WHITE_LABEL_FEATURES[targetLevel].filter(f => !current.has(f));
}

/**
 * Obtient le niveau minimum requis pour une feature
 */
export function getRequiredLevel(feature: WhiteLabelFeature): WhiteLabelLevel {
  if (WHITE_LABEL_FEATURES.basic.includes(feature)) return 'basic';
  if (WHITE_LABEL_FEATURES.full.includes(feature)) return 'full';
  if (WHITE_LABEL_FEATURES.premium.includes(feature)) return 'premium';
  return 'none';
}

/**
 * Labels des niveaux
 */
export const WHITE_LABEL_LEVEL_INFO: Record<WhiteLabelLevel, {
  label: string;
  description: string;
  plan: string;
  price: string;
}> = {
  none: {
    label: 'Aucun',
    description: 'White-label non disponible',
    plan: 'Starter → Pro',
    price: '-',
  },
  basic: {
    label: 'Basique',
    description: 'Personnalisation essentielle',
    plan: 'Enterprise M',
    price: '349€/mois',
  },
  full: {
    label: 'Complet',
    description: 'Personnalisation complète + domaine',
    plan: 'Enterprise L',
    price: '499€/mois',
  },
  premium: {
    label: 'Premium',
    description: 'Personnalisation totale + SSO',
    plan: 'Enterprise XL',
    price: '799€/mois',
  },
};

/**
 * Couleurs par défaut Talok
 */
export const DEFAULT_BRANDING: Partial<OrganizationBranding> = {
  company_name: 'Talok',
  primary_color: '#2563eb', // blue-600
  secondary_color: '#7c3aed', // violet-600
  accent_color: '#10b981', // emerald-500
  email_primary_color: '#2563eb',
  remove_powered_by: false,
};
