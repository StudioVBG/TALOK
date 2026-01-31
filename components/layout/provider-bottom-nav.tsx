"use client";

import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  FileText,
  Receipt,
  Star,
  Shield,
  Settings,
  HelpCircle,
} from "lucide-react";
import { SharedBottomNav } from "./shared-bottom-nav";

export function ProviderBottomNav() {
  return (
    <SharedBottomNav
      items={[
        { href: "/provider/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/provider/jobs", label: "Missions", icon: Briefcase },
        { href: "/provider/calendar", label: "Calendrier", icon: Calendar },
        { href: "/provider/quotes", label: "Devis", icon: FileText },
      ]}
      moreItems={[
        { href: "/provider/invoices", label: "Factures", icon: Receipt },
        { href: "/provider/documents", label: "Documents", icon: FileText },
        { href: "/provider/reviews", label: "Avis", icon: Star },
        { href: "/provider/compliance", label: "Conformité", icon: Shield },
        { href: "/provider/settings", label: "Paramètres", icon: Settings },
        { href: "/provider/help", label: "Aide", icon: HelpCircle },
      ]}
      hiddenOnPaths={['/provider/onboarding']}
    />
  );
}
