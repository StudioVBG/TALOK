"use client";
// @ts-nocheck

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { useProfile } from "@/lib/hooks/use-profile";

function DashboardContent() {
  const router = useRouter();
  const { profile } = useProfile();

  useEffect(() => {
    // Rediriger vers le dashboard spécifique du rôle
    if (profile?.role) {
      switch (profile.role) {
        case "owner":
          router.replace("/app/owner/dashboard");
          break;
        case "tenant":
          router.replace("/app/tenant/dashboard");
          break;
        case "provider":
          router.replace("/vendor/dashboard");
          break;
        case "admin":
          router.replace("/admin/dashboard");
          break;
        default:
          // Si aucun rôle spécifique, rester sur /dashboard
          console.warn("[Dashboard] Rôle non reconnu:", profile.role);
          break;
      }
    }
  }, [profile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Redirection en cours...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

