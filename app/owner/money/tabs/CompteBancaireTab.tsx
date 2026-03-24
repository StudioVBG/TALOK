"use client";

/**
 * Onglet "Compte bancaire" — Statut IBAN, solde Stripe Connect, historique versements
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  useStripePayouts,
  type StripeTransfer,
  type StripePayout,
} from "@/lib/hooks/use-stripe-connect";

const TRANSFER_STATUS: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
  paid: { label: "Versé", icon: <CheckCircle2 className="h-3 w-3" />, classes: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" },
  pending: { label: "En cours", icon: <Clock className="h-3 w-3" />, classes: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
  failed: { label: "Échoué", icon: <AlertCircle className="h-3 w-3" />, classes: "bg-red-500/20 text-red-600 border-red-500/30" },
  canceled: { label: "Annulé", icon: <Ban className="h-3 w-3" />, classes: "bg-slate-500/20 text-muted-foreground border-slate-500/30" },
  reversed: { label: "Reversé", icon: <RotateCcw className="h-3 w-3" />, classes: "bg-orange-500/20 text-orange-600 border-orange-500/30" },
};

const PAYOUT_STATUS = TRANSFER_STATUS;

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// Dictionnaire codes Stripe → labels français
const STRIPE_REQUIREMENT_LABELS: Record<string, string> = {
  // Identite
  "individual.first_name": "Prenom",
  "individual.last_name": "Nom de famille",
  "individual.dob.day": "Date de naissance (jour)",
  "individual.dob.month": "Date de naissance (mois)",
  "individual.dob.year": "Date de naissance (annee)",
  "individual.email": "Adresse e-mail",
  "individual.phone": "Numero de telephone",
  "individual.id_number": "Numero SIREN / SIRET",
  "individual.verification.document": "Piece d'identite (recto/verso)",
  "individual.verification.additional_document": "Justificatif de domicile",
  // Adresse
  "individual.address.line1": "Adresse postale",
  "individual.address.city": "Ville",
  "individual.address.postal_code": "Code postal",
  "individual.address.state": "Region / Departement",
  // Coordonnees bancaires
  "external_account": "Coordonnees bancaires (IBAN)",
  // Activite professionnelle
  "business_profile.mcc": "Categorie d'activite professionnelle",
  "business_profile.url": "Site web ou page en ligne",
  "business_profile.product_description": "Description de votre activite",
  // Entreprise
  "company.name": "Raison sociale",
  "company.tax_id": "Numero de TVA / SIREN",
  "company.phone": "Telephone de l'entreprise",
  "company.address.line1": "Adresse de l'entreprise",
  "company.address.city": "Ville de l'entreprise",
  "company.address.postal_code": "Code postal de l'entreprise",
  // CGU
  "tos_acceptance.date": "Acceptation des conditions d'utilisation",
  "tos_acceptance.ip": "Acceptation des conditions (confirmation IP)",
};

const STRIPE_DISABLED_REASON_LABELS: Record<string, string> = {
  "requirements.past_due":
    "Des informations obligatoires n'ont pas ete fournies a temps.",
  "requirements.pending_verification":
    "Vos documents sont en cours de verification par Stripe.",
  "under_review":
    "Votre compte est en cours d'examen. Nous revenons vers vous sous 2 jours ouvres.",
  "listed":
    "Votre compte a ete signale. Contactez le support.",
  "rejected.fraud":
    "Votre compte a ete refuse. Contactez le support.",
  "rejected.terms_of_service":
    "Les conditions d'utilisation Stripe n'ont pas ete acceptees.",
  "rejected.other":
    "Votre compte a ete refuse. Contactez le support.",
  "other":
    "Compte suspendu. Contactez le support Talok.",
};

const STRIPE_REQUIREMENT_GROUPS: Record<string, string[]> = {
  "Identite": [
    "individual.first_name", "individual.last_name",
    "individual.dob.day", "individual.dob.month", "individual.dob.year",
    "individual.email", "individual.phone", "individual.id_number",
    "individual.verification.document",
    "individual.verification.additional_document",
  ],
  "Adresse": [
    "individual.address.line1", "individual.address.city",
    "individual.address.postal_code", "individual.address.state",
  ],
  "Coordonnees bancaires": ["external_account"],
  "Activite": [
    "business_profile.mcc", "business_profile.url",
    "business_profile.product_description",
  ],
  "Entreprise": [
    "company.name", "company.tax_id", "company.phone",
    "company.address.line1", "company.address.city",
    "company.address.postal_code",
  ],
};

function getRequirementLabel(code: string): string {
  return STRIPE_REQUIREMENT_LABELS[code] ?? "Information complementaire requise";
}

function groupRequirements(requirements: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  const ungrouped: string[] = [];

  for (const req of requirements) {
    let found = false;
    for (const [group, codes] of Object.entries(STRIPE_REQUIREMENT_GROUPS)) {
      if (codes.includes(req)) {
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(req);
        found = true;
        break;
      }
    }
    if (!found) ungrouped.push(req);
  }

  if (ungrouped.length > 0) {
    grouped["Autres informations"] = ungrouped;
  }

  return grouped;
}

export function CompteBancaireTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [connectLoading, setConnectLoading] = useState(false);

  const {
    data: connectData,
    isLoading: statusLoading,
    isError: statusError,
    error: statusErrorValue,
    refetch: refetchStatus,
  } = useStripeConnectStatus();
  const connectAccount = connectData?.account ?? null;
  const isReady = Boolean(connectData?.has_account && connectAccount?.is_ready);
  const hasAccount = Boolean(connectData?.has_account);
  const isOnboardingIncomplete = Boolean(hasAccount && !isReady);
  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceError,
    error: balanceErrorValue,
    refetch: refetchBalance,
  } = useStripeConnectBalance(isReady);
  const {
    data: transfers,
    isLoading: transfersLoading,
    isError: transfersError,
    error: transfersErrorValue,
    refetch: refetchTransfers,
  } = useStripeTransfers(isReady);
  const {
    data: payouts,
    isLoading: payoutsLoading,
    isError: payoutsError,
    error: payoutsErrorValue,
    refetch: refetchPayouts,
  } = useStripePayouts(isReady);

  useEffect(() => {
    const success = searchParams.get("success");
    const refresh = searchParams.get("refresh");

    if (!success && !refresh) {
      return;
    }

    if (success === "true") {
      toast({
        title: "Onboarding Stripe mis à jour",
        description: "Le statut de votre compte bancaire est en cours de synchronisation.",
      });
    }

    if (refresh === "true") {
      toast({
        title: "Onboarding à reprendre",
        description: "Stripe vous demande encore quelques informations avant d'activer les versements.",
      });
    }

    void (async () => {
      const refreshedStatus = await refetchStatus();
      const refreshedIsReady = Boolean(
        refreshedStatus.data?.has_account && refreshedStatus.data.account?.is_ready
      );

      if (refreshedIsReady) {
        await Promise.allSettled([
          refetchBalance(),
          refetchTransfers(),
          refetchPayouts(),
        ]);
      }
    })();

    const params = new URLSearchParams(searchParams.toString());
    params.delete("success");
    params.delete("refresh");
    const query = params.toString();
    router.replace(query ? `/owner/money?${query}` : "/owner/money");
  }, [refetchBalance, refetchPayouts, refetchStatus, refetchTransfers, router, searchParams, toast]);

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
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible d'ouvrir le tableau de bord",
        variant: "destructive",
      });
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

  if (statusError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-600" /> Réception des loyers
          </CardTitle>
          <CardDescription>
            Stripe Connect permet de recevoir vos loyers. Le chargement de cet espace a échoué.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="font-medium text-destructive">Impossible de charger le compte bancaire</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusErrorValue instanceof Error
                ? statusErrorValue.message
                : "Une erreur inattendue est survenue."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetchStatus()} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Réessayer
          </Button>
        </CardContent>
      </Card>
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
              {connectAccount?._cached ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  Les informations Stripe affichées ci-dessous proviennent du dernier cache synchronisé.
                </div>
              ) : null}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">Compte configuré</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {connectAccount?.bank_account
                      ? `IBAN •••• ${connectAccount.bank_account.last4} — ${connectAccount.bank_account.bank_name ?? "Banque"}`
                      : "Les versements seront envoyés sur le compte renseigné."}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={openConnectDashboard} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Gérer le compte bancaire
              </Button>
            </div>
          ) : isOnboardingIncomplete ? (
            (() => {
              const disabledReason = connectAccount?.requirements?.disabled_reason;
              const humanReason = disabledReason
                ? STRIPE_DISABLED_REASON_LABELS[disabledReason]
                  ?? "Des informations sont requises pour activer votre compte."
                : null;
              const missingReqs = connectAccount?.missing_requirements ?? [];
              const groupedReqs = groupRequirements(missingReqs);

              return (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-amber-900 dark:text-amber-100">
                            Votre compte bancaire n&apos;est pas encore pret
                          </p>
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Action requise
                          </Badge>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Il manque quelques informations pour activer la reception de vos loyers.
                        </p>
                        {humanReason ? (
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            {humanReason}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {missingReqs.length > 0 ? (
                      <div className="space-y-3 pt-1">
                        {Object.entries(groupedReqs).map(([group, codes]) => (
                          <div key={group}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">
                              {group}
                            </p>
                            <ul className="space-y-1">
                              {codes.map((code) => (
                                <li key={code} className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                  {getRequirementLabel(code)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <p className="text-xs text-amber-600 dark:text-amber-400 border-t border-amber-200 dark:border-amber-800 pt-3">
                      Vous serez redirige vers notre partenaire de paiement securise Stripe pour completer ces informations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={startConnectOnboarding} disabled={connectLoading} className="gap-2">
                      {connectLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      Completer mes informations
                    </Button>
                    <Button variant="outline" onClick={() => refetchStatus()} className="gap-2">
                      <RotateCcw className="h-4 w-4" /> Actualiser le statut
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8 border-2 border-dashed rounded-2xl bg-muted/30">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">
                  {connectData?.not_configured
                    ? "Stripe Connect n'est pas encore disponible"
                    : "Aucun compte bancaire configuré"}
                </p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  {connectData?.not_configured
                    ? "Le module d'encaissement en ligne n'est pas activé pour le moment. Vous pouvez réessayer plus tard."
                    : "Configurez votre compte Stripe Connect pour recevoir les loyers directement sur votre compte."}
                </p>
                {!connectData?.not_configured ? (
                  <Button onClick={startConnectOnboarding} disabled={connectLoading} className="gap-2">
                    {connectLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    Configurer mon compte bancaire
                  </Button>
                ) : null}
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
              ) : balanceError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">
                    {balanceErrorValue instanceof Error
                      ? balanceErrorValue.message
                      : "Erreur de chargement du solde"}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => refetchBalance()}>
                    Réessayer
                  </Button>
                </div>
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
              ) : balanceError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">
                    {balanceErrorValue instanceof Error
                      ? balanceErrorValue.message
                      : "Erreur de chargement du solde"}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => refetchBalance()}>
                    Réessayer
                  </Button>
                </div>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-violet-600" /> Transferts Connect
              </CardTitle>
              <CardDescription>
                Transferts internes crees depuis les paiements locataires vers votre compte Stripe Connect.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transfersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : transfersError ? (
                <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                  <p className="font-medium text-destructive">Impossible de charger les transferts Connect</p>
                  <p className="text-sm text-muted-foreground">
                    {transfersErrorValue instanceof Error
                      ? transfersErrorValue.message
                      : "Une erreur inattendue est survenue."}
                  </p>
                  <Button variant="outline" onClick={() => refetchTransfers()} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Réessayer
                  </Button>
                </div>
              ) : !transfers || transfers.length === 0 ? (
                <EmptyState
                  icon={ArrowDownToLine}
                  title="Aucun transfert"
                  description="Les transferts apparaîtront ici une fois que vos locataires auront effectué des paiements."
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" /> Payouts bancaires
              </CardTitle>
              <CardDescription>
                Virements bancaires reels emis par Stripe depuis votre solde Connect vers votre banque.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payoutsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : payoutsError ? (
                <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                  <p className="font-medium text-destructive">Impossible de charger les payouts bancaires</p>
                  <p className="text-sm text-muted-foreground">
                    {payoutsErrorValue instanceof Error
                      ? payoutsErrorValue.message
                      : "Une erreur inattendue est survenue."}
                  </p>
                  <Button variant="outline" onClick={() => refetchPayouts()} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Réessayer
                  </Button>
                </div>
              ) : !payouts || payouts.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Aucun payout"
                  description="Les virements bancaires réels apparaîtront ici dès que Stripe déclenchera un payout."
                />
              ) : (
                <div className="space-y-2">
                  {payouts.map((payout: StripePayout, i: number) => {
                    const statusInfo = PAYOUT_STATUS[payout.status] ?? PAYOUT_STATUS.pending;
                    return (
                      <motion.div
                        key={payout.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{formatEur(payout.amount)}</span>
                            <Badge className={cn("gap-1 text-xs", statusInfo.classes)}>
                              {statusInfo.icon} {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {payout.arrival_date
                              ? `Arrivee estimee le ${new Date(payout.arrival_date).toLocaleDateString("fr-FR")}`
                              : "Date de virement en attente"}
                          </p>
                          {payout.failure_message ? (
                            <p className="text-xs text-destructive mt-1 truncate">{payout.failure_message}</p>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-muted-foreground">
                            {new Date(payout.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          {payout.paid_at ? (
                            <p className="text-xs text-muted-foreground">
                              Paye le {new Date(payout.paid_at).toLocaleDateString("fr-FR")}
                            </p>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
