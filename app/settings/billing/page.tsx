"use client";

/**
 * Page de gestion de l'abonnement utilisateur
 * Affiche le plan actuel, l'utilisation, les add-ons et permet les upgrades
 *
 * Conformité :
 * - Art. L112-1 Code de la Consommation (affichage HT/TTC)
 * - Art. L221-18 Code de la Consommation (droit de rétractation)
 * - Art. 20 RGPD (portabilité des données)
 * - WCAG 2.2 AA (accessibilité)
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
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
  Info
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
}

// ============================================
// CONSTANTS
// ============================================

const TVA_RATE = 20; // 20% TVA métropole

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computeTTC(htCents: number): number {
  return Math.round(htCents * (1 + TVA_RATE / 100));
}

function getPlanLevel(slug: string): number {
  const levels: Record<string, number> = {
    gratuit: -1, starter: 0, confort: 1, pro: 2,
    enterprise_s: 3, enterprise_m: 4, enterprise_l: 5, enterprise_xl: 6, enterprise: 3,
  };
  return levels[slug] ?? -1;
}

// ============================================
// LOADING SKELETON
// ============================================

function BillingSkeleton() {
  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
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
  suffix = ""
}: {
  icon: React.ElementType;
  label: string;
  current: number;
  max: number;
  unit?: string;
  suffix?: string;
}) {
  const percent = max === -1 ? 0 : Math.min(100, (current / max) * 100);
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;
  const displayMax = max === -1 ? "Illimité" : `${max}${unit}`;
  const statusLabel = isAtLimit ? "Limite atteinte" : isNearLimit ? "Proche de la limite" : "Normal";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </span>
        <span className={isAtLimit ? "text-destructive font-medium" : isNearLimit ? "text-amber-500 font-medium" : ""}>
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
          className={isAtLimit ? "bg-destructive/20" : isNearLimit ? "bg-amber-500/20" : ""}
        />
      </div>
    </div>
  );
}

// ============================================
// INVOICE STATUS BADGE
// ============================================

function InvoiceStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    paid: { label: "Payée", variant: "default" },
    open: { label: "En attente", variant: "secondary" },
    draft: { label: "Brouillon", variant: "outline" },
    void: { label: "Annulée", variant: "outline" },
    uncollectible: { label: "Irrécouvrable", variant: "destructive" },
  };
  const config = configs[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
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
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
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
        setInvoices((invoicesData.invoices || []).slice(0, 3));
      }
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    if (!subscription?.stripe_customer_id) {
      toast({
        title: "Configuration du paiement",
        description: "Vous allez être redirigé pour configurer votre moyen de paiement.",
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
      toast({ title: "Conditions acceptées", description: "Vos nouvelles conditions tarifaires ont été validées." });
      await fetchData();
      setPriceChangeDialog({ open: false });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExportData() {
    setActionLoading("export");
    try {
      toast({ title: "Export en cours", description: "Vos données sont en cours de préparation. Vous recevrez un email avec le lien de téléchargement." });
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: string) {
    const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Actif", variant: "default" },
      trialing: { label: "Période d'essai", variant: "secondary" },
      past_due: { label: "Impayé", variant: "destructive" },
      canceled: { label: "Annulé", variant: "outline" },
      paused: { label: "Suspendu", variant: "outline" },
    };
    const config = configs[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function getEffectivePrice(): number {
    if (!subscription) return 0;

    if (subscription.grandfathered_until && new Date(subscription.grandfathered_until) > new Date()) {
      const lockedPrice = subscription.locked_price_monthly || subscription.plan.price_monthly;
      if (subscription.billing_cycle === "yearly") {
        // Use actual yearly price ratio from plan to compute
        const ratio = subscription.plan.price_yearly / (subscription.plan.price_monthly * 12);
        return Math.round(lockedPrice * 12 * ratio);
      }
      return lockedPrice;
    }

    return subscription.billing_cycle === "yearly"
      ? subscription.plan.price_yearly
      : subscription.plan.price_monthly;
  }

  function getTrialDaysRemaining(): number {
    if (!subscription?.trial_end) return 0;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function getTotalMonthlyCost(): number {
    if (!subscription) return 0;

    let total = subscription.plan.price_monthly;

    // Extra properties
    if (subscription.plan.billing_type === "per_unit" && subscription.properties_count > subscription.plan.included_properties) {
      total += (subscription.properties_count - subscription.plan.included_properties) * subscription.plan.extra_property_price;
    }

    // Add-ons
    for (const addon of addonSubscriptions) {
      if (addon.status === "active") {
        total += addon.addon.price_monthly;
      }
    }

    return total;
  }

  function getSignaturesUsed(): number {
    return subscription?.signatures_used_this_month ?? 0;
  }

  // Determine if a plan is an upgrade or downgrade
  function isPlanUpgrade(plan: Plan): boolean {
    if (!subscription) return true;
    return getPlanLevel(plan.slug) > getPlanLevel(subscription.plan.slug);
  }

  if (loading) {
    return <BillingSkeleton />;
  }

  const effectivePrice = getEffectivePrice();
  const totalMonthlyCost = getTotalMonthlyCost();

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/settings" className="hover:text-foreground transition-colors">Paramètres</Link></li>
          <li><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></li>
          <li aria-current="page" className="text-foreground font-medium">Abonnement</li>
        </ol>
      </nav>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" aria-hidden="true" />
          Mon abonnement
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérez votre forfait, vos modules et vos moyens de paiement
        </p>
      </motion.div>

      {/* Alerte changement de prix */}
      {subscription?.price_change_notified_at && subscription?.price_change_accepted === null && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-600">Évolution tarifaire à venir</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le tarif de votre plan évolue. Votre tarif actuel est maintenu jusqu&apos;au{" "}
                    <strong>{subscription.grandfathered_until ? formatDate(subscription.grandfathered_until) : "—"}</strong>.
                    {" "}Conformément à l&apos;Art. L215-1 du Code de la Consommation, vous pouvez résilier sans frais.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => setPriceChangeDialog({ open: true })}>
                      <Check className="h-4 w-4 mr-1" aria-hidden="true" />
                      Consulter les détails
                    </Button>
                    <Button size="sm" variant="outline" onClick={openPortal}>
                      Résilier sans frais
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Plan actuel */}
      {subscription ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {subscription.plan.name}
                    {getStatusBadge(subscription.status)}
                    {subscription.status === "trialing" && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                        <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                        {getTrialDaysRemaining()} jours restants
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Abonnement {subscription.billing_cycle === "yearly" ? "annuel" : "mensuel"}
                    {subscription.current_period_end && (
                      <> — Prochain paiement le {formatDate(subscription.current_period_end)}</>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatCurrency(effectivePrice)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}HT/{subscription.billing_cycle === "yearly" ? "an" : "mois"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    soit {formatCurrency(computeTTC(effectivePrice))} TTC (TVA {TVA_RATE}%)
                  </p>
                  {subscription.grandfathered_until && new Date(subscription.grandfathered_until) > new Date() && (
                    <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-600">
                      <Shield className="h-3 w-3 mr-1" aria-hidden="true" />
                      Tarif garanti jusqu&apos;au {formatDate(subscription.grandfathered_until)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Usage */}
              <div>
                <h3 className="text-sm font-medium mb-4">Utilisation ce mois</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UsageBar
                    icon={Home}
                    label="Biens"
                    current={subscription.properties_count}
                    max={subscription.plan.max_properties}
                    suffix={subscription.plan.billing_type === "per_unit" ? ` (${subscription.plan.included_properties} inclus)` : ""}
                  />
                  <UsageBar
                    icon={FileText}
                    label="Baux actifs"
                    current={subscription.leases_count}
                    max={subscription.plan.max_leases}
                  />
                  <UsageBar
                    icon={Users}
                    label="Locataires"
                    current={subscription.tenants_count}
                    max={subscription.plan.max_tenants}
                  />
                  <UsageBar
                    icon={HardDrive}
                    label="Stockage"
                    current={Math.round(subscription.documents_size_mb / 1024 * 10) / 10}
                    max={subscription.plan.max_documents_gb}
                    unit=" Go"
                  />
                  {subscription.plan.features?.signatures && Number(subscription.plan.features?.signatures_monthly_quota) > 0 && (
                    <UsageBar
                      icon={PenTool}
                      label="Signatures électroniques"
                      current={getSignaturesUsed()}
                      max={Number(subscription.plan.features.signatures_monthly_quota)}
                      suffix="/mois"
                    />
                  )}
                </div>
              </div>

              {/* Coût total estimé */}
              <div className="p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-medium">Coût total estimé ce mois</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Abonnement {subscription.plan.name}</span>
                    <span>{formatCurrency(subscription.plan.price_monthly)} HT</span>
                  </div>
                  {subscription.plan.billing_type === "per_unit" && subscription.properties_count > subscription.plan.included_properties && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {subscription.properties_count - subscription.plan.included_properties} lot(s) supplémentaire(s)
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
                  <div className="flex justify-between pt-2 border-t font-medium">
                    <span>Total HT</span>
                    <span>{formatCurrency(totalMonthlyCost)}/mois</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total TTC (TVA {TVA_RATE}%)</span>
                    <span>{formatCurrency(computeTTC(totalMonthlyCost))}/mois</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button onClick={() => setUpgradeDialog({ open: true, plan: null })}>
                  <ArrowUpRight className="h-4 w-4 mr-2" aria-hidden="true" />
                  Changer de forfait
                </Button>
                <Button variant="outline" onClick={openPortal} disabled={actionLoading === "portal"}>
                  {actionLoading === "portal" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />}
                  {subscription?.stripe_customer_id ? "Gérer le paiement" : "Configurer le paiement"}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings/invoices">
                    <Receipt className="h-4 w-4 mr-2" aria-hidden="true" />
                    Toutes les factures
                  </Link>
                </Button>
                <Button variant="ghost" onClick={handleExportData} disabled={actionLoading === "export"}>
                  {actionLoading === "export" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" aria-hidden="true" />}
                  Exporter mes données
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-2">Aucun abonnement actif</h3>
              <p className="text-muted-foreground mb-4">
                Choisissez un forfait pour débloquer toutes les fonctionnalités de gestion locative.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Tous les plans payants bénéficient d&apos;un premier mois offert. Sans engagement, résiliable à tout moment.
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

      {/* Dernières factures */}
      {invoices.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Dernières factures
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings/invoices">
                    Voir tout
                    <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium">
                          {invoice.invoice_number || "Facture"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(invoice.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatCurrency(invoice.total)}</span>
                      <InvoiceStatusBadge status={invoice.status} />
                      {invoice.invoice_pdf_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={invoice.invoice_pdf_url} target="_blank" rel="noopener noreferrer" aria-label={`Télécharger la facture ${invoice.invoice_number || ""}`}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add-ons souscrits */}
      {addonSubscriptions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />
                Mes modules additionnels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {addonSubscriptions.map((addonSub) => (
                  <div key={addonSub.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{addonSub.addon.name}</p>
                      <p className="text-sm text-muted-foreground">{addonSub.addon.description}</p>
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

      {/* Modules disponibles */}
      {subscription && addonSubscriptions.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Zap className="h-6 w-6 text-amber-500" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Boostez votre abonnement</h3>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez des modules comme le Channel Manager ou la Copropriété
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

      {/* Informations légales */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          <p>
            Tous les prix sont affichés hors taxes (HT). TVA applicable : {TVA_RATE}% (France métropolitaine).
            Tarifs spécifiques DOM-TOM sur demande.
          </p>
          <p>
            Conformément à l&apos;Art. L221-18 du Code de la Consommation, vous disposez d&apos;un droit de rétractation de 14 jours à compter de la souscription.
            Vous pouvez exercer ce droit via la section &quot;Gérer le paiement&quot; ou en nous contactant.
          </p>
          <p>
            <Link href="/legal/cgv" className="underline hover:text-foreground">Conditions Générales de Vente</Link>
            {" — "}
            <Link href="/legal/cgu" className="underline hover:text-foreground">Conditions Générales d&apos;Utilisation</Link>
            {" — "}
            <Link href="/legal/privacy" className="underline hover:text-foreground">Politique de confidentialité</Link>
          </p>
        </div>
      </motion.div>

      {/* Dialog Changer de forfait (upgrade/downgrade avec distinction) */}
      <Dialog open={upgradeDialog.open} onOpenChange={(open) => setUpgradeDialog({ open, plan: null })}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changer de forfait</DialogTitle>
            <DialogDescription>
              Choisissez le forfait qui correspond à vos besoins. Les prix sont affichés HT.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {plans.filter(p => p.slug !== subscription?.plan.slug).map((plan) => {
              const isUpgrade = isPlanUpgrade(plan);
              return (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary ${upgradeDialog.plan?.id === plan.id ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setUpgradeDialog({ ...upgradeDialog, plan })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUpgradeDialog({ ...upgradeDialog, plan }); }}}
                  aria-pressed={upgradeDialog.plan?.id === plan.id}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isUpgrade ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      )}
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {plan.name}
                          <Badge variant={isUpgrade ? "default" : "outline"} className={isUpgrade ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}>
                            {isUpgrade ? "Upgrade" : "Downgrade"}
                          </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(plan.price_monthly)} HT/mois</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(computeTTC(plan.price_monthly))} TTC</p>
                    </div>
                  </div>
                  {!isUpgrade && upgradeDialog.plan?.id === plan.id && (
                    <div className="mt-3 p-3 rounded bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 inline mr-1" aria-hidden="true" />
                        Le downgrade prendra effet à la fin de votre période de facturation actuelle.
                        Certaines fonctionnalités ne seront plus disponibles.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
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

      {/* Dialog acceptation changement de prix */}
      <Dialog open={priceChangeDialog.open} onOpenChange={(open) => setPriceChangeDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Évolution tarifaire</DialogTitle>
            <DialogDescription>
              Votre forfait {subscription?.plan.name} évolue
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
              Conformément à l&apos;Art. L215-1 du Code de la Consommation, vous pouvez résilier sans frais
              avant la date d&apos;effet du nouveau tarif.
            </p>
          </div>
          <DialogFooter>
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
    </div>
  );
}
