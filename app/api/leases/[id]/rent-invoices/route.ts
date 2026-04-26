export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/rent-invoices - Émettre une facture de loyer mensuelle
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Service-role + check explicite owner/admin
    // (cf. docs/audits/rls-cascade-audit.md)
    const serviceClient = getServiceClient();

    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        loyer,
        charges_forfaitaires,
        property:properties(owner_id)
      `)
      .eq("id", id)
      .maybeSingle();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = lease as {
      statut?: string;
      loyer?: number;
      charges_forfaitaires?: number;
      property?: { owner_id?: string } | null;
    };
    if (leaseData.statut !== "active") {
      return NextResponse.json(
        { error: "Le bail doit être actif" },
        { status: 400 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileData = profile as { id: string; role: string } | null;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si une facture existe déjà pour ce mois
    const { data: existing } = await serviceClient
      .from("invoices")
      .select("id")
      .eq("lease_id", id)
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
      .eq("lease_id", id as any)
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

    // Calculer les montants avec validation de type
    const parsedLoyerOverride = loyer_override != null ? Number(loyer_override) : null;
    const parsedChargesOverride = charges_override != null ? Number(charges_override) : null;

    if (parsedLoyerOverride != null && (!Number.isFinite(parsedLoyerOverride) || parsedLoyerOverride < 0)) {
      return NextResponse.json(
        { error: "loyer_override doit être un nombre positif valide" },
        { status: 400 }
      );
    }
    if (parsedChargesOverride != null && (!Number.isFinite(parsedChargesOverride) || parsedChargesOverride < 0)) {
      return NextResponse.json(
        { error: "charges_override doit être un nombre positif valide" },
        { status: 400 }
      );
    }

    const montant_loyer = parsedLoyerOverride ?? leaseData.loyer ?? 0;
    const montant_charges = parsedChargesOverride ?? leaseData.charges_forfaitaires ?? 0;
    const montant_total = montant_loyer + montant_charges;
    const dueDate = `${month}-05`;

    if (!profileData) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Créer la facture
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        lease_id: id as any,
        owner_id: profileData.id,
        tenant_id: tenantProfileId,
        periode: month,
        montant_total,
        montant_loyer,
        montant_charges,
        date_echeance: dueDate,
        due_date: dueDate,
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
      .eq("lease_id", id as any)
      .in("role", ["principal", "tenant"] as any)
      .is("left_on", null);

    const allRoommatesData = allRoommates as any;
    if (allRoommatesData && allRoommatesData.length > 1) {
      const totalWeight = allRoommatesData.reduce((sum: number, r: any) => sum + parseFloat(r.weight || 1), 0);
      const monthDate = new Date(`${month}-01`);

      for (const roommate of allRoommatesData) {
        const share = (parseFloat(roommate.weight || 1) / totalWeight) * montant_total;
        await supabase.from("payment_shares").insert({
          lease_id: id as any,
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
        lease_id: id as any,
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





