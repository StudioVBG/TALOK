/**
 * Icon mapping utility pour éviter de passer des fonctions de Server Components à Client Components
 * Utilisation: Au lieu de passer `icon={Building2}`, on passe `iconName="Building2"`
 */

import {
  Building2,
  FileText,
  Euro,
  Wrench,
  Home,
  Users,
  CreditCard,
  Calendar,
  Bell,
  Settings,
  HelpCircle,
  Plus,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Gauge,
  FileSignature,
  MessageSquare,
  ClipboardCheck,
  LayoutDashboard,
  Receipt,
  User,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "Building2"
  | "FileText"
  | "Euro"
  | "Wrench"
  | "Home"
  | "Users"
  | "CreditCard"
  | "Calendar"
  | "Bell"
  | "Settings"
  | "HelpCircle"
  | "Plus"
  | "FolderOpen"
  | "CheckCircle"
  | "AlertCircle"
  | "Clock"
  | "TrendingUp"
  | "TrendingDown"
  | "ArrowRight"
  | "Gauge"
  | "FileSignature"
  | "MessageSquare"
  | "ClipboardCheck"
  | "LayoutDashboard"
  | "Receipt"
  | "User";

const iconMap: Record<IconName, LucideIcon> = {
  Building2,
  FileText,
  Euro,
  Wrench,
  Home,
  Users,
  CreditCard,
  Calendar,
  Bell,
  Settings,
  HelpCircle,
  Plus,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Gauge,
  FileSignature,
  MessageSquare,
  ClipboardCheck,
  LayoutDashboard,
  Receipt,
  User,
};

export function getIcon(name: IconName): LucideIcon {
  return iconMap[name] || FolderOpen;
}

interface DynamicIconProps {
  name: IconName;
  className?: string;
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  const Icon = getIcon(name);
  return <Icon className={className} />;
}

