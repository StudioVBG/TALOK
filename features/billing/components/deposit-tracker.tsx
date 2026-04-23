"use client";

/**
 * DepositTracker — Suivi des dépôts de garantie
 *
 * Affiche la liste des dépôts avec statut, montants et actions disponibles.
 * Utilisé dans le tab "Dépôts" de la page Finances propriétaire.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowDownRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";

// ── Types ──

export interface SecurityDeposit {
  id: string;
  lease_id: string;
  tenant_id: string;
  amount_cents: number;
  paid_at: string | null;
  payment_method: string | null;
  restitution_amount_cents: number | null;
  retenue_cents: number;
  retenue_details: Array<{
    motif: string;
    amount_cents: number;
    justification?: string;
  }>;
  restitution_due_date: string | null;
  restituted_at: string | null;
  restitution_method: string | null;
  status: "pending" | "received" | "partially_returned" | "returned" | "disputed";
  late_penalty_cents: number;
  created_at: string;
  lease?: {
    id: string;
    type_bail: string;
    date_debut: string;
    date_fin: string | null;
    loyer: number;
    statut: string;
    property?: {
      id: string;
      adresse_complete: string;
      owner_id: string;
    };
  };
  tenant?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  };
}

interface DepositTrackerProps {
  deposits: SecurityDeposit[];
  loading?: boolean;
  onRestitute?: (deposit: SecurityDeposit) => void;
}

// ── Status helpers ──

const STATUS_CONFIG: Record<
  SecurityDeposit["status"],
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "En attente",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  received: {
    label: "Encaissé",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  partially_returned: {
    label: "Partiellement restitué",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <ArrowDownRight className="h-3.5 w-3.5" />,
  },
  returned: {
    label: "Restitué",
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  disputed: {
    label: "Litige",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

function centsToEur(cents: number): number {
  return cents / 100;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── KPIs ──

function DepositKPIs({ deposits }: { deposits: SecurityDeposit[] }) {
  const totalPending = deposits
    .filter((d) => d.status === "pending")
    .reduce((sum, d) => sum + d.amount_cents, 0);

  const totalReceived = deposits
    .filter((d) => d.status === "received")
    .reduce((sum, d) => sum + d.amount_cents, 0);

  const totalRestituted = deposits
    .filter((d) => d.status === "returned" || d.status === "partially_returned")
    .reduce((sum, d) => sum + (d.restitution_amount_cents || 0), 0);

  const overdueCount = deposits.filter((d) => {
    if (d.status !== "received" || !d.restitution_due_date) return false;
    return new Date(d.restitution_due_date) < new Date();
  }).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl bg-card border shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">En attente</p>
        <p className="text-2xl font-bold text-amber-600 mt-1">
          {formatCurrency(centsToEur(totalPending))}
        </p>
      </div>
      <div className="p-4 rounded-xl bg-card border shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">Encaissés</p>
        <p className="text-2xl font-bold text-emerald-600 mt-1">
          {formatCurrency(centsToEur(totalReceived))}
        </p>
      </div>
      <div className="p-4 rounded-xl bg-card border shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">Restitués</p>
        <p className="text-2xl font-bold text-blue-600 mt-1">
          {formatCurrency(centsToEur(totalRestituted))}
        </p>
      </div>
      <div className="p-4 rounded-xl bg-card border shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">En retard</p>
        <p
          className={cn(
            "text-2xl font-bold mt-1",
            overdueCount > 0 ? "text-red-600" : "text-muted-foreground"
          )}
        >
          {overdueCount}
        </p>
      </div>
    </div>
  );
}

// ── Single deposit card ──

function DepositCard({
  deposit,
  onRestitute,
}: {
  deposit: SecurityDeposit;
  onRestitute?: (deposit: SecurityDeposit) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[deposit.status];
  const tenantName = deposit.tenant
    ? `${deposit.tenant.prenom} ${deposit.tenant.nom}`.trim()
    : "Locataire";
  const address = deposit.lease?.property?.adresse_complete || "Adresse inconnue";

  const isOverdue =
    deposit.status === "received" &&
    deposit.restitution_due_date &&
    new Date(deposit.restitution_due_date) < new Date();

  const canRestitute =
    deposit.status === "received" &&
    (deposit.lease?.statut === "terminated" || deposit.lease?.statut === "ended");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border-2 transition-all bg-card",
        isOverdue ? "border-red-300 dark:border-red-800" : "border-border"
      )}
    >
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{tenantName}</span>
            <Badge variant="secondary" className={cn("text-xs gap-1", config.color)}>
              {config.icon}
              {config.label}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                En retard
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{address}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-bold text-lg">
            {formatCurrency(centsToEur(deposit.amount_cents))}
          </p>
          <p className="text-xs text-muted-foreground">
            {deposit.paid_at ? `Reçu le ${formatDate(deposit.paid_at)}` : "Non reçu"}
          </p>
        </div>

        <div className="shrink-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              {/* Detail rows */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Type de bail</span>
                  <p className="font-medium">{deposit.lease?.type_bail || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Période</span>
                  <p className="font-medium">
                    {formatDate(deposit.lease?.date_debut || null)} →{" "}
                    {formatDate(deposit.lease?.date_fin || null)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Moyen de paiement</span>
                  <p className="font-medium">{deposit.payment_method || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date limite restitution</span>
                  <p
                    className={cn(
                      "font-medium",
                      isOverdue && "text-red-600 font-bold"
                    )}
                  >
                    {formatDate(deposit.restitution_due_date)}
                    {isOverdue && " (dépassée)"}
                  </p>
                </div>
              </div>

              {/* Restitution details */}
              {(deposit.status === "partially_returned" || deposit.status === "returned") && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-sm">Restitution</p>
                  <div className="flex justify-between text-sm">
                    <span>Montant restitué</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(centsToEur(deposit.restitution_amount_cents || 0))}
                    </span>
                  </div>
                  {deposit.retenue_cents > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Retenues</span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(centsToEur(deposit.retenue_cents))}
                        </span>
                      </div>
                      {deposit.retenue_details?.map((r, i) => (
                        <div key={i} className="flex justify-between text-xs pl-4 text-muted-foreground">
                          <span>{r.motif}</span>
                          <span>{formatCurrency(centsToEur(r.amount_cents))}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {deposit.late_penalty_cents > 0 && (
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-red-600">Pénalité de retard</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(centsToEur(deposit.late_penalty_cents))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {canRestitute && onRestitute && (
                <Button
                  onClick={() => onRestitute(deposit)}
                  className="w-full gap-2"
                  variant="default"
                >
                  <ArrowDownRight className="h-4 w-4" />
                  Restituer le dépôt
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main ──

export function DepositTracker({ deposits, loading, onRestitute }: DepositTrackerProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deposits || deposits.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-muted/30">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="font-semibold text-lg">Aucun dépôt de garantie</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Les dépôts de garantie apparaissent ici automatiquement à la signature des baux.
        </p>
        <div className="mt-6 mx-auto max-w-lg rounded-xl border border-border/60 bg-background/60 p-4 text-left">
          <div className="flex gap-3">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Un dépôt figure sur une facture mais pas ici ?</p>
              <p>
                Un dépôt de garantie n'apparaît dans ce suivi qu'une fois le bail
                <span className="font-medium text-foreground"> activé</span> (signé par les deux parties).
                Tant que le bail reste au statut « brouillon » ou « en attente de signature »,
                le montant encaissé via la facture initiale n'est pas rattaché à un dépôt formel.
              </p>
              <p>
                Le montant affiché sur la facture reste acquis&nbsp;: il sera automatiquement rattaché
                ici dès la signature du bail. Aucun paiement n'est perdu.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DepositKPIs deposits={deposits} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dépôts de garantie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deposits.map((deposit) => (
            <DepositCard
              key={deposit.id}
              deposit={deposit}
              onRestitute={onRestitute}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
