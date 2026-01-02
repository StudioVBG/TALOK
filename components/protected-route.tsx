"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
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
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push(redirectTo);
      return;
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role as any)) {
      // Rediriger vers le dashboard approprié selon le rôle
      switch (profile.role) {
        case "owner":
          router.replace("/owner/dashboard");
          break;
        case "tenant":
          router.replace("/tenant");
          break;
        case "provider":
          router.replace("/provider");
          break;
        case "admin":
          router.replace("/admin/dashboard");
          break;
        default:
          router.push("/dashboard");
      }
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

  if (allowedRoles && profile && !allowedRoles.includes(profile.role as any)) {
    return null;
  }

  return <>{children}</>;
}

