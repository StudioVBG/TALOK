"use client";
// @ts-nocheck

/**
 * Page de choix du forfait lors de l'inscription
 * Le propriétaire choisit son forfait, le 1er mois est offert
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { authService } from "@/features/auth/services/auth.service";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { PLANS, formatPrice, type PlanSlug } from "@/lib/subscriptions/plans";
import {
  Check,
  Loader2,
  ArrowRight,
  Home,
  Star,
  Zap,
  Crown,
  Gift,
  CreditCard,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "yearly";

const PLAN_ICONS: Record<PlanSlug, React.ReactNode> = {
  starter: <Home className="w-5 h-5" />,
  confort: <Star className="w-5 h-5" />,
  pro: <Zap className="w-5 h-5" />,
  enterprise: <Crown className="w-5 h-5" />,
};

// Plans disponibles pour l'inscription (sans Enterprise qui est sur devis)
const SIGNUP_PLANS: PlanSlug[] = ["starter", "confort", "pro"];

export default function SignupPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<PlanSlug>("confort");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const role = searchParams.get("role") || "owner";

  // Vérifier que l'utilisateur est connecté et a un email vérifié
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authService.getUser();
        if (!user) {
          toast({
            title: "Session expirée",
            description: "Veuillez vous reconnecter.",
            variant: "destructive",
          });
          router.push("/auth/login");
          return;
        }
        
        // Seuls les propriétaires choisissent un forfait
        if (role !== "owner") {
          router.push(`/app/${role}/onboarding/profile`);
          return;
        }
      } catch (error) {
        console.error("Erreur vérification auth:", error);
        router.push("/auth/login");
      } finally {
        setCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, [role, router, toast]);

  const handleSelectPlan = async () => {
    if (!selectedPlan) return;
    
    setLoading(true);
    try {
      // Créer une session Stripe Checkout
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_slug: selectedPlan,
          billing_cycle: billing,
          success_url: `${window.location.origin}/app/owner/onboarding/profile?subscription=success`,
          cancel_url: `${window.location.origin}/signup/plan?role=${role}&canceled=true`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création du checkout");
      }

      // Rediriger vers Stripe Checkout
      window.location.href = data.url;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Vérifier si on revient de Stripe avec un canceled
  useEffect(() => {
    const canceled = searchParams.get("canceled");
    if (canceled === "true") {
      toast({
        title: "Paiement annulé",
        description: "Vous pouvez choisir un autre forfait ou réessayer.",
        variant: "default",
      });
    }
  }, [searchParams, toast]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const selectedPlanData = PLANS[selectedPlan];
  const price = billing === "yearly" 
    ? selectedPlanData.price_yearly 
    : selectedPlanData.price_monthly;

  return (
    <OnboardingShell
      stepLabel="Dernière étape – Choix du forfait"
      title="Choisissez votre forfait"
      subtitle="Le 1er mois est offert. Vous ne serez prélevé qu'à partir du 2ème mois."
      footer={
        <div className="flex items-center gap-2 text-slate-400">
          <Shield className="h-4 w-4" />
          <span>Paiement sécurisé par Stripe • Annulation à tout moment</span>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140 }}
        className="space-y-6"
      >
        {/* Badge 1er mois offert */}
        <div className="flex justify-center">
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 px-4 py-2 text-sm">
            <Gift className="w-4 h-4 mr-2" />
            1er mois offert sur tous les forfaits
          </Badge>
        </div>

        {/* Toggle mensuel/annuel */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 p-1 rounded-full bg-slate-800/50 border border-slate-700/50">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-white text-slate-900 shadow-lg"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                billing === "yearly"
                  ? "bg-white text-slate-900 shadow-lg"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Annuel
              <Badge className="bg-emerald-500 text-white border-0 text-xs">
                -17%
              </Badge>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid gap-4">
          {SIGNUP_PLANS.map((slug) => {
            const plan = PLANS[slug];
            const planPrice = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
            const isSelected = selectedPlan === slug;
            
            return (
              <motion.div
                key={slug}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedPlan(slug)}
                className={cn(
                  "relative rounded-xl border-2 p-4 cursor-pointer transition-all",
                  isSelected
                    ? "border-violet-500 bg-violet-500/10"
                    : plan.is_popular
                    ? "border-violet-500/50 bg-slate-800/50"
                    : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                )}
              >
                {/* Badge populaire */}
                {plan.is_popular && (
                  <div className="absolute -top-2.5 right-4">
                    <Badge className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-0 text-xs">
                      ⭐ Recommandé
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Radio button visuel */}
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected
                        ? "border-violet-500 bg-violet-500"
                        : "border-slate-500"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    
                    {/* Icon & Nom */}
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isSelected
                        ? `bg-gradient-to-br ${plan.gradient || "from-violet-500 to-indigo-600"} text-white`
                        : "bg-slate-700/50 text-slate-400"
                    )}>
                      {PLAN_ICONS[slug]}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-400">{plan.tagline}</p>
                    </div>
                  </div>

                  {/* Prix */}
                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white">
                        {formatPrice(planPrice)}
                      </span>
                      <span className="text-sm text-slate-400">
                        /{billing === "yearly" ? "an" : "mois"}
                      </span>
                    </div>
                    {billing === "yearly" && planPrice && (
                      <p className="text-xs text-slate-500">
                        soit {formatPrice(Math.round(planPrice / 12))}/mois
                      </p>
                    )}
                  </div>
                </div>

                {/* Highlights (visible si sélectionné) */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t border-slate-700/50"
                  >
                    <ul className="grid grid-cols-2 gap-2">
                      {plan.highlights.slice(0, 4).map((highlight, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <Check className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Récapitulatif */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Forfait sélectionné</span>
            <span className="font-medium text-white">{selectedPlanData.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Facturation</span>
            <span className="font-medium text-white">
              {billing === "yearly" ? "Annuelle" : "Mensuelle"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-slate-700/50 pt-3">
            <span className="text-slate-400">1er mois</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Offert
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">À partir du 2ème mois</span>
            <span className="text-lg font-bold text-white">
              {formatPrice(price)}<span className="text-sm font-normal text-slate-400">/{billing === "yearly" ? "an" : "mois"}</span>
            </span>
          </div>
        </div>

        {/* Bouton de confirmation */}
        <Button
          onClick={handleSelectPlan}
          disabled={loading || !selectedPlan}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-6 text-base"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Redirection vers le paiement...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Continuer avec {selectedPlanData.name}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-500">
          Vous serez redirigé vers Stripe pour enregistrer votre moyen de paiement.
          <br />
          Aucun prélèvement avant la fin de votre mois offert.
        </p>
      </motion.div>
    </OnboardingShell>
  );
}

