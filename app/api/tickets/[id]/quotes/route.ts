/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/tickets/[tid]/quotes
 *
 * Deux cas d'utilisation :
 * 1. Propriétaire : Demande de devis à plusieurs prestataires (provider_ids)
 * 2. Prestataire : Soumission d'un devis (amount, description)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    
    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    
    // CAS 1: Propriétaire demande des devis à des prestataires
    if (body.provider_ids && Array.isArray(body.provider_ids)) {
      // Vérifier que c'est un propriétaire
      if (profileData?.role !== "owner") {
        return NextResponse.json(
          { error: "Seuls les propriétaires peuvent demander des devis" },
          { status: 403 }
        );
      }

      // Vérifier l'accès au ticket
      const { data: ticket } = await supabaseClient
        .from("tickets")
        .select(`
          id,
          titre,
          property_id,
          property:properties!inner(owner_id, adresse_complete)
        `)
        .eq("id", id as any)
        .single();

      if (!ticket) {
        return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
      }

      const ticketData = ticket as any;
      if (ticketData.property?.owner_id !== profileData.id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }

      // Créer des work_orders pour chaque prestataire
      const workOrderPromises = body.provider_ids.map(async (providerId: string) => {
        // Vérifier si un work_order existe déjà
        const { data: existing } = await supabaseClient
          .from("work_orders")
          .select("id")
          .eq("ticket_id", id as any)
          .eq("provider_id", providerId as any)
          .single();

        if (existing) {
          return { id: (existing as any).id, status: "existing" };
        }

        // Créer le work_order
        const { data: workOrder, error } = await supabaseClient
          .from("work_orders")
          .insert({
            ticket_id: id,
            provider_id: providerId,
            statut: "assigned",
            date_creation: new Date().toISOString(),
          } as any)
          .select()
          .single();

        if (error) {
          console.error("Erreur création work_order:", error);
          return null;
        }

        return workOrder;
      });

      const results = await Promise.all(workOrderPromises);
      const created = results.filter(r => r && r.status !== "existing");

      // Créer des notifications pour les prestataires (optionnel)
      try {
        for (const providerId of body.provider_ids) {
          await supabaseClient.from("notifications").insert({
            user_id: providerId,
            type: "quote_request",
            title: "Nouvelle demande de devis",
            message: `Vous avez reçu une demande de devis pour: ${ticketData.titre}`,
            data: { ticket_id: id },
          } as any);
        }
      } catch (notifError) {
        console.error("Erreur création notifications:", notifError);
        // Ne pas faire échouer la requête pour ça
      }

      return NextResponse.json({ 
        success: true,
        message: `Demande envoyée à ${body.provider_ids.length} prestataire(s)`,
        work_orders_created: created.length,
      });
    }

    // CAS 2: Prestataire soumet un devis
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
        work_orders(provider_id)
      `)
      .eq("id", id as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

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
        ticket_id: id,
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
    try {
      await supabaseClient.from("outbox").insert({
        event_type: "Quote.Submitted",
        payload: {
          quote_id: (quote as any).id,
          ticket_id: id,
          provider_id: profileData.id,
          amount,
        },
      } as any);
    } catch (outboxError) {
      console.error("Erreur outbox:", outboxError);
    }

    return NextResponse.json({ quote });
  } catch (error: unknown) {
    console.error("Erreur POST quotes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tickets/[tid]/quotes - Lister les devis d'un ticket
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      .eq("ticket_id", id as any)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ quotes: quotes || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

