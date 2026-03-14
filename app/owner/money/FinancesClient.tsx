"use client";

/**
 * SOTA 2026 — Page Finances unifiée du propriétaire
 *
 * 4 onglets :
 * - Encaissements : KPIs + factures locataires (InvoiceListUnified)
 * - Compte bancaire : IBAN, solde Stripe Connect, historique versements
 * - Mon forfait : plan, usage, upgrade/cancel
 * - Moyens de paiement : cartes, factures abo, audit PSD3
 */

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Euro,
  Building2,
  Sparkles,
  CreditCard,
  Plus,
  Star,
  Trash2,
  Loader2,
  Shield,
  Ban,
  Clock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { InvoiceListUnified } from "@/features/billing/components/invoice-list-unified";
import { PaymentMethodSetup } from "@/features/billing/components/v2/PaymentMethodSetup";
import {
  useOwnerPaymentMethods,
  useOwnerCurrentPaymentMethod,
  useAddOwnerPaymentMethod,
  useRemoveOwnerPaymentMethod,
  useSetDefaultOwnerPaymentMethod,
  useOwnerPaymentAuditLog,
  type OwnerPaymentMethodItem,
  type OwnerPaymentAuditEntry,
} from "@/lib/hooks/use-owner-payment-methods";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

// Tab components
import { CompteBancaireTab } from "./tabs/CompteBancaireTab";
import { MonForfaitTab } from "./tabs/MonForfaitTab";

// ── Types ──

interface Invoice {
  id: string;
  periode: string;
  montant_total: number;
  statut: string;
  created_at: string;
  lease_id?: string;
  lease?: {
    property?: { adresse_complete: string };
    tenant_name?: string;
  };
}

interface FinancesClientProps {
  invoices: Invoice[];
}

// ── Constants ──

const TAB_IDS = ["encaissements", "banque", "forfait", "paiement"] as const;
type TabId = (typeof TAB_IDS)[number];

const AUDIT_ACTION_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  card_added: { label: "Carte ajoutée", icon: <Plus className="h-3.5 w-3.5 text-emerald-600" /> },
  set_default: { label: "Défini par défaut", icon: <Star className="h-3.5 w-3.5 text-amber-500" /> },
  revoked: { label: "Carte supprimée", icon: <Ban className="h-3.5 w-3.5 text-red-500" /> },
};

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  unknown: "Carte",
};

// ── Encaissements Tab (inline, uses server-passed invoices) ──

function EncaissementsTab({ invoices }: { invoices: Invoice[] }) {
  // KPI calculations
  const kpis = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const thisMonth = invoices.filter(
      (i) => i.periode?.startsWith(currentMonth) || i.created_at?.startsWith(currentMonth)
    );

    const revenus = thisMonth
      .filter((i) => i.statut === "paid")
      .reduce((acc, curr) => acc + (curr.montant_total || 0), 0);

    const enAttente = thisMonth
      .filter((i) => i.statut === "sent" || i.statut === "viewed" || i.statut === "partial")
      .reduce((acc, curr) => acc + (curr.montant_total || 0), 0);

    const impayes = thisMonth
      .filter((i) => i.statut === "late")
      .reduce((acc, curr) => acc + (curr.montant_total || 0), 0);

    return { revenus, enAttente, impayes };
  }, [invoices]);

  const fmt = (v: number) =>
    v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-card border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Revenus ce mois</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{fmt(kpis.revenus)}</p>
        </div>
        <div className="p-6 rounded-2xl bg-card border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">En attente</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{fmt(kpis.enAttente)}</p>
        </div>
        <div className="p-6 rounded-2xl bg-card border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Impayés</p>
          <p className={cn("text-3xl font-bold mt-2", kpis.impayes > 0 ? "text-red-600" : "text-muted-foreground")}>
            {fmt(kpis.impayes)}
          </p>
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-card rounded-2xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Historique des factures</h2>
          <Button asChild size="sm" className="shadow-lg shadow-blue-500/20">
            <Link href="/owner/invoices/new">
              <Plus className="mr-2 h-4 w-4" /> Créer une facture
            </Link>
          </Button>
        </div>
        <InvoiceListUnified invoices={invoices as any} variant="owner" />
      </div>
    </div>
  );
}

// ── Moyens de Paiement Tab (inline, reuses hooks) ──

