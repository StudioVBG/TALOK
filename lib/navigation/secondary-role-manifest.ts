import {
  Building2,
  Calendar,
  ClipboardList,
  Euro,
  FileText,
  FolderOpen,
  HelpCircle,
  Home,
  MessageSquare,
  PieChart,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SecondaryRoleKey = "agency" | "copro" | "guarantor";

export type SecondaryRoleNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export type SecondaryRoleManifest = {
  key: SecondaryRoleKey;
  label: string;
  title: string;
  subtitle: string;
  navigation: SecondaryRoleNavItem[];
  footerNavigation: SecondaryRoleNavItem[];
};

export const SECONDARY_ROLE_MANIFESTS: Record<SecondaryRoleKey, SecondaryRoleManifest> = {
  agency: {
    key: "agency",
    label: "Agence",
    title: "Espace Agence",
    subtitle: "Talok Pro",
    navigation: [
      { name: "Dashboard", href: "/agency/dashboard", icon: Home },
      { name: "Mandats", href: "/agency/mandates", icon: FileText },
      { name: "Propriétaires", href: "/agency/owners", icon: Users },
      { name: "Biens gérés", href: "/agency/properties", icon: Building2 },
      { name: "Locataires", href: "/agency/tenants", icon: UserCog },
      { name: "Finances", href: "/agency/finances", icon: Euro },
      { name: "Commissions", href: "/agency/commissions", icon: PieChart },
      { name: "Documents", href: "/agency/documents", icon: FolderOpen },
      { name: "Équipe", href: "/agency/team", icon: ClipboardList },
    ],
    footerNavigation: [
      { name: "Paramètres", href: "/agency/settings", icon: Settings },
      { name: "Aide", href: "/agency/help", icon: HelpCircle },
    ],
  },
  copro: {
    key: "copro",
    label: "Copropriétaire",
    title: "Mon Espace",
    subtitle: "Copropriétaire",
    navigation: [
      { name: "Dashboard", href: "/copro/dashboard", icon: Home },
      { name: "Assemblées", href: "/copro/assemblies", icon: Calendar },
      { name: "Charges", href: "/copro/charges", icon: Euro },
      { name: "Documents", href: "/copro/documents", icon: FileText },
      { name: "Signalements", href: "/copro/tickets", icon: MessageSquare },
    ],
    footerNavigation: [
      { name: "Paramètres", href: "/copro/settings", icon: Settings },
      { name: "Aide", href: "/copro/help", icon: HelpCircle },
    ],
  },
  guarantor: {
    key: "guarantor",
    label: "Garant",
    title: "Espace Garant",
    subtitle: "Engagements & documents",
    navigation: [
      { name: "Tableau de bord", href: "/guarantor/dashboard", icon: Home },
      { name: "Documents", href: "/guarantor/documents", icon: FileText },
      { name: "Engagements", href: "/guarantor/dashboard", icon: Shield },
    ],
    footerNavigation: [
      { name: "Mon profil", href: "/guarantor/profile", icon: User },
      { name: "Aide", href: "/guarantor/help", icon: HelpCircle },
    ],
  },
};

export function getSecondaryRoleManifest(role: SecondaryRoleKey): SecondaryRoleManifest {
  return SECONDARY_ROLE_MANIFESTS[role];
}
