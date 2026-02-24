"use client";

/**
 * SOTA 2026 : Page de gestion des moyens de paiement propriétaire
 * - Carte d'abonnement (Stripe Elements in-app)
 * - Compte bancaire réception loyers (Stripe Connect)
 * - Journal d'audit PSD3
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  CreditCard,
  Building2,
  Shield,
  ChevronLeft,
  Plus,
  Star,
  Trash2,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Ban,
  Clock,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PaymentMethodSetup } from "@/features/billing/components/v2/PaymentMethodSetup";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
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

interface Props {
  profileId: string;
}

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

export function OwnerPaymentSettingsClient({ profileId }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("card");
  const [showAddCard, setShowAddCard] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectData, setConnectData] = useState<{
    has_account: boolean;
    account: {
      is_ready: boolean;
      bank_account?: { last4: string; bank_name?: string } | null;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
    } | null;
  } | null>(null);

  const { data: methods, isLoading: methodsLoading, isError: methodsError, refetch: refetchMethods } = useOwnerPaymentMethods();
  const { data: currentPm, isLoading: currentLoading, isError: currentError, refetch: refetchCurrent } = useOwnerCurrentPaymentMethod();
  const addMutation = useAddOwnerPaymentMethod();
  const removeMutation = useRemoveOwnerPaymentMethod();
  const setDefaultMutation = useSetDefaultOwnerPaymentMethod();
  const { data: audit, isLoading: auditLoading } = useOwnerPaymentAuditLog();

  // URL ?tab=bank pour redirection depuis l'ancienne page banking
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const tab = params.get("tab");
    if (tab === "bank" || tab === "card" || tab === "audit") setActiveTab(tab);
  }, []);

  // Charger le statut Stripe Connect pour l'onglet Banque
  useEffect(() => {
    if (activeTab !== "bank") return;
    let cancelled = false;
    fetch("/api/stripe/connect")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConnectData(data);
      })
      .catch(() => {
        if (!cancelled) setConnectData(null);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleNewCardSuccess = async (paymentMethodId: string) => {
    try {
      await addMutation.mutateAsync(paymentMethodId);
      setShowAddCard(false);
      toast({ title: "Carte enregistrée", description: "Votre carte a été ajoutée pour l'abonnement." });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'ajouter la carte",
        variant: "destructive",
      });
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

  const startConnectOnboarding = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Button variant="ghost" size="sm" asChild className="mb-4 gap-1.5 text-muted-foreground">
          <Link href="/owner/settings/billing"><ChevronLeft className="h-4 w-4" /> Facturation</Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-600 rounded-xl shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Moyens de paiement</h1>
            <p className="text-muted-foreground text-sm">
              Carte d&apos;abonnement et compte bancaire pour recevoir les loyers
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 h-12 rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="card" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" /> Carte abonnement
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" /> Compte bancaire
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
            <Shield className="h-4 w-4" /> Sécurité
          </TabsTrigger>
        </TabsList>

        {/* ──── Onglet Carte abonnement ──── */}
        <TabsContent value="card" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cartes pour votre abonnement</CardTitle>
              <CardDescription>
                Sélectionnez la carte utilisée pour payer votre forfait Talok. Vos données sont sécurisées par Stripe.
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
                    Impossible de charger vos moyens de paiement. Veuillez réessayer ou contacter le support si le problème persiste.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        refetchMethods();
                        refetchCurrent();
                      }}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Réessayer
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
                        Ajoutez une carte pour payer votre abonnement Talok
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
        </TabsContent>

        {/* ──── Onglet Compte bancaire (Stripe Connect) ──── */}
        <TabsContent value="bank" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Réception des loyers
              </CardTitle>
              <CardDescription>
                Configurez le compte bancaire sur lequel vous souhaitez recevoir les loyers (via Stripe Connect).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!connectData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : connectData.has_account && connectData.account?.is_ready ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">Compte configuré</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        {connectData.account.bank_account
                          ? `IBAN •••• ${connectData.account.bank_account.last4} — ${connectData.account.bank_account.bank_name ?? "Banque"}`
                          : "Les versements seront envoyés sur le compte renseigné."}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={openConnectDashboard} className="gap-2">
                    <ExternalLink className="h-4 w-4" /> Ouvrir le tableau de bord des paiements
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Pour recevoir les loyers directement sur votre compte bancaire, complétez la configuration sécurisée (Stripe Connect).
                  </p>
                  <Button onClick={startConnectOnboarding} disabled={connectLoading} className="gap-2">
                    {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    Configurer la réception des loyers
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──── Onglet Sécurité / Audit PSD3 ──── */}
        <TabsContent value="audit" className="mt-6 space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
