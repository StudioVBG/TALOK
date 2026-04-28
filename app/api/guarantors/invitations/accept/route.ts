export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { applyRateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/guarantors/invitations/accept
 *
 * Accepte une invitation garant standalone (table `guarantor_invitations`)
 * pour un utilisateur déjà authentifié. Le pendant côté signup neuf est
 * traité directement dans /api/v1/auth/register (résolution + marquage
 * post-signUp).
 */
const acceptSchema = z.object({
  token: z.string().min(10, "Token invalide"),
});

export async function POST(request: Request) {
  try {
    const rateLimitResponse = await applyRateLimit(request, "inviteAccept");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = acceptSchema.parse(body);

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.id) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "guarantor") {
      return NextResponse.json(
        {
          error: "Seul un compte garant peut accepter cette invitation.",
          code: "ROLE_MISMATCH",
        },
        { status: 403 }
      );
    }

    const { data: invitation } = await serviceClient
      .from("guarantor_invitations")
      .select("id, guarantor_email, status, expires_at, accepted_at, declined_at, lease_id")
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
    if (
      invitation.status === "expired" ||
      (invitation.expires_at && new Date(invitation.expires_at as string) < new Date())
    ) {
      return NextResponse.json({ error: "Cette invitation a expiré." }, { status: 410 });
    }

    const userEmail = (user.email || profile.email || "").toLowerCase().trim();
    const inviteEmail = String(invitation.guarantor_email).toLowerCase().trim();
    if (userEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: "L'email de votre compte ne correspond pas à l'invitation.",
          details: `Cette invitation est destinée à ${invitation.guarantor_email}.`,
        },
        { status: 403 }
      );
    }

    // Update conditionnel sur status='pending' pour éviter les race conditions
    const { data: updated, error: updateError } = await serviceClient
      .from("guarantor_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        guarantor_profile_id: profile.id,
      })
      .eq("id", invitation.id)
      .eq("status", "pending")
      .select("id");

    if (updateError) {
      console.error("[guarantor-accept] update failed:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de l'acceptation" },
        { status: 500 }
      );
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "Cette invitation a déjà été utilisée." },
        { status: 409 }
      );
    }

    try {
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "guarantor_invitation_accepted",
        entity_type: "guarantor_invitation",
        entity_id: invitation.id,
        metadata: {
          lease_id: invitation.lease_id,
          email: inviteEmail,
        } as Record<string, unknown>,
      });
    } catch {
      // audit non bloquant
    }

    return NextResponse.json({
      success: true,
      lease_id: invitation.lease_id,
      role: "guarantor" as const,
      message: "Invitation acceptée. Vous êtes maintenant lié au bail.",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[guarantor-accept] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
