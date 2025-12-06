"use client";

/**
 * Page Billing - Gestion de l'abonnement
 * Affiche l'abonnement actuel, l'usage, les factures et les options
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  useSubscription, 
  useUsageLimit,
  UpgradeModal,
  CancelModal,
  UsageMeter,
} from "@/components/subscription";
import {
  PLANS,
  formatPrice,
  getPlanLevel,
} from "@/lib/subscriptions/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Settings,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Check,
  Calendar,
  Receipt,
  Clock,
  Building2,
  Users,
  PenTool,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { SubscriptionInvoice } from "@/lib/subscriptions/types";

// ============================================
// COMPONENTS
// ============================================

function UsageCard() {
  const { usage, currentPlan, loading } = useSubscription();
  const plan = PLANS[currentPlan];

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const usageItems = [
    {
      key: "properties" as const,
      label: "Biens immobiliers",
      icon: Building2,
      limit: plan.limits.max_properties,
    },
    {
      key: "users" as const,
      label: "Utilisateurs",
      icon: Users,
      limit: plan.limits.max_users,
    },
    {
      key: "signatures" as const,
      label: "Signatures ce mois",
      icon: PenTool,
      limit: plan.limits.signatures_monthly_quota,
    },
    {
      key: "storage" as const,
      label: "Stockage",
      icon: HardDrive,
      limit: plan.limits.max_documents_gb,
      unit: "Go",
    },
  ];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-400" />
          Utilisation
        </CardTitle>
        <CardDescription>
          Suivi de votre consommation ce mois-ci
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {usageItems.map((item) => {
          const data = usage?.[item.key];
          const isUnlimited = item.limit === -1;
          const percentage = data?.percentage || 0;
          const isWarning = percentage >= 80 && percentage < 100;
          const isCritical = percentage >= 100;

          return (
            <div key={item.key} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">{item.label}</span>
                </div>
                <span className="text-slate-400">
                  {isUnlimited ? (
                    "Illimité"
                  ) : (
                    <>
                      {data?.used || 0} / {item.limit}
                      {item.unit ? ` ${item.unit}` : ""}
                    </>
                  )}
                </span>
              </div>
              {!isUnlimited && (
                <Progress
                  value={percentage}
                  className={cn(
                    "h-2",
                    isCritical
                      ? "[&>div]:bg-red-500"
                      : isWarning
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-emerald-500"
                  )}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InvoicesTable() {
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch("/api/subscriptions/invoices");
        const data = await res.json();
        setInvoices(data.invoices || []);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucune facture pour le moment</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700">
          <TableHead>Date</TableHead>
          <TableHead>Numéro</TableHead>
          <TableHead>Montant</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id} className="border-slate-700/50">
            <TableCell className="text-slate-300">
              {new Date(invoice.created_at).toLocaleDateString("fr-FR")}
            </TableCell>
            <TableCell className="text-slate-400">
              {invoice.invoice_number || "-"}
            </TableCell>
            <TableCell className="text-white font-medium">
              {formatPrice(invoice.total)}
            </TableCell>
            <TableCell>
              <Badge
                className={cn(
                  invoice.status === "paid"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : invoice.status === "open"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                )}
              >
                {invoice.status === "paid"
                  ? "Payée"
                  : invoice.status === "open"
                  ? "En attente"
                  : invoice.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {invoice.invoice_pdf_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a
                    href={invoice.invoice_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const {
    subscription,
    currentPlan,
    loading,
    isTrialing,
    isCanceled,
    trialDaysRemaining,
    daysUntilRenewal,
    refresh,
  } = useSubscription();

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const plan = PLANS[currentPlan];
  const isPaid = currentPlan !== "starter";
  const canUpgrade = getPlanLevel(currentPlan) < getPlanLevel("enterprise");
  const canDowngrade = getPlanLevel(currentPlan) > 0;

  // Check for success param
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "true") {
      toast({
        title: "🎉 Abonnement activé !",
        description: "Merci pour votre confiance. Profitez de vos nouvelles fonctionnalités !",
      });
      refresh();
      router.replace("/owner/settings/billing");
    }
  }, [searchParams, toast, refresh, router]);

  const openStripePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscriptions/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur");
      }

      window.location.href = data.url;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'ouverture du portail";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Facturation</h1>
          <p className="text-slate-400">
            Gérez votre abonnement et vos factures
          </p>
        </div>
        {isPaid && (
          <Button
            variant="outline"
            onClick={openStripePortal}
            disabled={portalLoading}
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Gérer le paiement
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        )}
      </div>

      {/* Alert banners */}
      {isTrialing && trialDaysRemaining !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center gap-4"
        >
          <Clock className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-violet-300 font-medium">
              Période d&apos;essai en cours
            </p>
            <p className="text-sm text-slate-400">
              Il vous reste {trialDaysRemaining} jours pour profiter de toutes les
              fonctionnalités {plan.name}.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-500"
            onClick={openStripePortal}
          >
            Ajouter un moyen de paiement
          </Button>
        </motion.div>
      )}

      {isCanceled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-4"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 font-medium">Abonnement annulé</p>
            <p className="text-sm text-slate-400">
              Votre abonnement sera résilié le{" "}
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR")
                : "bientôt"}
              . Vous pouvez le réactiver à tout moment.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={async () => {
              try {
                const res = await fetch("/api/subscriptions/reactivate", {
                  method: "POST",
                });
                if (res.ok) {
                  toast({
                    title: "Abonnement réactivé",
                    description: "Votre abonnement a été réactivé avec succès.",
                  });
                  refresh();
                }
              } catch (error) {
                console.error(error);
              }
            }}
          >
            Réactiver
          </Button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Votre forfait</CardTitle>
                <CardDescription>
                  Détails de votre abonnement actuel
                </CardDescription>
              </div>
              <Badge
                className={cn(
                  "text-sm",
                  subscription?.status === "active"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : subscription?.status === "trialing"
                    ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                    : "bg-slate-500/20 text-slate-400"
                )}
              >
                {subscription?.status === "active"
                  ? "Actif"
                  : subscription?.status === "trialing"
                  ? "Essai"
                  : subscription?.status || "Gratuit"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${plan.gradient || "from-slate-600 to-slate-700"} flex items-center justify-center`}
              >
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {formatPrice(
                    subscription?.billing_cycle === "yearly"
                      ? plan.price_yearly
                      : plan.price_monthly
                  )}
                </div>
                <div className="text-sm text-slate-400">
                  /{subscription?.billing_cycle === "yearly" ? "an" : "mois"}
                </div>
              </div>
            </div>

            {/* Billing info */}
            {isPaid && subscription && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <div className="text-sm text-slate-400 mb-1">
                    Cycle de facturation
                  </div>
                  <div className="text-white font-medium">
                    {subscription.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <div className="text-sm text-slate-400 mb-1">
                    Prochaine facturation
                  </div>
                  <div className="text-white font-medium">
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR")
                      : "-"}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {canUpgrade && (
                <Button
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
                  onClick={() => setShowUpgrade(true)}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Upgrader
                </Button>
              )}
              {isPaid && !isCanceled && (
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => setShowCancel(true)}
                >
                  Résilier
                </Button>
              )}
              {currentPlan === "starter" && (
                <Button
                  onClick={() => router.push("/pricing")}
                  className="bg-violet-600 hover:bg-violet-500"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Voir les forfaits
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Card */}
        <UsageCard />
      </div>

      {/* Invoices */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            Historique des factures
          </CardTitle>
          <CardDescription>
            Téléchargez vos factures pour votre comptabilité
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesTable />
        </CardContent>
      </Card>

      {/* Modals */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <CancelModal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onSuccess={() => refresh()}
      />
    </div>
  );
}

