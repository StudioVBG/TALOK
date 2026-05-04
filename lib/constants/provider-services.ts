/**
 * Liste canonique des spécialités proposables par un prestataire.
 * Utilisée à l'onboarding (sélection initiale) et dans /provider/settings (édition).
 */
export const PROVIDER_SERVICES = [
  "Plomberie",
  "Électricité",
  "Chauffage",
  "Climatisation",
  "Menuiserie",
  "Peinture",
  "Carrelage",
  "Maçonnerie",
  "Serrurerie",
  "Vitrerie",
  "Élagage",
  "Jardinage",
  "Ménage",
  "Autre",
] as const;

export type ProviderService = (typeof PROVIDER_SERVICES)[number];
