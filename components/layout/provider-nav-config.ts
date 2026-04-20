import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  Calendar,
  Star,
  Settings,
  HelpCircle,
  FileText,
  FolderOpen,
  Shield,
  Image,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

export interface ProviderNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const providerNavigation: ProviderNavItem[] = [
  { name: "Tableau de bord", href: "/provider/dashboard", icon: LayoutDashboard },
  { name: "Mes missions", href: "/provider/jobs", icon: Briefcase },
  { name: "Messages", href: "/provider/messages", icon: MessageSquare },
  { name: "Calendrier", href: "/provider/calendar", icon: Calendar },
  { name: "Mes devis", href: "/provider/quotes", icon: FileText },
  { name: "Mes factures", href: "/provider/invoices", icon: Receipt },
  { name: "Mes documents", href: "/provider/documents", icon: FolderOpen },
  { name: "Mes avis", href: "/provider/reviews", icon: Star },
  { name: "Conformité", href: "/provider/compliance", icon: Shield },
  { name: "Mon portfolio", href: "/provider/portfolio", icon: Image },
];

export const providerSecondaryNav: ProviderNavItem[] = [
  { name: "Paramètres", href: "/provider/settings", icon: Settings },
  { name: "Aide", href: "/provider/help", icon: HelpCircle },
];
