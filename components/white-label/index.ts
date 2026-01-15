/**
 * White-Label Components
 *
 * Composants UI pour la configuration de la marque blanche
 * avec support pour les différents niveaux de personnalisation
 */

// Composants de base
export { ColorPicker } from "./color-picker";
export { LogoUpload } from "./logo-upload";
export { FeatureGate, FeatureBadge, FeatureList } from "./feature-gate";
export { BrandingForm } from "./branding-form";

// Prévisualisation
export { LivePreview } from "./live-preview";
export { EmailPreview } from "./email-preview";

// Gestion des domaines
export { DomainManager } from "./domain-manager";

// Provider et contexte
export {
  BrandingProvider,
  useBranding,
  BrandedLogo,
  BrandedFooter,
} from "./branding-provider";

// Pages brandées
export { BrandedLogin } from "./branded-login";

// Configuration wizard
export { SetupWizard } from "./setup-wizard";
