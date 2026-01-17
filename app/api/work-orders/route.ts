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

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticket_id");
    const providerId = searchParams.get("provider_id");

    let query = supabaseClient.from("work_orders").select("*").order("created_at", { ascending: false });

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
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
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

