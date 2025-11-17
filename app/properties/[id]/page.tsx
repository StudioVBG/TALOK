"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertyDetailV2 } from "@/features/properties/components/v3/property-detail-v2";

function PropertyDetailPageContent() {
  const params = useParams();
  
  if (!params.id || typeof params.id !== "string") {
    return null;
  }

  return <PropertyDetailV2 propertyId={params.id} />;
}

export default function PropertyDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <PropertyDetailPageContent />
    </ProtectedRoute>
  );
}

