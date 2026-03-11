"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertyWizardV3 } from "@/features/properties/components/v3/property-wizard-v3";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { useUsageLimit } from "@/components/subscription";

function PropertyWizardWrapper() {
  const router = useRouter();
  const reset = usePropertyWizardStore((state) => state.reset);
  const { canAdd, loading: subscriptionLoading } = useUsageLimit("properties");

  // Reset wizard on mount to ensure clean state
  useEffect(() => {
    reset();
  }, [reset]);

  // Rediriger si l'utilisateur ne peut pas ajouter de bien (accès direct par URL)
  useEffect(() => {
    if (!subscriptionLoading && !canAdd) {
      router.replace("/owner/properties?upgrade=true");
    }
  }, [subscriptionLoading, canAdd, router]);

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

  // Si l'utilisateur ne peut pas ajouter, ne pas afficher le wizard (en cours de redirection)
  if (!canAdd) {
    return <LoadingFallback />;
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
