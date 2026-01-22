export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/quotes/[id]/reject - Refuser un devis
 *
 * Seul le propriétaire du ticket peut refuser un devis.
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
        { error: "Seul le propriétaire peut refuser un devis" },
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

    // Refuser le devis
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ status: "rejected" })
      .eq("id", id);

    if (updateError) throw updateError;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Quote.Rejected",
      payload: {
        quote_id: id,
        ticket_id: quoteData.ticket_id,
        provider_id: quoteData.provider_id,
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "Devis refusé"
    });
  } catch (error: unknown) {
    console.error("[POST /api/quotes/[id]/reject] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

