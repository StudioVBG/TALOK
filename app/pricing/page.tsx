"use client";

/**
 * Page Pricing - Affichage des plans et tarifs
 * Design moderne avec animations et UX optimisée
 *
 * Conformité :
 * - Art. L112-1 Code de la Consommation (affichage HT/TTC)
 * - Art. L221-18 Code de la Consommation (droit de rétractation 14 jours)
 * - LCEN (accès CGV/CGU)
 * - WCAG 2.2 AA (accessibilité)
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  PLANS,
  FEATURE_GROUPS,
  FEATURE_LABELS,
  type PlanSlug,
  type FeatureKey,
  formatPrice,
  getYearlyDiscount,
} from "@/lib/subscriptions/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Users,
  Home,
  Shield,
  Loader2,
  ChevronDown,
  Star,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PublicFooter } from "@/components/layout/public-footer";

// ============================================
// TYPES
// ============================================

type BillingCycle = "monthly" | "yearly";

// ============================================
// CONSTANTS
// ============================================

const TVA_RATE = 20; // 20% TVA métropole

// ============================================
// DATA
// ============================================

const FAQ_ITEMS = [
  {
    question: "Puis-je changer de forfait à tout moment ?",
    answer: "Oui, vous pouvez upgrader ou downgrader votre forfait à tout moment. En cas d'upgrade, vous ne payez que la différence au prorata. En cas de downgrade, le nouveau tarif s'applique à la prochaine période de facturation.",
  },
  {
    question: "Comment fonctionne le 1er mois offert ?",
    answer: "Le 1er mois est entièrement offert sur tous les forfaits payants. Vous enregistrez votre moyen de paiement à l'inscription mais vous ne serez prélevé qu'à partir du 2ème mois. Vous pouvez annuler à tout moment pendant le mois offert.",
  },
  {
    question: "Quels sont les tarifs des différents plans ?",
    answer: "Gratuit (1 bien), Starter 9 € HT (3 biens), Confort 35 € HT (10 biens + 2 signatures), Pro 69 € HT (50 biens + 10 signatures). Enterprise à partir de 249 € HT avec Account Manager inclus. -20 % sur l'abonnement annuel. TVA en sus (20 % en France métropolitaine).",
  },
  {
    question: "Y a-t-il des frais cachés ?",
    answer: "Non, aucun frais caché. Le prix affiché est le prix hors taxes. Les seuls coûts supplémentaires sont les biens au-delà du quota (+2 € à +3 €/bien selon le plan) et les signatures électroniques au-delà du quota inclus. La TVA applicable s'ajoute selon votre localisation.",
  },
  {
    question: "Comment fonctionnent les frais de paiement ?",
    answer: "Les frais sont de 2,2 % pour les paiements CB et 0,50 € par prélèvement SEPA. Les clients Enterprise bénéficient de tarifs réduits (1,9 % CB, 0,40 € SEPA). Les virements bancaires sont gratuits.",
  },
  {
    question: "Puis-je récupérer mes données si je résilie ?",
    answer: "Absolument. Conformément à l'Art. 20 du RGPD (droit à la portabilité), vous pouvez exporter toutes vos données à tout moment depuis la section Abonnement. Après résiliation, vos données sont conservées 30 jours avant suppression définitive.",
  },
  {
    question: "Comment fonctionne la réduction GLI ?",
    answer: "Selon votre forfait, vous bénéficiez de -5 % à -25 % sur les primes d'assurance Garantie Loyers Impayés de nos partenaires. Enterprise XL offre le meilleur taux à -25 %.",
  },
  {
    question: "Quel est le droit de rétractation ?",
    answer: "Conformément à l'Art. L221-18 du Code de la Consommation, vous disposez d'un droit de rétractation de 14 jours à compter de la souscription. Vous pouvez exercer ce droit directement depuis votre espace de gestion ou en nous contactant.",
  },
];

const PLAN_ICONS: Partial<Record<PlanSlug, React.ReactNode>> = {
  gratuit: <Home className="w-6 h-6" />,
  starter: <Home className="w-6 h-6" />,
  confort: <Star className="w-6 h-6" />,
  pro: <Zap className="w-6 h-6" />,
  enterprise_s: <Crown className="w-6 h-6" />,
  enterprise_m: <Crown className="w-6 h-6" />,
  enterprise_l: <Crown className="w-6 h-6" />,
  enterprise_xl: <Crown className="w-6 h-6" />,
  enterprise: <Crown className="w-6 h-6" />,
};

// ============================================
// COMPONENTS
// ============================================

function PlanCard({
  slug,
  isSelected,
  billing,
  onSelect,
  loading,
}: {
  slug: PlanSlug;
  isSelected: boolean;
  billing: BillingCycle;
  onSelect: (slug: PlanSlug) => void;
  loading: string | null;
}) {
  const plan = PLANS[slug];
  const price = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
  const monthlyEquivalent = billing === "yearly" && plan.price_yearly
    ? Math.round(plan.price_yearly / 12)
    : null;
  const discount = getYearlyDiscount(plan);
  const isLoading = loading === slug;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-2xl border-2 p-6 transition-all duration-300",
        isSelected
          ? "border-violet-500 bg-violet-500/10 shadow-xl shadow-violet-500/20"
          : plan.is_popular
          ? "border-violet-500/50 bg-slate-800/50"
          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
      )}
    >
      {/* Badge populaire */}
      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-0 px-4 py-1 shadow-lg">
            <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
            {plan.badge || "Le plus populaire"}
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            isSelected || plan.is_popular
              ? `bg-gradient-to-br ${plan.gradient || "from-violet-500 to-indigo-600"} text-white`
              : "bg-slate-700/50 text-slate-400"
          )}
        >
          {PLAN_ICONS[slug]}
        </div>
        {billing === "yearly" && discount > 0 && price !== null && (
          <Badge
            className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-sm font-semibold px-2.5 py-0.5"
            aria-label={`Réduction de ${discount} pourcent sur l'abonnement annuel`}
          >
            -{discount}%
          </Badge>
        )}
      </div>

      {/* Name & Description */}
      <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
      <p className="text-sm text-slate-400 mb-4">{plan.tagline}</p>

      {/* Price */}
      <div className="mb-6">
        {price !== null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">
                {formatPrice(price)}
              </span>
              <span className="text-slate-400">
                HT/{billing === "yearly" ? "an" : "mois"}
              </span>
            </div>
            {monthlyEquivalent && (
              <p className="text-sm text-slate-400 mt-1">
                soit {formatPrice(monthlyEquivalent)} HT/mois
              </p>
            )}
            {price > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {formatPrice(Math.round(price * (1 + TVA_RATE / 100)))} TTC
              </p>
            )}
          </>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">Sur mesure</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        className={cn(
          "w-full mb-6",
          isSelected || plan.is_popular
            ? `bg-gradient-to-r ${plan.gradient || "from-violet-600 to-indigo-600"} hover:opacity-90`
            : "bg-slate-700 hover:bg-slate-600"
        )}
        size="lg"
        onClick={() => onSelect(slug)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : slug === "enterprise" || slug === "enterprise_l" || slug === "enterprise_xl" ? (
          <>
            Nous contacter
            <MessageSquare className="w-4 h-4 ml-2" aria-hidden="true" />
          </>
        ) : slug === "starter" || slug === "gratuit" ? (
          <>
            Commencer
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </>
        ) : (
          <>
            {plan.cta_text}
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </>
        )}
      </Button>

      {/* Highlights */}
      <ul className="space-y-3">
        {plan.highlights.map((highlight, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span className="text-slate-300">{highlight}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function FeatureComparisonTable({ billing }: { billing: BillingCycle }) {
  const orderedPlans: PlanSlug[] = ["gratuit", "starter", "confort", "pro", "enterprise_s"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" role="table" aria-label="Comparaison détaillée des forfaits">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="text-left p-4 text-slate-400 font-medium min-w-[180px]" scope="col">
              Fonctionnalités
            </th>
            {orderedPlans.map((slug) => (
              <th
                key={slug}
                scope="col"
                className={cn(
                  "p-4 text-center min-w-[120px]",
                  PLANS[slug].is_popular && "bg-violet-500/10 border-t-2 border-violet-500"
                )}
              >
                <div className="text-white font-semibold">{PLANS[slug].name}</div>
                <div className="text-sm text-slate-400 mt-1">
                  {PLANS[slug].price_monthly !== null
                    ? `${formatPrice(
                        billing === "yearly"
                          ? PLANS[slug].price_yearly
                          : PLANS[slug].price_monthly
                      )} HT`
                    : "Sur devis"}
                </div>
                {PLANS[slug].is_popular && (
                  <span className="inline-block text-xs text-violet-400 font-medium mt-1">
                    Le plus choisi
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Limits row */}
          <tr className="bg-slate-800/30">
            <td
              colSpan={orderedPlans.length + 1}
              className="p-3 text-sm font-medium text-slate-300"
            >
              Limites
            </td>
          </tr>
          <tr className="border-b border-slate-800/50 hover:bg-slate-800/20">
            <td className="p-4">
              <div className="text-slate-300 text-sm">Nombre de biens</div>
            </td>
            {orderedPlans.map((slug) => (
              <td
                key={slug}
                className={cn(
                  "p-4 text-center text-white font-medium",
                  PLANS[slug].is_popular && "bg-violet-500/5"
                )}
              >
                {PLANS[slug].limits.max_properties === -1 ? "Illimité" : PLANS[slug].limits.max_properties}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-800/50 hover:bg-slate-800/20">
            <td className="p-4">
              <div className="text-slate-300 text-sm">Signatures / mois</div>
            </td>
            {orderedPlans.map((slug) => (
              <td
                key={slug}
                className={cn(
                  "p-4 text-center text-white font-medium",
                  PLANS[slug].is_popular && "bg-violet-500/5"
                )}
              >
                {PLANS[slug].limits.signatures_monthly_quota === -1
                  ? "Illimité"
                  : PLANS[slug].limits.signatures_monthly_quota === 0
                  ? "Aucune"
                  : PLANS[slug].limits.signatures_monthly_quota}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-800/50 hover:bg-slate-800/20">
            <td className="p-4">
              <div className="text-slate-300 text-sm">Utilisateurs</div>
            </td>
            {orderedPlans.map((slug) => (
              <td
                key={slug}
                className={cn(
                  "p-4 text-center text-white font-medium",
                  PLANS[slug].is_popular && "bg-violet-500/5"
                )}
              >
                {PLANS[slug].limits.max_users === -1 ? "Illimité" : PLANS[slug].limits.max_users}
              </td>
            ))}
          </tr>

          {/* Feature groups */}
          {FEATURE_GROUPS.map((group) => (
            <React.Fragment key={group.id}>
              <tr className="bg-slate-800/30">
                <td
                  colSpan={orderedPlans.length + 1}
                  className="p-3 text-sm font-medium text-slate-300"
                >
                  {group.title}
                </td>
              </tr>
              {group.features.map((featureKey) => {
                const feature = FEATURE_LABELS[featureKey as FeatureKey];
                if (!feature) return null;

                return (
                  <tr
                    key={featureKey}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20"
                  >
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">{feature.label}</div>
                      <div className="text-xs text-slate-500">{feature.description}</div>
                    </td>
                    {orderedPlans.map((slug) => {
                      const hasFeature = PLANS[slug].features[featureKey as FeatureKey];
                      return (
                        <td
                          key={slug}
                          className={cn(
                            "p-4 text-center",
                            PLANS[slug].is_popular && "bg-violet-500/5"
                          )}
                        >
                          {hasFeature ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="w-5 h-5 text-emerald-400 mx-auto" aria-hidden="true" />
                              <span className="sr-only">Inclus</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <X className="w-5 h-5 text-slate-600 mx-auto" aria-hidden="true" />
                              <span className="sr-only">Non inclus</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [billing, setBilling] = useState<BillingCycle>("yearly");
  const [loading, setLoading] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Check for success/canceled from Stripe
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast({
        title: "Paiement réussi",
        description: "Votre abonnement a été activé avec succès.",
      });
      router.replace("/owner/dashboard?subscription=success");
    }
    if (canceled === "true") {
      toast({
        title: "Paiement annulé",
        description: "Vous pouvez réessayer quand vous voulez.",
        variant: "default",
      });
    }
  }, [searchParams, router, toast]);

  const handleSelectPlan = async (slug: PlanSlug) => {
    // Enterprise plans - contact form or redirect to enterprise pricing
    if (slug === "enterprise" || slug === "enterprise_l" || slug === "enterprise_xl") {
      router.push("/contact?subject=enterprise");
      return;
    }

    // Enterprise S and M can be subscribed directly
    if (slug === "enterprise_s" || slug === "enterprise_m") {
      if (!user) {
        sessionStorage.setItem("intendedPlan", JSON.stringify({ slug, billing }));
        router.push("/auth/signup?redirect=/pricing");
        return;
      }
      // Continue to checkout below
    }

    // Free plan - just register
    if (slug === "gratuit") {
      if (user) {
        router.push("/owner/dashboard");
      } else {
        router.push("/auth/signup");
      }
      return;
    }

    // Paid plans (including Starter) - need to be authenticated, then checkout
    if (!user) {
      sessionStorage.setItem("intendedPlan", JSON.stringify({ slug, billing }));
      router.push("/auth/signup?redirect=/pricing");
      return;
    }

    // Create checkout session
    setLoading(slug);
    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_slug: slug,
          billing_cycle: billing,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création du checkout");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
              Tarification simple et transparente
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Le bon forfait pour{" "}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                votre gestion locative
            </span>
          </h1>
            <p className="text-lg text-slate-400 mb-8">
              Choisissez le forfait adapté à votre portefeuille.
              <br />
              <span
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-base border border-emerald-500/30"
                role="status"
                aria-label="Offre spéciale : premier mois offert sur tous les plans payants"
              >
                1er mois offert
              </span>{" "}
              sur tous les plans.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-4 p-2 rounded-full bg-slate-800/50 border border-slate-700/50" role="radiogroup" aria-label="Cycle de facturation">
            <button
              onClick={() => setBilling("monthly")}
              role="radio"
              aria-checked={billing === "monthly"}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                billing === "monthly"
                    ? "bg-white text-slate-900 shadow-lg"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("yearly")}
              role="radio"
              aria-checked={billing === "yearly"}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                billing === "yearly"
                    ? "bg-white text-slate-900 shadow-lg"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Annuel
                <Badge className="bg-emerald-500 text-white border-0 text-sm font-semibold px-2 py-0.5">
                -20%
                </Badge>
            </button>
          </div>

            {/* HT mention */}
            <p className="text-xs text-slate-500 mt-4">
              Tous les prix sont affichés hors taxes (HT). TVA {TVA_RATE}% en sus (France métropolitaine).
            </p>
          </motion.div>
            </div>
      </section>

      {/* Plans Grid - Standard */}
      <section className="py-8 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {(["gratuit", "starter", "confort", "pro"] as PlanSlug[]).map(
              (slug, index) => (
                <motion.div
                  key={slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PlanCard
                    slug={slug}
                    isSelected={PLANS[slug].is_popular}
                    billing={billing}
                    onSelect={handleSelectPlan}
                    loading={loading}
                  />
                </motion.div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="py-16 bg-gradient-to-b from-slate-900/50 to-slate-950 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              <Crown className="w-3 h-3 mr-1" aria-hidden="true" />
              Solutions Enterprise
            </Badge>
            <h2 className="text-3xl font-bold text-white mb-4">
              Pour les gestionnaires de{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                50+ biens
              </span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Tarification adaptée au volume, signatures incluses, frais de paiement réduits.
              <br />
              Choisissez la taille qui correspond à votre portefeuille.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {(["enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"] as PlanSlug[]).map(
              (slug, index) => (
                <motion.div
                  key={slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PlanCard
                    slug={slug}
                    isSelected={PLANS[slug].is_popular}
                    billing={billing}
                    onSelect={handleSelectPlan}
                    loading={loading}
                  />
                </motion.div>
              )
            )}
          </div>

          {/* Enterprise Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {[
              { label: "Frais CB réduits", value: "1,9%", sublabel: "au lieu de 2,2%" },
              { label: "Frais SEPA", value: "0,40\u00A0\u20AC", sublabel: "au lieu de 0,50\u00A0\u20AC" },
              { label: "Réduction GLI", value: "jusqu'\u00E0 -25%", sublabel: "sur les primes" },
              { label: "Account Manager", value: "Inclus", sublabel: "dès Enterprise S" },
            ].map((item, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <div className="text-2xl font-bold text-emerald-400">{item.value}</div>
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-slate-500">{item.sublabel}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-16 border-t border-slate-800" id="comparison">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Comparez nos forfaits en détail
            </h2>
            <p className="text-slate-400 mb-6">
              Trouvez le forfait qui correspond à vos besoins
            </p>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setShowComparison(!showComparison)}
              className="text-slate-300 hover:text-white"
              aria-expanded={showComparison}
              aria-controls="comparison-table"
            >
              {showComparison ? "Masquer" : "Afficher"} le tableau comparatif
              <ChevronDown
                className={cn(
                  "w-4 h-4 ml-2 transition-transform",
                  showComparison && "rotate-180"
                )}
                aria-hidden="true"
              />
            </Button>
          </motion.div>

          <AnimatePresence>
            {showComparison && (
              <motion.div
                id="comparison-table"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                  <FeatureComparisonTable billing={billing} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Shield, label: "Paiement sécurisé", sublabel: "via Stripe" },
              { icon: Users, label: "+10 000", sublabel: "propriétaires" },
              { icon: Home, label: "+50 000", sublabel: "biens gérés" },
              { icon: Star, label: "4.8/5", sublabel: "satisfaction" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-violet-400" aria-hidden="true" />
                </div>
                <div className="font-semibold text-white">{item.label}</div>
                <div className="text-sm text-slate-400">{item.sublabel}</div>
        </motion.div>
            ))}
          </div>
        </div>
      </section>

        {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
            Questions fréquentes
          </h2>
            <p className="text-slate-400">
              Tout ce que vous devez savoir sur nos forfaits
            </p>
          </motion.div>

          <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
              {FAQ_ITEMS.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AccordionItem
                    value={`item-${i}`}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-xl px-6 overflow-hidden"
                  >
                    <AccordionTrigger className="text-left text-white hover:no-underline py-4">
                      {item.question}
                </AccordionTrigger>
                    <AccordionContent className="text-slate-400 pb-4">
                      {item.answer}
                </AccordionContent>
              </AccordionItem>
                </motion.div>
            ))}
          </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-indigo-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Prêt à simplifier votre gestion locative ?
            </h2>
            <p className="text-slate-300 mb-8">
              Rejoignez des milliers de propriétaires qui font confiance à notre
              plateforme. Commencez gratuitement, sans engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => handleSelectPlan("starter")}
              >
                <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                Commencer avec Starter
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-violet-500/50 text-violet-300 hover:bg-violet-500/10"
                onClick={() => handleSelectPlan("confort")}
              >
                <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                1er mois offert
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Legal & CGV section */}
      <section className="py-8 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-xs text-slate-500 space-y-2 text-center">
            <p>
              Tous les prix sont affichés hors taxes (HT). TVA applicable : {TVA_RATE}% (France métropolitaine).
              Tarifs spécifiques DOM-TOM (TVA réduite, octroi de mer) disponibles sur demande.
            </p>
            <p>
              Conformément à l&apos;Art. L221-18 du Code de la Consommation, vous disposez d&apos;un droit de rétractation de 14 jours
              à compter de la souscription.
            </p>
            <p>
              <a href="/legal/cgv" className="underline hover:text-slate-300 transition-colors">Conditions Générales de Vente</a>
              {" — "}
              <a href="/legal/cgu" className="underline hover:text-slate-300 transition-colors">Conditions Générales d&apos;Utilisation</a>
              {" — "}
              <a href="/legal/privacy" className="underline hover:text-slate-300 transition-colors">Politique de confidentialité</a>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter variant="dark" />
    </div>
  );
}
