/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/tickets/[tid]/quotes/[qid]/approve - Approuver un devis (BTN-P15)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const { id, qid } = await params;
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est propriétaire du logement
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select(`
        id,
        property:properties!inner(owner_id)
      `)
      .eq("id", id as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const ticketData = ticket as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = ticketData.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut approuver un devis" },
        { status: 403 }
      );
    }

    // Vérifier que le devis existe et est en attente
    const { data: quote } = await supabaseClient
      .from("quotes")
      .select("*")
      .eq("id", qid as any)
      .eq("ticket_id", id as any)
      .single();

    if (!quote) {
      return NextResponse.json(
        { error: "Devis non trouvé" },
        { status: 404 }
      );
    }

    if ((quote as any).status !== "pending") {
      return NextResponse.json(
        { error: "Ce devis a déjà été traité" },
        { status: 400 }
      );
    }

    // Approuver le devis
    const { data: updatedQuote, error } = await supabaseClient
      .from("quotes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      } as any)
      .eq("id", qid as any)
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le statut du ticket en "in_progress"
    await supabaseClient
      .from("tickets")
      .update({ statut: "in_progress" } as any)
      .eq("id", id as any);

    // Émettre des événements
    await supabaseClient.from("outbox").insert({
      event_type: "Quote.Approved",
      payload: {
        quote_id: qid,
        ticket_id: id,
        approved_by: user.id,
      },
    } as any);

    await supabaseClient.from("outbox").insert({
      event_type: "Ticket.InProgress",
      payload: {
        ticket_id: id,
        reason: "Devis approuvé",
      },
    } as any);

    // Journaliser
    await supabaseClient.from("audit_log").insert({
      user_id: user.id,
      action: "quote_approved",
      entity_type: "quote",
      entity_id: qid,
      metadata: { ticket_id: id },
    } as any);

    return NextResponse.json({ quote: updatedQuote });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

