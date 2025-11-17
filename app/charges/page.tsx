"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { ChargesList } from "@/features/billing/components/charges-list";
import { canManageProperties } from "@/lib/helpers/permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function ChargesPageContent() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && !canManageProperties(profile.role as any)) {
      router.push("/dashboard" as any);
    }
  }, [profile, router]);

  if (!profile || !canManageProperties(profile.role as any)) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Charges</h1>
        <p className="text-muted-foreground">Gérez les charges récurrentes de vos logements</p>
      </div>

      <ChargesList />
    </div>
  );
}

export default function ChargesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <ChargesPageContent />
    </ProtectedRoute>
  );
}

