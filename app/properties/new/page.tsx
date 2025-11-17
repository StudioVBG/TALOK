"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { PropertyWizardV3 } from "@/features/properties/components/v3/property-wizard-v3";
import { useRouter } from "next/navigation";
import { canManageProperties } from "@/lib/helpers/permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEffect } from "react";

function NewPropertyPageContent() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && !canManageProperties(profile.role as any)) {
      router.push("/dashboard");
    }
  }, [profile, router]);

  if (!profile || !canManageProperties(profile.role as any)) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ajouter un logement</h1>
        <p className="text-muted-foreground">
          Un questionnaire ultra-simple en 6 étapes pour créer votre brouillon, adapté à chaque type de bien.
        </p>
      </div>
      <PropertyWizardV3 />
    </div>
  );
}

export default function NewPropertyPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <NewPropertyPageContent />
    </ProtectedRoute>
  );
}

