"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { ChargeForm } from "@/features/billing/components/charge-form";
import { useSearchParams } from "next/navigation";

function NewChargePageContent() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("property_id") || undefined;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nouvelle charge</h1>
        <p className="text-muted-foreground">Ajoutez une nouvelle charge récurrente</p>
      </div>

      <ChargeForm propertyId={propertyId} />
    </div>
  );
}

export default function NewChargePage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <NewChargePageContent />
    </ProtectedRoute>
  );
}

