export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { ticketUpdateSchema } from "@/lib/validations";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

interface Profile {
  id: string;
  role: "admin" | "owner" | "tenant" | "provider";
}

interface TicketWithProperty {
  id: string;
  created_by_profile_id: string | null;
  property_id: string | null;
  property: {
    id: string;
    adresse_complete: string;
    owner_id: string;
  } | null;
  [key: string]: unknown;
}

interface TicketBasic {
  created_by_profile_id: string | null;
  property_id: string | null;
}

interface PropertyOwner {
  owner_id: string;
}

/**
 * GET /api/tickets/[id] - Récupérer un ticket par ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const typedProfile = profile as Profile;

    // Récupérer le ticket avec service client pour bypass RLS
    const { data: ticket, error } = await serviceClient
      .from("tickets")
      .select(`
        *,
        property:properties (
          id, adresse_complete, owner_id
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!ticket) {
      throw new ApiError(404, "Ticket non trouvé");
    }

    const typedTicket = ticket as unknown as TicketWithProperty;

    // Vérifier les permissions manuellement
    const isAdmin = typedProfile.role === "admin";
    const isCreator = typedTicket.created_by_profile_id === typedProfile.id;
    const isOwner = typedTicket.property?.owner_id === typedProfile.id;

    if (!isAdmin && !isCreator && !isOwner) {
      throw new ApiError(403, "Accès non autorisé");
    }

    return NextResponse.json({ ticket: typedTicket });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/tickets/[id] - Mettre à jour un ticket
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const body = await request.json();
    const validated = ticketUpdateSchema.parse(body);

    // Vérifier les permissions avec service client
    const { data: ticket } = await serviceClient
      .from("tickets")
      .select("created_by_profile_id, property_id")
      .eq("id", id)
      .single();

    if (!ticket) {
      throw new ApiError(404, "Ticket non trouvé");
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const profileData = profile as Profile;
    const ticketData = ticket as TicketBasic;

    // Vérifier les permissions : créateur, propriétaire de la propriété, ou admin
    let hasPermission = false;
    if (profileData.role === "admin") {
      hasPermission = true;
    } else if (ticketData.created_by_profile_id === profileData.id) {
      hasPermission = true;
    } else if (ticketData.property_id && profileData.role === "owner") {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", ticketData.property_id)
        .single();

      const propertyData = property as PropertyOwner | null;
      if (propertyData && propertyData.owner_id === profileData.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      throw new ApiError(403, "Vous n'avez pas la permission de modifier ce ticket");
    }

    const { data: updatedTicket, error } = await serviceClient
      .from("tickets")
      .update(validated)
      .eq("id", id)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Vérifier les permissions avec service client
    const { data: ticket } = await serviceClient
      .from("tickets")
      .select("created_by_profile_id")
      .eq("id", id)
      .single();

    if (!ticket) {
      throw new ApiError(404, "Ticket non trouvé");
    }

    const ticketData = ticket as { created_by_profile_id: string | null };

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const profileData = profile as Profile;

    // Seul le créateur ou un admin peut supprimer
    if (profileData.role !== "admin" && ticketData.created_by_profile_id !== profileData.id) {
      throw new ApiError(403, "Vous n'avez pas la permission de supprimer ce ticket");
    }

    const { error } = await serviceClient.from("tickets").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

