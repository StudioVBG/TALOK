import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

export interface TenantPendingCashReceipt {
  id: string;
  /**
   * Numéro "REC-YYYY-MM-XXXX" auto-généré par trigger côté DB.
   * Peut être null si le trigger n'a pas encore été (re)déployé —
   * l'UI retombe alors sur les 8 premiers caractères de l'id.
   */
  receipt_number: string | null;
  amount: number;
  periode: string | null;
  owner_signed_at: string | null;
  property_address: string | null;
  owner_name: string;
  created_at: string;
}

/**
 * Reçus espèces en attente de contresignature du locataire courant.
 * Utilisé par /tenant/payments pour afficher un bandeau d'action.
 */
export async function getTenantPendingCashReceipts(): Promise<TenantPendingCashReceipt[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  const { data, error } = await serviceClient
    .from("cash_receipts")
    .select(`
      id, receipt_number, amount, periode, owner_signed_at, created_at,
      owner:profiles!cash_receipts_owner_id_fkey(prenom, nom),
      property:properties(adresse_complete)
    `)
    .eq("tenant_id", profile.id)
    .eq("status", "pending_tenant")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Filet défensif : on écarte toute ligne sans id pour éviter des CTA
  // pointant vers /tenant/payments/cash-receipt/undefined et des 500 en
  // cascade sur les routes API correspondantes.
  return data
    .filter((r: any) => typeof r?.id === "string" && r.id.length > 0)
    .map((r: any) => ({
      id: r.id,
      receipt_number: r.receipt_number ?? null,
      amount: Number(r.amount),
      periode: r.periode,
      owner_signed_at: r.owner_signed_at,
      created_at: r.created_at,
      property_address: r.property?.adresse_complete ?? null,
      owner_name: `${r.owner?.prenom ?? ""} ${r.owner?.nom ?? ""}`.trim() || "Propriétaire",
    }));
}

export async function getOwnerInvoices(limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  const { data } = await serviceClient
    .from("invoices")
    .select(`
      *,
      lease:leases(
        property:properties(adresse_complete)
      ),
      tenant:profiles!invoices_tenant_id_fkey(nom, prenom)
    `)
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Déduplication par id (sécurité contre les doublons PostgREST)
  const seen = new Set<string>();
  return (data || [])
    .filter((inv: any) => {
      if (seen.has(inv.id)) return false;
      seen.add(inv.id);
      return true;
    })
    .map((inv: any) => {
      const tenantName = inv.tenant
        ? `${inv.tenant.prenom || ""} ${inv.tenant.nom || ""}`.trim() || "Locataire inconnu"
        : "Locataire inconnu";

      return {
        id: inv.id,
        periode: inv.periode,
        montant_total: inv.montant_total,
        statut: inv.statut as "draft" | "sent" | "paid" | "late" | "cancelled",
        created_at: inv.created_at,
        lease: {
          property: {
            adresse_complete: inv.lease?.property?.adresse_complete
          },
          tenant_name: tenantName
        }
      };
    });
}

export async function getTenantInvoices() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const serviceClient = getServiceClient();

  // Trouver le profil tenant
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  // 1. Factures directement liées via tenant_id (locataire principal)
  const { data: directInvoices } = await serviceClient
    .from("invoices")
    .select(`
      *,
      lease:leases(
        property:properties(adresse_complete)
      )
    `)
    .eq("tenant_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);

  // 2. Fallback colocataires : factures des baux où je suis signataire
  //    (tenant_id différent ou NULL)
  const { data: myLeaseIds } = await serviceClient
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .in("role", ["colocataire", "locataire_principal"]);

  const leaseIds = (myLeaseIds || []).map((ls) => ls.lease_id).filter(Boolean);
  const directInvoiceIds = new Set((directInvoices || []).map((inv) => inv.id));

  let colocInvoices: typeof directInvoices = [];
  if (leaseIds.length > 0) {
    const { data } = await serviceClient
      .from("invoices")
      .select(`
        *,
        lease:leases(
          property:properties(adresse_complete)
        )
      `)
      .in("lease_id", leaseIds)
      .or(`tenant_id.is.null,tenant_id.neq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    colocInvoices = (data || []).filter((inv) => !directInvoiceIds.has(inv.id));
  }

  // 3. Fusionner et trier par date décroissante
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allInvoices = [...(directInvoices || []), ...(colocInvoices || [])].sort((a: any, b: any) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).slice(0, 200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allInvoices.map((inv: any) => ({
    id: inv.id,
    periode: inv.periode,
    montant_total: inv.montant_total,
    montant_loyer: inv.montant_loyer,
    montant_charges: inv.montant_charges,
    date_echeance: inv.date_echeance,
    due_date: inv.due_date || inv.date_echeance,
    metadata: inv.metadata,
    notes: inv.notes,
    type: inv.type || null,
    statut: inv.statut as "draft" | "sent" | "paid" | "late" | "cancelled",
    created_at: inv.created_at,
    lease: {
      property: {
        adresse_complete: inv.lease?.property?.adresse_complete
      }
    }
  }));
}
