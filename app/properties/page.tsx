"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { PropertiesList } from "@/features/properties/components/properties-list";
import { canManageProperties } from "@/lib/helpers/permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function PropertiesPageContent() {
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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mes logements</h1>
        <p className="text-muted-foreground">
          Gérez vos logements et leurs informations
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

