/**
 * Data fetching pour la liste des locataires d'un propriétaire
 */

import { createClient } from "@/lib/supabase/server";

export interface OwnerTenant {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  avatar_url?: string;
  lease_id: string;
  property_id: string;
  property_address: string;
  property_city: string;
  loyer_hc: number;
  charges_forfaitaires: number;
  total_loyer: number;
  payment_score: number; // 0-100
  payments_on_time_percentage: number; // 0-100
  balance_due: number;
  status: "active" | "pending_signature" | "former";
  last_payment_date?: string;
  next_payment_date?: string;
}

/**
 * Récupère tous les locataires d'un propriétaire via ses propriétés et baux
 */
export async function fetchOwnerTenants(ownerId: string): Promise<OwnerTenant[]> {
  const supabase = await createClient();

  // 1. Récupérer toutes les propriétés du propriétaire
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville")
    .eq("owner_id", ownerId);

  if (propertiesError) {
    console.error("[fetchOwnerTenants] Error fetching properties:", propertiesError);
    return [];
  }

  if (!properties || properties.length === 0) {
    return [];
  }

  const propertyIds = properties.map((p) => p.id);

  // 2. Récupérer tous les baux liés à ces propriétés
  const { data: leases, error: leasesError } = await supabase
    .from("leases")
    .select(`
      id,
      property_id,
      loyer,
      charges_forfaitaires,
      statut,
      date_debut,
      date_fin
    `)
    .in("property_id", propertyIds)
    .in("statut", ["active", "pending_signature", "terminated"]);

  if (leasesError) {
    console.error("[fetchOwnerTenants] Error fetching leases:", leasesError);
    return [];
  }

  if (!leases || leases.length === 0) {
    return [];
  }

  const leaseIds = leases.map((l) => l.id);

  // 3. Récupérer les signataires (locataires) de ces baux
  const { data: signers, error: signersError } = await supabase
    .from("lease_signers")
    .select(`
      id,
      lease_id,
      profile_id,
      role,
      profiles (
        id,
        prenom,
        nom,
        email,
        avatar_url
      )
    `)
    .in("lease_id", leaseIds)
    .in("role", ["locataire_principal", "colocataire"]);

  if (signersError) {
    console.error("[fetchOwnerTenants] Error fetching signers:", signersError);
    return [];
  }

  // 4. Récupérer les factures pour calculer le solde dû
  const { data: invoices, error: invoicesError } = await supabase
    .from("invoices")
    .select(`
      id,
      lease_id,
      montant_total,
      statut,
      date_echeance,
      created_at
    `)
    .in("lease_id", leaseIds);

  // 5. Récupérer les paiements pour calculer le score
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(`
      id,
      invoice_id,
      montant,
      statut,
      date_paiement,
      invoices!inner(lease_id, date_echeance)
    `)
    .in("invoices.lease_id", leaseIds);

  // 6. Construire la liste des locataires
  const tenants: OwnerTenant[] = [];

  for (const signer of signers || []) {
    const profile = signer.profiles as any;
    if (!profile) continue;

    const lease = leases.find((l) => l.id === signer.lease_id);
    if (!lease) continue;

    const property = properties.find((p) => p.id === lease.property_id);
    if (!property) continue;

    // Calculer le solde dû
    const leaseInvoices = (invoices || []).filter(
      (inv) => inv.lease_id === lease.id && inv.statut !== "paid"
    );
    const balanceDue = leaseInvoices.reduce(
      (sum, inv) => sum + Number(inv.montant_total || 0),
      0
    );

    // Calculer le score de paiement
    const leasePayments = (payments || []).filter(
      (p: any) => p.invoices?.lease_id === lease.id
    );
    let onTimeCount = 0;
    let totalPayments = leasePayments.length;

    for (const payment of leasePayments) {
      if (payment.statut === "succeeded") {
        const paymentDate = new Date(payment.date_paiement as string);
        const dueDate = new Date((payment as any).invoices?.date_echeance);
        if (paymentDate <= dueDate) {
          onTimeCount++;
        }
      }
    }

    const onTimePercentage =
      totalPayments > 0 ? Math.round((onTimeCount / totalPayments) * 100) : 100;
    const paymentScore = Math.round(onTimePercentage);

    // Trouver le dernier paiement
    const lastPayment = leasePayments
      .filter((p) => p.statut === "succeeded")
      .sort((a, b) => new Date(b.date_paiement as string).getTime() - new Date(a.date_paiement as string).getTime())[0];

    // Calculer la prochaine date de paiement
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);

    // Déterminer le statut
    let status: "active" | "pending_signature" | "former" = "active";
    if (lease.statut === "pending_signature") {
      status = "pending_signature";
    } else if (lease.statut === "terminated") {
      status = "former";
    }

    tenants.push({
      id: profile.id,
      prenom: profile.prenom || "",
      nom: profile.nom || "",
      email: profile.email || "",
      avatar_url: profile.avatar_url,
      lease_id: lease.id,
      property_id: property.id,
      property_address: property.adresse_complete || "",
      property_city: property.ville || "",
      loyer_hc: Number(lease.loyer || 0),
      charges_forfaitaires: Number(lease.charges_forfaitaires || 0),
      total_loyer:
        Number(lease.loyer || 0) + Number(lease.charges_forfaitaires || 0),
      payment_score: paymentScore,
      payments_on_time_percentage: onTimePercentage,
      balance_due: balanceDue,
      status,
      last_payment_date: lastPayment?.date_paiement ?? undefined,
      next_payment_date: nextMonth.toISOString(),
    });
  }

  return tenants;
}

