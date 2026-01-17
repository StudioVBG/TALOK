export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  validateBody,
  logAudit,
} from "@/lib/api/middleware";
import { CreateInvitationSchema } from "@/lib/api/schemas";

interface RouteParams {
  params: Promise<{ pid: string }>;
}

/**
 * GET /api/v1/properties/:pid/invitations
 * List invitations for a property
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { pid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const supabase = await createClient();

    // Verify ownership
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", pid)
      .single();

    if (!property) {
      return apiError("Propriété non trouvée", 404);
    }

    if (auth.profile.role === "owner" && property.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403);
    }

    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("property_id", pid)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({ invitations });
  } catch (error: unknown) {
    console.error("[GET /invitations] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/properties/:pid/invitations
 * Create a new invitation
 * Events: Property.InvitationCreated
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { pid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const supabase = await createClient();

    // Verify ownership
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id, unique_code, adresse_complete")
      .eq("id", pid)
      .single();

    if (!property) {
      return apiError("Propriété non trouvée", 404);
    }

    if (auth.profile.role === "owner" && property.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403);
    }

    const body = await request.json();
    const { data, error: validationError } = validateBody(CreateInvitationSchema, body);

    if (validationError) return validationError;

    // Generate invitation token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expires_in_days || 7));

    // Create invitation
    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({
        property_id: pid,
        token,
        role: data.role,
        email: data.email || null,
        expires_at: expiresAt.toISOString(),
        status: "pending",
        created_by: auth.profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /invitations] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Generate invitation URL
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Property.InvitationCreated",
      payload: {
        invitation_id: invitation.id,
        property_id: pid,
        role: data.role,
        email: data.email,
      },
    });

    // If email provided, send invitation
    if (data.email) {
      // TODO: Send email via Brevo/Resend
    }

    // Audit log
    await logAudit(
      supabase,
      "invitation.created",
      "invitations",
      invitation.id,
      auth.user.id,
      null,
      invitation
    );

    return apiSuccess(
      {
        invitation: {
          ...invitation,
          invite_url: inviteUrl,
          property_code: property.unique_code,
        },
      },
      201
    );
  } catch (error: unknown) {
    console.error("[POST /invitations] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

