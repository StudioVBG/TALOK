"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { PropertiesList } from "@/features/properties/components/properties-list";
import { canManageProperties } from "@/lib/helpers/permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Page générique des propriétés
 * 
 * Cette page sert de point d'entrée et redirige :
 * - Les propriétaires vers /app/owner/properties (page dédiée avec layout)
 * - Les admins vers cette page (liste générique)
 * 
 * ⚠️ NE PAS UTILISER CETTE PAGE POUR LES PROPRIÉTAIRES
 * Utiliser /app/owner/properties à la place
 */
function PropertiesPageContent() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    
    // Rediriger les propriétaires vers leur page dédiée
    if (profile?.role === "owner") {
      router.replace("/app/owner/properties");
      return;
    }

    // Rediriger les utilisateurs sans permissions
    if (profile && !canManageProperties(profile.role as any)) {
      router.push("/dashboard");
    }
  }, [profile, loading, router]);

  // Afficher un loader pendant la redirection pour les owners
  if (loading || profile?.role === "owner") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  if (!profile || !canManageProperties(profile.role as any)) {
    return null;
  }

  // Cette page est maintenant réservée aux admins uniquement
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tous les logements</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble de tous les logements (Admin)
        </p>
      </div>

      <PropertiesList />
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <PropertiesPageContent />
    </ProtectedRoute>
  );
}

