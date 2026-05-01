export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  LETTER_TEMPLATES,
  buildLetterHtml,
  type LetterKey,
  type LetterContext,
} from "@/lib/legal/letter-templates";

/**
 * GET /api/tenant/legal-letters/[type]
 *
 * Génère un courrier légal préremplisé en HTML imprimable.
 * Le tenant peut ouvrir le rendu dans un nouvel onglet et imprimer / sauvegarder en PDF.
 *
 * Types disponibles :
 *   - demande_quittance
 *   - contestation_hausse_loyer
 *   - signalement_reparation_urgente
 *   - demande_attestation_loyer
 *   - restitution_caution_relance
 *
 * Optionnel : ?lease_id=<uuid> pour sélectionner un bail spécifique
 *             (sinon le bail actif du tenant est utilisé)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ type: string }> },
) {
  try {
    const { type } = await context.params;

    const template = LETTER_TEMPLATES[type as LetterKey];
    if (!template) {
      return NextResponse.json(
        {
          error: "Type de courrier inconnu",
          available: Object.keys(LETTER_TEMPLATES),
        },
        { status: 404 },
      );
    }

    // Auth + role tenant
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, telephone, adresse")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "tenant") {
      return NextResponse.json(
        { error: "Réservé aux locataires" },
        { status: 403 },
      );
    }

    // Récupérer le bail (optionnel si lease_id en query)
    const url = new URL(request.url);
    const leaseIdParam = url.searchParams.get("lease_id");

    const serviceClient = getServiceClient();

    let leaseQuery = serviceClient
      .from("lease_signers")
      .select(
        `
        lease_id,
        lease:leases(
          id,
          loyer,
          charges_forfaitaires,
          depot_garantie,
          date_debut,
          property:properties(
            adresse_complete,
            code_postal,
            ville,
            owner:profiles!properties_owner_id_fkey(
              prenom, nom, adresse
            )
          )
        )
      `,
      )
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"]);

    if (leaseIdParam) {
      leaseQuery = leaseQuery.eq("lease_id", leaseIdParam);
    }

    const { data: signerRows } = await leaseQuery.limit(1);
    const signerRow = signerRows?.[0];
    const lease = (signerRow?.lease as any) || null;
    const property = lease?.property || null;
    const owner = property?.owner || null;

    // Construction du contexte
    const ctx: LetterContext = {
      tenantFullName:
        `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Locataire",
      tenantAddress: profile.adresse ?? property?.adresse_complete ?? undefined,
      ownerFullName: owner
        ? `${owner.prenom ?? ""} ${owner.nom ?? ""}`.trim() || "Le bailleur"
        : "Le bailleur",
      ownerAddress: owner?.adresse ?? undefined,
      propertyAddress: property
        ? `${property.adresse_complete ?? ""}, ${property.code_postal ?? ""} ${property.ville ?? ""}`.trim()
        : "____________",
      leaseStartDate: lease?.date_debut ?? undefined,
      rentMonthly: lease?.loyer ?? undefined,
      charges: lease?.charges_forfaitaires ?? undefined,
      cautionAmount: lease?.depot_garantie ?? undefined,
      city: property?.ville ?? undefined,
    };

    const html = buildLetterHtml(template, ctx);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Pas de cache : le contexte évolue
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[legal-letters] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
