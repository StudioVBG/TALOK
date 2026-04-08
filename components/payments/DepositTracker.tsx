"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowDownRight,
} from "lucide-react";

interface SecurityDeposit {
  id: string;
  lease_id: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  restitution_amount_cents: number | null;
  retenue_cents: number | null;
  restitution_due_date: string | null;
  restituted_at: string | null;
  lease?: {
    property?: {
      adresse_complete?: string;
      ville?: string;
    };
  };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: string }
> = {
  pending: {
    label: "En attente",
    icon: Clock,
    variant: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  received: {
    label: "Reçu",
    icon: CheckCircle,
    variant: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  partially_returned: {
    label: "Partiellement restitué",
    icon: ArrowDownRight,
    variant: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  returned: {
    label: "Restitué",
    icon: CheckCircle,
    variant: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  disputed: {
    label: "Litige",
    icon: AlertTriangle,
    variant: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

interface DepositTrackerProps {
  deposits: SecurityDeposit[];
}

export function DepositTracker({ deposits }: DepositTrackerProps) {
  if (deposits.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Shield className="h-10 w-10 mb-2 opacity-40" />
          <p>Aucun dépôt de garantie enregistré</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {deposits.map((deposit) => {
        const config = STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending;
        const Icon = config.icon;

        return (
          <Card key={deposit.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  {deposit.lease?.property?.adresse_complete ||
                    deposit.lease?.property?.ville ||
                    "Dépôt de garantie"}
                </CardTitle>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.variant}`}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Montant</p>
                  <p className="font-semibold">
                    {formatCents(deposit.amount_cents)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reçu le</p>
                  <p className="font-medium">{formatDate(deposit.paid_at)}</p>
                </div>

                {deposit.restitution_amount_cents != null && (
                  <div>
                    <p className="text-muted-foreground">Restitué</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCents(deposit.restitution_amount_cents)}
                    </p>
                  </div>
                )}

                {(deposit.retenue_cents ?? 0) > 0 && (
                  <div>
                    <p className="text-muted-foreground">Retenues</p>
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      {formatCents(deposit.retenue_cents!)}
                    </p>
                  </div>
                )}

                {deposit.restitution_due_date && (
                  <div>
                    <p className="text-muted-foreground">Date limite restitution</p>
                    <p className="font-medium">
                      {formatDate(deposit.restitution_due_date)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
