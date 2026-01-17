export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/rent-invoices - Émettre une facture de loyer mensuelle
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { month, loyer_override, charges_override } = body; // Format "YYYY-MM"

    if (!month) {
      return NextResponse.json(
        { error: "Mois requis (format YYYY-MM)" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
        loyer,
        charges_forfaitaires,
        property:properties!inner(owner_id)
      `)
      .eq("id", params.id as any)
      .single();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = lease as any;
    if (leaseData.statut !== "active") {
      return NextResponse.json(
        { error: "Le bail doit être actif" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (leaseData.property.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si une facture existe déjà pour ce mois
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("lease_id", params.id as any)
      .eq("periode", month)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Une facture existe déjà pour ce mois" },
        { status: 409 }
      );
    }

    // Récupérer les locataires
    const { data: roommates } = await supabase
      .from("roommates")
      .select("profile_id, role")
      .eq("lease_id", params.id as any)
      .eq("role", "principal" as any)
      .is("left_on", null)
      .limit(1);

    const roommatesData = roommates as any;
    const tenantProfileId = roommatesData?.[0]?.profile_id;

    if (!tenantProfileId) {
      return NextResponse.json(
        { error: "Aucun locataire principal trouvé" },
        { status: 400 }
      );
    }

    // Calculer les montants
    const montant_loyer = loyer_override || leaseData.loyer;
    const montant_charges = charges_override || leaseData.charges_forfaitaires || 0;
    const montant_total = montant_loyer + montant_charges;

    // Créer la facture
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        lease_id: params.id as any,
        owner_id: profileData.id,
        tenant_id: tenantProfileId,
        periode: month,
        montant_total,
        montant_loyer,
        montant_charges,
        statut: "sent",
      } as any)
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const invoiceData = invoice as any;

    // Si colocation, créer les parts de paiement
    const { data: allRoommates } = await supabase
      .from("roommates")
      .select("id, weight, role")
      .eq("lease_id", params.id as any)
      .in("role", ["principal", "tenant"] as any)
      .is("left_on", null);

    const allRoommatesData = allRoommates as any;
    if (allRoommatesData && allRoommatesData.length > 1) {
      const totalWeight = allRoommatesData.reduce((sum: number, r: any) => sum + parseFloat(r.weight || 1), 0);
      const monthDate = new Date(`${month}-01`);

      for (const roommate of allRoommatesData) {
        const share = (parseFloat(roommate.weight || 1) / totalWeight) * montant_total;
        await supabase.from("payment_shares").insert({
          lease_id: params.id as any,
          invoice_id: invoiceData.id,
          month: monthDate.toISOString().split("T")[0],
          roommate_id: roommate.id,
          due_amount: share,
          status: "unpaid",
        } as any);
      }
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Rent.InvoiceIssued",
      payload: {
        invoice_id: invoiceData.id,
        lease_id: params.id as any,
        month,
        montant_total,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "invoice_issued",
      entity_type: "invoice",
      entity_id: invoiceData.id,
      metadata: { month, montant_total },
    } as any);

    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





