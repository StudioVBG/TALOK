export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { workOrderSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil et le rôle pour filtrer les résultats
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticket_id");
    const providerId = searchParams.get("provider_id");

    let query = supabaseClient.from("work_orders").select("*").order("created_at", { ascending: false });

    // Filtrer selon le rôle de l'utilisateur
    const role = (profile as any).role;
    const profileId = (profile as any).id;

    if (role === "provider") {
      // Un prestataire ne voit que ses propres interventions
      query = query.eq("provider_id", profileId as any);
    } else if (role === "owner") {
      // Un propriétaire voit les work orders liés à ses propriétés (via tickets)
      const { data: properties } = await supabaseClient
        .from("properties")
        .select("id")
        .eq("owner_id", profileId as any);
      const propertyIds = (properties || []).map((p: any) => p.id);
      if (propertyIds.length === 0) {
        return NextResponse.json({ workOrders: [] });
      }
      const { data: tickets } = await supabaseClient
        .from("tickets")
        .select("id")
        .in("property_id", propertyIds as any);
      const ticketIds = (tickets || []).map((t: any) => t.id);
      if (ticketIds.length === 0) {
        return NextResponse.json({ workOrders: [] });
      }
      query = query.in("ticket_id", ticketIds as any);
    } else if (role === "tenant") {
      // Un locataire voit uniquement les work orders liés à ses tickets
      const { data: tenantTickets } = await supabaseClient
        .from("tickets")
        .select("id")
        .eq("created_by_profile_id", profileId as any);
      const tenantTicketIds = (tenantTickets || []).map((t: any) => t.id);
      if (tenantTicketIds.length === 0) {
        return NextResponse.json({ workOrders: [] });
      }
      query = query.in("ticket_id", tenantTicketIds as any);
    } else if (role !== "admin") {
      return NextResponse.json({ workOrders: [] });
    }
    // admin: pas de filtre additionnel

    if (ticketId) {
      query = query.eq("ticket_id", ticketId as any);
    }
    if (providerId) {
      query = query.eq("provider_id", providerId as any);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ workOrders: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? (error as Error).message : "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const validated = workOrderSchema.parse(body);

    const { data: workOrder, error } = await supabaseClient
      .from("work_orders")
      .insert({
        ...validated,
        statut: "assigned",
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le statut du ticket
    const validatedData = validated as any;
    await supabaseClient
      .from("tickets")
      .update({ statut: "in_progress" } as any)
      .eq("id", validatedData.ticket_id as any);

    // Émettre des événements
    await supabaseClient.from("outbox").insert({
      event_type: "Ticket.Assigned",
      payload: {
        ticket_id: validatedData.ticket_id,
        work_order_id: (workOrder as any).id,
        provider_id: validatedData.provider_id,
      },
    } as any);

    await supabaseClient.from("outbox").insert({
      event_type: "Ticket.InProgress",
      payload: {
        ticket_id: validatedData.ticket_id,
        work_order_id: (workOrder as any).id,
      },
    } as any);

    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: (error as any).errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? (error as Error).message : "Erreur serveur" }, { status: 500 });
  }
}

