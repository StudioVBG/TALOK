"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpensesList } from "@/features/colocation/components/ExpensesList";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import type { ColocationMemberWithDetails } from "@/features/colocation/types";

export default function TenantColocationExpensesPage() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | undefined>();
  const [members, setMembers] = useState<ColocationMemberWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

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

          const membersData = await colocationMembersService.getMembers(lease.property_id);
          setMembers(membersData);

          const myMember = membersData.find((m) => m.tenant_profile_id === profile.id);
          if (myMember) setCurrentMemberId(myMember.id);
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
      <h1 className="text-2xl font-bold">Depenses partagees</h1>
      <ExpensesList
        propertyId={propertyId}
        members={members}
        currentMemberId={currentMemberId}
      />
    </div>
  );
}
