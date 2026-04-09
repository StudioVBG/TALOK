"use client";

/**
 * Onglet "Mon forfait" — Plan actuel, usage, upgrade/cancel
 * Logique extraite de /owner/settings/billing/page.tsx (qui devient un redirect)
 */

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useSubscription,
  UpgradeModal,
} from "@/components/subscription";
import {
  PLANS,
  formatPrice,
  getPlanLevel,
  type PlanSlug,
} from "@/lib/subscriptions/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  DatabaseBackup,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Check,
  Receipt,
  Clock,
  Building2,
  Users,
  PenTool,
  HardDrive,
  ChevronRight,
  Eye,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  X,
  Info,
  Landmark,
  Mail,
  MessageSquare,
  ArrowLeftRight,
  Code,
  Wrench,
  UserPlus,
  Brain,
  ClipboardCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { SubscriptionInvoice } from "@/lib/subscriptions/types";
import { PaymentMethod } from "@/components/billing/PaymentMethod";
import { useOwnerCurrentPaymentMethod } from "@/lib/hooks/use-owner-payment-methods";
import { isExpiringSoon, formatBillingCountdown } from "@/lib/billing-utils";
import { useStripePortal } from "@/hooks/useStripePortal";

// ── Constants ──

const TVA_RATE = 20;

const FEATURE_ICONS: Record<string, React.ElementType> = {
  signatures: PenTool,
  open_banking: Landmark,
  bank_reconciliation: ArrowLeftRight,
  auto_reminders: Mail,
  auto_reminders_sms: MessageSquare,
  irl_revision: TrendingUp,
  tenant_portal: Users,
  tenant_payment_online: CreditCard,
  lease_generation: FileText,
  scoring_tenant: Brain,
  edl_digital: ClipboardCheck,
  multi_users: UserPlus,
  work_orders: Wrench,
  providers_management: Users,
  api_access: Code,
  webhooks: Zap,
  white_label: Building2,
  copro_module: Building2,
};

const FEATURE_LABELS: Record<string, string> = {
  signatures: "Signature électronique",
  open_banking: "Open Banking",
  bank_reconciliation: "Rapprochement bancaire",
  auto_reminders: "Relances automatiques",
  auto_reminders_sms: "Relances SMS",
  irl_revision: "Révision IRL automatique",
  tenant_portal: "Portail locataire",
  tenant_payment_online: "Paiement en ligne",
  lease_generation: "Génération de bail",
  scoring_tenant: "Scoring locataire IA",
  edl_digital: "EDL numérique",
  multi_users: "Multi-utilisateurs",
  work_orders: "Ordres de travaux",
  providers_management: "Gestion prestataires",
  api_access: "API",
  webhooks: "Webhooks",
  white_label: "White label",
  copro_module: "Module copropriété",
};

const FEATURE_GROUPS = [
  { id: "base", title: "Gestion de base", features: ["tenant_portal", "lease_generation"] },
  { id: "documents", title: "Documents", features: ["signatures", "edl_digital"] },
  { id: "finance", title: "Finance", features: ["open_banking", "bank_reconciliation", "tenant_payment_online"] },
  { id: "automation", title: "Automatisation", features: ["auto_reminders", "auto_reminders_sms", "irl_revision"] },
  { id: "collaboration", title: "Collaboration", features: ["multi_users", "work_orders", "providers_management"] },
  { id: "advanced", title: "Avancé", features: ["api_access", "webhooks", "white_label", "copro_module", "scoring_tenant"] },
];

// ── Helpers ──

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function computeTTC(htCents: number): number {
  return Math.round(htCents * (1 + TVA_RATE / 100));
}

// ── Sub-components ──

