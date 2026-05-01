export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/claim-site
 * Body: { site_id, message? }
 *
 * L'owner soumet une demande de rattachement de son building à un site
 * syndic Talok existant. Le syndic devra approuver depuis /syndic/claims.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/emails/resend.service";

const ClaimSchema = z.object({
  site_id: z.string().uuid(),
  message: z.string().max(1000).optional(),
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
    const parse = ClaimSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const profileId = (profile as { id: string }).id;

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, site_link_status, site_id")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }
    if ((building as { owner_id: string }).owner_id !== profileId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if ((building as { site_link_status: string }).site_link_status === "linked") {
      return NextResponse.json(
        { error: "Cet immeuble est déjà rattaché à une copropriété." },
        { status: 409 }
      );
    }

    // Vérifie que le site existe et est actif
    const { data: site } = await serviceClient
      .from("sites")
      .select("id, name, syndic_profile_id, is_active")
      .eq("id", parse.data.site_id)
      .maybeSingle();
    if (!site || !(site as { is_active: boolean }).is_active) {
      return NextResponse.json({ error: "Copropriété introuvable" }, { status: 404 });
    }

    // Annule un éventuel claim pending pour le même couple
    await serviceClient
      .from("building_site_links")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("building_id", buildingId)
      .eq("status", "pending");

    const { data: claim, error } = await serviceClient
      .from("building_site_links")
      .insert({
        building_id: buildingId,
        site_id: parse.data.site_id,
        status: "pending",
        claimed_by_profile_id: profileId,
        claim_message: parse.data.message ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notifie le syndic par email
    try {
      const { data: syndicAuthUser } = await serviceClient.auth.admin.getUserById(
        await (async () => {
          const { data: syndicProfile } = await serviceClient
            .from("profiles")
            .select("user_id")
            .eq("id", (site as { syndic_profile_id: string }).syndic_profile_id)
            .maybeSingle();
          return (syndicProfile as { user_id: string } | null)?.user_id ?? "";
        })()
      );
      const syndicEmail = syndicAuthUser?.user?.email;

      const { data: ownerProfile } = await serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", profileId)
        .maybeSingle();
      const ownerName = ownerProfile
        ? [
            (ownerProfile as { prenom: string | null }).prenom,
            (ownerProfile as { nom: string | null }).nom,
          ]
            .filter(Boolean)
            .join(" ") || "Un copropriétaire"
        : "Un copropriétaire";

      const siteName = (site as { name: string }).name;

      if (syndicEmail) {
        await sendEmail({
          to: syndicEmail,
          subject: `Nouvelle demande de rattachement — ${siteName}`,
          html: `<p>Bonjour,</p>
<p><strong>${ownerName}</strong> souhaite rattacher son immeuble à votre copropriété <strong>${siteName}</strong> sur Talok.</p>
${parse.data.message ? `<p><em>« ${parse.data.message} »</em></p>` : ""}
<p>Validez ou refusez la demande depuis votre espace : <a href="https://talok.fr/syndic/claims">talok.fr/syndic/claims</a></p>
<p>Cordialement,<br/>L'équipe Talok</p>`,
          text: `${ownerName} souhaite rattacher son immeuble à votre copropriété ${siteName}. Validez sur https://talok.fr/syndic/claims`,
          tags: [{ name: "type", value: "building_site_claim_pending" }],
        });
      }
    } catch (emailError) {
      console.error("[claim-site] notification email failed", emailError);
    }

    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
