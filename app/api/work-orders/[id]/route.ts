export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { workOrderUpdateSchema } from "@/lib/validations";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: workOrder, error } = await supabaseClient
      .from("work_orders")
      .select("*")
      .eq("id", params.id as any)
      .single();

    if (error) throw error;
    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
    const validated = workOrderUpdateSchema.parse(body);

    const { data: workOrder, error } = await supabaseClient
      .from("work_orders")
      .update(validated as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (error) throw error;

    // Si l'ordre de travail est terminé, mettre à jour le ticket
    const validatedData = validated as any;
    if (validatedData.statut === "done") {
      const workOrderData = workOrder as any;
      await supabaseClient
        .from("tickets")
        .update({ statut: "resolved" } as any)
        .eq("id", workOrderData.ticket_id as any);

      // Émettre un événement
      await supabaseClient.from("outbox").insert({
        event_type: "Ticket.Done",
        payload: {
          ticket_id: workOrderData.ticket_id,
          work_order_id: workOrderData.id,
        },
      } as any);
    }

    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { error } = await supabaseClient.from("work_orders").delete().eq("id", params.id as any);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

