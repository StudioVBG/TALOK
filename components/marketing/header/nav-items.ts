import {
  FileText,
  CreditCard,
  ClipboardCheck,
  FolderOpen,
  Wrench,
  PieChart,
  Receipt,
  Building2,
  User,
  Briefcase,
  Building,
  Landmark,
  Palmtree,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export const PRODUCT_ITEMS: NavItem[] = [
  { label: "Gestion des baux", href: "/fonctionnalites/gestion-des-baux", icon: FileText },
  { label: "Paiements en ligne", href: "/fonctionnalites/paiements-en-ligne", icon: CreditCard },
  { label: "États des lieux", href: "/fonctionnalites/etats-des-lieux", icon: ClipboardCheck },
  { label: "Documents", href: "/fonctionnalites/documents", icon: FolderOpen },
  { label: "Tickets & travaux", href: "/fonctionnalites/tickets-et-travaux", icon: Wrench },
  { label: "Comptabilité", href: "/fonctionnalites/comptabilite-fiscalite", icon: PieChart },
  { label: "Quittances de loyer", href: "/fonctionnalites/quittances-loyers", icon: Receipt },
  { label: "Immeuble & copropriété", href: "/fonctionnalites/immeuble-copropriete", icon: Building2 },
];

export const SOLUTIONS_ITEMS: NavItem[] = [
  { label: "Propriétaires particuliers", href: "/solutions/proprietaires-particuliers", icon: User },
  { label: "Investisseurs & SCI", href: "/solutions/investisseurs", icon: Briefcase },
  { label: "Administrateurs de biens", href: "/solutions/administrateurs-biens", icon: Building },
  { label: "Syndics de copropriété", href: "/solutions/syndics", icon: Landmark },
  { label: "France d’outre-mer", href: "/solutions/outre-mer", icon: Palmtree, badge: "DROM-COM" },
];
