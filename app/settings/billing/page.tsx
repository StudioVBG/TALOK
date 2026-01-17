"use client";
// @ts-nocheck

/**
 * Page de gestion de l'abonnement utilisateur
 * Affiche le plan actuel, l'utilisation, les add-ons et permet les upgrades
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { 
  CreditCard, 
  Loader2, 
  ArrowUpRight, 
  Calendar,
  Home,
  FileText,
  Users,
  HardDrive,
  Edit,
  Zap,
  AlertTriangle,
  Check,
  ExternalLink,
  Plus,
  Receipt,
  Clock,
  Shield
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

interface Subscription {
  id: string;
  plan_id: string;
  plan: {
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
    features: Record<string, any>;
  };
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
  features: Record<string, any>;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [addonSubscriptions, setAddonSubscriptions] = useState<AddonSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
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
      const [subRes, plansRes] = await Promise.all([
        fetch("/api/subscriptions/current"),
        fetch("/api/subscriptions/plans")
      ]);
      
      const subData = await subRes.json();
      const plansData = await plansRes.json();
      
      if (subData.subscription) {
        setSubscription(subData.subscription);
        setAddonSubscriptions(subData.addon_subscriptions || []);
      }
      setPlans(plansData.plans || []);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    // Si pas de stripe_customer_id, on redirige vers le checkout pour configurer le paiement
    if (!subscription?.stripe_customer_id) {
      toast({ 
        title: "Configuration du paiement", 
        description: "Vous allez être redirigé pour configurer votre moyen de paiement.",
      });
      // Rediriger vers le checkout avec le plan actuel
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
      toast({ title: "✅ Conditions acceptées" });
      await fetchData();
      setPriceChangeDialog({ open: false });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  function getUsagePercent(current: number, max: number) {
    if (max === -1) return 0;
    return Math.min(100, (current / max) * 100);
  }

  function getStatusBadge(status: string) {
    const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Actif", variant: "default" },
      trialing: { label: "Essai", variant: "secondary" },
      past_due: { label: "Impayé", variant: "destructive" },
      canceled: { label: "Annulé", variant: "outline" },
      paused: { label: "Suspendu", variant: "outline" },
    };
    const config = configs[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function getEffectivePrice() {
    if (!subscription) return 0;
    
    // Si grandfathered, utiliser le tarif verrouillé
    if (subscription.grandfathered_until && new Date(subscription.grandfathered_until) > new Date()) {
      return subscription.billing_cycle === "yearly" 
        ? (subscription.locked_price_monthly || subscription.plan.price_monthly) * 12 * 0.83  // ~17% de réduction annuelle
        : subscription.locked_price_monthly || subscription.plan.price_monthly;
    }
    
    return subscription.billing_cycle === "yearly" 
      ? subscription.plan.price_yearly 
      : subscription.plan.price_monthly;
  }

  function getTrialDaysRemaining() {
    if (!subscription?.trial_end) return 0;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          Mon abonnement
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérez votre forfait, vos add-ons et vos moyens de paiement
        </p>
      </motion.div>

      {/* Alerte changement de prix */}
      {subscription?.price_change_notified_at && subscription?.price_change_accepted === null && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-600">Évolution tarifaire à venir</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le tarif de votre plan évolue. Votre tarif actuel est maintenu jusqu'au{" "}
                    <strong>{subscription.grandfathered_until ? formatDate(subscription.grandfathered_until) : "—"}</strong>.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => setPriceChangeDialog({ open: true })}>
                      <Check className="h-4 w-4 mr-1" />
                      Voir et accepter
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
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {getTrialDaysRemaining()} jours restants
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Abonnement {subscription.billing_cycle === "yearly" ? "annuel" : "mensuel"}
                    {subscription.current_period_end && (
                      <> • Prochain paiement le {formatDate(subscription.current_period_end)}</>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatCurrency(getEffectivePrice())}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{subscription.billing_cycle === "yearly" ? "an" : "mois"}
                    </span>
                  </div>
                  {subscription.grandfathered_until && new Date(subscription.grandfathered_until) > new Date() && (
                    <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-600">
                      <Shield className="h-3 w-3 mr-1" />
                      Tarif garanti jusqu'au {formatDate(subscription.grandfathered_until)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Usage */}
              <div>
                <h4 className="text-sm font-medium mb-4">Utilisation ce mois</h4>
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
                    unit="Go"
                  />
                  {subscription.plan.features?.signatures && subscription.plan.features?.signatures_monthly_quota > 0 && (
                    <UsageBar 
                      icon={Edit} 
                      label="Signatures" 
                      current={0}  // TODO: récupérer l'usage réel
                      max={subscription.plan.features.signatures_monthly_quota} 
                      suffix="/mois"
                    />
                  )}
                </div>
              </div>

              {/* Coût supplémentaire lots */}
              {subscription.plan.billing_type === "per_unit" && subscription.properties_count > subscription.plan.included_properties && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Lots supplémentaires</p>
                      <p className="text-xs text-muted-foreground">
                        {subscription.properties_count - subscription.plan.included_properties} lot(s) au-delà des {subscription.plan.included_properties} inclus
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        +{formatCurrency((subscription.properties_count - subscription.plan.included_properties) * subscription.plan.extra_property_price)}
                        <span className="text-sm font-normal text-muted-foreground">/mois</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button onClick={() => setUpgradeDialog({ open: true, plan: null })}>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Changer de forfait
                </Button>
                <Button variant="outline" onClick={openPortal} disabled={actionLoading === "portal"}>
                  {actionLoading === "portal" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  {subscription?.stripe_customer_id ? "Gérer le paiement" : "Configurer le paiement"}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings/invoices">
                    <Receipt className="h-4 w-4 mr-2" />
                    Mes factures
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun abonnement actif</h3>
              <p className="text-muted-foreground mb-6">
                Choisissez un forfait pour débloquer toutes les fonctionnalités
              </p>
              <Button asChild>
                <Link href="/pricing">
                  Voir les forfaits
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
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
                <Zap className="h-5 w-5 text-amber-500" />
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
                      <p className="font-semibold">{formatCurrency(addonSub.addon.price_monthly)}/mois</p>
                      <Badge variant="outline" className="mt-1">
                        {addonSub.status === "active" ? "Actif" : addonSub.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/pricing#addons">
                  <Plus className="h-4 w-4 mr-2" />
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
                  <Zap className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Boostez votre abonnement</h3>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez des modules comme le Channel Manager ou la Copropriété
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/pricing#addons">
                    Voir les modules
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dialog upgrade */}
      <Dialog open={upgradeDialog.open} onOpenChange={(open) => setUpgradeDialog({ open, plan: null })}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changer de forfait</DialogTitle>
            <DialogDescription>
              Choisissez le forfait qui correspond à vos besoins
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {plans.filter(p => p.slug !== subscription?.plan.slug).map((plan) => (
              <div 
                key={plan.id} 
                className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary ${upgradeDialog.plan?.id === plan.id ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setUpgradeDialog({ ...upgradeDialog, plan })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{plan.name}</h4>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(plan.price_monthly)}/mois</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialog({ open: false, plan: null })}>
              Annuler
            </Button>
            <Button 
              disabled={!upgradeDialog.plan}
              onClick={() => {
                // Rediriger vers le checkout avec le nouveau plan
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
                <span className="font-semibold">{formatCurrency(subscription?.locked_price_monthly || 0)}/mois</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nouveau tarif</span>
                <span className="font-semibold">{formatCurrency(subscription?.plan.price_monthly || 0)}/mois</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-700 dark:text-green-400">
                <Shield className="h-4 w-4 inline mr-1" />
                Votre tarif actuel est garanti jusqu'au{" "}
                <strong>{subscription?.grandfathered_until ? formatDate(subscription.grandfathered_until) : "—"}</strong>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              En acceptant, vous confirmez avoir pris connaissance des nouvelles conditions.
              Vous pouvez également résilier sans frais avant la date d'effet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceChangeDialog({ open: false })}>
              Plus tard
            </Button>
            <Button onClick={acceptPriceChange} disabled={actionLoading === "accept-price"}>
              {actionLoading === "accept-price" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              J'accepte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composant barre d'utilisation
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <span className={isAtLimit ? "text-destructive font-medium" : isNearLimit ? "text-amber-500 font-medium" : ""}>
          {current}{unit} / {max === -1 ? "∞" : `${max}${unit}`}{suffix}
        </span>
      </div>
      <Progress value={percent} className={isAtLimit ? "bg-destructive/20" : isNearLimit ? "bg-amber-500/20" : ""} />
    </div>
  );
}

