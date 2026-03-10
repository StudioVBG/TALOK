"use client";

/**
 * Onglet "Compte bancaire" — Statut IBAN, solde Stripe Connect, historique versements
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Wallet,
  ArrowDownToLine,
  Clock,
  AlertCircle,
  Ban,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  useStripeConnectStatus,
  useStripeConnectBalance,
  useStripeTransfers,
  type StripeTransfer,
} from "@/lib/hooks/use-stripe-connect";

const TRANSFER_STATUS: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
  paid: { label: "Versé", icon: <CheckCircle2 className="h-3 w-3" />, classes: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" },
  pending: { label: "En cours", icon: <Clock className="h-3 w-3" />, classes: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
  failed: { label: "Échoué", icon: <AlertCircle className="h-3 w-3" />, classes: "bg-red-500/20 text-red-600 border-red-500/30" },
  canceled: { label: "Annulé", icon: <Ban className="h-3 w-3" />, classes: "bg-slate-500/20 text-slate-600 border-slate-500/30" },
  reversed: { label: "Reversé", icon: <RotateCcw className="h-3 w-3" />, classes: "bg-orange-500/20 text-orange-600 border-orange-500/30" },
};

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function CompteBancaireTab() {
  const { toast } = useToast();
  const [connectLoading, setConnectLoading] = useState(false);

  const { data: connectData, isLoading: statusLoading } = useStripeConnectStatus();
  const { data: balance, isLoading: balanceLoading } = useStripeConnectBalance();
  const { data: transfers, isLoading: transfersLoading } = useStripeTransfers();

  const isReady = connectData?.has_account && connectData.account?.is_ready;

  const startConnectOnboarding = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      if (data.onboarding_url) window.location.href = data.onboarding_url;
      else throw new Error("URL d'onboarding manquante");
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de démarrer la configuration",
        variant: "destructive",
      });
    } finally {
      setConnectLoading(false);
    }
  };

  const openConnectDashboard = async () => {
    try {
      const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" });
      const data = await res.json();
      const url = data.dashboard_url ?? data.url;
      if (res.ok && url) window.location.href = url;
      else throw new Error(data.error ?? "Erreur");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ouvrir le tableau de bord", variant: "destructive" });
    }
  };

  if (statusLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statut du compte bancaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-600" /> Réception des loyers
          </CardTitle>
          <CardDescription>
            Compte bancaire pour recevoir les paiements de vos locataires via Stripe Connect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReady ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">Compte configuré</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {connectData.account?.bank_account
                      ? `IBAN •••• ${connectData.account.bank_account.last4} — ${connectData.account.bank_account.bank_name ?? "Banque"}`
                      : "Les versements seront envoyés sur le compte renseigné."}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={openConnectDashboard} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Gérer le compte bancaire
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8 border-2 border-dashed rounded-2xl bg-muted/30">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Aucun compte bancaire configuré</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Configurez votre RIB pour recevoir les loyers directement sur votre compte.
                </p>
                <Button onClick={startConnectOnboarding} disabled={connectLoading} className="gap-2">
                  {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                  Configurer mon compte bancaire
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solde Stripe Connect */}
      {isReady && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-muted-foreground">Solde disponible</span>
              </div>
              {balanceLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold text-emerald-600">
                  <AnimatedCounter value={balance?.available ?? 0} type="currency" />
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Prêt à être viré sur votre compte</p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-muted-foreground">En attente</span>
              </div>
              {balanceLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold text-amber-600">
                  <AnimatedCounter value={balance?.pending ?? 0} type="currency" />
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Paiements en cours de traitement</p>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Historique des versements */}
      {isReady && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-violet-600" /> Historique des versements
            </CardTitle>
            <CardDescription>
              Versements reçus sur votre compte bancaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transfersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : !transfers || transfers.length === 0 ? (
              <EmptyState
                icon={ArrowDownToLine}
                title="Aucun versement"
                description="Les versements apparaîtront ici une fois que vos locataires auront effectué des paiements."
              />
            ) : (
              <div className="space-y-2">
                {transfers.map((transfer: StripeTransfer, i: number) => {
                  const statusInfo = TRANSFER_STATUS[transfer.status] ?? TRANSFER_STATUS.pending;
                  return (
                    <motion.div
                      key={transfer.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {formatEur(transfer.amount)}
                          </span>
                          <Badge className={cn("gap-1 text-xs", statusInfo.classes)}>
                            {statusInfo.icon} {statusInfo.label}
                          </Badge>
                        </div>
                        {transfer.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {transfer.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-muted-foreground">
                          {new Date(transfer.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {transfer.net_amount != null && transfer.net_amount !== transfer.amount && (
                          <p className="text-xs text-muted-foreground">
                            Net : {formatEur(transfer.net_amount)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
