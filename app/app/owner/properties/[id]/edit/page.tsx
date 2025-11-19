"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertyWizardV3 } from "@/features/properties/components/v3/property-wizard-v3";
import { propertiesService } from "@/features/properties/services/properties.service";
import { toPropertyV3 } from "@/lib/types/compatibility";
import type { Property } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

function EditPropertyPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchProperty(params.id as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function fetchProperty(id: string) {
    try {
      setLoading(true);
      const data = await propertiesService.getPropertyById(id);
      setProperty(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger le logement.",
        variant: "destructive",
      });
      router.push("/app/owner/properties");
    } finally {
      setLoading(false);
    }
  }

  const handleSuccess = (propertyId: string) => {
    router.push(`/app/owner/properties/${propertyId}`);
  };

  const handleCancel = () => {
    router.push(`/app/owner/properties/${params.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return null;
  }

  // Convertir Property legacy vers PropertyV3 pour le wizard
  const propertyV3 = toPropertyV3(property);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <PropertyWizardV3
        propertyId={property.id}
        initialData={propertyV3}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default function EditPropertyPage() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <EditPropertyPageContent />
    </ProtectedRoute>
  );
}

