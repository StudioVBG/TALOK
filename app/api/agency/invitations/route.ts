export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/services/email-service";
import { applyRateLimit } from "@/lib/security/rate-limit";

/**
 * Endpoints d'invitations agence (collaborateurs).
 *
 * - POST   /api/agency/invitations    : créer (auth = profile.role IN ('agency','admin'))
 * - GET    /api/agency/invitations    : lister les invitations de l'agence du caller
 *
 * Le flux d'acceptation est géré côté signup via /api/v1/auth/register
 * (verrouillage rôle + lien agency_managers post-signUp) ou côté
 * post-login via POST /api/agency/invitations/[token]/accept.
 */

const CreateAgencyInvitationSchema = z.object({
  email: z
    .string()
    .email("Email invalide")
    .transform((v) => v.trim().toLowerCase()),
  prenom: z.string().min(1).max(80).optional(),
  nom: z.string().min(1).max(80).optional(),
  telephone: z.string().optional(),
  role_agence: z
    .enum(["directeur", "gestionnaire", "assistant", "comptable"])
    .default("gestionnaire"),
  can_sign_documents: z.boolean().default(false),
  personal_message: z.string().max(1000).optional(),
});

async function getCallerProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const service = getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, prenom, nom, email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { user, profile, service };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, "agencyInvite");
    if (rateLimitResponse) return rateLimitResponse;

    const ctx = await getCallerProfile();
    if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const { user, profile, service } = ctx;

    if (profile.role !== "agency" && profile.role !== "admin" && profile.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Seules les agences peuvent inviter des collaborateurs.", code: "ROLE_FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = CreateAgencyInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // L'agency_profile_id du caller : pour profile.role='agency', c'est son
    // propre profile.id. Pour admin, on accepte un body.agency_profile_id
    // explicite (admin agit pour le compte d'une agence).
    let agencyProfileId: string | null = profile.id;
    if (profile.role === "admin" || profile.role === "platform_admin") {
      const adminBody = body as { agency_profile_id?: string };
      if (!adminBody.agency_profile_id) {
        return NextResponse.json(
          { error: "agency_profile_id requis pour un admin", code: "MISSING_AGENCY_ID" },
          { status: 400 }
        );
      }
      agencyProfileId = adminBody.agency_profile_id;
    }

    // Empêcher les doublons sur (agence, email) en pending/sent
    const { data: existing } = await service
      .from("agency_invitations")
      .select("id, status")
      .eq("agency_profile_id", agencyProfileId)
      .eq("email", data.email)
      .in("status", ["pending", "accepted"])
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Une invitation est déjà en cours pour cet email." },
        { status: 409 }
      );
    }

    const { data: invitation, error: insertError } = await service
      .from("agency_invitations")
      .insert({
        agency_profile_id: agencyProfileId,
        invited_by: profile.id,
        email: data.email,
        prenom: data.prenom ?? null,
        nom: data.nom ?? null,
        telephone: data.telephone ?? null,
        role_agence: data.role_agence,
        can_sign_documents: data.can_sign_documents,
        personal_message: data.personal_message ?? null,
      })
      .select()
      .single();

    if (insertError || !invitation) {
      console.error("[agency-invite] insert error:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Erreur lors de la création de l'invitation" },
        { status: 500 }
      );
    }

    // Email d'invitation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
    const inviteUrl = `${appUrl}/signup/role?role=agency&invite=${invitation.invitation_token}&email=${encodeURIComponent(data.email)}`;
    const inviterName = `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Votre agence";

    try {
      await sendEmail({
        to: data.email,
        subject: `Invitation à rejoindre ${inviterName} sur Talok`,
        html: `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%);padding:32px;text-align:center;">
        <span style="font-size:24px;font-weight:800;color:white;">TALOK</span>
      </div>
      <div style="padding:40px;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">Invitation collaborateur</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          ${inviterName} vous invite à rejoindre l'équipe en tant que
          <strong>${data.role_agence}</strong> sur Talok.
        </p>
        ${data.personal_message ? `
        <div style="background:#f9fafb;border-left:4px solid #2563EB;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;color:#374151;font-style:italic;">${data.personal_message}</p>
        </div>` : ""}
        <div style="text-align:center;margin:32px 0;">
          <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#1D4ED8,#3B82F6);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Accepter l'invitation
          </a>
        </div>
        <p style="color:#6b7280;font-size:14px;">
          Ce lien expire le ${new Date(invitation.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
        tags: [{ name: "type", value: "agency_invitation" }],
        idempotencyKey: `agency-invitation/${invitation.id}`,
      });

      await service
        .from("agency_invitations")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", invitation.id);
    } catch (emailError) {
      console.error("[agency-invite] email error:", emailError);
      // Non bloquant : l'invitation est créée, l'agence peut renvoyer.
    }

    return NextResponse.json(invitation, { status: 201 });
  } catch (error: unknown) {
    console.error("[agency-invite] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const ctx = await getCallerProfile();
    if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const { profile, service } = ctx;

    if (profile.role !== "agency" && profile.role !== "admin" && profile.role !== "platform_admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const query = service
      .from("agency_invitations")
      .select("*")
      .order("created_at", { ascending: false });

    // Pour les agences : limité à leurs propres invitations
    if (profile.role === "agency") {
      query.eq("agency_profile_id", profile.id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
