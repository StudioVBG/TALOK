"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCalendar } from "@/features/colocation/components/TaskCalendar";

export default function TenantColocationTasksPage() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadPropertyId();
  }, []);

  const loadPropertyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the property via lease signers
      const { data: signer } = await supabase
        .from("lease_signers")
        .select("leases!inner(property_id, statut)")
        .eq("profiles.user_id", user.id)
        .in("role", ["locataire_principal", "colocataire"])
        .limit(1)
        .single();

      if (signer) {
        const lease = signer.leases as any;
        if (lease?.property_id) {
          setPropertyId(lease.property_id);
        }
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Aucune colocation active trouvee.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Mes taches</h1>
      <TaskCalendar propertyId={propertyId} />
    </div>
  );
}