function UsageBar({
  icon: Icon,
  label,
  used,
  limit,
  unit = "",
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  unit?: string;
  tooltip?: string;
}) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const isWarning = percentage >= 80 && percentage < 95;
  const isCritical = percentage >= 95 && percentage < 100;
  const isAtLimit = percentage >= 100;
  const displayMax = isUnlimited ? "Illimité" : `${limit}${unit}`;

  const statusLabel = isAtLimit
    ? "Limite atteinte"
    : isCritical
      ? "Limite presque atteinte"
      : isWarning
        ? "Proche de la limite"
        : "Normal";

  const barColor = isAtLimit
    ? "[&>div]:bg-red-500"
    : isCritical
      ? "[&>div]:bg-orange-500"
      : isWarning
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-emerald-500";

  const textColor = isAtLimit
    ? "text-red-600 font-semibold"
    : isCritical
      ? "text-orange-600 font-semibold"
      : isWarning
        ? "text-amber-600 font-medium"
        : "text-muted-foreground";

  const content = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <span>{label}</span>
          {tooltip && <HelpCircle className="w-3 h-3 text-muted-foreground/50" aria-hidden="true" />}
        </div>
        <span className={textColor}>
          {isUnlimited ? "Illimité" : `${used}${unit} / ${displayMax}`}
        </span>
      </div>
      {!isUnlimited && (
        <div
          role="meter"
          aria-label={`${label} : ${used}${unit} sur ${displayMax}`}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuetext={`${used}${unit} sur ${displayMax} — ${statusLabel}`}
        >
          <Progress value={percentage} className={cn("h-2", barColor)} />
        </div>
      )}
      {(isAtLimit || isCritical) && (
        <p className={cn("text-xs", isAtLimit ? "text-red-600" : "text-orange-600")}>
          {isAtLimit
            ? "Limite atteinte — passez au forfait supérieur"
            : `${Math.round(percentage)}% utilisé — limite bientôt atteinte`}
        </p>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><div>{content}</div></TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs"><p className="text-sm">{tooltip}</p></TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function UsageAlertBanner({ items }: { items: { label: string; percentage: number }[] }) {
  const critical = items.filter((i) => i.percentage >= 95);
  if (critical.length === 0) return null;
  const hasLimit = critical.some((i) => i.percentage >= 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-lg flex items-start gap-4 border",
        hasLimit ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
      )}
    >
      <AlertCircle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", hasLimit ? "text-red-600" : "text-orange-600")} aria-hidden="true" />
      <div className="flex-1">
        <p className={cn("font-semibold text-sm", hasLimit ? "text-red-800 dark:text-red-300" : "text-orange-800 dark:text-orange-300")}>
          {hasLimit ? "Limites atteintes" : "Limites bientôt atteintes"}
        </p>
        <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {critical.map((item) => (
            <li key={item.label}>
              {item.label} : {Math.round(item.percentage)}%
              {item.percentage >= 100 && " — Limite atteinte"}
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-3" asChild>
          <Link href="/pricing">
            <ArrowUpRight className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Voir les forfaits supérieurs
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

function PlanFeaturesSection({ planSlug }: { planSlug: PlanSlug }) {
  const plan = PLANS[planSlug];
  if (!plan) return null;

  const enabledGroups = FEATURE_GROUPS
    .map((group) => ({
      ...group,
      enabledFeatures: group.features.filter((f) => {
        const val = plan.features[f];
        return val === true || (typeof val === "string" && val !== "none" && val !== "false");
      }),
    }))
    .filter((group) => group.enabledFeatures.length > 0);

  if (enabledGroups.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-500" aria-hidden="true" />
        Fonctionnalités incluses
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {enabledGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.title}</p>
            <ul className="space-y-1.5">
              {group.enabledFeatures.map((featureKey) => {
                const FeatureIcon = FEATURE_ICONS[featureKey] || Check;
                const label = FEATURE_LABELS[featureKey] || featureKey;
                return (
                  <li key={featureKey} className="flex items-center gap-2 text-sm">
                    <FeatureIcon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; icon: React.ElementType; classes: string }> = {
    paid: { label: "Payée", icon: CheckCircle2, classes: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" },
    open: { label: "En attente", icon: Clock, classes: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
    draft: { label: "Brouillon", icon: FileText, classes: "bg-slate-500/20 text-muted-foreground border-slate-500/30" },
    void: { label: "Annulée", icon: X, classes: "bg-slate-500/20 text-muted-foreground border-slate-500/30" },
    uncollectible: { label: "Irrécouvrable", icon: AlertTriangle, classes: "bg-red-500/20 text-red-600 border-red-500/30" },
  };
  const config = configs[status] || { label: status, icon: Info, classes: "bg-slate-500/20 text-muted-foreground border-slate-500/30" };
  const StatusIcon = config.icon;
  return (
    <Badge className={cn("gap-1", config.classes)}>
      <StatusIcon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

type CheckoutVerificationState = "idle" | "verifying" | "confirmed" | "pending";

function isConfirmedSubscriptionStatus(status?: string | null): boolean {
  return status === "active" || status === "trialing";
}

function CheckoutVerificationBanner({
  state,
  message,
}: {
  state: CheckoutVerificationState;
  message: string | null;
}) {
  if (state === "idle" || !message) return null;

  const tone =
    state === "confirmed"
      ? {
          wrapper: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
          text: "text-emerald-800 dark:text-emerald-300",
          icon: CheckCircle2,
          iconClass: "text-emerald-600",
        }
      : state === "pending"
        ? {
            wrapper: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
            text: "text-amber-800 dark:text-amber-300",
            icon: AlertTriangle,
            iconClass: "text-amber-600",
          }
        : {
            wrapper: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
            text: "text-blue-800 dark:text-blue-300",
            icon: Loader2,
            iconClass: "text-blue-600 animate-spin",
          };

  const Icon = tone.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("p-4 rounded-lg border flex items-start gap-4", tone.wrapper)}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", tone.iconClass)} aria-hidden="true" />
      <div className="flex-1">
        <p className={cn("font-medium text-sm", tone.text)}>{message}</p>
      </div>
    </motion.div>
  );
}

function SubscriptionInvoicesTable() {
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscription } = useSubscription();

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
      <div className="text-center py-12">
        <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground mb-1">Aucune facture disponible</p>
        <p className="text-sm text-muted-foreground">
          {subscription?.status === "trialing"
            ? "Votre première facture sera générée à la fin de votre période d'essai."
            : "Vos factures apparaîtront ici après votre premier paiement."}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Numéro</TableHead>
          <TableHead>Montant</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              {new Date(invoice.created_at).toLocaleDateString("fr-FR")}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {invoice.invoice_number || "En cours"}
            </TableCell>
            <TableCell className="font-medium">
              {formatPrice(invoice.total)}
            </TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {invoice.invoice_pdf_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.invoice_pdf_url} target="_blank" rel="noopener noreferrer" aria-label="Télécharger le PDF">
                          <Download className="w-4 h-4" aria-hidden="true" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Télécharger le PDF</TooltipContent>
                  </Tooltip>
                )}
                {invoice.hosted_invoice_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer" aria-label="Voir en ligne">
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Voir en ligne</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UsageCard() {
  const { usage, currentPlan, loading } = useSubscription();
  const plan = PLANS[currentPlan];

  if (loading) {
    return (
      <Card>
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
    { key: "properties" as const, label: "Biens immobiliers", icon: Building2, limit: plan.limits.max_properties, tooltip: "Nombre de biens (lots) gérés dans votre compte" },
    { key: "users" as const, label: "Utilisateurs", icon: Users, limit: plan.limits.max_users, tooltip: "Nombre de collaborateurs sur votre compte" },
    { key: "signatures" as const, label: "Signatures ce mois", icon: PenTool, limit: plan.limits.signatures_monthly_quota, tooltip: plan.limits.signatures_monthly_quota > 0 ? `${plan.limits.signatures_monthly_quota} signatures incluses/mois` : "Signatures électroniques (payantes à l'unité)" },
    { key: "storage" as const, label: "Stockage", icon: HardDrive, limit: plan.limits.max_documents_gb, unit: " Go", tooltip: "Espace utilisé par vos documents (baux, EDL, photos...)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-500" aria-hidden="true" />
          Utilisation
        </CardTitle>
        <CardDescription>Suivi de votre consommation ce mois-ci</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {usageItems.map((item) => {
          const data = usage?.[item.key];
          return (
            <UsageBar
              key={item.key}
              icon={item.icon}
              label={item.label}
              used={data?.used || 0}
              limit={item.limit}
              unit={item.unit}
              tooltip={item.tooltip}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export function MonForfaitTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const {
    subscription,
    currentPlan,
    usage,
    loading,
    isTrialing,
    isCanceled,
    trialDaysRemaining,
    daysUntilRenewal,
    refresh,
  } = useSubscription();

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [checkoutVerificationState, setCheckoutVerificationState] = useState<CheckoutVerificationState>("idle");
  const [checkoutVerificationMessage, setCheckoutVerificationMessage] = useState<string | null>(null);

  const { data: ownerPaymentMethod } = useOwnerCurrentPaymentMethod();
  const { mutateAsync: openBillingPortal, isPending: isOpeningBillingPortal } = useStripePortal();
  const plan = PLANS[currentPlan];
  const isPaid = currentPlan !== "gratuit";
  const canUpgrade = getPlanLevel(currentPlan) < getPlanLevel("enterprise_xl");

  // Check for checkout redirect params
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      let cancelled = false;

      const verifyCheckout = async () => {
        setCheckoutVerificationState("verifying");
        setCheckoutVerificationMessage("Paiement recu, confirmation de l'abonnement en cours...");
        toast({
          title: "Confirmation en cours",
          description: "Nous verifions votre abonnement aupres de Stripe.",
        });

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        let confirmed = false;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          await refresh();

          const response = await fetch("/api/subscriptions/current", {
            cache: "no-store",
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            if (isConfirmedSubscriptionStatus(data.subscription?.status)) {
              confirmed = true;
              break;
            }
          }

          if (attempt < 2) {
            await wait(1500);
          }
        }

        if (cancelled) return;

        if (confirmed) {
          setCheckoutVerificationState("confirmed");
          setCheckoutVerificationMessage("Abonnement confirme. Vos nouvelles fonctionnalites sont disponibles.");
          toast({
            title: "Abonnement confirme",
            description: "La confirmation Stripe a bien ete recue.",
          });
        } else {
          setCheckoutVerificationState("pending");
          setCheckoutVerificationMessage(
            "Le retour Stripe a ete recu mais l'activation n'est pas encore confirmee cote serveur. Rechargez cette page dans quelques instants si le statut ne change pas."
          );
          toast({
            title: "Confirmation en attente",
            description: "Le paiement est revenu de Stripe, mais l'abonnement n'est pas encore confirme cote serveur.",
            variant: "destructive",
          });
        }

        router.replace("/owner/money?tab=forfait");
      };

      void verifyCheckout();

      return () => {
        cancelled = true;
      };
    } else if (canceled === "true") {
      setCheckoutVerificationState("idle");
      setCheckoutVerificationMessage(null);
      toast({
        title: "Paiement annulé",
        description: "Vous pouvez reprendre à tout moment depuis cette page.",
        variant: "destructive",
      });
      router.replace("/owner/money?tab=forfait");
    }
  }, [searchParams, toast, refresh, router]);

  // Usage alert items
  const usageAlertItems = useMemo(() => {
    if (!usage) return [];
    const items: { label: string; percentage: number }[] = [];
    const addItem = (label: string, key: "properties" | "users" | "signatures" | "storage") => {
      const data = usage[key];
      if (data && data.percentage >= 0) {
        items.push({ label, percentage: data.percentage });
      }
    };
    addItem("Biens", "properties");
    addItem("Utilisateurs", "users");
    addItem("Signatures", "signatures");
    addItem("Stockage", "storage");
    return items;
  }, [usage]);

  const handleExportData = async () => {
    try {
      const res = await fetch("/api/subscriptions/export", { method: "POST" });
      if (!res.ok) throw new Error("Erreur lors de l'export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `talok-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export réussi", description: "Vos données ont été téléchargées." });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'exporter vos données pour le moment.", variant: "destructive" });
    }
  };

  const handleReactivate = async () => {
    try {
      const res = await fetch("/api/subscriptions/reactivate", { method: "POST" });
      if (res.ok) {
        toast({ title: "Abonnement réactivé", description: "Votre abonnement a été réactivé avec succès." });
        refresh();
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de réactiver l'abonnement.", variant: "destructive" });
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openBillingPortal();
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'ouvrir la gestion de l'abonnement.",
        variant: "destructive",
      });
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
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <CheckoutVerificationBanner
          state={checkoutVerificationState}
          message={checkoutVerificationMessage}
        />

        {/* Proactive usage alerts */}
        <UsageAlertBanner items={usageAlertItems} />

        {/* Trial alert */}
        {isTrialing && trialDaysRemaining !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 flex items-start gap-4"
          >
            <Clock className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-violet-800 dark:text-violet-300 font-medium">Période d&apos;essai en cours</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Il vous reste <strong>{trialDaysRemaining} jours</strong> pour profiter de toutes les
                fonctionnalités {plan.name}. Ajoutez un moyen de paiement pour continuer après l&apos;essai.
              </p>
            </div>
            <Button size="sm" className="flex-shrink-0" asChild>
              <Link href="/owner/money?tab=paiement">Ajouter un moyen de paiement</Link>
            </Button>
          </motion.div>
        )}

        {/* Card expiring alert */}
        {ownerPaymentMethod && isExpiringSoon(ownerPaymentMethod.exp_month, ownerPaymentMethod.exp_year, 30) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-lg border flex items-start gap-4",
              isExpiringSoon(ownerPaymentMethod.exp_month, ownerPaymentMethod.exp_year, 7)
                ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            )}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
            <div className="flex-1">
              <p className={cn("font-medium text-sm", isExpiringSoon(ownerPaymentMethod.exp_month, ownerPaymentMethod.exp_year, 7) ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300")}>
                Votre carte expire bientôt
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Mettez à jour votre moyen de paiement pour éviter toute interruption de votre abonnement.
              </p>
            </div>
            <Button size="sm" variant="outline" className="flex-shrink-0" asChild>
              <Link href="/owner/money?tab=paiement">Mettre à jour</Link>
            </Button>
          </motion.div>
        )}

        {/* Canceled alert */}
        {isCanceled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-4"
          >
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-red-800 dark:text-red-300 font-medium">Résiliation programmée</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Votre abonnement sera résilié le{" "}
                <strong>
                  {subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                    : "bientôt"}
                </strong>.
                Vous conservez l&apos;accès à toutes les fonctionnalités jusqu&apos;à cette date.
              </p>
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 flex-shrink-0" onClick={handleReactivate}>
              <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Réactiver
            </Button>
          </motion.div>
        )}

        {/* No payment method alert */}
        {subscription?.status === "active" && !ownerPaymentMethod && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 flex items-start gap-4"
          >
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-blue-800 dark:text-blue-300 font-medium">Aucun moyen de paiement enregistré</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ajoutez une carte pour sécuriser le renouvellement de votre abonnement.
              </p>
            </div>
            <Button size="sm" className="flex-shrink-0" asChild>
              <Link href="/owner/money?tab=paiement">Ajouter un moyen de paiement</Link>
            </Button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Plan Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Votre forfait</CardTitle>
                  <CardDescription>Détails de votre abonnement actuel</CardDescription>
                </div>
                <Badge
                  className={cn(
                    "text-sm",
                    subscription?.status === "active"
                      ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                      : subscription?.status === "trialing"
                        ? "bg-violet-500/20 text-violet-600 border-violet-500/30"
                        : subscription?.status === "past_due"
                          ? "bg-red-500/20 text-red-600 border-red-500/30"
                          : "bg-slate-500/20 text-muted-foreground"
                  )}
                >
                  {subscription?.status === "active"
                    ? "Actif"
                    : subscription?.status === "trialing"
                      ? "Essai"
                      : subscription?.status === "past_due"
                        ? "Impayé"
                        : subscription?.status === "canceled"
                          ? "Annulé"
                          : subscription?.status || "Gratuit"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan info */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${plan.gradient || "from-slate-600 to-slate-700"} flex items-center justify-center flex-shrink-0`}>
                    <Building2 className="w-7 h-7 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {plan.limits.max_properties === -1 ? "Biens illimités" : `${plan.limits.max_properties} biens max`}
                      </span>
                      {plan.limits.signatures_monthly_quota > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground/50">|</span>
                          <span className="text-xs text-muted-foreground">
                            {plan.limits.signatures_monthly_quota === -1 ? "Signatures illimitées" : `${plan.limits.signatures_monthly_quota} signatures/mois`}
                          </span>
                        </>
                      )}
                      {plan.limits.max_users > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground/50">|</span>
                          <span className="text-xs text-muted-foreground">
                            {plan.limits.max_users === -1 ? "Utilisateurs illimités" : `${plan.limits.max_users} utilisateur(s)`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold">
                      {formatPrice(subscription?.billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly)}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        HT/{subscription?.billing_cycle === "yearly" ? "an" : "mois"}
                      </span>
                    </div>
                    {plan.price_monthly && plan.price_monthly > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        soit {formatCurrency(computeTTC(subscription?.billing_cycle === "yearly" ? plan.price_yearly ?? 0 : plan.price_monthly))} TTC (TVA {TVA_RATE}%)
                      </div>
                    )}
                    {subscription?.billing_cycle === "yearly" && plan.price_yearly && (
                      <div className="text-xs text-muted-foreground">
                        equiv. {formatCurrency(Math.round(plan.price_yearly / 12))} HT/mois
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billing info */}
              {isPaid && subscription && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="text-xs text-muted-foreground mb-1">Statut du forfait</div>
                    <div className="font-medium text-sm">
                      {subscription.status === "active"
                        ? "Actif"
                        : subscription.status === "trialing"
                          ? "Essai"
                          : subscription.status === "past_due"
                            ? "Paiement en attente"
                            : subscription.status === "incomplete"
                              ? "Activation en attente"
                              : subscription.status === "canceled"
                                ? "Annulation programmee"
                                : subscription.status}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ce statut concerne le forfait, pas l'occupation du bien.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="text-xs text-muted-foreground mb-1">Cycle de facturation</div>
                    <div className="font-medium text-sm">
                      {subscription.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}
                    </div>
                    {plan.price_yearly && plan.price_monthly && plan.price_yearly > 0 && subscription.billing_cycle === "monthly" && (
                      <p className="text-xs text-emerald-600 mt-1">
                        Économisez {Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100)}% en annuel
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="text-xs text-muted-foreground mb-1">Prochaine facturation</div>
                    <div className="font-medium text-sm">
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                        : "-"}
                    </div>
                    {daysUntilRenewal !== null && daysUntilRenewal <= 7 && (
                      <p className="text-xs text-amber-600 mt-1">{formatBillingCountdown(subscription.current_period_end)}</p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="text-xs text-muted-foreground mb-1">Coût mensuel estimé</div>
                    <div className="font-medium text-sm">{formatCurrency(plan.price_monthly ?? 0)} HT</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(computeTTC(plan.price_monthly ?? 0))} TTC</div>
                  </div>
                </div>
              )}

              {/* Features collapsible */}
              <div>
                <button
                  onClick={() => setShowFeatures(!showFeatures)}
                  className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-500 transition-colors"
                  aria-expanded={showFeatures}
                >
                  <ChevronRight className={cn("w-4 h-4 transition-transform", showFeatures && "rotate-90")} aria-hidden="true" />
                  {showFeatures ? "Masquer les fonctionnalités" : "Voir les fonctionnalités incluses"}
                </button>
                <AnimatePresence>
                  {showFeatures && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="pt-4">
                        <PlanFeaturesSection planSlug={currentPlan} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {canUpgrade && (
                  <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500" onClick={() => setShowUpgrade(true)}>
                    <ArrowUpRight className="w-4 h-4 mr-2" aria-hidden="true" />
                    Choisir ou modifier mon forfait
                  </Button>
                )}
                {isPaid && !isCanceled && (
                  <Button variant="outline" onClick={handleManageSubscription} disabled={isOpeningBillingPortal}>
                    {isOpeningBillingPortal ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" aria-hidden="true" />
                    )}
                    Gerer paiement et annulation
                  </Button>
                )}
                {currentPlan === "gratuit" && (
                  <Button onClick={() => router.push("/pricing")}>
                    <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                    Voir les forfaits
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/pricing">
                    <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                    Comparer les forfaits
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-violet-500" aria-hidden="true" />
                  Moyen de paiement
                </CardTitle>
                <CardDescription>Carte utilisée pour votre abonnement</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Une seule action: ajoutez votre carte pour le forfait, puis les renouvellements et l&apos;annulation se gerent ensuite depuis l&apos;espace de facturation.
                </p>
                <PaymentMethod
                  paymentMethod={ownerPaymentMethod ?? null}
                  manageUrl="/owner/money?tab=paiement"
                />
              </CardContent>
            </Card>
            <UsageCard />
          </div>
        </div>

        {/* Subscription invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-violet-500" aria-hidden="true" />
                  Factures d&apos;abonnement
                </CardTitle>
                <CardDescription>Téléchargez vos factures pour votre comptabilité</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SubscriptionInvoicesTable />
          </CardContent>
        </Card>

        {/* Legal & RGPD */}
        <Card className="bg-muted/30 border-muted">
          <CardContent className="py-4 px-5">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Informations légales</h3>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                Tous les prix sont affichés hors taxes (HT). TVA applicable : {TVA_RATE}% (France métropolitaine).
                Taux réduits outre-mer : Martinique/Guadeloupe/Réunion 8,5%, Guyane/Mayotte 0%.
              </p>
              <p>
                Conformément à l&apos;Art. L221-18 du Code de la Consommation, vous disposez d&apos;un droit de rétractation de 14 jours.
                Conformément à l&apos;Art. L215-1, toute modification tarifaire fait l&apos;objet d&apos;une notification préalable de 30 jours minimum.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
                <Link href="/legal/cgv" className="underline hover:text-foreground transition-colors">CGV</Link>
                <Link href="/legal/cgu" className="underline hover:text-foreground transition-colors">CGU</Link>
                <Link href="/legal/privacy" className="underline hover:text-foreground transition-colors">Politique de confidentialité</Link>
                <span className="flex-1" />
                <Button variant="outline" size="sm" className="text-xs" onClick={handleExportData}>
                  <DatabaseBackup className="w-3 h-3 mr-1" aria-hidden="true" />
                  Exporter mes données (Art. 20 RGPD)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modals */}
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </div>
    </TooltipProvider>
  );
}
