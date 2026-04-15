"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import {
  CreditCard,
  Receipt,
  Search,
  Download,
  TrendingUp,
  FileText,
  Euro,
  PartyPopper,
  Sparkles,
  History,
  CheckCircle2,
  Calendar,
  Clock,
  Wallet,
  Banknote,
  PenLine,
} from "lucide-react";
import type { TenantPendingCashReceipt } from "@/features/billing/server/data-fetching";
import { PaymentCheckout } from "@/features/billing/components/payment-checkout";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTenantData } from "../_data/TenantDataProvider";
import { useTenantRealtime } from "@/lib/hooks/use-realtime-tenant";
import { useTenantPaymentMethodsDisplay } from "@/lib/hooks/use-tenant-payment-methods";
import { useToast } from "@/components/ui/use-toast";
import { isInvoicePayableStatus } from "@/lib/payments/tenant-payment-flow";
import {
  computeUnpaidStats,
  computePunctualityScore,
  getNextUpcomingInvoice,
} from "@/lib/payments/unpaid-invoices";

interface TenantPaymentsClientProps {
  invoices: any[];
  pendingCashReceipts?: TenantPendingCashReceipt[];
}

export function TenantPaymentsClient({
  invoices: initialInvoices,
  pendingCashReceipts = [],
}: TenantPaymentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { dashboard, refetch } = useTenantData();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentReturnState, setPaymentReturnState] = useState<"success" | "canceled" | null>(null);

  // Prochaine échéance basée sur la prochaine invoice non payée (source de vérité)
  // Fallback : calcul basé sur jour_paiement du bail si aucune invoice n'existe encore
  const payableInvoices = useMemo(
    () => initialInvoices.filter((invoice: any) => isInvoicePayableStatus(invoice.statut)),
    [initialInvoices]
  );

  const nextDue = useMemo(() => {
    const now = new Date();
    const lease = dashboard?.lease ?? (dashboard?.leases && dashboard.leases.length > 0 ? dashboard.leases[0] : null);

    // Source unique : prochaine facture dont la date d'échéance est >= aujourd'hui.
    // Les factures passées impayées appartiennent à la section "Total à régulariser",
    // pas à la section "Prochaine échéance" (corrige Bug 4).
    const nextInvoice = getNextUpcomingInvoice(initialInvoices);

    if (nextInvoice) {
      const effectiveDate =
        (nextInvoice as any).date_echeance ||
        (nextInvoice as any).due_date ||
        (nextInvoice as any).created_at;
      const dueDate = new Date(effectiveDate);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffMs = dueDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        date: dueDate,
        amount: Number((nextInvoice as any).montant_total) || 0,
        daysLeft,
        hasLease: !!lease,
        loyer: Number((nextInvoice as any).montant_loyer) || 0,
        charges: Number((nextInvoice as any).montant_charges) || 0,
        invoice: nextInvoice,
      };
    }

    // Fallback : calcul basé sur jour_paiement du bail si aucune facture future
    const jourPaiement = (lease as any)?.jour_paiement ?? 5;
    let nextDate = new Date(now.getFullYear(), now.getMonth(), jourPaiement);
    if (nextDate <= now) {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, jourPaiement);
    }
    const daysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    if (jourPaiement > daysInMonth) nextDate.setDate(daysInMonth);
    const amount = (lease?.loyer ?? 0) + (lease?.charges_forfaitaires ?? 0);
    const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      date: nextDate,
      amount,
      daysLeft,
      hasLease: !!lease,
      loyer: lease?.loyer ?? 0,
      charges: lease?.charges_forfaitaires ?? 0,
      invoice: null,
    };
  }, [dashboard?.lease, dashboard?.leases, initialInvoices]);

  // SOTA 2026: Temps réel pour synchronisation des factures avec le propriétaire
  const realtime = useTenantRealtime({ showToasts: true, enableSound: false });

  // Moyen de paiement configuré
  const { defaultMethod, isLoading: isLoadingMethods } = useTenantPaymentMethodsDisplay();

  // Refetch quand le realtime signale un changement de facture
  useEffect(() => {
    if (realtime.hasRecentInvoice) {
      refetch();
    }
  }, [realtime.hasRecentInvoice, refetch]);

  const invoices = initialInvoices;

  useEffect(() => {
    const isSuccess = searchParams.get("success") === "true";
    const isCanceled = searchParams.get("canceled") === "true";

    if (!isSuccess && !isCanceled) {
      return;
    }

    if (isSuccess) {
      setPaymentReturnState("success");
      toast({
        title: "Paiement confirmé",
        description: "Votre paiement a ete transmis. La quittance apparaitra dans vos documents une fois synchronisee.",
      });
      refetch();
      router.refresh();
    } else {
      setPaymentReturnState("canceled");
      toast({
        title: "Paiement annule",
        description: "Aucun debit n'a ete effectue. Vous pouvez reprendre le paiement quand vous le souhaitez.",
      });
    }

    router.replace("/tenant/payments");
  }, [refetch, router, searchParams, toast]);

  const handleDownload = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/receipt`, "_blank");
  };

  const handlePaymentSuccess = () => {
    setIsPaymentOpen(false);
    // Rafraîchir les données du context provider + la page
    refetch();
    router.refresh(); 
  };

  // Statistiques financières SOTA — délègue aux helpers centralisés pour
  // garantir la cohérence avec le dashboard et le bandeau d'actions documents.
  const stats = useMemo(() => {
    // Total à régulariser (Bug 1)
    const unpaidStats = computeUnpaidStats(invoices);

    // Score de ponctualité (Bug 5) : null tant qu'aucun paiement n'est enregistré
    const { score, paidCount, totalCount } = computePunctualityScore(invoices);

    const punctualityLabel = score === null ? "En construction"
      : score >= 90 ? "Excellent"
      : score >= 70 ? "Bon"
      : score >= 50 ? "Moyen"
      : "À améliorer";

    return {
      totalUnpaid: unpaidStats.totalAmount,
      unpaidCount: unpaidStats.count,
      paidCount,
      punctualityScore: score,
      punctualityLabel,
      totalCount,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter(inv =>
      inv.statut !== 'cancelled' && (
        inv.periode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatCurrency(inv.montant_total).includes(searchQuery)
      )
    );

    // Bug 6 : tri par date d'échéance descendante (plus récente en haut)
    // Avant : tri par "periode" alphabétique qui mélangeait passé et futur.
    return [...filtered].sort((a: any, b: any) => {
      const dateA = a.date_echeance || a.due_date || a.created_at || a.periode;
      const dateB = b.date_echeance || b.due_date || b.created_at || b.periode;
      const tA = new Date(dateA).getTime();
      const tB = new Date(dateB).getTime();
      // Si les dates sont invalides, fallback sur periode
      if (Number.isNaN(tA) || Number.isNaN(tB)) {
        return (b.periode || "").localeCompare(a.periode || "");
      }
      return tB - tA;
    });
  }, [invoices, searchQuery]);

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Paiements</h1>
              {/* Indicateur temps réel */}
              {realtime.isConnected && (
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live
                </motion.div>
              )}
            </div>
            <p className="text-muted-foreground text-lg">
              Suivi de vos loyers, quittances et santé financière.
            </p>
          </motion.div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Rechercher un paiement"
              placeholder="Rechercher une période..."
              className="pl-10 h-11 bg-card border-border shadow-sm focus:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {paymentReturnState && (
          <GlassCard
            className={cn(
              "p-5 border shadow-lg",
              paymentReturnState === "success"
                ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40"
                : "bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40"
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold text-foreground">
                  {paymentReturnState === "success"
                    ? "Paiement en cours de synchronisation"
                    : "Paiement annule"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {paymentReturnState === "success"
                    ? "Le système de paiement met à jour automatiquement votre facture et génère votre quittance. Vous pourrez ensuite la retrouver dans vos documents."
                    : "Vous pouvez relancer le paiement depuis cette page des que vous etes pret."}
                </p>
              </div>
              <Button
                variant={paymentReturnState === "success" ? "default" : "outline"}
                className="rounded-xl font-bold"
                asChild
              >
                <Link href={paymentReturnState === "success" ? "/tenant/documents?type=quittance" : "/tenant/settings/payments"}>
                  {paymentReturnState === "success" ? "Voir mes quittances" : "Gerer mes moyens"}
                </Link>
              </Button>
            </div>
          </GlassCard>
        )}

        {/* Reçus espèces en attente de contresignature — SOTA 2026 */}
        {pendingCashReceipts.filter((cr) => !!cr.id).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="space-y-3"
          >
            {pendingCashReceipts
              .filter((cr) => !!cr.id)
              .map((cr) => {
                // Référence affichée : numéro REC-YYYY-MM-XXXX si présent,
                // sinon fallback sur les 8 premiers caractères de l'id
                // (évite un "Référence : " vide si le trigger DB n'a pas
                // généré le numéro).
                const referenceLabel =
                  cr.receipt_number && cr.receipt_number.length > 0
                    ? cr.receipt_number
                    : cr.id.slice(0, 8).toUpperCase();

                return (
                  <GlassCard
                    key={cr.id}
                    className="p-5 border-amber-200 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 shadow-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-md shrink-0">
                          <Banknote className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">
                            Signature requise — Reçu espèces
                          </p>
                          <p className="text-lg font-black text-foreground">
                            {formatCurrency(cr.amount)} · {cr.owner_name}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {cr.periode ? `Période ${cr.periode}` : "Paiement en espèces"}
                            {cr.property_address ? ` · ${cr.property_address}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground/80 mt-1">
                            Référence : {referenceLabel}
                          </p>
                        </div>
                      </div>
                      <Button
                        asChild
                        className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 shrink-0"
                      >
                        <Link href={`/tenant/payments/cash-receipt/${cr.id}`}>
                          <PenLine className="mr-2 h-4 w-4" /> Signer le reçu
                        </Link>
                      </Button>
                    </div>
                  </GlassCard>
                );
              })}
          </motion.div>
        )}

        {/* Prochaine échéance - SOTA 2026 */}
        {nextDue.hasLease && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <GlassCard className="p-6 border-border bg-card shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-950/30 dark:to-emerald-950/30 border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Calendar className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Prochaine échéance</p>
                  <p className="text-2xl font-black text-foreground">
                    {formatCurrency(nextDue.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Le {nextDue.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {(nextDue.loyer > 0 || nextDue.charges > 0) && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Loyer {formatCurrency(nextDue.loyer)} + Charges {formatCurrency(nextDue.charges)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background/80 border border-border">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-bold text-foreground">
                    {nextDue.daysLeft > 0
                      ? `Dans ${nextDue.daysLeft} jour${nextDue.daysLeft > 1 ? "s" : ""}`
                      : nextDue.daysLeft === 0
                        ? "Aujourd'hui"
                        : "Échéance passée"}
                  </span>
                </div>
                <Button
                  className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    // Préfère la facture "prochaine échéance" si elle est payable,
                    // sinon retombe sur la première facture passée impayée.
                    const target = (nextDue.invoice as any) || payableInvoices[0];
                    if (target) {
                      setSelectedInvoice(target);
                      setIsPaymentOpen(true);
                    }
                  }}
                  disabled={!nextDue.invoice && payableInvoices.length === 0}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Payer
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Panneau de Statut Financier Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard className={cn(
              "p-6 border-none shadow-xl text-white relative overflow-hidden",
              "bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700"
            )}>
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Total à régulariser</p>
                <p className="text-4xl font-black">
                  {formatCurrency(stats.totalUnpaid)}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Badge className={cn("border-none", stats.totalUnpaid > 0 ? "bg-red-500" : "bg-emerald-500")}>
                    {stats.unpaidCount} facture{stats.unpaidCount > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              <Euro className="absolute -right-4 -bottom-4 h-24 w-24 text-white/5 rotate-12" />
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-2">
            <GlassCard className="p-6 border-border bg-card shadow-lg h-full flex flex-col justify-center">
              <div className="flex items-center gap-6">
                <div className={cn(
                  "h-16 w-16 rounded-3xl flex items-center justify-center shadow-inner",
                  stats.punctualityScore === null ? "bg-slate-50 dark:bg-slate-900/30"
                    : stats.punctualityScore >= 70 ? "bg-emerald-50 dark:bg-emerald-900/30"
                    : "bg-amber-50 dark:bg-amber-900/30"
                )}>
                  <TrendingUp className={cn(
                    "h-8 w-8",
                    stats.punctualityScore === null ? "text-slate-400 dark:text-slate-500"
                      : stats.punctualityScore >= 70 ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Score de ponctualité</h3>
                  <p className="text-muted-foreground text-sm">
                    {stats.punctualityScore === null
                      ? 'Votre score sera calculé après votre premier paiement.'
                      : stats.paidCount > 0
                        ? `Vous avez payé ${stats.paidCount} loyer${stats.paidCount > 1 ? 's' : ''} sur ${stats.totalCount}. ${stats.punctualityScore >= 90 ? 'Continuez ainsi !' : 'Vous pouvez mieux faire !'}`
                        : 'Aucun paiement enregistré pour le moment.'
                    }
                  </p>
                </div>
                <div className="ml-auto text-center hidden sm:block">
                  <p className={cn(
                    "text-3xl font-black",
                    stats.punctualityScore === null ? "text-slate-400 dark:text-slate-500"
                      : stats.punctualityScore >= 70 ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}>
                    {stats.punctualityScore !== null ? `${stats.punctualityScore}%` : '—'}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{stats.punctualityLabel}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Moyen de paiement configuré */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GlassCard className="p-6 border-border bg-card shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Moyen de paiement</p>
                  {isLoadingMethods ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>
                  ) : defaultMethod ? (
                    <p className="font-bold text-foreground">{defaultMethod.displayName}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun moyen de paiement configuré</p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl font-bold" asChild>
                <Link href="/tenant/settings/payments">
                  {defaultMethod ? "Gérer" : "Ajouter"}
                </Link>
              </Button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Liste des Paiements - Timeline Style */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Historique
            </h2>
            <Badge variant="outline" className="bg-card/50">{filteredInvoices.length} transactions</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredInvoices.map((invoice, index) => (
                <motion.div 
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <GlassCard className={cn(
                    "p-0 border-border bg-card hover:shadow-xl transition-all duration-300 group overflow-hidden",
                    invoice.statut !== 'paid' && "border-red-100 dark:border-red-900/50 ring-1 ring-red-50 dark:ring-red-900/30"
                  )}>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                      <div className={cn(
                        "w-full sm:w-2 sm:h-20 h-2",
                        invoice.statut === 'paid' ? "bg-emerald-500" : "bg-red-500"
                      )} />
                      
                      <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-2xl transition-transform group-hover:scale-110",
                            invoice.statut === 'paid' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          )}>
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-black text-foreground text-lg">
                              {invoice.type === 'initial_invoice' ? 'Facture initiale' : `Loyer ${invoice.periode}`}
                              {(invoice as any).metadata?.is_prorated && (
                                <span className="ml-2 text-xs font-medium text-amber-600">(prorata)</span>
                              )}
                            </p>
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-0.5">
                              Échéance : {invoice.due_date ? formatDateShort(invoice.due_date) : formatDateShort(invoice.created_at)}
                            </p>
                            {(invoice as any).metadata?.includes_deposit && (
                              <p className="text-xs text-muted-foreground">
                                Inclut dépôt de garantie : {formatCurrency((invoice as any).metadata.deposit_amount)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 sm:gap-8 ml-auto sm:ml-0">
                          <div className="text-right">
                            <p className="text-2xl font-black text-foreground">{formatCurrency(invoice.montant_total)}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Montant total</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <StatusBadge
                              status={
                                invoice.statut === 'paid' ? 'Payé'
                                : invoice.statut === 'late' ? 'En retard'
                                : invoice.statut === 'overdue' ? 'Impayé'
                                : invoice.statut === 'unpaid' ? 'Impayé critique'
                                : invoice.statut === 'partial' ? 'Paiement partiel'
                                : invoice.statut === 'viewed' ? 'Consultée'
                                : invoice.statut === 'cancelled' ? 'Annulée'
                                : invoice.statut === 'draft' ? 'Brouillon'
                                : 'À régler'
                              }
                              type={
                                invoice.statut === 'paid' ? 'success'
                                : invoice.statut === 'late' || invoice.statut === 'overdue' || invoice.statut === 'unpaid' ? 'error'
                                : invoice.statut === 'partial' ? 'warning'
                                : invoice.statut === 'viewed' ? 'info'
                                : invoice.statut === 'draft' || invoice.statut === 'cancelled' ? 'neutral'
                                : 'warning'
                              }
                              className="h-7 px-3 text-[10px] font-black uppercase tracking-widest"
                            />
                            {invoice.statut === 'late' && invoice.due_date && (
                              <span className="text-xs text-red-600 font-bold">
                                {Math.max(1, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))}j de retard
                              </span>
                            )}

                            <div className="flex gap-2">
                              {isInvoicePayableStatus(invoice.statut) ? (
                                <Button
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-blue-100 dark:shadow-blue-900/30"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setIsPaymentOpen(true);
                                  }}
                                >
                                  <CreditCard className="mr-2 h-4 w-4" /> Payer {formatCurrency(invoice.montant_total)}
                                </Button>
                              ) : invoice.statut === 'paid' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 px-4 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-600 border-emerald-200 text-emerald-700"
                                  onClick={() => handleDownload(invoice.id)}
                                >
                                  <Download className="h-4 w-4 mr-2" /> Quittance
                                </Button>
                              ) : invoice.statut === 'draft' || invoice.statut === 'cancelled' ? (
                                <Badge variant="outline" className="h-10 px-4 font-bold text-muted-foreground">
                                  {invoice.statut === 'draft' ? 'Brouillon' : 'Annulée'}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredInvoices.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <GlassCard className="p-12 text-center border-dashed border-2 border-border bg-muted/30">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 mb-4">
                    <Receipt className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {searchQuery ? "Aucun résultat" : "Aucune facture"}
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {searchQuery
                      ? "Aucune facture ne correspond à votre recherche. Essayez un autre terme."
                      : "Votre historique de paiements apparaîtra ici après l'émission de votre première facture par le propriétaire."}
                  </p>
                </GlassCard>
              </motion.div>
            )}
          </div>
        </div>

        {/* Dialog de paiement */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl" aria-describedby={undefined}>
            {selectedInvoice && (
              <PaymentCheckout
                invoiceId={selectedInvoice.id}
                amount={selectedInvoice.montant_total}
                description={selectedInvoice.type === 'initial_invoice' ? 'Facture initiale' : `Loyer ${selectedInvoice.periode}`}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setIsPaymentOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Zone de Tips SOTA */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="mt-12 p-8 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="h-14 w-14 bg-card/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <PartyPopper className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black">Besoin d'un justificatif ?</h2>
              <p className="text-white/60 leading-relaxed">
                Vos quittances de loyer sont générées automatiquement dès réception de votre paiement. Elles servent de justificatif de domicile officiel.
              </p>
              <Button variant="secondary" className="bg-card/10 hover:bg-card/20 border-white/20 text-white font-bold h-12 px-8" asChild>
                <Link href="/tenant/documents">Accéder à mes quittances</Link>
              </Button>
            </div>
            <div className="flex justify-end">
              <div className="relative group">
                <GlassCard className="p-6 bg-card/5 border-white/10 backdrop-blur-xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-4" />
                  <p className="text-xl font-bold">Paiement Garanti</p>
                  <p className="text-sm text-white/60 mt-2">Toutes vos transactions sont sécurisées par cryptage SSL 256 bits.</p>
                </GlassCard>
                <Sparkles className="absolute -top-4 -right-4 h-12 w-12 text-emerald-400/30 animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </PageTransition>
  );
}
