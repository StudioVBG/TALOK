export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RentView } from "./RentView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseRentPage({ params }: PageProps) {
  const { id: leaseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  // Fetch lease with property + financial info
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id, statut, type_bail, date_debut,
      property:properties!inner(id, adresse_complete, ville, owner_id, loyer_hc, charges_mensuelles)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease || (lease.property as any)?.owner_id !== profile.id) {
    redirect("/owner/leases");
  }

  const property = lease.property as any;

  // Fetch invoices for this lease
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, numero, periode, montant_total, statut, date_echeance, created_at, metadata")
    .eq("lease_id", leaseId)
    .order("periode", { ascending: false })
    .limit(24);

  // Fetch payments for this lease (via invoices)
  const { data: payments } = await supabase
    .from("payments")
    .select(`
      id, date_paiement, montant, statut, methode,
      invoices!inner(id, periode, lease_id)
    `)
    .eq("invoices.lease_id", leaseId)
    .order("date_paiement", { ascending: false })
    .limit(24);

  return (
    <RentView
      leaseId={leaseId}
      leaseStatus={lease.statut}
      loyer={property.loyer_hc || 0}
      charges={property.charges_mensuelles || 0}
      invoices={invoices || []}
      payments={(payments || []).map((p: any) => ({
        id: p.id,
        date_paiement: p.date_paiement,
        montant: p.montant,
        statut: p.statut,
        methode: p.methode,
        periode: p.invoices?.periode,
      }))}
    />
  );
}
