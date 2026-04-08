export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { workOrderSchema } from "@/lib/validations";
import { withFeatureAccess, createSubscriptionErrorResponse } from "@/lib/middleware/subscription-check";

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

    // Get profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const body = await request.json();

    // SOTA 2026: Support both legacy (ticket-based) and new (standalone) work orders
    const isExtended = !!body.property_id && !!body.title;

    if (isExtended) {
      // New extended work order (from owner providers module)
      const featureCheck = await withFeatureAccess(profile?.id || '', "work_orders");
      if (!featureCheck.allowed) {
        return createSubscriptionErrorResponse(featureCheck);
      }

      const { data: workOrder, error } = await supabaseClient
        .from("work_orders")
        .insert({
          property_id: body.property_id,
          lease_id: body.lease_id || null,
          ticket_id: body.ticket_id || null,
          provider_id: body.provider_id || null,
          entity_id: body.entity_id || null,
          owner_id: profile?.id,
          title: body.title,
          description: body.description,
          category: body.category,
          urgency: body.urgency || 'normal',
          status: 'draft',
          statut: 'assigned',
          is_deductible: body.is_deductible ?? true,
          deductible_category: body.deductible_category || null,
          requested_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      // If from a ticket, update ticket status
      if (body.ticket_id) {
        await supabaseClient
          .from("tickets")
          .update({ statut: "in_progress" } as any)
          .eq("id", body.ticket_id as any);
      }

      return NextResponse.json({ workOrder });
    }

    // Legacy: ticket-based work order
    const validated = workOrderSchema.parse(body);
    const validatedData = validated as any;

    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select("property_id")
      .eq("id", validatedData.ticket_id)
      .single();

    if (ticket?.property_id) {
      const { data: property } = await supabaseClient
        .from("properties")
        .select("owner_id")
        .eq("id", (ticket as { property_id: string }).property_id)
        .single();

      if (property?.owner_id) {
        const featureCheck = await withFeatureAccess(property.owner_id, "work_orders");
        if (!featureCheck.allowed) {
          return createSubscriptionErrorResponse(featureCheck);
        }
      }
    }

    const { data: workOrder, error } = await supabaseClient
      .from("work_orders")
      .insert({
        ...validated,
        statut: "assigned",
        status: "draft",
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le statut du ticket
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

