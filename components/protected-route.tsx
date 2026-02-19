"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import type { UserRole } from "@/lib/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  redirectTo = "/auth/signin",
}: ProtectedRouteProps) {
  const { user, profile, loading, status, retryProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push(redirectTo);
      return;
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role as UserRole)) {
      // Redirect to the appropriate dashboard using centralized helper
      const dashUrl = getRoleDashboardUrl(profile.role);
      router.replace(dashUrl);
      return;
    }
  }, [user, profile, loading, allowedRoles, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Handle profile_error state — show error UI with retry instead of blank screen
  if (status === "profile_error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-4xl mb-4">&#x26A0;</div>
          <h2 className="text-lg font-semibold mb-2">
            Impossible de charger votre profil
          </h2>
          <p className="text-muted-foreground mb-6">
            Une erreur est survenue lors du chargement de votre profil.
            Veuillez réessayer ou vous reconnecter.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => retryProfile()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              Réessayer
            </button>
            <button
              onClick={() => {
                router.push("/auth/signin");
              }}
              className="px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
            >
              Se reconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role as UserRole)) {
    return null;
  }

  return <>{children}</>;
}
