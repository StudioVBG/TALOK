export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/invite-syndic
 * Body: { email, name?, copro_name?, phone?, message? }
 *
 * Génère un token d'invitation publique pour que le syndic externe
 * rejoigne Talok et prenne en charge la copropriété. Envoie un email
 * avec un lien d'inscription pré-rempli vers /auth/syndic-invite/[token].
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/emails/resend.service";

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(255).optional(),
  copro_name: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  message: z.string().max(2000).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parse = InviteSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const profileId = (profile as { id: string }).id;

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, name, adresse_complete, code_postal, ville")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }
    if ((building as { owner_id: string }).owner_id !== profileId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const token = randomBytes(32).toString("base64url");
    const ownerName =
      [
        (profile as { prenom: string | null }).prenom,
        (profile as { nom: string | null }).nom,
      ]
        .filter(Boolean)
        .join(" ") || "Un copropriétaire";

    const { data: invitation, error: insertError } = await serviceClient
      .from("syndic_invitations_public")
      .insert({
        token,
        building_id: buildingId,
        invited_by_profile_id: profileId,
        suggested_syndic_name: parse.data.name ?? null,
        suggested_syndic_email: parse.data.email,
        suggested_syndic_phone: parse.data.phone ?? null,
        suggested_copro_name: parse.data.copro_name ?? null,
        message: parse.data.message ?? null,
      })
      .select("id, token")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const inviteUrl = `https://talok.fr/auth/syndic-invite/${token}`;
    const buildingDisplay =
      (building as { name: string | null }).name ??
      (building as { adresse_complete: string | null }).adresse_complete ??
      "un immeuble";

    try {
      await sendEmail({
        to: parse.data.email,
        subject: `${ownerName} vous invite à rejoindre Talok`,
        html: `<p>Bonjour${parse.data.name ? ` ${parse.data.name}` : ""},</p>
<p><strong>${ownerName}</strong> est copropriétaire de ${buildingDisplay}${
          (building as { code_postal: string | null }).code_postal
            ? ` (${(building as { code_postal: string }).code_postal} ${(building as { ville: string }).ville ?? ""})`
            : ""
        } et souhaiterait que vous gériez la copropriété sur Talok.</p>
${parse.data.message ? `<p><em>« ${parse.data.message} »</em></p>` : ""}
<p>Talok est le logiciel de gestion locative et copropriété SaaS, conforme à la loi du 10 juillet 1965 et au décret 2005-240 (plan comptable copropriété). Avec Talok, vous gérez vos AGs, appels de fonds, comptabilité, mandats et fournisseurs depuis une seule plateforme.</p>
<p style="margin: 24px 0;"><a href="${inviteUrl}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Découvrir et créer mon compte syndic</a></p>
<p>Ce lien est valide 60 jours.</p>
<p>Cordialement,<br/>L'équipe Talok</p>`,
        text: `${ownerName} vous invite à rejoindre Talok pour gérer ${buildingDisplay}. Lien : ${inviteUrl}`,
        tags: [{ name: "type", value: "syndic_public_invitation" }],
      });
    } catch (emailError) {
      console.error("[invite-syndic] email send failed", emailError);
    }

    return NextResponse.json({
      success: true,
      token,
      invite_url: inviteUrl,
      invitation_id: (invitation as { id: string }).id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
