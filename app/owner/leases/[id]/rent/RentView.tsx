"use client";
// @ts-nocheck

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Euro,
  CheckCircle2,
  Clock,
  AlertCircle,
  Receipt,
  ArrowRight,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface Invoice {
  id: string;
  numero?: string;
  periode: string;
  montant_total: number;
  statut: string;
  date_echeance?: string;
  created_at: string;
  metadata?: any;
}

interface Payment {
  id: string;
  date_paiement: string | null;
  montant: number;
  statut: string;
  methode?: string;
  periode?: string;
}

interface RentViewProps {
  leaseId: string;
  leaseStatus: string;
  loyer: number;
  charges: number;
  invoices: Invoice[];
  payments: Payment[];
}

const INVOICE_STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
  sent: { label: "Envoyée", color: "bg-blue-100 text-blue-700", icon: CalendarDays },
  viewed: { label: "Vue", color: "bg-blue-100 text-blue-700", icon: CalendarDays },
  partial: { label: "Partiel", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700", icon: AlertCircle },
  disputed: { label: "Contestée", color: "bg-red-100 text-red-700", icon: AlertCircle },
  cancelled: { label: "Annulée", color: "bg-slate-100 text-slate-500", icon: Clock },
  credited: { label: "Avoirs", color: "bg-purple-100 text-purple-700", icon: Receipt },
};

function formatPeriode(periode: string): string {
  try {
    const date = new Date(periode + "-01");
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } catch {
    return periode;
  }
}

export function RentView({ leaseId, leaseStatus, loyer, charges, invoices, payments }: RentViewProps) {
  const totalMensuel = loyer + charges;

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.statut === "paid");
    const overdue = invoices.filter((i) => i.statut === "overdue");
    const pending = invoices.filter((i) => ["sent", "viewed", "partial"].includes(i.statut));

    const totalCollected = paid.reduce((sum, i) => sum + i.montant_total, 0);
    const totalOverdue = overdue.reduce((sum, i) => sum + i.montant_total, 0);

    return { paid: paid.length, overdue: overdue.length, pending: pending.length, totalCollected, totalOverdue };
  }, [invoices]);

  const isActive = ["active", "notice_given"].includes(leaseStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Loyers & quittances</h2>
        {isActive && (
          <Button size="sm" asChild>
            <Link href={`/owner/money`}>
              <Euro className="h-4 w-4 mr-2" />
              Tableau de bord finances
            </Link>
          </Button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Euro className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(totalMensuel)}</p>
                <p className="text-[11px] text-muted-foreground">Loyer mensuel</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalCollected)}</p>
                <p className="text-[11px] text-muted-foreground">Encaissé</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.pending}</p>
                <p className="text-[11px] text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.overdue > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                <AlertCircle className={`h-4 w-4 ${stats.overdue > 0 ? "text-red-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.overdue > 0 ? formatCurrency(stats.totalOverdue) : "0"}</p>
                <p className="text-[11px] text-muted-foreground">Impayés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aucune facture"
          description={
            isActive
              ? "Les factures seront générées automatiquement chaque mois."
              : "Les factures apparaîtront ici une fois le bail actif."
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Historique des factures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.map((invoice) => {
                const config = INVOICE_STATUS[invoice.statut] || INVOICE_STATUS.draft;
                const Icon = config.icon;
                return (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium capitalize">{formatPeriode(invoice.periode)}</p>
                        {invoice.numero && (
                          <p className="text-[10px] text-muted-foreground">N° {invoice.numero}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={config.color} variant="outline">
                        {config.label}
                      </Badge>
                      <span className="text-sm font-medium w-20 text-right">
                        {formatCurrency(invoice.montant_total)}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                        <Link href={`/owner/money`}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Derniers paiements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`h-4 w-4 ${payment.statut === "succeeded" || payment.statut === "paid" ? "text-emerald-500" : "text-amber-500"}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {payment.date_paiement
                          ? new Date(payment.date_paiement).toLocaleDateString("fr-FR")
                          : "Date inconnue"}
                      </p>
                      {payment.periode && (
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {formatPeriode(payment.periode)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.methode && (
                      <span className="text-[10px] text-muted-foreground capitalize">{payment.methode}</span>
                    )}
                    <span className="text-sm font-medium">{formatCurrency(payment.montant)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
