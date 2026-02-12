"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ChevronRight,
  Clock,
  Pause,
  AlertTriangle,
  CreditCard,
  Loader2,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBilling } from "@/hooks/useBilling";
import { useTerritory } from "@/hooks/useTerritory";
import { useStripePortal } from "@/hooks/useStripePortal";
import { daysUntil, formatDateLong } from "@/lib/billing-utils";
import { BillingSkeleton } from "./BillingSkeleton";
import { PlanHeader } from "./PlanHeader";
import { PlanFeatures } from "./PlanFeatures";
import { BillingCycle } from "./BillingCycle";
import { CostBreakdown } from "./CostBreakdown";
import { UsageMeters } from "./UsageMeters";
import { UsageAlertBanner } from "./UsageAlert";
import { PaymentMethod } from "./PaymentMethod";
import { InvoiceHistory } from "./InvoiceHistory";
import { CancellationFlow } from "./CancellationFlow";
import { ReactivationBanner } from "./ReactivationBanner";
import { LegalFooter } from "./LegalFooter";
import type { UsageMetric } from "@/types/billing";

export function BillingPage() {
  const router = useRouter();
  const { data: billing, isLoading, error } = useBilling();
  const { territoire, tva_taux } = useTerritory();
  const { mutate: openPortal, isPending: portalPending } = useStripePortal();
  const [showCancel, setShowCancel] = useState(false);

  if (isLoading) return <BillingSkeleton />;

  if (error || !billing) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" aria-hidden="true" />
        <p className="text-slate-300 font-medium mb-2">Erreur de chargement</p>
        <p className="text-sm text-slate-400 mb-4">
          {error instanceof Error ? error.message : "Impossible de charger vos informations de facturation."}
        </p>
        <Button onClick={() => window.location.reload()}>
          Reessayer
        </Button>
      </div>
    );
  }

  const { subscription, usage, plan, payment_method } = billing;
  const { status, billing_cycle, current_period_end, cancel_at_period_end, trial_end, pause_collection_until } = subscription;

  const trialDaysRemaining = trial_end ? daysUntil(trial_end) : 0;

  const usageAlertItems = (["biens", "signatures", "utilisateurs", "stockage_mb"] as UsageMetric[]).map(
    (metric) => ({
      metric,
      level: usage[metric].alert_level,
      current: usage[metric].current_value,
      max: usage[metric].max_value,
    })
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Skip to main */}
        <a
          href="#billing-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-2 focus:outline-indigo-400 focus:outline-offset-2"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white" id="billing-content">
              Facturation & Abonnement
            </h1>
            <p className="text-slate-300 mt-1">
              Gerez votre forfait, vos factures et vos moyens de paiement
            </p>
          </div>
          {subscription.stripe_customer_id && (
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:text-white"
              onClick={() => openPortal()}
              disabled={portalPending}
            >
              {portalPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              Gerer le paiement
            </Button>
          )}
        </div>

        {/* ===== STATUS BANNERS ===== */}

        {/* Trial */}
        {status === "trialing" && trial_end && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-start gap-4"
            role="alert"
          >
            <Clock className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-violet-300 font-medium">Periode d&apos;essai en cours</p>
              <p className="text-sm text-slate-300 mt-0.5">
                Il vous reste <strong>{trialDaysRemaining} jours</strong> pour profiter de toutes les
                fonctionnalites {plan.name}. Ajoutez un moyen de paiement pour continuer.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 flex-shrink-0"
              onClick={() => openPortal()}
              disabled={portalPending}
            >
              Ajouter un moyen de paiement
            </Button>
          </motion.div>
        )}

        {/* Paused */}
        {status === "paused" && pause_collection_until && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-4"
            role="alert"
          >
            <Pause className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-amber-300 font-medium">Abonnement en pause</p>
              <p className="text-sm text-slate-300 mt-0.5">
                Votre abonnement reprendra automatiquement le{" "}
                <strong>{formatDateLong(pause_collection_until)}</strong>.
                Vos donnees sont conservees.
              </p>
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 flex-shrink-0">
              <Play className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Reprendre
            </Button>
          </motion.div>
        )}

        {/* Past due */}
        {status === "past_due" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-4"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-red-300 font-medium">Paiement echoue</p>
              <p className="text-sm text-slate-300 mt-0.5">
                Votre dernier paiement a echoue. Mettez a jour votre moyen de paiement pour
                eviter l&apos;interruption de votre service.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 flex-shrink-0"
              onClick={() => openPortal()}
              disabled={portalPending}
            >
              Mettre a jour la CB
            </Button>
          </motion.div>
        )}

        {/* Cancel at period end */}
        {cancel_at_period_end && current_period_end && (
          <ReactivationBanner periodEnd={current_period_end} />
        )}

        {/* Incomplete */}
        {status === "incomplete" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-4"
            role="alert"
          >
            <CreditCard className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-amber-300 font-medium">Configuration requise</p>
              <p className="text-sm text-slate-300 mt-0.5">
                Finalisez la configuration de votre abonnement pour acceder a toutes les fonctionnalites.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 flex-shrink-0"
              onClick={() => openPortal()}
              disabled={portalPending}
            >
              Finaliser
            </Button>
          </motion.div>
        )}

        {/* Usage alerts */}
        <UsageAlertBanner items={usageAlertItems} />

        {/* ===== MAIN CONTENT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — Plan + billing */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan header */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <PlanHeader
                  plan={plan}
                  status={status}
                  billingCycle={billing_cycle}
                  usage={usage}
                  tvaTaux={tva_taux}
                  onUpgrade={() => router.push("/pricing")}
                />
              </CardContent>
            </Card>

            {/* Billing cycle info */}
            {(status === "active" || status === "trialing") && current_period_end && (
              <BillingCycle
                cycle={billing_cycle}
                periodEnd={current_period_end}
                plan={plan}
                tvaTaux={tva_taux}
              />
            )}

            {/* Cost breakdown */}
            <CostBreakdown
              plan={plan}
              billingCycle={billing_cycle}
              territoire={territoire}
              tvaTaux={tva_taux}
            />

            {/* Plan features */}
            {plan.features.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <PlanFeatures groups={plan.features} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column — Usage + Payment */}
          <div className="space-y-6">
            {/* Usage meters */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Utilisation</CardTitle>
                <p className="text-sm text-slate-400">Suivi de votre consommation ce mois-ci</p>
              </CardHeader>
              <CardContent>
                <UsageMeters usage={usage} />
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Moyen de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentMethod paymentMethod={payment_method} />
              </CardContent>
            </Card>

            {/* Cancel action */}
            {!cancel_at_period_end && status !== "canceled" && status !== "incomplete" && (
              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={() => setShowCancel(true)}
              >
                <X className="w-4 h-4 mr-2" aria-hidden="true" />
                Resilier mon abonnement
              </Button>
            )}
          </div>
        </div>

        {/* Invoice history */}
        <InvoiceHistory
          subscriptionStatus={status}
          trialEnd={trial_end}
        />

        {/* Legal footer */}
        <LegalFooter />

        {/* Cancellation flow dialog */}
        {current_period_end && (
          <CancellationFlow
            open={showCancel}
            onOpenChange={setShowCancel}
            periodEnd={current_period_end}
          />
        )}

      </div>
    </TooltipProvider>
  );
}
