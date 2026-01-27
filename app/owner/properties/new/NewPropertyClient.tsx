"use client";
// @ts-nocheck

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertyWizardV3 } from "@/features/properties/components/v3/property-wizard-v3";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";

function PropertyWizardWrapper() {
  const router = useRouter();
  const reset = usePropertyWizardStore((state) => state.reset);

  // Reset wizard on mount to ensure clean state
  useEffect(() => {
    console.log("[OwnerNewPropertyPage] Reset du wizard pour nouvelle création");
    reset();
  }, [reset]);

  const handleSuccess = (propertyId: string) => {
    console.log("[OwnerNewPropertyPage] Succès ! Redirection vers :", `/owner/properties/${propertyId}`);
    router.push(`/owner/properties/${propertyId}`);
  };

  const handleCancel = () => {
    router.push("/owner/properties");
  };

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
  useEffect(() => {
    console.log("[OwnerNewPropertyPage] Page montée");
  }, []);

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <Suspense fallback={<LoadingFallback />}>
        <PropertyWizardWrapper />
      </Suspense>
    </ProtectedRoute>
  );
}
