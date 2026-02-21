import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

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
        property:properties(adresse_complete),
        signers:lease_signers(
          role,
          profile:profiles(nom, prenom)
        )
      )
    `)
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Transformation des données pour correspondre à l'interface Invoice
  return (data || []).map((inv: any) => {
    // Trouver le nom du locataire principal
    const tenantSigner = inv.lease?.signers?.find((s: any) => s.role === 'locataire_principal');
    const tenantName = tenantSigner?.profile 
      ? `${tenantSigner.profile.prenom} ${tenantSigner.profile.nom}` 
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
    statut: inv.statut as "draft" | "sent" | "paid" | "late" | "cancelled",
    created_at: inv.created_at,
    lease: {
      property: {
        adresse_complete: inv.lease?.property?.adresse_complete
      }
    }
  }));
}
