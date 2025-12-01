/**
 * Profile Tasks Utilities - SOTA 2025
 * Fonctions utilitaires pour la complétion de profil (Server-compatible)
 */

import {
  User,
  Phone,
  Camera,
  Calendar,
  Briefcase,
  Euro,
  FileText,
  Shield,
  Building2,
  LucideIcon,
} from "lucide-react";

export interface ProfileTask {
  key: string;
  label: string;
  iconName: string; // Nom de l'icône au lieu de l'icône elle-même pour la sérialisation
  href: string;
  done: boolean;
}

// Helper function to create owner profile tasks
export function createOwnerProfileTasks(data: {
  hasFirstName?: boolean;
  hasLastName?: boolean;
  hasPhone?: boolean;
  hasAvatar?: boolean;
  hasOwnerType?: boolean;
  hasIban?: boolean;
  hasBillingAddress?: boolean;
  hasIdentityDocument?: boolean;
  hasProperty?: boolean;
}): ProfileTask[] {
  return [
    { key: "firstName", label: "Prénom renseigné", iconName: "User", href: "/owner/settings/profile", done: !!data.hasFirstName },
    { key: "lastName", label: "Nom renseigné", iconName: "User", href: "/owner/settings/profile", done: !!data.hasLastName },
    { key: "phone", label: "Téléphone ajouté", iconName: "Phone", href: "/owner/settings/profile", done: !!data.hasPhone },
    { key: "avatar", label: "Photo de profil", iconName: "Camera", href: "/owner/settings/profile", done: !!data.hasAvatar },
    { key: "ownerType", label: "Type de propriétaire", iconName: "Building2", href: "/owner/settings/profile", done: !!data.hasOwnerType },
    { key: "iban", label: "IBAN bancaire", iconName: "Euro", href: "/owner/settings/billing", done: !!data.hasIban },
    { key: "billingAddress", label: "Adresse de facturation", iconName: "Building2", href: "/owner/settings/billing", done: !!data.hasBillingAddress },
    { key: "identityDocument", label: "Pièce d'identité", iconName: "FileText", href: "/owner/documents", done: !!data.hasIdentityDocument },
    { key: "property", label: "Premier bien ajouté", iconName: "Building2", href: "/owner/properties/new", done: !!data.hasProperty },
  ];
}

// Helper function to create tenant profile tasks
export function createTenantProfileTasks(data: {
  hasFirstName?: boolean;
  hasLastName?: boolean;
  hasPhone?: boolean;
  hasAvatar?: boolean;
  hasBirthDate?: boolean;
  hasSituationPro?: boolean;
  hasRevenus?: boolean;
  hasIdentityDocument?: boolean;
  hasInsurance?: boolean;
}): ProfileTask[] {
  return [
    { key: "firstName", label: "Prénom renseigné", iconName: "User", href: "/tenant/settings", done: !!data.hasFirstName },
    { key: "lastName", label: "Nom renseigné", iconName: "User", href: "/tenant/settings", done: !!data.hasLastName },
    { key: "phone", label: "Téléphone ajouté", iconName: "Phone", href: "/tenant/settings", done: !!data.hasPhone },
    { key: "avatar", label: "Photo de profil", iconName: "Camera", href: "/tenant/settings", done: !!data.hasAvatar },
    { key: "birthDate", label: "Date de naissance", iconName: "Calendar", href: "/tenant/settings", done: !!data.hasBirthDate },
    { key: "situationPro", label: "Situation professionnelle", iconName: "Briefcase", href: "/tenant/settings", done: !!data.hasSituationPro },
    { key: "revenus", label: "Revenus déclarés", iconName: "Euro", href: "/tenant/settings", done: !!data.hasRevenus },
    { key: "identityDocument", label: "Pièce d'identité", iconName: "FileText", href: "/tenant/documents", done: !!data.hasIdentityDocument },
    { key: "insurance", label: "Attestation assurance", iconName: "Shield", href: "/tenant/documents", done: !!data.hasInsurance },
  ];
}

