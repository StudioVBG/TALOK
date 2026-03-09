import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { LEASE_STATUS, SIGNER_ROLES } from "@/lib/constants/roles";

/**
 * POST /api/leases/[id]/generate-invoice
 *
 * Génère la facture initiale (caution + 1er mois, prorata si nécessaire)
 * pour un bail fully_signed ou active qui n'a pas encore de facture.
 *
 * Utile pour les baux créés avant la migration du trigger automatique.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  // 1. Auth check
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const serviceClient = getServiceClient();

  // 2. Charger le bail complet
  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .select("*, property:properties(id, owner_id)")
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
  }

  // 3. Vérifier que l'utilisateur est bien le propriétaire
  const ownerId = (lease as any).property?.owner_id;
  if (ownerId !== profile.id) {
    return NextResponse.json({ error: "Vous n'êtes pas le propriétaire de ce bail" }, { status: 403 });
  }

  // 4. Vérifier le statut du bail
  const validStatuses = [LEASE_STATUS.FULLY_SIGNED, LEASE_STATUS.ACTIVE];
  if (!validStatuses.includes((lease as any).statut)) {
    return NextResponse.json(
      { error: `Le bail doit être signé ou actif (statut actuel: ${(lease as any).statut})` },
      { status: 400 }
    );
  }

  // 5. Anti-doublon : vérifier si une facture initiale existe déjà
  const { data: existingInvoice } = await serviceClient
    .from("invoices")
    .select("id, montant_total, statut")
    .eq("lease_id", leaseId)
    .eq("metadata->>type" as any, "initial_invoice")
    .maybeSingle();

  if (existingInvoice) {
    return NextResponse.json({
      message: "La facture initiale existe déjà",
      invoice: existingInvoice,
      already_exists: true,
    });
  }

  // 6. Résoudre le tenant_id via lease_signers
  const { data: tenantSigner } = await serviceClient
    .from("lease_signers")
    .select("profile_id")
    .eq("lease_id", leaseId)
    .in("role", [
      SIGNER_ROLES.TENANT_PRINCIPAL,
      SIGNER_ROLES.CO_TENANT,
      "locataire" as any,
    ])
    .not("profile_id", "is", null)
    .limit(1)
    .single();

  const tenantId = tenantSigner?.profile_id;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Aucun locataire avec profil trouvé pour ce bail" },
      { status: 400 }
    );
  }

  // 7. Calculs : loyer, charges, prorata, dépôt
  const baseRent = (lease as any).loyer ?? 0;
  const baseCharges = (lease as any).charges_forfaitaires ?? 0;
  const deposit = (lease as any).depot_de_garantie ?? 0;
  const dateDebut = (lease as any).date_debut;

  if (!dateDebut) {
    return NextResponse.json(
      { error: "Le bail n'a pas de date de début" },
      { status: 400 }
    );
  }

  const startDate = new Date(dateDebut);
  const isMidMonthStart = startDate.getDate() > 1;
  const monthStr = dateDebut.slice(0, 7);

  let finalRent = baseRent;
  let finalCharges = baseCharges;

  if (isMidMonthStart) {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const remainingDays = daysInMonth - startDate.getDate() + 1;
    finalRent = (baseRent / daysInMonth) * remainingDays;
    finalCharges = (baseCharges / daysInMonth) * remainingDays;
  }

  const totalAmount = finalRent + finalCharges + deposit;
  const dueDate = dateDebut;
  const periodEndDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);
  const invoiceNumber = `INI-${monthStr.replace("-", "")}-${leaseId.slice(0, 8).toUpperCase()}`;

  // 8. Insérer la facture
  const { data: newInvoice, error: insertError } = await serviceClient
    .from("invoices")
    .insert({
      lease_id: leaseId,
      owner_id: ownerId,
      tenant_id: tenantId,
      issuer_entity_id: (lease as any).signatory_entity_id ?? null,
      invoice_number: invoiceNumber,
      periode: monthStr,
      montant_loyer: Math.round(finalRent * 100) / 100,
      montant_charges: Math.round(finalCharges * 100) / 100,
      montant_total: Math.round(totalAmount * 100) / 100,
      date_echeance: dueDate,
      period_start: dateDebut,
      period_end: periodEnd,
      statut: "sent",
      notes: `Facture initiale - Dépôt de garantie${deposit > 0 ? ` (${deposit}€)` : ""} + ${isMidMonthStart ? "loyer proratisé" : "1er mois de loyer"}`,
      metadata: {
        type: "initial_invoice",
        includes_deposit: deposit > 0,
        deposit_amount: deposit,
        is_prorated: isMidMonthStart,
        prorated_days: isMidMonthStart
          ? new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate() - startDate.getDate() + 1
          : null,
        rent_amount: Math.round(finalRent * 100) / 100,
        charges_amount: Math.round(finalCharges * 100) / 100,
        generated_manually: true,
        version: "SOTA-2026",
      },
    } as any)
    .select("id, montant_total, statut, periode, invoice_number")
    .single();

  if (insertError) {
    console.error("[generate-invoice] Insert error:", insertError);
    return NextResponse.json(
      { error: `Erreur lors de la création de la facture: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Facture initiale créée avec succès",
    invoice: newInvoice,
    details: {
      rent: Math.round(finalRent * 100) / 100,
      charges: Math.round(finalCharges * 100) / 100,
      deposit,
      total: Math.round(totalAmount * 100) / 100,
      is_prorated: isMidMonthStart,
    },
  });
}
