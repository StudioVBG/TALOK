// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ticketSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";
import type { ProfileRow, TicketRow, TicketUpdate, PropertyRow } from "@/lib/supabase/typed-client";

/**
 * GET /api/tickets/[id] - Récupérer un ticket par ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", params.id as any)
      .single();

    if (error) throw error;
    if (!ticket) {
      return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/tickets/[id] - Mettre à jour un ticket
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = ticketSchema.partial().parse(body);

    // Vérifier les permissions
    const { data: ticket } = await supabase
      .from("tickets")
      .select("created_by_profile_id, property_id")
      .eq("id", params.id as any)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const ticketData = ticket as any;

    // Vérifier les permissions : créateur, propriétaire de la propriété, ou admin
    let hasPermission = false;
    if (profileData.role === "admin") {
      hasPermission = true;
    } else if (ticketData.created_by_profile_id === profileData.id) {
      hasPermission = true;
    } else if (ticketData.property_id && profileData.role === "owner") {
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id")
        .eq("id", ticketData.property_id as any)
        .single();

      const propertyData = property as any;
      if (propertyData && propertyData.owner_id === profileData.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce ticket" },
        { status: 403 }
      );
    }

    const { data: updatedTicket, error } = await supabase
      .from("tickets")
      .update(validated as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ticket: updatedTicket });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/tickets/[id] - Supprimer un ticket
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier les permissions
    const { data: ticket } = await supabase
      .from("tickets")
      .select("created_by_profile_id")
      .eq("id", params.id)
      .single();

    const ticketData = ticket as Pick<TicketRow, "created_by_profile_id"> | null;
    if (!ticketData) {
      return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as ProfileRow | null;
    if (!profileData) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Seul le créateur ou un admin peut supprimer
    if (profileData.role !== "admin" && ticketData.created_by_profile_id !== profileData.id) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer ce ticket" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("tickets").delete().eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

