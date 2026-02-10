"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Euro,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface Payment {
  id: string;
  date_paiement: string | null;
  montant: number;
  statut: string;
  periode: string | null;
}

interface Invoice {
  id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: string;
  created_at: string;
  metadata?: Record<string, any> | null;
}

interface LeasePaymentsTabProps {
  leaseId: string;
  payments: Payment[];
  invoices: Invoice[];
  leaseStatus: string;
}

const PAYMENT_STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  succeeded: { label: "Payé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  paid: { label: "Payé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  failed: { label: "Échoué", color: "bg-red-100 text-red-700", icon: XCircle },
  refunded: { label: "Remboursé", color: "bg-slate-100 text-slate-700", icon: CreditCard },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Envoyée", color: "bg-blue-100 text-blue-700" },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-700" },
  late: { label: "En retard", color: "bg-red-100 text-red-700" },
};

function formatPeriode(periode: string): string {
  try {
    const [year, month] = periode.split("-");
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } catch {
    return periode;
  }
}

export function LeasePaymentsTab({ leaseId, payments, invoices, leaseStatus }: LeasePaymentsTabProps) {
  const isPreActivation = !["active", "terminated", "archived"].includes(leaseStatus);

  if (isPreActivation) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 bg-slate-100 rounded-full mb-4">
          <Euro className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          Paiements non disponibles
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-md">
          Les factures et paiements seront générés une fois le bail activé.
        </p>
      </div>
    );
  }

  const hasNoData = payments.length === 0 && invoices.length === 0;

  if (hasNoData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 bg-amber-100 rounded-full mb-4">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          En attente du premier paiement
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-md">
          Aucune facture ni paiement enregistré pour ce bail.
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href={`/owner/money?lease_id=${leaseId}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Voir la comptabilité
          </Link>
        </Button>
      </div>
    );
  }

  // Stats
  const totalReceived = payments
    .filter((p) => p.statut === "succeeded" || p.statut === "paid")
    .reduce((sum, p) => sum + p.montant, 0);
  const totalPending = payments
    .filter((p) => p.statut === "pending")
    .reduce((sum, p) => sum + p.montant, 0);
  const lateInvoices = invoices.filter((inv) => inv.statut === "late");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 py-4"
    >
      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
          <p className="text-xs text-emerald-600 font-medium mb-1">Reçus</p>
          <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
          <p className="text-xs text-amber-600 font-medium mb-1">En attente</p>
          <p className="text-lg font-bold text-amber-700">{formatCurrency(totalPending)}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
          <p className="text-xs text-slate-600 font-medium mb-1">Factures</p>
          <p className="text-lg font-bold text-slate-700">{invoices.length}</p>
        </div>
      </div>

      {/* Alerte retards */}
      {lateInvoices.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {lateInvoices.length} facture{lateInvoices.length > 1 ? "s" : ""} en retard
            </p>
            <p className="text-xs text-red-600">
              {formatCurrency(lateInvoices.reduce((s, i) => s + i.montant_total, 0))} impayés
            </p>
          </div>
        </div>
      )}

      {/* Factures */}
      {invoices.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Factures
          </h4>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {invoices.slice(0, 12).map((invoice) => {
              const invStatus = INVOICE_STATUS[invoice.statut] || INVOICE_STATUS.draft;
              const isInitial = invoice.metadata?.type === "initial_invoice";

              return (
                <div key={invoice.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isInitial ? "Facture initiale" : formatPeriode(invoice.periode)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(invoice.montant_loyer)} + {formatCurrency(invoice.montant_charges)} charges
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(invoice.montant_total)}</span>
                    <Badge className={invStatus.color} variant="outline">
                      {invStatus.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paiements */}
      {payments.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5" />
            Paiements reçus
          </h4>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {payments.map((payment) => {
              const statusConf = PAYMENT_STATUS[payment.statut] || PAYMENT_STATUS.pending;
              const StatusIcon = statusConf.icon;

              return (
                <div key={payment.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${statusConf.color}`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(payment.montant)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.periode
                          ? formatPeriode(payment.periode)
                          : payment.date_paiement
                            ? new Date(payment.date_paiement).toLocaleDateString("fr-FR")
                            : "Date inconnue"}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusConf.color} variant="outline">
                    {statusConf.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lien vers comptabilité complète */}
      <div className="flex justify-end pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/owner/money?lease_id=${leaseId}`}>
            <CreditCard className="h-3.5 w-3.5 mr-2" />
            Voir la comptabilité complète
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
