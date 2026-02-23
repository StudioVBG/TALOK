"use client";

/**
 * SOTA 2026 : Page de gestion des moyens de paiement locataire
 * - Multi-cartes / SEPA
 * - Mandats SEPA avec statut
 * - Journal d'audit PSD3
 * - Permission Dashboard
 */

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CreditCard,
  Building2,
  Shield,
  ChevronLeft,
  FileText,
  Clock,
  Star,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ScrollText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { PaymentMethodSelector } from "@/features/billing/components/v2/PaymentMethodSelector";
import {
  useSepaMandates,
  usePaymentAuditLog,
} from "@/lib/hooks/use-tenant-payment-methods";

interface Props {
  profileId: string;
}

const MANDATE_STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Actif", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  pending: { label: "En attente", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Clock className="h-3.5 w-3.5" /> },
  suspended: { label: "Suspendu", color: "text-orange-700 bg-orange-50 border-orange-200", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  cancelled: { label: "Annulé", color: "text-red-700 bg-red-50 border-red-200", icon: <Ban className="h-3.5 w-3.5" /> },
  expired: { label: "Expiré", color: "text-slate-600 bg-slate-50 border-slate-200", icon: <Clock className="h-3.5 w-3.5" /> },
  failed: { label: "Échoué", color: "text-red-700 bg-red-50 border-red-200", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const AUDIT_ACTION_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  created: { label: "Moyen ajouté", icon: <Plus className="h-3.5 w-3.5 text-emerald-600" /> },
  set_default: { label: "Défini par défaut", icon: <Star className="h-3.5 w-3.5 text-amber-500" /> },
  revoked: { label: "Supprimé", icon: <Ban className="h-3.5 w-3.5 text-red-500" /> },
  payment_success: { label: "Paiement réussi", icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> },
  payment_failed: { label: "Paiement échoué", icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> },
  prenotification_sent: { label: "Pré-notification envoyée", icon: <FileText className="h-3.5 w-3.5 text-blue-500" /> },
  mandate_created: { label: "Mandat SEPA créé", icon: <ScrollText className="h-3.5 w-3.5 text-indigo-500" /> },
  mandate_cancelled: { label: "Mandat annulé", icon: <Ban className="h-3.5 w-3.5 text-red-500" /> },
  data_accessed: { label: "Données consultées", icon: <Eye className="h-3.5 w-3.5 text-slate-500" /> },
  expired: { label: "Moyen expiré", icon: <Clock className="h-3.5 w-3.5 text-slate-500" /> },
};

export function TenantPaymentSettingsClient({ profileId }: Props) {
  const [activeTab, setActiveTab] = useState("methods");
  const { data: mandates, isLoading: mandatesLoading } = useSepaMandates();
  const { data: audit, isLoading: auditLoading } = usePaymentAuditLog();

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1.5 text-muted-foreground">
            <Link href="/tenant/settings"><ChevronLeft className="h-4 w-4" /> Paramètres</Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Moyens de paiement</h1>
              <p className="text-muted-foreground text-sm">
                Gérez vos cartes, comptes SEPA et prélèvements automatiques
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 h-12 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="methods" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
              <CreditCard className="h-4 w-4" /> Mes moyens
            </TabsTrigger>
            <TabsTrigger value="mandates" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
              <Building2 className="h-4 w-4" /> Mandats SEPA
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
              <Shield className="h-4 w-4" /> Sécurité
            </TabsTrigger>
          </TabsList>

          {/* ──── TAB: Moyens de paiement ──── */}
          <TabsContent value="methods" className="mt-6 space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Cartes & comptes enregistrés</CardTitle>
                <CardDescription>
                  Sélectionnez votre moyen de paiement par défaut. Vos données sont
                  sécurisées par Stripe et ne transitent jamais par nos serveurs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentMethodSelector
                  onSelect={() => {}}
                  showManage
                />
              </CardContent>
            </Card>

            <GlassCard className="p-5 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Conformité PSD3</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Conformément au règlement PSD3/PSR européen, vous pouvez consulter et révoquer
                    à tout moment l'accès à vos données de paiement depuis l'onglet "Sécurité".
                    Toutes les opérations sont tracées dans un journal d'audit immuable.
                  </p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* ──── TAB: Mandats SEPA ──── */}
          <TabsContent value="mandates" className="mt-6 space-y-4">
            {mandatesLoading ? (
              <div className="text-center py-12 text-muted-foreground">Chargement des mandats...</div>
            ) : !mandates || mandates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-semibold text-foreground">Aucun mandat SEPA</p>
                  <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                    Un mandat SEPA sera créé automatiquement lorsque vous configurerez
                    un prélèvement automatique pour le paiement de votre loyer.
                  </p>
                </CardContent>
              </Card>
            ) : (
              mandates.map((mandate) => {
                const statusInfo = MANDATE_STATUS_MAP[mandate.status] ?? MANDATE_STATUS_MAP.pending;
                return (
                  <motion.div key={mandate.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="shadow-md">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-indigo-600" />
                              <span className="font-bold text-foreground">Mandat SEPA</span>
                              <Badge variant="outline" className={cn("gap-1 text-xs", statusInfo.color)}>
                                {statusInfo.icon} {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              Réf. {mandate.mandate_reference}
                            </p>
                          </div>
                          <p className="text-xl font-bold text-foreground">
                            {mandate.amount.toFixed(2)}€<span className="text-xs text-muted-foreground font-normal">/mois</span>
                          </p>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Débiteur</p>
                            <p className="font-medium mt-0.5">{mandate.debtor_name}</p>
                            <p className="text-muted-foreground text-xs">
                              IBAN •••• {mandate.debtor_iban.slice(-4)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Créancier</p>
                            <p className="font-medium mt-0.5">{mandate.creditor_name}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Signé le</p>
                            <p className="font-medium mt-0.5">
                              {mandate.signed_at
                                ? new Date(mandate.signed_at).toLocaleDateString("fr-FR")
                                : "En attente"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Prochain prélèvement</p>
                            <p className="font-medium mt-0.5">
                              {mandate.next_collection_date
                                ? new Date(mandate.next_collection_date).toLocaleDateString("fr-FR")
                                : mandate.first_collection_date
                                  ? new Date(mandate.first_collection_date).toLocaleDateString("fr-FR")
                                  : "—"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          {/* ──── TAB: Sécurité & Audit PSD3 ──── */}
          <TabsContent value="audit" className="mt-6 space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-lg">Journal de sécurité</CardTitle>
                </div>
                <CardDescription>
                  Historique complet de toutes les opérations sur vos moyens de paiement.
                  Conformité PSD3 / PSR — Permission Dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <p className="text-muted-foreground text-center py-8">Chargement...</p>
                ) : !audit || audit.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucune activité enregistrée</p>
                ) : (
                  <div className="space-y-1">
                    {audit.map((entry, i) => {
                      const actionInfo = AUDIT_ACTION_MAP[entry.action] ?? {
                        label: entry.action,
                        icon: <Clock className="h-3.5 w-3.5 text-slate-400" />,
                      };
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
                            <p className="text-sm font-medium text-foreground">{actionInfo.label}</p>
                            {entry.details && Object.keys(entry.details).length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                {entry.details.type && `Type: ${entry.details.type}`}
                                {entry.details.last4 && ` •••• ${entry.details.last4}`}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60">
                              {new Date(entry.created_at).toLocaleTimeString("fr-FR", {
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
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
