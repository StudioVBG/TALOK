export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  logAudit,
} from "@/lib/api/middleware";

interface RouteParams {
  params: Promise<{ pid: string; iid: string }>;
}

/**
 * DELETE /api/v1/properties/:pid/invitations/:iid
 * Revoke an invitation (burn the code forever)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { pid, iid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

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

    // Get invitation
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", iid)
      .eq("property_id", pid)
      .single();

    if (fetchError || !invitation) {
      return apiError("Invitation non trouvée", 404);
    }

    // Mark as revoked (not deleted - code is burned forever)
    const { error } = await supabase
      .from("invitations")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: auth.profile.id,
      })
      .eq("id", iid);

    if (error) {
      console.error("[DELETE /invitations] Error:", error);
      return apiError("Erreur lors de la révocation", 500);
    }

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Property.InvitationRevoked",
      payload: {
        invitation_id: iid,
        property_id: pid,
        token: invitation.token,
      },
    });

    // Audit log
    await logAudit(
      supabase,
      "invitation.revoked",
      "invitations",
      iid,
      auth.user.id,
      invitation,
      { status: "revoked" }
    );

    return apiSuccess({ message: "Invitation révoquée (code brûlé à vie)" });
  } catch (error: unknown) {
    console.error("[DELETE /invitations] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