function MoyensPaiementTab() {
  const { toast } = useToast();
  const [showAddCard, setShowAddCard] = useState(false);

  const { data: methods, isLoading: methodsLoading, isError: methodsError, refetch: refetchMethods } = useOwnerPaymentMethods();
  const { data: currentPm, isLoading: currentLoading, isError: currentError, refetch: refetchCurrent } = useOwnerCurrentPaymentMethod();
  const addMutation = useAddOwnerPaymentMethod();
  const removeMutation = useRemoveOwnerPaymentMethod();
  const setDefaultMutation = useSetDefaultOwnerPaymentMethod();
  const { data: audit, isLoading: auditLoading } = useOwnerPaymentAuditLog();

  const handleNewCardSuccess = async (paymentMethodId: string) => {
    try {
      await addMutation.mutateAsync(paymentMethodId);
      setShowAddCard(false);
      toast({ title: "Carte enregistrée", description: "Votre carte a été ajoutée pour l'abonnement." });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'ajouter la carte", variant: "destructive" });
    }
  };

  const handleRemoveCard = async (id: string) => {
    try {
      await removeMutation.mutateAsync(id);
      toast({ title: "Carte supprimée" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer la carte", variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultMutation.mutateAsync(id);
      toast({ title: "Moyen par défaut mis à jour" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cartes pour votre abonnement</CardTitle>
          <CardDescription>
            Ajoutez simplement une carte pour votre forfait. Les renouvellements sont ensuite automatiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {methodsLoading || currentLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : methodsError || currentError ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 space-y-3">
              <p className="text-sm font-medium text-destructive">
                Impossible de charger vos moyens de paiement.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { refetchMethods(); refetchCurrent(); }} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Réessayer
                </Button>
                <Button variant="link" size="sm" asChild className="px-0">
                  <Link href={OWNER_ROUTES.support.path}>Contacter le support</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {methods && methods.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence>
                    {methods.map((m: OwnerPaymentMethodItem) => {
                      const isDefault = currentPm?.id === m.id;
                      const card = m.card;
                      const brand = card?.brand ? BRAND_LABEL[card.brand] ?? card.brand : "Carte";
                      const last4 = card?.last4 ?? "••••";
                      const exp = card ? `${String(card.exp_month).padStart(2, "0")}/${card.exp_year}` : null;
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                            isDefault ? "border-primary bg-primary/5" : "border-border bg-card"
                          )}
                        >
                          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <CreditCard className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{brand} •••• {last4}</span>
                              {isDefault && (
                                <Badge variant="secondary" className="text-xs gap-0.5">
                                  <Star className="h-3 w-3" /> Défaut
                                </Badge>
                              )}
                            </div>
                            {exp && <p className="text-xs text-muted-foreground">Exp. {exp}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {!isDefault && (
                              <Button variant="ghost" size="icon" title="Définir par défaut" onClick={() => handleSetDefault(m.id)}>
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Supprimer"
                              onClick={() => handleRemoveCard(m.id)}
                              disabled={removeMutation.isPending}
                            >
                              {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-2xl bg-muted/30">
                  <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Aucune carte enregistrée</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Ajoutez une carte pour activer et renouveler votre forfait
                  </p>
                </div>
              )}

              <AnimatePresence>
                {showAddCard ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-4 border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">Nouvelle carte</p>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddCard(false)}>Annuler</Button>
                      </div>
                      <PaymentMethodSetup
                        setupIntentEndpoint="/api/owner/payment-methods/setup-intent"
                        allowedTypes={["card"]}
                        returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/owner/money?tab=forfait&setup=success`}
                        onSuccess={handleNewCardSuccess}
                        onCancel={() => setShowAddCard(false)}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <Button variant="outline" className="w-full gap-2 border-dashed h-12 rounded-2xl" onClick={() => setShowAddCard(true)}>
                    <Plus className="h-4 w-4" /> Ajouter une carte
                  </Button>
                )}
              </AnimatePresence>
            </>
          )}
        </CardContent>
      </Card>

      {/* PSD3 Audit log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            <CardTitle className="text-lg">Journal de sécurité</CardTitle>
          </div>
          <CardDescription>
            Historique des opérations sur vos moyens de paiement. Conformité PSD3 / PSR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <p className="text-muted-foreground text-center py-8">Chargement...</p>
          ) : !audit || audit.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune activité enregistrée</p>
          ) : (
            <div className="space-y-1">
              {audit.map((entry: OwnerPaymentAuditEntry, i: number) => {
                const actionInfo = AUDIT_ACTION_MAP[entry.action] ?? {
                  label: entry.action,
                  icon: <Clock className="h-3.5 w-3.5 text-slate-400" />,
                };
                const meta = entry.metadata ?? {};
                const last4 = typeof meta.last4 === "string" ? meta.last4 : null;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {actionInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{actionInfo.label}</p>
                      {last4 && <p className="text-xs text-muted-foreground">•••• {last4}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PSD3 info */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30">
        <CardContent className="flex items-start gap-3 py-4">
          <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Conformité PSD3</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              Conformément au règlement PSD3/PSR européen, vous pouvez consulter et révoquer à tout moment
              l&apos;accès à vos données de paiement. Toutes les opérations sont tracées dans ce journal d&apos;audit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main FinancesClient ──

export function FinancesClient({ invoices }: FinancesClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("encaissements");

  // Sync tab from URL params
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TAB_IDS.includes(tab as TabId)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
            Finances
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos encaissements, votre compte bancaire et votre abonnement
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="grid grid-cols-4 h-12 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="encaissements" className="gap-2 rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Euro className="h-4 w-4" />
              <span className="hidden sm:inline">Encaissements</span>
              <span className="sm:hidden">Encaiss.</span>
            </TabsTrigger>
            <TabsTrigger value="banque" className="gap-2 rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Compte bancaire</span>
              <span className="sm:hidden">Banque</span>
            </TabsTrigger>
            <TabsTrigger value="forfait" className="gap-2 rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Mon forfait</span>
              <span className="sm:hidden">Forfait</span>
            </TabsTrigger>
            <TabsTrigger value="paiement" className="gap-2 rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Moyens de paiement</span>
              <span className="sm:hidden">Cartes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="encaissements" className="mt-6">
            <EncaissementsTab invoices={invoices} />
          </TabsContent>

          <TabsContent value="banque" className="mt-6">
            <CompteBancaireTab />
          </TabsContent>

          <TabsContent value="forfait" className="mt-6">
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
              <MonForfaitTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="paiement" className="mt-6">
            <MoyensPaiementTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
