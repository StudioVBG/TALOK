"use client";
// @ts-nocheck

/**
 * Page Pricing - Tarifs et Plans d'abonnement
 * Design SOTA 2025 avec animations et comparaison des plans
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  Sparkles,
  Zap,
  Building2,
  FileText,
  Shield,
  Brain,
  Clock,
  Users,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  subscriptionsService,
  type Plan,
} from "@/lib/services/subscriptions.service";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// Features avec icônes
const featureLabels: Record<string, { label: string; icon: React.ElementType }> = {
  signatures: { label: "Signatures électroniques", icon: FileText },
  ocr: { label: "OCR documents (Mindee)", icon: Brain },
  scoring: { label: "Scoring IA solvabilité", icon: Shield },
  automations: { label: "Automations (relances, IRL)", icon: Clock },
  api_access: { label: "Accès API", icon: Zap },
  priority_support: { label: "Support prioritaire", icon: Users },
  cash_payments: { label: "Paiement espèces", icon: Building2 },
  export_csv: { label: "Export CSV", icon: FileText },
  multi_users: { label: "Multi-utilisateurs", icon: Users },
  white_label: { label: "White label", icon: Sparkles },
};

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Charger les plans
  useEffect(() => {
    subscriptionsService.getPlans().then((data) => {
      setPlans(data);
      setLoadingPlans(false);
    });
  }, []);

  // Afficher les messages de callback
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "🎉 Abonnement activé !",
        description: "Bienvenue ! Votre abonnement est maintenant actif.",
      });
    }
    if (searchParams.get("canceled") === "true") {
      toast({
        title: "Paiement annulé",
        description: "Vous pouvez réessayer quand vous le souhaitez.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const handleSubscribe = async (planSlug: string) => {
    if (planSlug === "free" || planSlug === "enterprise") return;

    setLoading(planSlug);
    try {
      const result = await subscriptionsService.createCheckoutSession(
        planSlug,
        billing
      );

      if ("error" in result) {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        });
      } else {
        window.location.href = result.url;
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const getPrice = (plan: Plan) => {
    const price = billing === "monthly" ? plan.price_monthly : plan.price_yearly;
    return (price / 100).toFixed(0);
  };

  const getMonthlyEquivalent = (plan: Plan) => {
    if (billing === "monthly") return null;
    return ((plan.price_yearly / 100) / 12).toFixed(2);
  };

  const getSaving = (plan: Plan) => {
    if (plan.price_monthly === 0) return 0;
    const monthlyTotal = plan.price_monthly * 12;
    return Math.round(((monthlyTotal - plan.price_yearly) / monthlyTotal) * 100);
  };

  // Filtrer les plans (enlever enterprise de la grille)
  const displayPlans = plans.filter((p) => p.slug !== "enterprise");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">GestLoc</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Se connecter</Button>
            </Link>
            <Link href="/signup?role=owner">
              <Button>Commencer</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6"
          >
            <Sparkles className="w-4 h-4" />
            14 jours d'essai gratuit sur tous les plans
          </motion.span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Un prix simple,
            <br />
            <span className="bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
              des fonctionnalités puissantes
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Choisissez le plan adapté à votre patrimoine immobilier.
            Sans engagement, changez ou annulez à tout moment.
          </p>

          {/* Toggle mensuel/annuel */}
          <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-muted/50 border border-border/50">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-background shadow-lg text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                billing === "yearly"
                  ? "bg-background shadow-lg text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Annuel
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 text-xs font-bold">
                -17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plans grid */}
        {loadingPlans ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {displayPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                variants={itemVariants}
                className={cn(
                  "relative flex flex-col p-6 rounded-2xl border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl",
                  plan.is_popular &&
                    "border-primary shadow-lg shadow-primary/10 scale-[1.02] z-10"
                )}
              >
                {/* Badge populaire */}
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
                      ⭐ Le plus populaire
                    </span>
                  </div>
                )}

                {/* Header du plan */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-foreground">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                {/* Prix */}
                <div className="mb-6">
                  {plan.price_monthly === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">Gratuit</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">
                          {getPrice(plan)}€
                        </span>
                        <span className="text-muted-foreground">
                          /{billing === "monthly" ? "mois" : "an"}
                        </span>
                      </div>
                      {billing === "yearly" && (
                        <p className="text-sm text-muted-foreground mt-1">
                          soit {getMonthlyEquivalent(plan)}€/mois
                        </p>
                      )}
                      {billing === "yearly" && getSaving(plan) > 0 && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          🎁 Économisez {getSaving(plan)}%
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Limites */}
                <div className="space-y-3 mb-6 pb-6 border-b border-border/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Logements</span>
                    <span className="font-medium">
                      {plan.max_properties === -1
                        ? "Illimité"
                        : plan.max_properties}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Baux actifs</span>
                    <span className="font-medium">
                      {plan.max_leases === -1 ? "Illimité" : plan.max_leases}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stockage</span>
                    <span className="font-medium">
                      {plan.max_documents_gb === -1
                        ? "Illimité"
                        : `${plan.max_documents_gb} Go`}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-6">
                  {Object.entries(plan.features || {}).map(([key, enabled]) => {
                    const feature = featureLabels[key];
                    if (!feature) return null;
                    const Icon = feature.icon;

                    return (
                      <li
                        key={key}
                        className={cn(
                          "flex items-center gap-3 text-sm",
                          !enabled && "opacity-50"
                        )}
                      >
                        {enabled ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span
                          className={cn(
                            enabled ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {feature.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* CTA */}
                <Button
                  className={cn(
                    "w-full",
                    plan.is_popular
                      ? "bg-primary hover:bg-primary/90"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  variant={plan.is_popular ? "default" : "secondary"}
                  onClick={() => handleSubscribe(plan.slug)}
                  disabled={
                    loading === plan.slug ||
                    plan.slug === "free" ||
                    plan.slug === "enterprise"
                  }
                >
                  {loading === plan.slug ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : plan.slug === "free" ? (
                    "Plan actuel"
                  ) : (
                    <>
                      Commencer l'essai
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/5 via-violet-500/5 to-primary/5 border border-primary/20 p-8 md:p-12"
        >
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Zap className="w-4 h-4" />
                Enterprise
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">
                Solution sur mesure
              </h3>
              <p className="text-muted-foreground max-w-lg">
                Pour les gestionnaires de patrimoine, SCI et agences.
                Volume illimité, API complète, white-label, support dédié et SLA.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="gap-2">
                Contactez-nous
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                Voir la démo
              </Button>
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-20"
        >
          <h2 className="text-2xl font-bold text-center mb-12">
            Questions fréquentes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                q: "Puis-je changer de plan à tout moment ?",
                a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements sont appliqués immédiatement et le prorata est calculé automatiquement.",
              },
              {
                q: "Comment fonctionne l'essai gratuit ?",
                a: "Vous bénéficiez de 14 jours d'essai gratuit sur tous les plans payants. Aucune carte bancaire n'est requise pour commencer.",
              },
              {
                q: "Quels moyens de paiement acceptez-vous ?",
                a: "Nous acceptons les cartes bancaires (Visa, Mastercard, Amex) et le prélèvement SEPA pour les paiements récurrents.",
              },
              {
                q: "Y a-t-il des frais cachés ?",
                a: "Non, le prix affiché est le prix final. Aucun frais de mise en service, de résiliation ou de stockage supplémentaire dans les limites du plan.",
              },
            ].map((faq, index) => (
              <div key={index} className="space-y-2">
                <h3 className="font-semibold text-foreground">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 GestLoc. Tous droits réservés.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/legal/cgu" className="hover:text-foreground">
              CGU
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Confidentialité
            </Link>
            <Link href="/legal/cgv" className="hover:text-foreground">
              CGV
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

