"use client";

import { Suspense, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertyWizardV3 } from "@/features/properties/components/v3/property-wizard-v3";

function PropertyWizardWrapper() {
  useEffect(() => {
    console.log("[OwnerNewPropertyPage] PropertyWizardWrapper monté");
  }, []);

  return (
    <div className="space-y-6">
      <PropertyWizardV3 />
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

export default function OwnerNewPropertyPage() {
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

