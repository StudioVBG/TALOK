// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/tickets/[tid]/quotes - Proposer un devis pour un ticket
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, description, valid_until } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Montant requis et doit être positif" },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description requise" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est prestataire assigné
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select(`
        id,
        work_orders!inner(provider_id)
      `)
      .eq("id", params.id as any)
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

    const profileData = profile as any;
    if (profileData?.role !== "provider") {
      return NextResponse.json(
        { error: "Seuls les prestataires peuvent proposer des devis" },
        { status: 403 }
      );
    }

    const ticketData = ticket as any;
    const isAssigned = ticketData.work_orders?.some((wo: any) => wo.provider_id === profileData.id);

    if (!isAssigned) {
      return NextResponse.json(
        { error: "Vous n'êtes pas assigné à ce ticket" },
        { status: 403 }
      );
    }

    // Créer le devis
    const { data: quote, error } = await supabaseClient
      .from("quotes")
      .insert({
        ticket_id: params.id,
        provider_id: profileData.id,
        amount,
        description,
        valid_until: valid_until || null,
        status: "pending",
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "Quote.Submitted",
      payload: {
        quote_id: (quote as any).id,
        ticket_id: params.id,
        provider_id: profileData.id,
        amount,
      },
    } as any);

    return NextResponse.json({ quote });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tickets/[tid]/quotes - Lister les devis d'un ticket
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier l'accès au ticket
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select(`
        id,
        property:properties!inner(owner_id),
        lease:leases(roommates(user_id))
      `)
      .eq("id", params.id as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const ticketData = ticket as any;
    const profileDataGet = profile as any;
    const hasAccess = ticketData.property.owner_id === profileDataGet?.id ||
      ticketData.lease?.roommates?.some((r: any) => r.user_id === user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les devis
    const { data: quotes, error } = await supabaseClient
      .from("quotes")
      .select(`
        *,
        provider:profiles!quotes_provider_id_fkey(prenom, nom)
      `)
      .eq("ticket_id", params.id as any)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ quotes: quotes || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

