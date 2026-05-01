import {
  Bell,
  Building2,
  Calculator,
  Calendar,
  ClipboardList,
  Euro,
  FileText,
  FolderOpen,
  HelpCircle,
  Home,
  MessageSquare,
  Palette,
  PieChart,
  PiggyBank,
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
      { name: "Comptes mandants", href: "/agency/accounts", icon: PiggyBank },
      { name: "Documents", href: "/agency/documents", icon: FolderOpen },
      { name: "Équipe", href: "/agency/team", icon: ClipboardList },
    ],
    footerNavigation: [
      { name: "Branding", href: "/agency/settings/branding", icon: Palette },
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
      { name: "Appels de fonds", href: "/copro/appels", icon: Euro },
      { name: "Mon compte", href: "/copro/comptabilite", icon: Calculator },
      { name: "Assemblées", href: "/copro/assemblies", icon: Calendar },
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
      { name: "Engagements", href: "/guarantor/dashboard", icon: Shield },
      { name: "Documents", href: "/guarantor/documents", icon: FileText },
      { name: "Notifications", href: "/guarantor/notifications", icon: Bell },
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
