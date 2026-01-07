"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { LeaseForm } from "@/features/leases/components/lease-form";
import { useRouter, useSearchParams } from "next/navigation";
import { canManageLeases } from "@/lib/helpers/permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEffect } from "react";

function NewLeasePageContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId =
    searchParams.get("propertyId") ?? searchParams.get("property_id");

  useEffect(() => {
    if (profile && !canManageLeases(profile.role as any)) {
      router.push("/dashboard");
    }
  }, [profile, router]);

  if (!profile || !canManageLeases(profile.role as any)) {
    return null;
  }

  const redirectAfterAction = () => {
    if (propertyId) {
      router.push(`/owner/properties/${propertyId}`);
    } else {
      router.push("/owner/leases");
    }
  };

  const handleSuccess = () => {
    redirectAfterAction();
  };

  const handleCancel = () => {
    redirectAfterAction();
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <LeaseForm
        propertyId={propertyId || undefined}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default function NewLeasePage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <NewLeasePageContent />
    </ProtectedRoute>
  );
}

