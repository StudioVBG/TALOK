"use client";

/**
 * PricingClient — Composant interactif de la page pricing
 *
 * Gère : toggle mensuel/annuel, sélecteur territoire (TVA DROM-COM),
 * plan selection, Stripe checkout, feature comparison.
 *
 * La structure statique (FAQ, trust, hero text) reste dans le server component page.tsx.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  PLANS,
  FEATURE_GROUPS,
  FEATURE_LABELS,
  type PlanSlug,
  type FeatureKey,
  formatPrice,
  getYearlyDiscount,
  isFeatureValueEnabled,
} from "@/lib/subscriptions/plans";
import { changePlanForCurrentUser } from "@/lib/subscriptions/change-plan-client";
import { TVA_TERRITORY_GROUPS, TVA_RATES } from "@/lib/billing-utils";
import type { Territoire } from "@/types/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Home,
  Loader2,
  ChevronDown,
  Star,
  MessageSquare,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ============================================
// TYPES
// ============================================

type BillingCycle = "monthly" | "yearly";

// ============================================
// CONSTANTS
// ============================================

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
// HELPERS
// ============================================

function formatTTC(priceHT: number, tvaRate: number): string {
  if (priceHT === 0) return "Gratuit";
  const ttc = Math.round(priceHT * (1 + tvaRate / 100));
  return formatPrice(ttc);
}

// ============================================
// SUB-COMPONENTS
// ============================================

function TerritorySelector({
  territoire,
  onChange,
}: {
  territoire: Territoire;
  onChange: (t: Territoire) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 mt-3">
      <MapPin className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
      <select
        value={territoire}
        onChange={(e) => onChange(e.target.value as Territoire)}
        aria-label="S\u00e9lectionnez votre territoire pour le calcul de la TVA"
        className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 cursor-pointer"
      >
        {TVA_TERRITORY_GROUPS.map((group) => (
          <option key={group.value} value={group.value}>
            {group.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PlanCard({
  slug,
  isSelected,
  billing,
  tvaRate,
  onSelect,
  loading,
}: {
  slug: PlanSlug;
  isSelected: boolean;
  billing: BillingCycle;
  tvaRate: number;
  onSelect: (slug: PlanSlug) => void;
  loading: string | null;
}) {
  const plan = PLANS[slug];
  const price = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
  const monthlyEquivalent =
    billing === "yearly" && plan.price_yearly
      ? Math.round(plan.price_yearly / 12)
      : null;
  const discount = getYearlyDiscount(plan);
  const isLoading = loading === slug;

  const ctaAriaLabel =
    price !== null && price > 0
      ? `S'inscrire au plan ${plan.name} \u00e0 ${formatPrice(price)} par ${billing === "yearly" ? "an" : "mois"}`
      : slug === "gratuit"
        ? "Commencer gratuitement"
        : `Contacter l'\u00e9quipe commerciale pour le plan ${plan.name}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-2xl border-2 p-6 transition-all duration-300 focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-900",
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
            aria-label={`R\u00e9duction de ${discount} pourcent sur l'abonnement annuel`}
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
                {formatTTC(price, tvaRate)} TTC
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
        aria-label={ctaAriaLabel}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : slug === "enterprise" ||
          slug === "enterprise_l" ||
          slug === "enterprise_xl" ? (
          <>
            Nous contacter
            <MessageSquare className="w-4 h-4 ml-2" aria-hidden="true" />
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
            <Check
              className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-slate-300">{highlight}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function FeatureComparisonTable({ billing }: { billing: BillingCycle }) {
  const orderedPlans: PlanSlug[] = [
    "gratuit",
    "starter",
    "confort",
    "pro",
    "enterprise_s",
    "enterprise_m",
    "enterprise_l",
    "enterprise_xl",
  ];

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        role="table"
        aria-label="Comparaison d\u00e9taill\u00e9e des forfaits"
      >
        <thead>
          <tr className="border-b border-slate-700/50">
            <th
              className="text-left p-4 text-slate-400 font-medium min-w-[180px]"
              scope="col"
            >
              Fonctionnalit\u00e9s
            </th>
            {orderedPlans.map((slug) => (
              <th
                key={slug}
                scope="col"
                className={cn(
                  "p-4 text-center min-w-[120px]",
                  PLANS[slug].is_popular &&
                    "bg-violet-500/10 border-t-2 border-violet-500"
                )}
              >
                <div className="text-white font-semibold">
                  {PLANS[slug].name}
                </div>
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
          {/* Limits rows */}
          <tr className="bg-slate-800/30">
            <td
              colSpan={orderedPlans.length + 1}
              className="p-3 text-sm font-medium text-slate-300"
            >
              Limites
            </td>
          </tr>
          {[
            {
              label: "Nombre de biens",
              getValue: (slug: PlanSlug) =>
                PLANS[slug].limits.max_properties === -1
                  ? "Illimit\u00e9"
                  : PLANS[slug].limits.max_properties,
            },
            {
              label: "Signatures / mois",
              getValue: (slug: PlanSlug) =>
                PLANS[slug].limits.signatures_monthly_quota === -1
                  ? "Illimit\u00e9"
                  : PLANS[slug].limits.signatures_monthly_quota === 0
                    ? "Aucune"
                    : PLANS[slug].limits.signatures_monthly_quota,
            },
            {
              label: "Utilisateurs",
              getValue: (slug: PlanSlug) =>
                PLANS[slug].limits.max_users === -1
                  ? "Illimit\u00e9"
                  : PLANS[slug].limits.max_users,
            },
          ].map((row) => (
            <tr
              key={row.label}
              className="border-b border-slate-800/50 hover:bg-slate-800/20"
            >
              <td className="p-4">
                <div className="text-slate-300 text-sm">{row.label}</div>
              </td>
              {orderedPlans.map((slug) => (
                <td
                  key={slug}
                  className={cn(
                    "p-4 text-center text-white font-medium",
                    PLANS[slug].is_popular && "bg-violet-500/5"
                  )}
                >
                  {row.getValue(slug)}
                </td>
              ))}
            </tr>
          ))}

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
                      <div className="text-slate-300 text-sm">
                        {feature.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        {feature.description}
                      </div>
                    </td>
                    {orderedPlans.map((slug) => {
                      const featureValue =
                        PLANS[slug].features[featureKey as FeatureKey];
                      const hasFeature = isFeatureValueEnabled(featureValue);
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
                              <Check
                                className="w-5 h-5 text-emerald-400 mx-auto"
                                aria-hidden="true"
                              />
                              {typeof featureValue === "string" &&
                                featureValue !== "true" && (
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                    {featureValue}
                                  </span>
                                )}
                              <span className="sr-only">Inclus</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <X
                                className="w-5 h-5 text-slate-600 mx-auto"
                                aria-hidden="true"
                              />
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
// MAIN CLIENT COMPONENT
// ============================================

export function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingCycle>("yearly");
  const [territoire, setTerritoire] = useState<Territoire>("metropole");
  const [loading, setLoading] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const tvaRate = TVA_RATES[territoire];

  // Check for success/canceled from Stripe
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast({
        title: "Paiement r\u00e9ussi",
        description: "Votre abonnement a \u00e9t\u00e9 activ\u00e9 avec succ\u00e8s.",
      });
      router.replace("/owner/dashboard?subscription=success");
    }
    if (canceled === "true") {
      toast({
        title: "Paiement annul\u00e9",
        description: "Vous pouvez r\u00e9essayer quand vous voulez.",
        variant: "default",
      });
    }
  }, [searchParams, router, toast]);

  const handleSelectPlan = useCallback(
    async (slug: PlanSlug) => {
      if (
        slug === "enterprise" ||
        slug === "enterprise_l" ||
        slug === "enterprise_xl"
      ) {
        router.push("/contact?subject=enterprise");
        return;
      }

      if (slug === "enterprise_s" || slug === "enterprise_m") {
        if (!user) {
          sessionStorage.setItem(
            "intendedPlan",
            JSON.stringify({ slug, billing })
          );
          router.push("/auth/signup?redirect=/pricing");
          return;
        }
      }

      if (slug === "gratuit") {
        if (user) {
          router.push("/owner/dashboard");
        } else {
          router.push("/auth/signup");
        }
        return;
      }

      if (!user) {
        sessionStorage.setItem(
          "intendedPlan",
          JSON.stringify({ slug, billing })
        );
        router.push("/auth/signup?redirect=/pricing");
        return;
      }

      setLoading(slug);
      try {
        const result = await changePlanForCurrentUser(slug, billing);

        if (result.mode === "checkout" && result.url) {
          window.location.href = result.url;
          return;
        }

        toast({
          title: result.scheduled
            ? "Changement programm\u00e9"
            : "Forfait mis \u00e0 jour",
          description: result.scheduled
            ? "Le nouveau forfait sera appliqu\u00e9 \u00e0 votre prochaine \u00e9ch\u00e9ance."
            : "Votre forfait a \u00e9t\u00e9 mis \u00e0 jour avec succ\u00e8s.",
        });
        router.push("/owner/money?tab=forfait");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Une erreur est survenue";
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(null);
      }
    },
    [user, billing, router, toast]
  );

  return (
    <>
      {/* ===== Billing toggle + TVA selector ===== */}
      <div className="text-center">
        {/* Toggle mensuel/annuel */}
        <div
          className="inline-flex items-center gap-4 p-2 rounded-full bg-slate-800/50 border border-slate-700/50"
          role="radiogroup"
          aria-label="Cycle de facturation"
        >
          <button
            onClick={() => setBilling("monthly")}
            role="radio"
            aria-checked={billing === "monthly"}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
              billing === "monthly"
                ? "bg-slate-50 text-slate-900 shadow-lg"
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
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
              billing === "yearly"
                ? "bg-slate-50 text-slate-900 shadow-lg"
                : "text-slate-400 hover:text-white"
            )}
          >
            Annuel
            <Badge className="bg-emerald-500 text-white border-0 text-sm font-semibold px-2 py-0.5">
              jusqu&apos;\u00e0 -20%
            </Badge>
          </button>
        </div>

        {/* TVA territory selector */}
        <div className="mt-3">
          <TerritorySelector
            territoire={territoire}
            onChange={setTerritoire}
          />
        </div>

        {/* HT mention */}
        <p className="text-xs text-slate-500 mt-3">
          Prix HT. TVA {tvaRate}% ({TVA_TERRITORY_GROUPS.find((g) => g.value === territoire)?.label?.split(" (")[0] || "France"}).
        </p>
      </div>

      {/* ===== Plans Grid - Standard ===== */}
      <section className="py-8 pb-16" aria-label="Forfaits standards">
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
                    tvaRate={tvaRate}
                    onSelect={handleSelectPlan}
                    loading={loading}
                  />
                </motion.div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ===== Enterprise Section ===== */}
      <section
        className="py-16 bg-gradient-to-b from-slate-900/50 to-slate-950 border-t border-slate-800"
        aria-label="Forfaits Enterprise"
      >
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
              Tarification adapt\u00e9e au volume, signatures incluses, frais de
              paiement r\u00e9duits.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {(
              [
                "enterprise_s",
                "enterprise_m",
                "enterprise_l",
                "enterprise_xl",
              ] as PlanSlug[]
            ).map((slug, index) => (
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
                  tvaRate={tvaRate}
                  onSelect={handleSelectPlan}
                  loading={loading}
                />
              </motion.div>
            ))}
          </div>

          {/* Enterprise Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {[
              {
                label: "Frais CB r\u00e9duits",
                value: "1,9%",
                sublabel: "au lieu de 2,2%",
              },
              {
                label: "Frais SEPA",
                value: "0,40\u00a0\u20ac",
                sublabel: "au lieu de 0,50\u00a0\u20ac",
              },
              {
                label: "R\u00e9duction GLI",
                value: "jusqu'\u00e0 -25%",
                sublabel: "sur les primes",
              },
              {
                label: "Account Manager",
                value: "Inclus",
                sublabel: "d\u00e8s Enterprise S",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-4 rounded-xl bg-slate-800/30 border border-slate-700/50"
              >
                <div className="text-2xl font-bold text-emerald-400">
                  {item.value}
                </div>
                <div className="text-sm font-medium text-white">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500">{item.sublabel}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== Savings vs Agency ===== */}
      <section className="py-10 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-2xl p-8 border border-emerald-500/20">
            <h3 className="text-lg font-bold text-white mb-2">
              \u00c9conomisez par rapport \u00e0 une agence
            </h3>
            <p className="text-slate-300 text-sm">
              G\u00e9rez 5 biens avec Talok Confort :{" "}
              <span className="font-bold text-emerald-400">
                {formatPrice(
                  billing === "yearly"
                    ? PLANS.confort.price_yearly!
                    : PLANS.confort.price_monthly! * 12
                )}
                /an
              </span>
              . Avec une agence :{" "}
              <span className="text-slate-400 line-through">
                ~2 000\u00a0\u20ac/an
              </span>
              .
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Estimation bas\u00e9e sur des frais de gestion agence de 7-8% du loyer
              annuel pour 5 biens.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Feature Comparison ===== */}
      <section className="py-16 border-t border-slate-800" id="comparison">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Comparez nos forfaits en d\u00e9tail
            </h2>
            <p className="text-slate-400 mb-6">
              Trouvez le forfait qui correspond \u00e0 vos besoins
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

      {/* ===== CTA Final ===== */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-indigo-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Pr\u00eat \u00e0 simplifier votre gestion locative ?
            </h2>
            <p className="text-slate-300 mb-8">
              Rejoignez des milliers de propri\u00e9taires qui font confiance \u00e0 Talok.
              Commencez gratuitement, sans engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-slate-50 text-slate-900 hover:bg-slate-200"
                onClick={() => handleSelectPlan("starter")}
                aria-label="Commencer avec le plan Starter"
              >
                <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                Commencer avec Starter
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-violet-500/50 text-violet-300 hover:bg-violet-500/10"
                onClick={() => handleSelectPlan("confort")}
                aria-label="Choisir le plan Confort"
              >
                <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                Choisir Confort
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
