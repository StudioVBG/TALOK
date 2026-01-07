"use client";

import Link from "next/link";
import {
  Building2,
  CreditCard,
  FileText,
  Wrench,
  Plus,
  Upload,
  Users,
  Gauge,
  LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UserRole = "owner" | "tenant" | "provider";

interface QuickAction {
  icon: LucideIcon;
  label: string;
  href: string;
  color: string;
}

const ownerActions: QuickAction[] = [
  {
    icon: Building2,
    label: "Nouveau bien",
    href: "/owner/properties/new",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: FileText,
    label: "Nouveau bail",
    href: "/owner/leases/new",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: CreditCard,
    label: "Émettre facture",
    href: "/owner/money",
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: Wrench,
    label: "Créer ticket",
    href: "/owner/tickets/new",
    color: "text-rose-600 dark:text-rose-400",
  },
];

const tenantActions: QuickAction[] = [
  {
    icon: CreditCard,
    label: "Payer mon loyer",
    href: "/tenant/payments",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: FileText,
    label: "Mes quittances",
    href: "/tenant/receipts",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Wrench,
    label: "Signaler problème",
    href: "/tenant/requests/new",
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: Gauge,
    label: "Relevé compteur",
    href: "/tenant/meters",
    color: "text-violet-600 dark:text-violet-400",
  },
];

const providerActions: QuickAction[] = [
  {
    icon: FileText,
    label: "Mes interventions",
    href: "/provider/jobs",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Upload,
    label: "Envoyer devis",
    href: "/provider/quotes/new",
    color: "text-emerald-600 dark:text-emerald-400",
  },
];

const actionsByRole: Record<UserRole, QuickAction[]> = {
  owner: ownerActions,
  tenant: tenantActions,
  provider: providerActions,
};

interface QuickActionsProps {
  role: UserRole;
  className?: string;
}

export function QuickActions({ role, className }: QuickActionsProps) {
  const actions = actionsByRole[role] || [];

  if (actions.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Actions rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {actions.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto py-4 px-3 flex-col gap-2 hover:bg-muted/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              asChild
            >
              <Link href={action.href}>
                <action.icon className={cn("h-6 w-6", action.color)} />
                <span className="text-xs font-medium text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

