export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * POST /api/agency/invitations/[token]/accept
 *
 * Cas du collaborateur qui a déjà un compte (profile.role='agency') et
 * clique le lien d'invitation. Le pendant côté signup neuf est traité
 * dans /api/v1/auth/register (résolution + création agency_managers).
 */
const paramsSchema = z.object({ token: z.string().min(10) });

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Token invalide" }, { status: 400 });
    }
    const { token } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const service = getServiceClient();
    const { data: profile } = await service
      .from("profiles")
      .select("id, role, email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.id) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    if (profile.role !== "agency") {
      return NextResponse.json(
        {
          error: "Seul un compte agence peut accepter cette invitation.",
          code: "ROLE_MISMATCH",
        },
        { status: 403 }
      );
    }

    const { data: invitation } = await service
      .from("agency_invitations")
      .select("id, email, status, expires_at, accepted_at, declined_at, agency_profile_id, role_agence, can_sign_documents")
      .eq("invitation_token", token)
      .maybeSingle();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    if (invitation.status === "accepted" || invitation.accepted_at) {
      return NextResponse.json({ error: "Cette invitation a déjà été utilisée." }, { status: 409 });
    }
    if (invitation.status === "declined" || invitation.declined_at) {
      return NextResponse.json({ error: "Cette invitation a été refusée." }, { status: 409 });
    }
    if (invitation.status === "cancelled") {
      return NextResponse.json({ error: "Cette invitation a été annulée." }, { status: 409 });
    }
    if (
      invitation.status === "expired" ||
      (invitation.expires_at && new Date(invitation.expires_at as string) < new Date())
    ) {
      return NextResponse.json({ error: "Cette invitation a expiré." }, { status: 410 });
    }

    const userEmail = (user.email || profile.email || "").toLowerCase().trim();
    const inviteEmail = String(invitation.email).toLowerCase().trim();
    if (userEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: "L'email de votre compte ne correspond pas à l'invitation.",
          details: `Cette invitation est destinée à ${invitation.email}.`,
        },
        { status: 403 }
      );
    }

    // Lier dans agency_managers (idempotent via UNIQUE(agency_profile_id, user_profile_id))
    const { data: manager, error: managerError } = await service
      .from("agency_managers")
      .upsert(
        {
          agency_profile_id: invitation.agency_profile_id,
          user_profile_id: profile.id,
          role_agence: invitation.role_agence,
          can_sign_documents: !!invitation.can_sign_documents,
          is_active: true,
        },
        { onConflict: "agency_profile_id,user_profile_id" }
      )
      .select("id")
      .maybeSingle();

    if (managerError) {
      console.error("[agency-accept] manager upsert failed:", managerError);
      return NextResponse.json(
        { error: "Erreur lors de la liaison à l'agence" },
        { status: 500 }
      );
    }

    // Acceptation atomique
    const { data: updated, error: updateError } = await service
      .from("agency_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_profile_id: profile.id,
        agency_manager_id: manager?.id ?? null,
      })
      .eq("id", invitation.id)
      .eq("status", "pending")
      .select("id");

    if (updateError) {
      console.error("[agency-accept] update failed:", updateError);
      return NextResponse.json({ error: "Erreur lors de l'acceptation" }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Cette invitation a déjà été utilisée." }, { status: 409 });
    }

    try {
      await service.from("audit_log").insert({
        user_id: user.id,
        action: "agency_invitation_accepted",
        entity_type: "agency_invitation",
        entity_id: invitation.id,
        metadata: {
          agency_profile_id: invitation.agency_profile_id,
          role_agence: invitation.role_agence,
          email: inviteEmail,
        } as Record<string, unknown>,
      });
    } catch {
      // audit non bloquant
    }

    return NextResponse.json({
      success: true,
      role: "agency" as const,
      role_agence: invitation.role_agence,
      agency_profile_id: invitation.agency_profile_id,
      agency_manager_id: manager?.id ?? null,
      message: "Invitation acceptée. Vous êtes maintenant lié à l'agence.",
    });
  } catch (error: unknown) {
    console.error("[agency-accept] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
