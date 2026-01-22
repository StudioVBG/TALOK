export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/invoices/[iid]/remind - Relancer un paiement (BTN-P08)
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer la facture
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id)
        )
      `)
      .eq("id", id as any)
      .single();

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const invoiceData = invoice as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = invoiceData.lease?.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut relancer un paiement" },
        { status: 403 }
      );
    }

    // Vérifier que la facture n'est pas déjà payée
    if (invoiceData.statut === "paid") {
      return NextResponse.json(
        { error: "Cette facture est déjà payée" },
        { status: 400 }
      );
    }

    // Récupérer les locataires du bail pour envoyer la notification
    const { data: roommates } = await supabase
      .from("roommates")
      .select(`
        user_id,
        profile:profiles!inner(user_id)
      `)
      .eq("lease_id", invoiceData.lease_id)
      .is("left_on", null);

    // Émettre un événement pour chaque locataire
    if (roommates) {
      for (const roommate of roommates) {
        const roommateData = roommate as any;
        await supabase.from("outbox").insert({
          event_type: "Payment.Reminder",
          payload: {
            invoice_id: id,
            lease_id: invoiceData.lease_id,
            tenant_id: roommateData.profile?.user_id,
            amount: invoiceData.montant_total,
            month: invoiceData.periode,
          },
        } as any);
      }
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "payment_reminder_sent",
      entity_type: "invoice",
      entity_id: id,
      metadata: {
        lease_id: invoiceData.lease_id,
        amount: invoiceData.montant_total,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Relance envoyée",
      reminders_sent: roommates?.length || 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

