export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/syndic/site-claims/[claimId]
 * Body: { decision: 'approve' | 'reject', reason? }
 *
 * Le syndic approuve ou refuse une demande de rattachement.
 * Le trigger SQL apply_building_site_link met à jour buildings.site_id
 * et crée user_site_roles automatiquement.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { sendEmail } from "@/lib/emails/resend.service";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ claimId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { claimId } = await params;
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const parse = DecisionSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    // Récupérer le claim et vérifier qu'il vise bien un site du syndic
    const { data: claim } = await auth.serviceClient
      .from("building_site_links")
      .select("id, site_id, status")
      .eq("id", claimId)
      .maybeSingle();
    if (!claim) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    if ((claim as { status: string }).status !== "pending") {
      return NextResponse.json(
        { error: "Cette demande a déjà été traitée." },
        { status: 409 }
      );
    }

    // Vérifie que le syndic est bien gestionnaire du site
    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("id, syndic_profile_id")
      .eq("id", (claim as { site_id: string }).site_id)
      .maybeSingle();
    if (!site) {
      return NextResponse.json({ error: "Copropriété introuvable" }, { status: 404 });
    }
    if (
      !auth.isAdmin &&
      (site as { syndic_profile_id: string }).syndic_profile_id !== auth.profile.id
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const newStatus = parse.data.decision === "approve" ? "approved" : "rejected";

    const { data: updated, error } = await auth.serviceClient
      .from("building_site_links")
      .update({
        status: newStatus,
        decided_by_profile_id: auth.profile.id,
        decided_at: new Date().toISOString(),
        decision_reason: parse.data.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notifie le copropriétaire par email
    try {
      const { data: claimFull } = await auth.serviceClient
        .from("building_site_links")
        .select(
          "claimed_by_profile_id, building:buildings(name, adresse_complete), site:sites(name)"
        )
        .eq("id", claimId)
        .maybeSingle();

      const ownerProfileId = (claimFull as { claimed_by_profile_id: string } | null)
        ?.claimed_by_profile_id;
      const buildingName =
        (claimFull as { building: { name: string | null; adresse_complete: string | null } } | null)
          ?.building?.name ??
        (claimFull as { building: { adresse_complete: string | null } } | null)?.building
          ?.adresse_complete ??
        "votre immeuble";
      const siteName =
        (claimFull as { site: { name: string } } | null)?.site?.name ?? "la copropriété";

      let ownerEmail: string | undefined;
      if (ownerProfileId) {
        const { data: ownerProfile } = await auth.serviceClient
          .from("profiles")
          .select("user_id")
          .eq("id", ownerProfileId)
          .maybeSingle();
        const ownerUserId = (ownerProfile as { user_id: string } | null)?.user_id;
        if (ownerUserId) {
          const { data: ownerAuth } = await auth.serviceClient.auth.admin.getUserById(ownerUserId);
          ownerEmail = ownerAuth?.user?.email ?? undefined;
        }
      }

      if (ownerEmail) {
        if (parse.data.decision === "approve") {
          await sendEmail({
            to: ownerEmail,
            subject: `Rattachement validé — ${siteName}`,
            html: `<p>Bonne nouvelle !</p>
<p>Votre demande de rattachement de <strong>${buildingName}</strong> à la copropriété <strong>${siteName}</strong> a été validée par le syndic.</p>
<p>Vous accédez désormais en lecture seule aux assemblées générales, appels de fonds et procès-verbaux depuis votre espace : <a href="https://talok.fr/owner/properties?tab=immeubles">votre fiche immeuble</a>.</p>
<p>Cordialement,<br/>L'équipe Talok</p>`,
            text: `Votre demande de rattachement de ${buildingName} à ${siteName} a été validée. Voir https://talok.fr/owner/properties?tab=immeubles`,
            tags: [{ name: "type", value: "building_site_claim_approved" }],
          });
        } else {
          await sendEmail({
            to: ownerEmail,
            subject: `Demande de rattachement refusée — ${siteName}`,
            html: `<p>Bonjour,</p>
<p>Votre demande de rattachement de <strong>${buildingName}</strong> à la copropriété <strong>${siteName}</strong> a été refusée par le syndic.</p>
${parse.data.reason ? `<p><strong>Motif :</strong> ${parse.data.reason}</p>` : ""}
<p>Vous pouvez renvoyer une nouvelle demande depuis la fiche de votre immeuble.</p>
<p>Cordialement,<br/>L'équipe Talok</p>`,
            text: `Votre demande de rattachement à ${siteName} a été refusée${parse.data.reason ? `. Motif : ${parse.data.reason}` : "."}.`,
            tags: [{ name: "type", value: "building_site_claim_rejected" }],
          });
        }
      }
    } catch (emailError) {
      console.error("[site-claims] notification email failed", emailError);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
