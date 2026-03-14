"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertyWizardV3 } from "@/features/properties/components/v3/property-wizard-v3";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { UpgradeModal, useSubscription, useUsageLimit } from "@/components/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { PLANS } from "@/lib/subscriptions/plans";

function PropertyWizardWrapper() {
  const router = useRouter();
  const reset = usePropertyWizardStore((state) => state.reset);
  const { canAdd, loading: subscriptionLoading } = useUsageLimit("properties");
  const { currentPlan } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const currentPlanName = PLANS[currentPlan].name;

  // Reset wizard on mount to ensure clean state
  useEffect(() => {
    reset();
  }, [reset]);

  const handleSuccess = (propertyId: string) => {
    router.push(`/owner/properties/${propertyId}?new=true`);
  };

  const handleCancel = () => {
    router.push("/owner/properties");
  };

  // Pendant le chargement de l'abonnement, afficher le loading
  if (subscriptionLoading) {
    return <LoadingFallback />;
  }

  // Si l'utilisateur ne peut pas ajouter, afficher un écran d'accès explicite
  if (!canAdd) {
    return (
      <>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Lock className="h-6 w-6" />
              </div>
              <CardTitle>Création de bien indisponible avec votre forfait actuel</CardTitle>
              <CardDescription>
                Vous avez atteint la capacité incluse de votre forfait {currentPlanName}. Passez au forfait supérieur pour continuer à agrandir votre portefeuille.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => setShowUpgrade(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Voir le bon forfait
              </Button>
              <Button variant="outline" asChild>
                <Link href="/owner/properties">
                  <Plus className="mr-2 h-4 w-4" />
                  Retour à mes biens
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="properties" />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PropertyWizardV3
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground">Chargement du formulaire...</p>
      </div>
    </div>
  );
}

export function NewPropertyClient() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <Suspense fallback={<LoadingFallback />}>
        <PropertyWizardWrapper />
      </Suspense>
    </ProtectedRoute>
  );
}
