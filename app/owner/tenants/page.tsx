export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TenantsClient } from "./TenantsClient";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveTenantDisplay } from "@/lib/helpers/resolve-tenant-display";
import { computeTenantScore, getTenantDisplayId, getTenantLeaseStatus } from "@/lib/helpers/tenant-score";

interface LeaseSignerProfile {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  telephone?: string | null;
  avatar_url?: string | null;
}

interface LeaseSignerRow {
  role?: string;
  invited_email?: string | null;
  invited_name?: string | null;
  signature_status?: string;
  profile?: LeaseSignerProfile | null;
}

interface InvoiceRow {
  lease_id: string;
  tenant_id: string;
  statut: string;
  montant_total: number;
  date_paiement: string | null;
  date_echeance: string | null;
}

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
  // ✅ FIX: Inclure invited_email et invited_name pour les locataires en attente
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
        invited_email,
        invited_name,
        signature_status,
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
    .in("statut", [
      "active",
      "pending_signature",
      "partially_signed",
      "pending_owner_signature",
      "fully_signed",
      "notice_given",
      "sent",
    ]);

  if (error) {
    console.error("[fetchOwnerTenants] Error:", error);
    return [];
  }

  // Batch: collect lease_ids pour tous les signers avec profil (une requête invoices par lot)
  const leaseIds: string[] = [];
  for (const lease of leases || []) {
    const signers = (lease.lease_signers as LeaseSignerRow[] | undefined)?.filter(
      (s) => (s.role === "locataire_principal" || s.role === "colocataire") && s.profile?.id
    ) || [];
    for (const s of signers) {
      if (s.profile?.id) {
        leaseIds.push(lease.id);
      }
    }
  }

  // Une seule requête invoices pour tous les (lease_id, tenant_id) concernés
  const invoiceStatsByKey = new Map<string, { paymentsOnTime: number; paymentsLate: number; lastPaymentDate: string | null; currentBalance: number }>();

  if (leaseIds.length > 0) {
    const uniqueLeaseIds = [...new Set(leaseIds)];
    const { data: allInvoices, error: invError } = await supabase
      .from("invoices")
      .select("lease_id, tenant_id, statut, montant_total, date_paiement, date_echeance")
      .in("lease_id", uniqueLeaseIds);

    if (invError) {
      console.warn("[fetchOwnerTenants] Erreur requête invoices (non bloquante):", invError);
    } else {
      for (const inv of (allInvoices || []) as InvoiceRow[]) {
        const tenantId = inv.tenant_id;
        if (!tenantId) continue;
        const key = `${inv.lease_id}-${tenantId}`;
        let stats = invoiceStatsByKey.get(key);
        if (!stats) {
          stats = { paymentsOnTime: 0, paymentsLate: 0, lastPaymentDate: null, currentBalance: 0 };
          invoiceStatsByKey.set(key, stats);
        }
        const statut = inv.statut;
        const montant_total = inv.montant_total ?? 0;
        const date_paiement = inv.date_paiement;
        const date_echeance = inv.date_echeance;
        if (statut === "paid") {
          if (date_paiement && date_echeance) {
            if (new Date(date_paiement) <= new Date(date_echeance)) {
              stats.paymentsOnTime++;
            } else {
              stats.paymentsLate++;
            }
          } else {
            stats.paymentsOnTime++;
          }
          if (!stats.lastPaymentDate || (date_paiement && date_paiement > stats.lastPaymentDate)) {
            stats.lastPaymentDate = date_paiement;
          }
        } else if (statut === "sent" || statut === "late") {
          stats.currentBalance += montant_total;
        }
      }
    }
  }

  const tenants: TenantWithDetails[] = [];

  for (const lease of leases || []) {
    // Trouver le locataire principal ou colocataires
    const tenantSigners = (lease.lease_signers as LeaseSignerRow[] | undefined)?.filter(
      (s) => s.role === "locataire_principal" || s.role === "colocataire"
    ) || [];

    for (const signer of tenantSigners) {
      // ✅ FIX: Afficher aussi les locataires invités mais pas encore inscrits
      if (!signer.profile && !signer.invited_email) continue;

      const key = signer.profile ? `${lease.id}-${signer.profile.id}` : "";
      const stats = key ? invoiceStatsByKey.get(key) : null;
      const paymentsOnTime = stats?.paymentsOnTime ?? 0;
      const paymentsLate = stats?.paymentsLate ?? 0;
      const lastPaymentDate = stats?.lastPaymentDate ?? null;
      const currentBalance = stats?.currentBalance ?? 0;

      const paymentsTotal = paymentsOnTime + paymentsLate;
      const score = computeTenantScore(paymentsOnTime, paymentsLate, currentBalance);
      const display = resolveTenantDisplay(signer);
      const tenantId = getTenantDisplayId(
        lease.id,
        display.isLinked,
        signer.profile?.id ?? "",
        signer.invited_email ?? ""
      );
      const profileId = signer.profile?.id || "";
      const leaseStatus = getTenantLeaseStatus(display.isLinked, lease.statut);

      tenants.push({
        id: tenantId,
        profile_id: profileId,
        prenom: display.prenom,
        nom: display.nom,
        email: display.email,
        telephone: display.telephone || signer.profile?.telephone || null,
        avatar_url: signer.profile?.avatar_url || null,
        lease_id: lease.id,
        lease_status: leaseStatus,
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

