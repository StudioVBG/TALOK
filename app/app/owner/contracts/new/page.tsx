"use client";
// @ts-nocheck

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useOwnerData } from "../../_data/OwnerDataProvider";
import { LeaseWizard } from "./LeaseWizard";

export default function NewContractPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId");

  const { properties: propertiesData, isLoading } = useOwnerData();
  const properties = useMemo(() => propertiesData?.properties || [], [propertiesData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Chargement de vos biens...</p>
        </div>
      </div>
    );
  }

  return (
    <LeaseWizard
      properties={properties}
      initialPropertyId={propertyId || undefined}
    />
  );
}
