"use client";
// @ts-nocheck

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileSignature,
  ClipboardCheck,
  Euro,
  FolderOpen,
  CalendarOff,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaseHubNavProps {
  leaseId: string;
  leaseStatus: string;
  propertyAddress: string;
  propertyCity: string;
  tenantName?: string;
  statusLabel: string;
  statusColor: string;
  hasEdl?: boolean;
  documentsCount?: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  sent: "bg-blue-100 text-blue-700 border-blue-300",
  pending_signature: "bg-amber-100 text-amber-700 border-amber-300",
  partially_signed: "bg-orange-100 text-orange-700 border-orange-300",
  pending_owner_signature: "bg-blue-100 text-blue-700 border-blue-300",
  fully_signed: "bg-indigo-100 text-indigo-700 border-indigo-300",
  active: "bg-green-100 text-green-700 border-green-300",
  notice_given: "bg-orange-100 text-orange-700 border-orange-300",
  amended: "bg-purple-100 text-purple-700 border-purple-300",
  terminated: "bg-slate-100 text-slate-600 border-slate-300",
  archived: "bg-gray-200 text-gray-600 border-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  pending_signature: "Signature en attente",
  partially_signed: "Partiellement signé",
  pending_owner_signature: "À signer",
  fully_signed: "Signé - EDL requis",
  active: "Actif",
  notice_given: "Congé donné",
  amended: "Avenant en cours",
  terminated: "Terminé",
  archived: "Archivé",
};

export function LeaseHubNav({
  leaseId,
  leaseStatus,
  propertyAddress,
  propertyCity,
  tenantName,
}: LeaseHubNavProps) {
  const pathname = usePathname();
  const basePath = `/owner/leases/${leaseId}`;

  const tabs = [
    {
      id: "overview",
      label: "Vue d'ensemble",
      href: basePath,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      id: "contract",
      label: "Contrat",
      href: `${basePath}/contract`,
      icon: FileSignature,
    },
    {
      id: "inspection",
      label: "État des lieux",
      href: `${basePath}/inspection`,
      icon: ClipboardCheck,
    },
    {
      id: "rent",
      label: "Loyers",
      href: `${basePath}/rent`,
      icon: Euro,
    },
    {
      id: "documents",
      label: "Documents",
      href: `${basePath}/documents`,
      icon: FolderOpen,
    },
    {
      id: "end",
      label: "Fin de bail",
      href: `${basePath}/end`,
      icon: CalendarOff,
      showIf: ["active", "notice_given"].includes(leaseStatus),
    },
  ];

  const visibleTabs = tabs.filter((t) => t.showIf === undefined || t.showIf);

  const isActive = (tab: (typeof tabs)[0]) => {
    if (tab.exact) {
      return pathname === tab.href;
    }
    return pathname.startsWith(tab.href);
  };

  const statusColor = STATUS_COLORS[leaseStatus] || STATUS_COLORS.draft;
  const statusLabel = STATUS_LABELS[leaseStatus] || "Inconnu";

  return (
    <div className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-30">
      {/* Header */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <Link href="/owner/leases">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Mes baux</span>
              </Link>
            </Button>
            <div className="h-5 w-px bg-border hidden sm:block flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">
                {propertyAddress}
                {propertyCity && (
                  <span className="text-muted-foreground font-normal hidden md:inline">
                    {" "}
                    — {propertyCity}
                  </span>
                )}
              </h1>
              <Badge className={cn("text-[10px] flex-shrink-0", statusColor)} variant="outline">
                {statusLabel}
              </Badge>
            </div>
          </div>
          {tenantName && (
            <p className="text-xs text-muted-foreground hidden lg:block flex-shrink-0">
              {tenantName}
            </p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="container mx-auto px-4">
        <nav className="-mb-px flex gap-1 overflow-x-auto scrollbar-hide pb-px" aria-label="Navigation du bail">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
