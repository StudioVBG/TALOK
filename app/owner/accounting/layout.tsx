"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  BookOpenCheck,
  ScanLine,
  Landmark,
  GitMerge,
  Calendar,
  Download,
  FileText,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Scale,
  ListTree,
  ArrowRightLeft,
  Building2,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface AccountingTab {
  label: string;
  href: string;
  icon: LucideIcon;
}

const accountingTabs: AccountingTab[] = [
  { label: "Tableau de bord", href: "/owner/accounting", icon: LayoutDashboard },
  { label: "Écritures", href: "/owner/accounting/entries", icon: BookOpen },
  { label: "Grand livre", href: "/owner/accounting/grand-livre", icon: BookOpenCheck },
  { label: "Balance", href: "/owner/accounting/balance", icon: Scale },
  { label: "Rendement par bien", href: "/owner/accounting/rendement", icon: TrendingUp },
  { label: "Plan comptable", href: "/owner/accounting/chart", icon: ListTree },
  { label: "Justificatifs", href: "/owner/accounting/upload", icon: ScanLine },
  { label: "Banque", href: "/owner/accounting/bank", icon: Landmark },
  {
    label: "Rapprochement",
    href: "/owner/accounting/bank/reconciliation",
    icon: GitMerge,
  },
  { label: "Virements", href: "/owner/accounting/transfers", icon: ArrowRightLeft },
  { label: "Exercices", href: "/owner/accounting/exercises", icon: Calendar },
  { label: "Exports", href: "/owner/accounting/exports", icon: Download },
  {
    label: "Déclarations",
    href: "/owner/accounting/declarations",
    icon: FileText,
  },
  {
    label: "Acquisitions",
    href: "/owner/accounting/property-acquisitions",
    icon: Building2,
  },
  {
    label: "Amortissements",
    href: "/owner/accounting/amortization",
    icon: TrendingDown,
  },
  { label: "Expert-comptable", href: "/owner/accounting/ec", icon: UserCheck },
  { label: "Paramètres", href: "/owner/accounting/settings", icon: Settings },
];

/**
 * Determine if a tab is active based on the current pathname.
 *
 * - `/owner/accounting` matches exactly (dashboard) to avoid matching every sub-route.
 * - `/owner/accounting/bank` matches its path but NOT `/owner/accounting/bank/reconciliation`
 *   (which is a separate tab).
 * - Other routes use a prefix match so nested pages (if any) keep the parent tab highlighted.
 */
function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/owner/accounting") {
    return pathname === "/owner/accounting";
  }
  if (tabHref === "/owner/accounting/bank") {
    return (
      pathname === "/owner/accounting/bank" ||
      (pathname.startsWith("/owner/accounting/bank/") &&
        !pathname.startsWith("/owner/accounting/bank/reconciliation"))
    );
  }
  return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
}

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <nav
        aria-label="Navigation Comptabilité"
        className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex min-w-max items-center gap-1 px-3 sm:px-4 lg:px-6">
            {accountingTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab.href, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors",
                    "border-b-2 -mb-px",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
