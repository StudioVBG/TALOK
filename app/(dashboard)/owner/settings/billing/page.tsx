"use client";

/**
 * Page Billing - Gestion de l'abonnement — SOTA 2026
 * Affiche l'abonnement actuel, l'usage, les factures et les options
 *
 * Conformite :
 * - Art. L112-1 Code de la Consommation (affichage HT/TTC)
 * - Art. L221-18 Code de la Consommation (droit de retractation 14 jours)
 * - Art. L215-1 Code de la Consommation (resiliation / changement tarifaire)
 * - Art. 20 RGPD (portabilite des donnees)
 * - WCAG 2.2 AA (accessibilite)
 * - CGI Art. 289 (mentions obligatoires factures)
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useSubscription,
  UpgradeModal,
  CancelModal,
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
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { SubscriptionInvoice } from "@/lib/subscriptions/types";

// ============================================
// CONSTANTS
// ============================================

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
  signatures: "Signature electronique",
  open_banking: "Open Banking",
  bank_reconciliation: "Rapprochement bancaire",
  auto_reminders: "Relances automatiques",
  auto_reminders_sms: "Relances SMS",
  irl_revision: "Revision IRL automatique",
  tenant_portal: "Portail locataire",
  tenant_payment_online: "Paiement en ligne",
  lease_generation: "Generation de bail",
  scoring_tenant: "Scoring locataire IA",
  edl_digital: "EDL numerique",
  multi_users: "Multi-utilisateurs",
  work_orders: "Ordres de travaux",
  providers_management: "Gestion prestataires",
  api_access: "API",
  webhooks: "Webhooks",
  white_label: "White label",
  copro_module: "Module copropriete",
};

const FEATURE_GROUPS = [
  { id: "base", title: "Gestion de base", features: ["tenant_portal", "lease_generation"] },
  { id: "documents", title: "Documents", features: ["signatures", "edl_digital"] },
  { id: "finance", title: "Finance", features: ["open_banking", "bank_reconciliation", "tenant_payment_online"] },
  { id: "automation", title: "Automatisation", features: ["auto_reminders", "auto_reminders_sms", "irl_revision"] },
  { id: "collaboration", title: "Collaboration", features: ["multi_users", "work_orders", "providers_management"] },
  { id: "advanced", title: "Avance", features: ["api_access", "webhooks", "white_label", "copro_module", "scoring_tenant"] },
];

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function computeTTC(htCents: number): number {
  return Math.round(htCents * (1 + TVA_RATE / 100));
}

// ============================================
// USAGE BAR (WCAG 2.2 AA)
// ============================================

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
  const displayMax = isUnlimited ? "Illimite" : `${limit}${unit}`;

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
    ? "text-red-400 font-semibold"
    : isCritical
      ? "text-orange-400 font-semibold"
      : isWarning
        ? "text-amber-400 font-medium"
        : "text-slate-400";

  const content = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-slate-300">{label}</span>
          {tooltip && (
            <HelpCircle className="w-3 h-3 text-slate-500" aria-hidden="true" />
          )}
        </div>
        <span className={textColor}>
          {isUnlimited ? "Illimite" : `${used}${unit} / ${displayMax}`}
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
        <p className={cn("text-xs", isAtLimit ? "text-red-400" : "text-orange-400")}>
          {isAtLimit
            ? "Limite atteinte — passez au forfait superieur"
            : `${Math.round(percentage)}% utilise — limite bientot atteinte`}
        </p>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{content}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

// ============================================
// USAGE ALERT BANNER
// ============================================

function UsageAlertBanner({
  items,
}: {
  items: { label: string; percentage: number }[];
}) {
  const critical = items.filter((i) => i.percentage >= 95);
  if (critical.length === 0) return null;
  const hasLimit = critical.some((i) => i.percentage >= 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-lg flex items-start gap-4 border",
        hasLimit
          ? "bg-red-500/10 border-red-500/30"
          : "bg-orange-500/10 border-orange-500/30"
      )}
    >
      <AlertCircle
        className={cn("w-5 h-5 flex-shrink-0 mt-0.5", hasLimit ? "text-red-400" : "text-orange-400")}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className={cn("font-semibold text-sm", hasLimit ? "text-red-300" : "text-orange-300")}>
          {hasLimit ? "Limites atteintes" : "Limites bientot atteintes"}
        </p>
        <ul className="text-sm text-slate-400 mt-1 space-y-0.5">
          {critical.map((item) => (
            <li key={item.label}>
              {item.label} : {Math.round(item.percentage)}%
              {item.percentage >= 100 && " — Limite atteinte"}
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-3 bg-violet-600 hover:bg-violet-500" asChild>
          <Link href="/pricing">
            <ArrowUpRight className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Voir les forfaits superieurs
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================
// PLAN FEATURES SECTION
// ============================================

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
      <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" aria-hidden="true" />
        Fonctionnalites incluses
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {enabledGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{group.title}</p>
            <ul className="space-y-1.5">
              {group.enabledFeatures.map((featureKey) => {
                const FeatureIcon = FEATURE_ICONS[featureKey] || Check;
                const label = FEATURE_LABELS[featureKey] || featureKey;
                return (
                  <li key={featureKey} className="flex items-center gap-2 text-sm">
                    <FeatureIcon className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" aria-hidden="true" />
                    <span className="text-slate-300">{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {plan.limits.signatures_monthly_quota > 0 && (
        <p className="text-xs text-slate-500">
          {plan.limits.signatures_monthly_quota === -1
            ? "Signatures electroniques illimitees incluses"
            : `${plan.limits.signatures_monthly_quota} signature(s) electronique(s) incluse(s) par mois`}
          {plan.features.signature_price && Number(plan.features.signature_price) > 0 && (
            <>, puis {formatCurrency(Number(plan.features.signature_price))} par signature supplementaire</>
          )}
        </p>
      )}
    </div>
  );
}

// ============================================
// INVOICE STATUS BADGE
// ============================================

function InvoiceStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; icon: React.ElementType; classes: string }> = {
    paid: { label: "Payee", icon: CheckCircle2, classes: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    open: { label: "En attente", icon: Clock, classes: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    draft: { label: "Brouillon", icon: FileText, classes: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    void: { label: "Annulee", icon: X, classes: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    uncollectible: { label: "Irrecouvrable", icon: AlertTriangle, classes: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const config = configs[status] || { label: status, icon: Info, classes: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
  const StatusIcon = config.icon;
  return (
    <Badge className={cn("gap-1", config.classes)}>
      <StatusIcon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

// ============================================
// INVOICES TABLE
// ============================================

function InvoicesTable() {
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
          <Skeleton key={i} className="h-16 w-full bg-slate-700/50" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-12 h-12 mx-auto mb-4 text-slate-600" aria-hidden="true" />
        <p className="text-slate-400 mb-1">Aucune facture disponible</p>
        <p className="text-sm text-slate-500">
          {subscription?.status === "trialing"
            ? "Votre premiere facture sera generee a la fin de votre periode d'essai."
            : "Vos factures apparaitront ici apres votre premier paiement."}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700">
          <TableHead className="text-slate-400">Date</TableHead>
          <TableHead className="text-slate-400">Numero</TableHead>
          <TableHead className="text-slate-400">Montant</TableHead>
          <TableHead className="text-slate-400">Statut</TableHead>
          <TableHead className="text-right text-slate-400">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id} className="border-slate-700/50 hover:bg-slate-800/50">
            <TableCell className="text-slate-300">
              {new Date(invoice.created_at).toLocaleDateString("fr-FR")}
            </TableCell>
            <TableCell className="text-slate-400">
              {invoice.invoice_number || "En cours"}
            </TableCell>
            <TableCell className="text-white font-medium">
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
                        <a
                          href={invoice.invoice_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Telecharger la facture PDF ${invoice.invoice_number || ""}`}
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Telecharger le PDF</TooltipContent>
                  </Tooltip>
                )}
                {invoice.hosted_invoice_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Voir la facture en ligne ${invoice.invoice_number || ""}`}
                        >
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

// ============================================
// USAGE CARD
// ============================================

function UsageCard() {
  const { usage, currentPlan, loading } = useSubscription();
  const plan = PLANS[currentPlan];

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <Skeleton className="h-6 w-32 bg-slate-700/50" />
          <Skeleton className="h-4 w-48 mt-2 bg-slate-700/50" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-slate-700/50" />
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
      tooltip: "Nombre de biens (lots) geres dans votre compte",
    },
    {
      key: "users" as const,
      label: "Utilisateurs",
      icon: Users,
      limit: plan.limits.max_users,
      tooltip: "Nombre de collaborateurs sur votre compte",
    },
    {
      key: "signatures" as const,
      label: "Signatures ce mois",
      icon: PenTool,
      limit: plan.limits.signatures_monthly_quota,
      tooltip: plan.limits.signatures_monthly_quota > 0
        ? `${plan.limits.signatures_monthly_quota} signatures incluses/mois`
        : "Signatures electroniques (payantes a l'unite)",
    },
    {
      key: "storage" as const,
      label: "Stockage",
      icon: HardDrive,
      limit: plan.limits.max_documents_gb,
      unit: " Go",
      tooltip: "Espace utilise par vos documents (baux, EDL, photos...)",
    },
  ];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <TrendingUp className="w-5 h-5 text-violet-400" aria-hidden="true" />
          Utilisation
        </CardTitle>
        <CardDescription className="text-slate-400">
          Suivi de votre consommation ce mois-ci
        </CardDescription>
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
    usage,
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
  const [showFeatures, setShowFeatures] = useState(false);

  const plan = PLANS[currentPlan];
  const isPaid = currentPlan !== "gratuit";
  const canUpgrade = getPlanLevel(currentPlan) < getPlanLevel("enterprise_xl");

  // Check for success param
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "true") {
      toast({
        title: "Abonnement active !",
        description: "Merci pour votre confiance. Profitez de vos nouvelles fonctionnalites !",
      });
      refresh();
      router.replace("/owner/settings/billing");
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
      toast({
        title: "Export reussi",
        description: "Vos donnees ont ete telechargees.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter vos donnees pour le moment.",
        variant: "destructive",
      });
    }
  };

  const handleReactivate = async () => {
    try {
      const res = await fetch("/api/subscriptions/reactivate", { method: "POST" });
      if (res.ok) {
        toast({
          title: "Abonnement reactive",
          description: "Votre abonnement a ete reactive avec succes.",
        });
        refresh();
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de reactiver l'abonnement.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-slate-700/50" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2 bg-slate-700/50" />
          <Skeleton className="h-64 bg-slate-700/50" />
        </div>
        <Skeleton className="h-48 bg-slate-700/50" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Skip to content */}
        <a
          href="#billing-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-violet-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
        >
          Aller au contenu principal
        </a>

        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="text-sm text-slate-400">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/owner/dashboard" className="hover:text-white transition-colors">
                Tableau de bord
              </Link>
            </li>
            <li><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></li>
            <li aria-current="page" className="text-white font-medium">Facturation & Abonnement</li>
          </ol>
        </nav>

        {/* Header */}
        <div id="billing-content" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-7 h-7 text-violet-400" aria-hidden="true" />
              Facturation & Abonnement
            </h1>
            <p className="text-slate-400 mt-1">
              Gerez votre forfait, vos modules, vos factures et vos moyens de paiement
            </p>
          </div>
          <div className="flex gap-2">
            {isPaid && (
              <Button
                variant="outline"
                onClick={openStripePortal}
                disabled={portalLoading}
                className="border-slate-600 text-slate-300 hover:text-white"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Gerer le paiement
              </Button>
            )}
            <Button variant="outline" asChild className="border-slate-600 text-slate-300 hover:text-white">
              <Link href="/pricing">
                <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                Comparer les forfaits
              </Link>
            </Button>
          </div>
        </div>

        {/* Proactive usage alerts */}
        <UsageAlertBanner items={usageAlertItems} />

        {/* Alert banners */}
        {isTrialing && trialDaysRemaining !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-start gap-4"
          >
            <Clock className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-violet-300 font-medium">
                Periode d&apos;essai en cours
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                Il vous reste <strong>{trialDaysRemaining} jours</strong> pour profiter de toutes les
                fonctionnalites {plan.name}. Ajoutez un moyen de paiement pour continuer apres l&apos;essai.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 flex-shrink-0"
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
            className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-4"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-red-300 font-medium">Resiliation programmee</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Votre abonnement sera resilie le{" "}
                <strong>
                  {subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                    : "bientot"}
                </strong>.
                Vous conservez l&apos;acces a toutes les fonctionnalites jusqu&apos;a cette date.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 flex-shrink-0"
              onClick={handleReactivate}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Reactiver
            </Button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Plan Card */}
          <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-white">Votre forfait</CardTitle>
                  <CardDescription className="text-slate-400">
                    Details de votre abonnement actuel
                  </CardDescription>
                </div>
                <Badge
                  className={cn(
                    "text-sm",
                    subscription?.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : subscription?.status === "trialing"
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                        : subscription?.status === "past_due"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-slate-500/20 text-slate-400"
                  )}
                >
                  {subscription?.status === "active"
                    ? "Actif"
                    : subscription?.status === "trialing"
                      ? "Essai"
                      : subscription?.status === "past_due"
                        ? "Impaye"
                        : subscription?.status === "canceled"
                          ? "Annule"
                          : subscription?.status || "Gratuit"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan info card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${plan.gradient || "from-slate-600 to-slate-700"} flex items-center justify-center flex-shrink-0`}
                  >
                    <Building2 className="w-7 h-7 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-sm text-slate-400">{plan.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs text-slate-500">
                        {plan.limits.max_properties === -1 ? "Biens illimites" : `${plan.limits.max_properties} biens max`}
                      </span>
                      {plan.limits.signatures_monthly_quota > 0 && (
                        <>
                          <span className="text-xs text-slate-600">|</span>
                          <span className="text-xs text-slate-500">
                            {plan.limits.signatures_monthly_quota === -1 ? "Signatures illimitees" : `${plan.limits.signatures_monthly_quota} signatures/mois`}
                          </span>
                        </>
                      )}
                      {plan.limits.max_users > 0 && (
                        <>
                          <span className="text-xs text-slate-600">|</span>
                          <span className="text-xs text-slate-500">
                            {plan.limits.max_users === -1 ? "Utilisateurs illimites" : `${plan.limits.max_users} utilisateur(s)`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-white">
                      {formatPrice(
                        subscription?.billing_cycle === "yearly"
                          ? plan.price_yearly
                          : plan.price_monthly
                      )}
                      <span className="text-sm font-normal text-slate-400 ml-1">
                        HT/{subscription?.billing_cycle === "yearly" ? "an" : "mois"}
                      </span>
                    </div>
                    {plan.price_monthly && plan.price_monthly > 0 && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        soit{" "}
                        {formatCurrency(
                          computeTTC(
                            subscription?.billing_cycle === "yearly"
                              ? plan.price_yearly ?? 0
                              : plan.price_monthly
                          )
                        )}{" "}
                        TTC (TVA {TVA_RATE}%)
                      </div>
                    )}
                    {subscription?.billing_cycle === "yearly" && plan.price_yearly && (
                      <div className="text-xs text-slate-500">
                        equiv. {formatCurrency(Math.round(plan.price_yearly / 12))} HT/mois
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billing info */}
              {isPaid && subscription && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <div className="text-xs text-slate-500 mb-1">Cycle de facturation</div>
                    <div className="text-white font-medium text-sm">
                      {subscription.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}
                    </div>
                    {plan.price_yearly && plan.price_monthly && plan.price_yearly > 0 && subscription.billing_cycle === "monthly" && (
                      <p className="text-xs text-emerald-400 mt-1">
                        Economisez {Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100)}% en annuel
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <div className="text-xs text-slate-500 mb-1">Prochaine facturation</div>
                    <div className="text-white font-medium text-sm">
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                        : "-"}
                    </div>
                    {daysUntilRenewal !== null && daysUntilRenewal <= 7 && (
                      <p className="text-xs text-amber-400 mt-1">
                        Dans {daysUntilRenewal} jour(s)
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <div className="text-xs text-slate-500 mb-1">Cout mensuel estime</div>
                    <div className="text-white font-medium text-sm">
                      {formatCurrency(plan.price_monthly ?? 0)} HT
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatCurrency(computeTTC(plan.price_monthly ?? 0))} TTC
                    </div>
                  </div>
                </div>
              )}

              {/* Features collapsible */}
              <div>
                <button
                  onClick={() => setShowFeatures(!showFeatures)}
                  className="flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
                  aria-expanded={showFeatures}
                >
                  <ChevronRight className={cn("w-4 h-4 transition-transform", showFeatures && "rotate-90")} aria-hidden="true" />
                  {showFeatures ? "Masquer les fonctionnalites" : "Voir les fonctionnalites incluses"}
                </button>
                <AnimatePresence>
                  {showFeatures && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4">
                        <PlanFeaturesSection planSlug={currentPlan} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Separator className="bg-slate-700" />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {canUpgrade && (
                  <Button
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
                    onClick={() => setShowUpgrade(true)}
                  >
                    <ArrowUpRight className="w-4 h-4 mr-2" aria-hidden="true" />
                    Changer de forfait
                  </Button>
                )}
                {isPaid && !isCanceled && (
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => setShowCancel(true)}
                  >
                    <X className="w-4 h-4 mr-2" aria-hidden="true" />
                    Resilier
                  </Button>
                )}
                {currentPlan === "gratuit" && (
                  <Button
                    onClick={() => router.push("/pricing")}
                    className="bg-violet-600 hover:bg-violet-500"
                  >
                    <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Receipt className="w-5 h-5 text-violet-400" aria-hidden="true" />
                  Factures
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Telechargez vos factures pour votre comptabilite
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <InvoicesTable />
          </CardContent>
        </Card>

        {/* Legal & RGPD */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-4 px-5">
            <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Informations legales</h3>
            <div className="text-xs text-slate-500 space-y-2">
              <p>
                Tous les prix sont affiches hors taxes (HT). TVA applicable : {TVA_RATE}% (France metropolitaine).
                Taux reduits DOM-TOM : Martinique/Guadeloupe/Reunion 8,5%, Guyane/Mayotte 0%.
                Le taux applicable est determine automatiquement selon votre adresse de facturation.
              </p>
              <p>
                Conformement a l&apos;Art. L221-18 du Code de la Consommation, vous disposez d&apos;un droit de retractation de 14 jours.
                Conformement a l&apos;Art. L215-1, toute modification tarifaire fait l&apos;objet d&apos;une notification prealable de 30 jours minimum.
                Les factures sont conformes aux mentions obligatoires du CGI Art. 289.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
                <Link href="/legal/cgv" className="underline hover:text-slate-300 transition-colors">CGV</Link>
                <Link href="/legal/cgu" className="underline hover:text-slate-300 transition-colors">CGU</Link>
                <Link href="/legal/privacy" className="underline hover:text-slate-300 transition-colors">Politique de confidentialite</Link>
                <Link href="/legal/cookies" className="underline hover:text-slate-300 transition-colors">Cookies</Link>
                <span className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-700 text-slate-400 hover:text-white"
                  onClick={handleExportData}
                >
                  <DatabaseBackup className="w-3 h-3 mr-1" aria-hidden="true" />
                  Exporter mes donnees (Art. 20 RGPD)
                </Button>
              </div>
            </div>
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
    </TooltipProvider>
  );
}
