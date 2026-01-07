// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TenantsClient } from "./TenantsClient";
import { Skeleton } from "@/components/ui/skeleton";


export const metadata = {
  title: "Mes Locataires | Talok",
  description: "Gérez vos locataires et suivez leurs paiements",
};

interface TenantWithDetails {
  id: string;
  profile_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  avatar_url: string | null;
  lease_id: string;
  lease_status: string;
  lease_start: string;
  lease_end: string | null;
  lease_type: string;
  loyer: number;
  charges: number;
  property_id: string;
  property_address: string;
  property_city: string;
  property_type: string;
  payments_on_time: number;
  payments_late: number;
  payments_total: number;
  current_balance: number;
  last_payment_date: string | null;
  tenant_score: number;
}

async function fetchOwnerTenants(ownerId: string): Promise<TenantWithDetails[]> {
  const supabase = await createClient();

  // Récupérer tous les baux du propriétaire avec les infos locataires
  const { data: leases, error } = await supabase
    .from("leases")
    .select(`
      id,
      statut,
      date_debut,
      date_fin,
      type_bail,
      loyer,
      charges_forfaitaires,
      property:properties!inner(
        id,
        adresse_complete,
        ville,
        type,
        owner_id
      ),
      lease_signers(
        role,
        profile:profiles(
          id,
          prenom,
          nom,
          email,
          telephone,
          avatar_url
        )
      )
    `)
    .eq("property.owner_id", ownerId)
    .in("statut", ["active", "pending_signature", "pending_owner_signature"]);

  if (error) {
    console.error("[fetchOwnerTenants] Error:", error);
    return [];
  }

  const tenants: TenantWithDetails[] = [];

  for (const lease of leases || []) {
    // Trouver le locataire principal ou colocataires
    const tenantSigners = lease.lease_signers?.filter(
      (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
    ) || [];

    for (const signer of tenantSigners) {
      if (!signer.profile) continue;

      // Récupérer les stats de paiement pour ce locataire
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, statut, montant_total, date_paiement, date_echeance")
        .eq("lease_id", lease.id)
        .eq("tenant_id", signer.profile.id);

      let paymentsOnTime = 0;
      let paymentsLate = 0;
      let lastPaymentDate: string | null = null;
      let currentBalance = 0;

      (invoices || []).forEach((inv: any) => {
        if (inv.statut === "paid") {
          // Vérifier si payé à temps
          if (inv.date_paiement && inv.date_echeance) {
            if (new Date(inv.date_paiement) <= new Date(inv.date_echeance)) {
              paymentsOnTime++;
            } else {
              paymentsLate++;
            }
          } else {
            paymentsOnTime++;
          }
          if (!lastPaymentDate || inv.date_paiement > lastPaymentDate) {
            lastPaymentDate = inv.date_paiement;
          }
        } else if (inv.statut === "sent" || inv.statut === "late") {
          currentBalance += inv.montant_total || 0;
        }
      });

      const paymentsTotal = paymentsOnTime + paymentsLate;
      
      // Calculer le score locataire (0-5 étoiles)
      let score = 5;
      if (paymentsTotal > 0) {
        const onTimeRate = paymentsOnTime / paymentsTotal;
        score = Math.round(onTimeRate * 5);
      }
      if (currentBalance > 0) {
        score = Math.max(1, score - 1);
      }

      tenants.push({
        id: `${lease.id}-${signer.profile.id}`,
        profile_id: signer.profile.id,
        prenom: signer.profile.prenom || "",
        nom: signer.profile.nom || "",
        email: signer.profile.email || "",
        telephone: signer.profile.telephone,
        avatar_url: signer.profile.avatar_url,
        lease_id: lease.id,
        lease_status: lease.statut,
        lease_start: lease.date_debut,
        lease_end: lease.date_fin,
        lease_type: lease.type_bail,
        loyer: lease.loyer || 0,
        charges: lease.charges_forfaitaires || 0,
        property_id: lease.property?.id || "",
        property_address: lease.property?.adresse_complete || "",
        property_city: lease.property?.ville || "",
        property_type: lease.property?.type || "",
        payments_on_time: paymentsOnTime,
        payments_late: paymentsLate,
        payments_total: paymentsTotal,
        current_balance: currentBalance,
        last_payment_date: lastPaymentDate,
        tenant_score: score,
      });
    }
  }

  return tenants;
}

function TenantsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default async function TenantsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  const tenants = await fetchOwnerTenants(profile.id);

  return (
    <Suspense fallback={<TenantsSkeleton />}>
      <TenantsClient tenants={tenants} />
    </Suspense>
  );
}

