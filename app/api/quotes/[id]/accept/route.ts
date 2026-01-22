export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/quotes/[id]/accept - Accepter un devis
 *
 * Seul le propriétaire du ticket peut accepter un devis.
 * Accepter un devis refuse automatiquement les autres devis en attente.
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

    // Récupérer le devis avec le ticket associé
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        id,
        ticket_id,
        provider_id,
        amount,
        status,
        ticket:tickets!inner(
          id,
          property:properties!inner(owner_id)
        )
      `)
      .eq("id", id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Devis non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est le propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const quoteData = quote as any;
    if (quoteData.ticket.property.owner_id !== profile?.id) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut accepter un devis" },
        { status: 403 }
      );
    }

    // Vérifier que le devis est en attente
    if (quoteData.status !== "pending") {
      return NextResponse.json(
        { error: "Ce devis n'est plus en attente" },
        { status: 400 }
      );
    }

    // Accepter ce devis
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ status: "accepted" })
      .eq("id", id);

    if (updateError) throw updateError;

    // Refuser les autres devis en attente pour ce ticket
    await supabase
      .from("quotes")
      .update({ status: "rejected" })
      .eq("ticket_id", quoteData.ticket_id)
      .eq("status", "pending")
      .neq("id", id);

    // Mettre à jour le work_order avec le coût
    await supabase
      .from("work_orders")
      .update({ 
        cout_estime: quoteData.amount,
        statut: "scheduled"
      })
      .eq("ticket_id", quoteData.ticket_id)
      .eq("provider_id", quoteData.provider_id);

    // Mettre à jour le statut du ticket
    await supabase
      .from("tickets")
      .update({ statut: "in_progress" })
      .eq("id", quoteData.ticket_id);

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Quote.Accepted",
      payload: {
        quote_id: id,
        ticket_id: quoteData.ticket_id,
        provider_id: quoteData.provider_id,
        amount: quoteData.amount,
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "Devis accepté avec succès"
    });
  } catch (error: unknown) {
    console.error("[POST /api/quotes/[id]/accept] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

