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
  /** ID propagé en `data-tour` pour cibler cet élément depuis le tour guidé. */
  tourId?: string;
}

export const providerNavigation: ProviderNavItem[] = [
  { name: "Tableau de bord", href: "/provider/dashboard", icon: LayoutDashboard, tourId: "nav-dashboard" },
  { name: "Mes missions", href: "/provider/jobs", icon: Briefcase, tourId: "nav-jobs" },
  { name: "Messages", href: "/provider/messages", icon: MessageSquare },
  { name: "Calendrier", href: "/provider/calendar", icon: Calendar, tourId: "nav-calendar" },
  { name: "Mes devis", href: "/provider/quotes", icon: FileText, tourId: "nav-quotes" },
  { name: "Mes factures", href: "/provider/invoices", icon: Receipt },
  { name: "Mes documents", href: "/provider/documents", icon: FolderOpen },
  { name: "Mes avis", href: "/provider/reviews", icon: Star, tourId: "nav-reviews" },
  { name: "Conformité", href: "/provider/compliance", icon: Shield },
  { name: "Mon portfolio", href: "/provider/portfolio", icon: Image },
];

export const providerSecondaryNav: ProviderNavItem[] = [
  { name: "Paramètres", href: "/provider/settings", icon: Settings },
  { name: "Aide", href: "/provider/help", icon: HelpCircle },
];
