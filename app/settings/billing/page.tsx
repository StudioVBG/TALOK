"use client";

/**
 * Page de gestion de l'abonnement utilisateur — SOTA 2026
 * Affiche le plan actuel, l'utilisation, les add-ons et permet les upgrades
 *
 * Conformité :
 * - Art. L112-1 Code de la Consommation (affichage HT/TTC)
 * - Art. L221-18 Code de la Consommation (droit de rétractation 14 jours)
 * - Art. L215-1 Code de la Consommation (résiliation / changement tarifaire)
 * - Art. 20 RGPD (portabilité des données)
 * - WCAG 2.2 AA (accessibilité)
 * - Directive DSP2 / PSD2 (3D Secure)
 * - CGI Art. 289 (mentions obligatoires factures)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Home,
  FileText,
  Users,
  HardDrive,
  PenTool,
  Zap,
  AlertTriangle,
  Check,
  ExternalLink,
  Plus,
  Receipt,
  Clock,
  Shield,
  Download,
  ChevronRight,
  Info,
  Building2,
  TrendingUp,
  Landmark,
  Mail,
  MessageSquare,
  ArrowLeftRight,
  Code,
  Wrench,
  UserPlus,
  Brain,
  ClipboardCheck,
  Pause,
  X,
  HelpCircle,
  Calendar,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface SubscriptionPlan {
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  max_properties: number;
  max_leases: number;
  max_tenants: number;
  max_documents_gb: number;
  included_properties: number;
  extra_property_price: number;
  billing_type: string;
  features: Record<string, boolean | string | number>;
}

interface Subscription {
  id: string;
  plan_id: string;
  plan: SubscriptionPlan;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_start: string;
  trial_end: string;
  cancel_at_period_end: boolean;
  properties_count: number;
  leases_count: number;
  tenants_count: number;
  documents_size_mb: number;
  signatures_used_this_month?: number;
  grandfathered_until: string | null;
  locked_price_monthly: number | null;
  price_change_notified_at: string | null;
  price_change_accepted: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface AddonSubscription {
  id: string;
  addon_id: string;
  addon: {
    name: string;
    slug: string;
    price_monthly: number;
    description: string;
  };
  status: string;
  started_at: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_properties: number;
  features: Record<string, boolean | string | number>;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  total: number;
  status: string;
  created_at: string;
  invoice_pdf_url: string | null;
  hosted_invoice_url: string | null;
  period_start?: string | null;
  period_end?: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const TVA_RATE = 20; // 20% TVA métropole
const TVA_RATE_MARTINIQUE = 8.5;
const TVA_RATE_GUADELOUPE = 8.5;
const TVA_RATE_REUNION = 8.5;
const TVA_RATE_GUYANE = 0;
const TVA_RATE_MAYOTTE = 0;

const USAGE_WARNING_THRESHOLD = 80;
const USAGE_CRITICAL_THRESHOLD = 95;
const USAGE_LIMIT_THRESHOLD = 100;

// Feature icon mapping
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

const FEATURE_LABELS_FR: Record<string, string> = {
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

const FEATURE_GROUPS_DISPLAY = [
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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function computeTTC(htCents: number, tvaRate: number = TVA_RATE): number {
  return Math.round(htCents * (1 + tvaRate / 100));
}

function getPlanLevel(slug: string): number {
  const levels: Record<string, number> = {
    gratuit: -1, starter: 0, confort: 1, pro: 2,
    enterprise_s: 3, enterprise_m: 4, enterprise_l: 5, enterprise_xl: 6, enterprise: 3,
  };
  return levels[slug] ?? -1;
}

function getDaysUntil(date: string): number {
  const target = new Date(date);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function getUsageLevel(percent: number): "normal" | "warning" | "critical" | "limit" {
  if (percent >= USAGE_LIMIT_THRESHOLD) return "limit";
  if (percent >= USAGE_CRITICAL_THRESHOLD) return "critical";
  if (percent >= USAGE_WARNING_THRESHOLD) return "warning";
  return "normal";
}

// ============================================
// LOADING SKELETON
// ============================================

function BillingSkeleton() {
  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl px-4 sm:px-6">
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// USAGE BAR COMPONENT (WCAG 2.2 AA compliant)
// ============================================

function UsageBar({
  icon: Icon,
  label,
  current,
  max,
  unit = "",
  suffix = "",
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  current: number;
  max: number;
  unit?: string;
  suffix?: string;
  tooltip?: string;
}) {
  const percent = max === -1 ? 0 : Math.min(100, (current / max) * 100);
  const level = getUsageLevel(percent);
  const displayMax = max === -1 ? "Illimite" : `${max}${unit}`;
  const statusLabel = level === "limit"
    ? "Limite atteinte"
    : level === "critical"
      ? "Limite presque atteinte"
      : level === "warning"
        ? "Proche de la limite"
        : "Normal";

  const colorClasses = {
    normal: "",
    warning: "text-amber-500 font-medium",
    critical: "text-orange-500 font-semibold",
    limit: "text-destructive font-semibold",
  };

  const progressClasses = {
    normal: "",
    warning: "bg-amber-500/20 [&>div]:bg-amber-500",
    critical: "bg-orange-500/20 [&>div]:bg-orange-500",
    limit: "bg-destructive/20 [&>div]:bg-destructive",
  };

  const content = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{label}</span>
          {tooltip && (
            <HelpCircle className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
          )}
        </span>
        <span className={colorClasses[level]}>
          {current}{unit} / {displayMax}{suffix}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} : ${current}${unit} sur ${displayMax}${suffix}`}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max === -1 ? undefined : max}
        aria-valuetext={`${current}${unit} sur ${displayMax}${suffix} — ${statusLabel}`}
      >
        <Progress
          value={percent}
          className={`h-2.5 rounded-full transition-all ${progressClasses[level]}`}
        />
      </div>
      {level !== "normal" && level !== "warning" && (
        <p className={`text-xs ${level === "limit" ? "text-destructive" : "text-orange-500"}`}>
          {level === "limit"
            ? "Limite atteinte — passez au forfait superieur"
            : `${Math.round(percent)}% utilise — limite bientot atteinte`}
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
  usageItems,
}: {
  usageItems: { label: string; percent: number; level: string }[];
}) {
  const criticalItems = usageItems.filter((u) => u.level === "limit" || u.level === "critical");
  if (criticalItems.length === 0) return null;

  const hasLimit = criticalItems.some((u) => u.level === "limit");

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`border-2 ${hasLimit ? "border-destructive/50 bg-destructive/5" : "border-orange-500/50 bg-orange-500/5"}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              className={`h-5 w-5 flex-shrink-0 mt-0.5 ${hasLimit ? "text-destructive" : "text-orange-500"}`}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className={`font-semibold text-sm ${hasLimit ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}>
                {hasLimit ? "Limites atteintes" : "Limites bientot atteintes"}
              </p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                {criticalItems.map((item) => (
                  <li key={item.label}>
                    {item.label} : {Math.round(item.percent)}%
                    {item.level === "limit" && " — Limite atteinte"}
                  </li>
                ))}
              </ul>
              <Button size="sm" className="mt-3" asChild>
                <Link href="/pricing">
                  <ArrowUpRight className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  Voir les forfaits superieurs
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// INVOICE STATUS BADGE
// ============================================

function InvoiceStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
    paid: { label: "Payee", variant: "default", icon: CheckCircle2 },
    open: { label: "En attente", variant: "secondary", icon: Clock },
    draft: { label: "Brouillon", variant: "outline", icon: FileText },
    void: { label: "Annulee", variant: "outline", icon: X },
    uncollectible: { label: "Irrecouvrable", variant: "destructive", icon: AlertTriangle },
  };
  const config = configs[status] || { label: status, variant: "outline" as const, icon: Info };
  const StatusIcon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <StatusIcon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

// ============================================
// PLAN FEATURES DISPLAY
// ============================================

function PlanFeaturesSection({ features }: { features: Record<string, boolean | string | number> }) {
  const enabledGroups = FEATURE_GROUPS_DISPLAY
    .map((group) => ({
      ...group,
      enabledFeatures: group.features.filter((f) => {
        const val = features[f];
        return val === true || (typeof val === "string" && val !== "none" && val !== "false");
      }),
    }))
    .filter((group) => group.enabledFeatures.length > 0);

  if (enabledGroups.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        Fonctionnalites incluses dans votre forfait
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {enabledGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.title}</p>
            <ul className="space-y-1.5">
              {group.enabledFeatures.map((featureKey) => {
                const FeatureIcon = FEATURE_ICONS[featureKey] || Check;
                const label = FEATURE_LABELS_FR[featureKey] || featureKey;
                const value = features[featureKey];
                const detail = typeof value === "string" && value !== "true" ? ` (${value})` : "";

                return (
                  <li key={featureKey} className="flex items-center gap-2 text-sm">
                    <FeatureIcon className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                    <span className="text-foreground">{label}{detail}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {features.signatures_monthly_quota && Number(features.signatures_monthly_quota) > 0 && (
        <p className="text-xs text-muted-foreground">
          {Number(features.signatures_monthly_quota) === -1
            ? "Signatures electroniques illimitees incluses"
            : `${features.signatures_monthly_quota} signature(s) electronique(s) incluse(s) par mois`}
          {features.signature_price && Number(features.signature_price) > 0 && (
            <>, puis {formatCurrency(Number(features.signature_price))} par signature supplementaire</>
          )}
        </p>
      )}
    </div>
  );
}

// ============================================
// BILLING CYCLE TOGGLE
// ============================================

function BillingCycleToggle({
  currentCycle,
  monthlyPrice,
  yearlyPrice,
  onSwitch,
  isLoading,
}: {
  currentCycle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  onSwitch: (cycle: "monthly" | "yearly") => void;
  isLoading: boolean;
}) {
  const isYearly = currentCycle === "yearly";
  const monthlyEquivalent = Math.round(yearlyPrice / 12);
  const savingsPercent = monthlyPrice > 0 ? Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100) : 0;
  const yearlySavings = monthlyPrice * 12 - yearlyPrice;

  if (monthlyPrice <= 0 || yearlyPrice <= 0) return null;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Cycle de facturation</p>
          <p className="text-xs text-muted-foreground">
            {isYearly
              ? `Annuel — ${formatCurrency(monthlyEquivalent)} HT/mois`
              : `Mensuel — ${formatCurrency(monthlyPrice)} HT/mois`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm ${!isYearly ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          Mensuel
        </span>
        <Switch
          checked={isYearly}
          onCheckedChange={(checked) => onSwitch(checked ? "yearly" : "monthly")}
          disabled={isLoading}
          aria-label="Basculer entre facturation mensuelle et annuelle"
        />
        <span className={`text-sm ${isYearly ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          Annuel
        </span>
        {savingsPercent > 0 && (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
            -{savingsPercent}%
          </Badge>
        )}
      </div>
      {!isYearly && yearlySavings > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-green-600 dark:text-green-400 hidden lg:block">
              Economisez {formatCurrency(yearlySavings)} HT/an en passant au cycle annuel
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>Soit {formatCurrency(monthlyEquivalent)} HT/mois au lieu de {formatCurrency(monthlyPrice)}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ============================================
// CANCELLATION DIALOG
// ============================================

function CancellationDialog({
  open,
  onOpenChange,
  subscription,
  onConfirmCancel,
  onPause,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  onConfirmCancel: () => void;
  onPause: () => void;
  isLoading: boolean;
}) {
  const [step, setStep] = useState<"reason" | "retention" | "confirm">("reason");
  const [reason, setReason] = useState("");

  const reasons = [
    { value: "too_expensive", label: "Trop cher pour mon usage" },
    { value: "missing_features", label: "Il manque des fonctionnalites" },
    { value: "switching", label: "Je change de logiciel" },
    { value: "not_using", label: "Je n'utilise plus le service" },
    { value: "temporary", label: "Besoin temporaire termine" },
    { value: "other", label: "Autre raison" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "reason" && "Pourquoi souhaitez-vous resilier ?"}
            {step === "retention" && "Avant de partir..."}
            {step === "confirm" && "Confirmer la resiliation"}
          </DialogTitle>
          <DialogDescription>
            {step === "reason" && "Votre retour nous aide a ameliorer Talok."}
            {step === "retention" && "Nous avons peut-etre une solution pour vous."}
            {step === "confirm" && "Cette action prendra effet a la fin de votre periode de facturation."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "reason" && (
            <motion.div
              key="reason"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-2"
            >
              {reasons.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setReason(r.value); setStep("retention"); }}
                  className={`w-full text-left p-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5 ${reason === r.value ? "border-primary bg-primary/5" : ""}`}
                >
                  <span className="text-sm">{r.label}</span>
                </button>
              ))}
            </motion.div>
          )}

          {step === "retention" && (
            <motion.div
              key="retention"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-4"
            >
              {(reason === "too_expensive" || reason === "not_using" || reason === "temporary") && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Pause className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-sm">Mettez votre abonnement en pause</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Suspendez votre abonnement pendant 1 a 3 mois sans perdre vos donnees.
                          Vous retrouverez tout a votre retour.
                        </p>
                        <Button size="sm" variant="outline" className="mt-3" onClick={onPause} disabled={isLoading}>
                          <Pause className="h-4 w-4 mr-1.5" aria-hidden="true" />
                          Mettre en pause
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {reason === "too_expensive" && (
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <ArrowDownRight className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-sm">Passez a un forfait moins cher</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Reduisez vos couts en changeant de forfait plutot qu&apos;en resiliant.
                        </p>
                        <Button size="sm" variant="outline" className="mt-3" asChild>
                          <Link href="/pricing">Voir les forfaits</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {reason === "missing_features" && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-sm">Dites-nous ce qui vous manque</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Notre equipe produit priorise les demandes utilisateurs. Votre retour peut impacter notre roadmap.
                        </p>
                        <Button size="sm" variant="outline" className="mt-3" asChild>
                          <a href="mailto:support@talok.fr?subject=Feature%20request">
                            Contacter le support
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="pt-2">
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setStep("confirm")}>
                  Je souhaite quand meme resilier
                </Button>
              </div>
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-4"
            >
              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">Consequences de la resiliation :</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <X className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-hidden="true" />
                    Acces aux fonctionnalites premium supprime a la fin de la periode
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-hidden="true" />
                    Retour au forfait Gratuit (1 bien maximum)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" aria-hidden="true" />
                    Vos donnees sont conservees 90 jours
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" aria-hidden="true" />
                    Export de vos donnees disponible (Art. 20 RGPD)
                  </li>
                </ul>
              </div>
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  Votre abonnement restera actif jusqu&apos;au <strong>{formatDate(subscription.current_period_end)}</strong>.
                  Aucun remboursement au prorata n&apos;est effectue (Art. L221-28 Code de la Consommation).
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="gap-2">
          {step === "reason" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          )}
          {step === "retention" && (
            <Button variant="outline" onClick={() => setStep("reason")}>Retour</Button>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => { setStep("reason"); onOpenChange(false); }}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={onConfirmCancel} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" aria-hidden="true" />}
                Confirmer la resiliation
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [addonSubscriptions, setAddonSubscriptions] = useState<AddonSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [upgradeDialog, setUpgradeDialog] = useState({ open: false, plan: null as Plan | null });
  const [priceChangeDialog, setPriceChangeDialog] = useState({ open: false });
  const [cancelDialog, setCancelDialog] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, invoicesRes] = await Promise.all([
        fetch("/api/subscriptions/current"),
        fetch("/api/subscriptions/plans"),
        fetch("/api/subscriptions/invoices").catch(() => null),
      ]);

      const subData = await subRes.json();
      const plansData = await plansRes.json();

      if (subData.subscription) {
        setSubscription(subData.subscription);
        setAddonSubscriptions(subData.addon_subscriptions || []);
      }
      setPlans(plansData.plans || []);

      if (invoicesRes && invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices((invoicesData.invoices || []).slice(0, 5));
      }
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // ACTION HANDLERS
  // ============================================

  async function openPortal() {
    if (!subscription?.stripe_customer_id) {
      toast({
        title: "Configuration du paiement",
        description: "Vous allez etre redirige pour configurer votre moyen de paiement.",
      });
      setActionLoading("portal");
      try {
        const res = await fetch("/api/subscriptions/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_slug: subscription?.plan.slug || "starter",
            billing_cycle: subscription?.billing_cycle || "monthly",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.location.href = data.url;
      } catch (error: unknown) {
        toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
      } finally {
        setActionLoading(null);
      }
      return;
    }

    setActionLoading("portal");
    try {
      const res = await fetch("/api/subscriptions/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function acceptPriceChange() {
    setActionLoading("accept-price");
    try {
      const res = await fetch("/api/subscriptions/accept-price-change", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Conditions acceptees", description: "Vos nouvelles conditions tarifaires ont ete validees." });
      await fetchData();
      setPriceChangeDialog({ open: false });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelSubscription() {
    setActionLoading("cancel");
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: "Resiliation programmee",
        description: `Votre abonnement restera actif jusqu'au ${subscription?.current_period_end ? formatDate(subscription.current_period_end) : "—"}.`,
      });
      setCancelDialog(false);
      await fetchData();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePauseSubscription() {
    toast({
      title: "Mise en pause",
      description: "La mise en pause de l'abonnement sera bientot disponible. Contactez le support pour une solution immediate.",
    });
  }

  async function handleExportData() {
    setActionLoading("export");
    try {
      toast({
        title: "Export en cours",
        description: "Vos donnees sont en cours de preparation. Vous recevrez un email avec le lien de telechargement.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate() {
    setActionLoading("reactivate");
    try {
      const res = await fetch("/api/subscriptions/reactivate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Abonnement reactive", description: "Votre abonnement a ete reactive avec succes." });
      await fetchData();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSwitchBillingCycle(cycle: "monthly" | "yearly") {
    setActionLoading("switch-cycle");
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_slug: subscription?.plan.slug,
          billing_cycle: cycle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  // ============================================
  // COMPUTED VALUES
  // ============================================

  function getStatusBadge(status: string) {
    const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Actif", variant: "default" },
      trialing: { label: "Periode d'essai", variant: "secondary" },
      past_due: { label: "Impaye", variant: "destructive" },
      canceled: { label: "Annule", variant: "outline" },
      paused: { label: "Suspendu", variant: "outline" },
    };
    const config = configs[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  const effectivePrice = useMemo(() => {
    if (!subscription) return 0;

    if (subscription.grandfathered_until && new Date(subscription.grandfathered_until) > new Date()) {
      const lockedPrice = subscription.locked_price_monthly || subscription.plan.price_monthly;
      if (subscription.billing_cycle === "yearly") {
        const ratio = subscription.plan.price_yearly / (subscription.plan.price_monthly * 12);
        return Math.round(lockedPrice * 12 * ratio);
      }
      return lockedPrice;
    }

    return subscription.billing_cycle === "yearly"
      ? subscription.plan.price_yearly
      : subscription.plan.price_monthly;
  }, [subscription]);

  const trialDaysRemaining = useMemo(() => {
    if (!subscription?.trial_end) return 0;
    return getDaysUntil(subscription.trial_end);
  }, [subscription]);

  const totalMonthlyCost = useMemo(() => {
    if (!subscription) return 0;

    let total = subscription.plan.price_monthly;

    if (subscription.plan.billing_type === "per_unit" && subscription.properties_count > subscription.plan.included_properties) {
      total += (subscription.properties_count - subscription.plan.included_properties) * subscription.plan.extra_property_price;
    }

    for (const addon of addonSubscriptions) {
      if (addon.status === "active") {
        total += addon.addon.price_monthly;
      }
    }

    return total;
  }, [subscription, addonSubscriptions]);

  const signaturesUsed = subscription?.signatures_used_this_month ?? 0;

  // Usage items for alert banner
  const usageItems = useMemo(() => {
    if (!subscription) return [];
    const items: { label: string; percent: number; level: string }[] = [];

    const addItem = (label: string, current: number, max: number) => {
      if (max === -1) return;
      const percent = Math.min(100, (current / max) * 100);
      items.push({ label, percent, level: getUsageLevel(percent) });
    };

    addItem("Biens", subscription.properties_count, subscription.plan.max_properties);
    addItem("Baux actifs", subscription.leases_count, subscription.plan.max_leases);
    addItem("Locataires", subscription.tenants_count, subscription.plan.max_tenants);
    addItem("Stockage", Math.round(subscription.documents_size_mb / 1024 * 10) / 10, subscription.plan.max_documents_gb);
    if (subscription.plan.features?.signatures && Number(subscription.plan.features?.signatures_monthly_quota) > 0) {
      addItem("Signatures", signaturesUsed, Number(subscription.plan.features.signatures_monthly_quota));
    }

    return items;
  }, [subscription, signaturesUsed]);

  function isPlanUpgrade(plan: Plan): boolean {
    if (!subscription) return true;
    return getPlanLevel(plan.slug) > getPlanLevel(subscription.plan.slug);
  }

  const nextPaymentDays = subscription?.current_period_end
    ? getDaysUntil(subscription.current_period_end)
    : null;

  if (loading) {
    return (
      <TooltipProvider>
        <BillingSkeleton />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 sm:py-8 space-y-6 max-w-4xl px-4 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5">
            <li><Link href="/settings" className="hover:text-foreground transition-colors">Parametres</Link></li>
            <li><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></li>
            <li aria-current="page" className="text-foreground font-medium">Facturation & Abonnement</li>
          </ol>
        </nav>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-primary" aria-hidden="true" />
            Facturation & Abonnement
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerez votre forfait, vos modules, vos factures et vos moyens de paiement
          </p>
        </motion.div>

        {/* Proactive usage alerts */}
        <UsageAlertBanner usageItems={usageItems} />

        {/* Price change alert */}
        {subscription?.price_change_notified_at && subscription?.price_change_accepted === null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">Evolution tarifaire a venir</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Le tarif de votre plan evolue. Votre tarif actuel est maintenu jusqu&apos;au{" "}
                      <strong>{subscription.grandfathered_until ? formatDate(subscription.grandfathered_until) : "—"}</strong>.
                      {" "}Conformement a l&apos;Art. L215-1 du Code de la Consommation, vous pouvez resilier sans frais.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => setPriceChangeDialog({ open: true })}>
                        <Eye className="h-4 w-4 mr-1.5" aria-hidden="true" />
                        Consulter les details
                      </Button>
                      <Button size="sm" variant="outline" onClick={openPortal}>
                        Resilier sans frais
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Cancellation pending alert */}
        {subscription?.cancel_at_period_end && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-semibold text-destructive">Resiliation programmee</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Votre abonnement sera annule le{" "}
                      <strong>{subscription.current_period_end ? formatDate(subscription.current_period_end) : "—"}</strong>.
                      Vous conservez l&apos;acces a toutes les fonctionnalites jusqu&apos;a cette date.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={handleReactivate}
                      disabled={actionLoading === "reactivate"}
                    >
                      {actionLoading === "reactivate" ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden="true" />
                      )}
                      Reactiver mon abonnement
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Current plan */}
        {subscription ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span className="text-xl">{subscription.plan.name}</span>
                      {getStatusBadge(subscription.status)}
                      {subscription.status === "trialing" && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                          <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                          {trialDaysRemaining}j restants
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1.5 space-y-0.5">
                      <span className="block">
                        Abonnement {subscription.billing_cycle === "yearly" ? "annuel" : "mensuel"}
                      </span>
                      {subscription.current_period_end && (
                        <span className="block">
                          Prochain paiement le{" "}
                          <strong>{formatDate(subscription.current_period_end)}</strong>
                          {nextPaymentDays !== null && nextPaymentDays <= 7 && (
                            <span className="text-amber-600 dark:text-amber-400"> (dans {nextPaymentDays}j)</span>
                          )}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-2xl font-bold">
                      {formatCurrency(effectivePrice)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}HT/{subscription.billing_cycle === "yearly" ? "an" : "mois"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      soit {formatCurrency(computeTTC(effectivePrice))} TTC (TVA {TVA_RATE}%)
                    </p>
                    {subscription.billing_cycle === "yearly" && (
                      <p className="text-xs text-muted-foreground">
                        equivalent a {formatCurrency(Math.round(effectivePrice / 12))} HT/mois
                      </p>
                    )}
                    {subscription.grandfathered_until && new Date(subscription.grandfathered_until) > new Date() && (
                      <Badge variant="outline" className="mt-1.5 bg-green-500/10 text-green-600 border-green-500/30">
                        <Shield className="h-3 w-3 mr-1" aria-hidden="true" />
                        Tarif garanti jusqu&apos;au {formatDate(subscription.grandfathered_until)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Usage meters */}
                <div>
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Utilisation ce mois
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UsageBar
                      icon={Home}
                      label="Biens"
                      current={subscription.properties_count}
                      max={subscription.plan.max_properties}
                      suffix={subscription.plan.billing_type === "per_unit" ? ` (${subscription.plan.included_properties} inclus)` : ""}
                      tooltip="Nombre de biens (lots) geres dans votre compte"
                    />
                    <UsageBar
                      icon={FileText}
                      label="Baux actifs"
                      current={subscription.leases_count}
                      max={subscription.plan.max_leases}
                      tooltip="Nombre de baux en cours (non resilies)"
                    />
                    <UsageBar
                      icon={Users}
                      label="Locataires"
                      current={subscription.tenants_count}
                      max={subscription.plan.max_tenants}
                      tooltip="Nombre de locataires avec un bail actif"
                    />
                    <UsageBar
                      icon={HardDrive}
                      label="Stockage"
                      current={Math.round(subscription.documents_size_mb / 1024 * 10) / 10}
                      max={subscription.plan.max_documents_gb}
                      unit=" Go"
                      tooltip="Espace utilise par vos documents (baux, EDL, photos...)"
                    />
                    {subscription.plan.features?.signatures && Number(subscription.plan.features?.signatures_monthly_quota) > 0 && (
                      <UsageBar
                        icon={PenTool}
                        label="Signatures electroniques"
                        current={signaturesUsed}
                        max={Number(subscription.plan.features.signatures_monthly_quota)}
                        suffix="/mois"
                        tooltip={`${Number(subscription.plan.features.signatures_monthly_quota)} signatures incluses par mois. Au-dela : ${subscription.plan.features.signature_price ? formatCurrency(Number(subscription.plan.features.signature_price)) : "—"} par signature.`}
                      />
                    )}
                  </div>
                </div>

                <Separator />

                {/* Billing cycle toggle */}
                <BillingCycleToggle
                  currentCycle={subscription.billing_cycle}
                  monthlyPrice={subscription.plan.price_monthly}
                  yearlyPrice={subscription.plan.price_yearly}
                  onSwitch={handleSwitchBillingCycle}
                  isLoading={actionLoading === "switch-cycle"}
                />

                {/* Cost breakdown */}
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-sm font-medium">Cout total estime ce mois</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Abonnement {subscription.plan.name}</span>
                      <span>{formatCurrency(subscription.plan.price_monthly)} HT</span>
                    </div>
                    {subscription.plan.billing_type === "per_unit" && subscription.properties_count > subscription.plan.included_properties && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {subscription.properties_count - subscription.plan.included_properties} lot(s) supplementaire(s) x {formatCurrency(subscription.plan.extra_property_price)}
                        </span>
                        <span>+{formatCurrency((subscription.properties_count - subscription.plan.included_properties) * subscription.plan.extra_property_price)} HT</span>
                      </div>
                    )}
                    {addonSubscriptions.filter(a => a.status === "active").map((addon) => (
                      <div key={addon.id} className="flex justify-between">
                        <span className="text-muted-foreground">Module {addon.addon.name}</span>
                        <span>+{formatCurrency(addon.addon.price_monthly)} HT</span>
                      </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-medium">
                      <span>Total HT</span>
                      <span>{formatCurrency(totalMonthlyCost)}/mois</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>TVA {TVA_RATE}% (France metropolitaine)</span>
                      <span>{formatCurrency(computeTTC(totalMonthlyCost) - totalMonthlyCost)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total TTC</span>
                      <span>{formatCurrency(computeTTC(totalMonthlyCost))}/mois</span>
                    </div>
                  </div>
                </div>

                {/* Plan features (collapsible) */}
                <div>
                  <button
                    onClick={() => setShowFeatures(!showFeatures)}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    aria-expanded={showFeatures}
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${showFeatures ? "rotate-90" : ""}`} aria-hidden="true" />
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
                          <PlanFeaturesSection features={subscription.plan.features} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setUpgradeDialog({ open: true, plan: null })}>
                    <ArrowUpRight className="h-4 w-4 mr-2" aria-hidden="true" />
                    Changer de forfait
                  </Button>
                  <Button variant="outline" onClick={openPortal} disabled={actionLoading === "portal"}>
                    {actionLoading === "portal" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />}
                    {subscription?.stripe_customer_id ? "Gerer le paiement" : "Configurer le paiement"}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/pricing">
                      <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
                      Comparer les forfaits
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={handleExportData} disabled={actionLoading === "export"}>
                    {actionLoading === "export" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" aria-hidden="true" />}
                    Exporter mes donnees
                  </Button>
                  {!subscription.cancel_at_period_end && subscription.status !== "canceled" && (
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setCancelDialog(true)}
                    >
                      <X className="h-4 w-4 mr-2" aria-hidden="true" />
                      Resilier
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">Aucun abonnement actif</h3>
                <p className="text-muted-foreground mb-4">
                  Choisissez un forfait pour debloquer toutes les fonctionnalites de gestion locative.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Tous les plans payants beneficient d&apos;un premier mois offert. Sans engagement, resiliable a tout moment.
                </p>
                <Button asChild>
                  <Link href="/pricing">
                    Voir les forfaits
                    <ArrowUpRight className="h-4 w-4 ml-2" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Invoices */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Factures
                </CardTitle>
                {invoices.length > 0 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings/invoices">
                      Voir tout
                      <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
              {invoices.length > 0 && (
                <CardDescription>
                  Vos {invoices.length} dernieres factures d&apos;abonnement
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">
                            {invoice.invoice_number || "Facture en cours"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(invoice.created_at)}
                            {invoice.period_start && invoice.period_end && (
                              <> — Periode : {formatDateShort(invoice.period_start)} au {formatDateShort(invoice.period_end)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{formatCurrency(invoice.total)}</span>
                        <InvoiceStatusBadge status={invoice.status} />
                        <div className="flex gap-1">
                          {invoice.invoice_pdf_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={invoice.invoice_pdf_url} target="_blank" rel="noopener noreferrer" aria-label={`Telecharger la facture PDF ${invoice.invoice_number || ""}`}>
                                    <Download className="h-4 w-4" />
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
                                  <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer" aria-label={`Voir la facture en ligne ${invoice.invoice_number || ""}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir en ligne</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground mb-1">Aucune facture disponible</p>
                  <p className="text-xs text-muted-foreground">
                    {subscription?.status === "trialing"
                      ? "Votre premiere facture sera generee a la fin de votre periode d'essai."
                      : "Vos factures apparaitront ici apres votre premier paiement."}
                  </p>
                  {subscription?.stripe_customer_id && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openPortal}>
                      <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden="true" />
                      Voir sur Stripe
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Active add-ons */}
        {addonSubscriptions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />
                  Mes modules additionnels
                </CardTitle>
                <CardDescription>
                  Modules supplementaires actifs sur votre compte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {addonSubscriptions.map((addonSub) => (
                    <div key={addonSub.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="font-medium">{addonSub.addon.name}</p>
                          <p className="text-sm text-muted-foreground">{addonSub.addon.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Actif depuis le {formatDateShort(addonSub.started_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(addonSub.addon.price_monthly)} HT/mois</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(computeTTC(addonSub.addon.price_monthly))} TTC</p>
                        <Badge variant="outline" className="mt-1">
                          {addonSub.status === "active" ? "Actif" : addonSub.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link href="/pricing#addons">
                    <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Ajouter un module
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Available add-ons promotion */}
        {subscription && addonSubscriptions.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <Zap className="h-6 w-6 text-amber-500" aria-hidden="true" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-semibold">Boostez votre abonnement</h3>
                    <p className="text-sm text-muted-foreground">
                      Ajoutez des modules comme le Channel Manager ou la Copropriete
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/pricing#addons">
                      Explorer les modules
                      <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Legal information */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="bg-muted/20">
            <CardContent className="py-4 px-5">
              <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Informations legales</h3>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>
                  Tous les prix sont affiches hors taxes (HT). TVA applicable : {TVA_RATE}% (France metropolitaine).
                  Taux reduits DOM-TOM : Martinique/Guadeloupe/Reunion {TVA_RATE_MARTINIQUE}%, Guyane/Mayotte {TVA_RATE_GUYANE}%.
                  Le taux applicable est determine automatiquement selon votre adresse de facturation.
                </p>
                <p>
                  Conformement a l&apos;Art. L221-18 du Code de la Consommation, vous disposez d&apos;un droit de retractation de 14 jours a compter de la souscription.
                  Conformement a l&apos;Art. L215-1, toute modification tarifaire fait l&apos;objet d&apos;une notification prealable de 30 jours minimum.
                </p>
                <p>
                  Conformement a l&apos;Art. 20 du RGPD, vous pouvez exercer votre droit a la portabilite des donnees a tout moment via le bouton &quot;Exporter mes donnees&quot;.
                </p>
                <p>
                  Les factures sont generees automatiquement et conformes aux mentions obligatoires du CGI Art. 289.
                  Numerotation sequentielle, mentions du vendeur et de l&apos;acheteur, taux de TVA et montant HT/TTC.
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  <Link href="/legal/cgv" className="underline hover:text-foreground transition-colors">CGV</Link>
                  <Link href="/legal/cgu" className="underline hover:text-foreground transition-colors">CGU</Link>
                  <Link href="/legal/privacy" className="underline hover:text-foreground transition-colors">Politique de confidentialite</Link>
                  <Link href="/legal/cookies" className="underline hover:text-foreground transition-colors">Cookies</Link>
                  <a href="mailto:support@talok.fr" className="underline hover:text-foreground transition-colors">Contact</a>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Dialog: Change plan */}
        <Dialog open={upgradeDialog.open} onOpenChange={(open) => setUpgradeDialog({ open, plan: null })}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Changer de forfait</DialogTitle>
              <DialogDescription>
                Choisissez le forfait qui correspond a vos besoins. Les prix sont affiches HT.
                <Link href="/pricing" className="text-primary hover:underline ml-1">
                  Voir la comparaison complete
                </Link>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {plans.filter(p => p.slug !== subscription?.plan.slug && p.slug !== "gratuit").map((plan) => {
                const isUpgrade = isPlanUpgrade(plan);
                const isSelected = upgradeDialog.plan?.id === plan.id;
                const yearlyEquiv = plan.price_yearly > 0 ? Math.round(plan.price_yearly / 12) : 0;
                const savings = plan.price_monthly > 0 && plan.price_yearly > 0
                  ? Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100)
                  : 0;

                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50 ${isSelected ? "border-primary bg-primary/5" : "border-transparent"}`}
                    onClick={() => setUpgradeDialog({ ...upgradeDialog, plan })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setUpgradeDialog({ ...upgradeDialog, plan }); }}}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isUpgrade ? (
                          <div className="p-1.5 rounded-full bg-green-500/10">
                            <ArrowUpRight className="h-4 w-4 text-green-600" aria-hidden="true" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-full bg-amber-500/10">
                            <ArrowDownRight className="h-4 w-4 text-amber-600" aria-hidden="true" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {plan.name}
                            <Badge
                              variant={isUpgrade ? "default" : "outline"}
                              className={isUpgrade
                                ? "bg-green-500/10 text-green-600 border-green-500/30"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30"}
                            >
                              {isUpgrade ? "Upgrade" : "Downgrade"}
                            </Badge>
                          </h4>
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {plan.max_properties === -1 ? "Biens illimites" : `Jusqu'a ${plan.max_properties} biens`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(plan.price_monthly)} HT/mois</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(computeTTC(plan.price_monthly))} TTC</p>
                        {savings > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                            ou {formatCurrency(yearlyEquiv)}/mois en annuel (-{savings}%)
                          </p>
                        )}
                      </div>
                    </div>
                    {!isUpgrade && isSelected && (
                      <div className="mt-3 p-3 rounded bg-amber-500/10 border border-amber-500/20">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4 inline mr-1" aria-hidden="true" />
                          Le downgrade prendra effet a la fin de votre periode de facturation actuelle.
                          Certaines fonctionnalites ne seront plus disponibles.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setUpgradeDialog({ open: false, plan: null })}>
                Annuler
              </Button>
              <Button
                disabled={!upgradeDialog.plan}
                onClick={() => {
                  window.location.href = `/pricing?upgrade=${upgradeDialog.plan?.slug}`;
                }}
              >
                Continuer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Price change acceptance */}
        <Dialog open={priceChangeDialog.open} onOpenChange={(open) => setPriceChangeDialog({ open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Evolution tarifaire</DialogTitle>
              <DialogDescription>
                Votre forfait {subscription?.plan.name} evolue
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Tarif actuel (maintenu)</span>
                  <span className="font-semibold">{formatCurrency(subscription?.locked_price_monthly || 0)} HT/mois</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nouveau tarif</span>
                  <span className="font-semibold">{formatCurrency(subscription?.plan.price_monthly || 0)} HT/mois</span>
                </div>
                {subscription?.locked_price_monthly && subscription?.plan.price_monthly && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t text-sm">
                    <span className="text-muted-foreground">Difference</span>
                    <span className="text-amber-600 font-medium">
                      +{formatCurrency(subscription.plan.price_monthly - subscription.locked_price_monthly)}/mois
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-700 dark:text-green-400">
                  <Shield className="h-4 w-4 inline mr-1" aria-hidden="true" />
                  Votre tarif actuel est garanti jusqu&apos;au{" "}
                  <strong>{subscription?.grandfathered_until ? formatDate(subscription.grandfathered_until) : "—"}</strong>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                En acceptant, vous confirmez avoir pris connaissance des nouvelles conditions tarifaires.
                Conformement a l&apos;Art. L215-1 du Code de la Consommation, vous pouvez resilier sans frais
                avant la date d&apos;effet du nouveau tarif.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPriceChangeDialog({ open: false })}>
                Plus tard
              </Button>
              <Button onClick={acceptPriceChange} disabled={actionLoading === "accept-price"}>
                {actionLoading === "accept-price" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" aria-hidden="true" />}
                J&apos;accepte les nouvelles conditions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Cancellation flow */}
        <CancellationDialog
          open={cancelDialog}
          onOpenChange={setCancelDialog}
          subscription={subscription}
          onConfirmCancel={handleCancelSubscription}
          onPause={handlePauseSubscription}
          isLoading={actionLoading === "cancel"}
        />
      </div>
    </TooltipProvider>
  );
}
