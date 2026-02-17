import { createClient } from "@/lib/supabase/server";
import type { InvoiceRow, ProfileRow } from "@/lib/supabase/database.types";

/**
 * ✅ SOTA BIC 2026: Récupère les factures du locataire
 * Stratégie double: par tenant_id direct OU via lease_signers (fallback pour les
 * factures générées avant que le tenant_id soit lié).
 */
export async function fetchTenantInvoices(userId: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single() as { data: Pick<ProfileRow, "id"> | null; error: Error | null };

  if (!profile) return [];

  // Stratégie 1: Requête directe par tenant_id
  const { data: directInvoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", profile.id)
    .order("periode", { ascending: false }) as { data: InvoiceRow[] | null; error: Error | null };

  // Stratégie 2: Factures via les baux où le locataire est signataire
  // Cela couvre les factures où tenant_id est null
  const { data: leaseSigners } = await supabase
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .in("role", ["locataire_principal", "locataire", "colocataire"]);

  const leaseIds = (leaseSigners || []).map((ls: { lease_id: string }) => ls.lease_id);

  let leaseInvoices: InvoiceRow[] = [];
  if (leaseIds.length > 0) {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .in("lease_id", leaseIds)
      .is("tenant_id", null)
      .order("periode", { ascending: false }) as { data: InvoiceRow[] | null; error: Error | null };
    leaseInvoices = data || [];
  }

  // Fusionner et dédupliquer
  const allInvoices = [...(directInvoices || []), ...leaseInvoices];
  const uniqueInvoices = allInvoices.filter(
    (inv, index, self) => self.findIndex((i) => i.id === inv.id) === index
  );

  // Trier par période décroissante
  uniqueInvoices.sort((a, b) => (b.periode || "").localeCompare(a.periode || ""));

  return uniqueInvoices;
}
