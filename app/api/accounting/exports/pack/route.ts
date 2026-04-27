/**
 * GET /api/accounting/exports/pack?entityId=...&exerciseId=...
 *
 * Streams a ZIP bundle to download. Reuses `buildAccountingPack` which
 * generates FEC + balance + grand-livre + journal (+ liasse stub if IS).
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { buildAccountingPack } from "@/lib/accounting/exports/pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil non trouve");

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const exerciseId = searchParams.get("exerciseId");
    if (!entityId || !exerciseId) {
      throw new ApiError(400, "entityId et exerciseId sont requis");
    }

    const { data: entity } = await serviceClient
      .from("legal_entities")
      .select("id, nom, siret, regime_fiscal, owner_profile_id")
      .eq("id", entityId)
      .maybeSingle();
    if (!entity) throw new ApiError(404, "Entité introuvable");

    // Trois chemins d'autorisation :
    //  1. admin : bypass complet
    //  2. propriétaire de l'entité (owner_profile_id === profile.id) →
    //     gating sur SON plan
    //  3. expert-comptable invité avec un ec_access actif sur l'entité →
    //     gating sur le plan du PROPRIÉTAIRE (l'EC est un externe sans
    //     abonnement Talok à lui)
    const isAdmin = profile.role === "admin";
    const isOwner = entity.owner_profile_id === profile.id;
    let isInvitedEC = false;

    if (!isAdmin && !isOwner) {
      const { data: ecAccess } = await serviceClient
        .from("ec_access")
        .select("id")
        .eq("entity_id", entityId)
        .eq("is_active", true)
        .is("revoked_at", null)
        .or(`ec_user_id.eq.${user.id},ec_email.eq.${user.email ?? ""}`)
        .limit(1)
        .maybeSingle();

      if (!ecAccess) {
        throw new ApiError(403, "Accès refusé à cette entité");
      }
      isInvitedEC = true;
    }

    // Feature gate : on check le plan du payeur (owner), pas celui de
    // l'EC qui consulte. Pour admin, on saute le check.
    if (!isAdmin) {
      const gateProfileId = isInvitedEC
        ? (entity.owner_profile_id as string | null)
        : profile.id;
      if (!gateProfileId) {
        throw new ApiError(404, "Propriétaire de l'entité introuvable");
      }
      const featureGate = await requireAccountingAccess(gateProfileId, "pack");
      if (featureGate) return featureGate;
    }

    const { data: exercise } = await serviceClient
      .from("accounting_exercises")
      .select("id, start_date, end_date, status")
      .eq("id", exerciseId)
      .eq("entity_id", entityId)
      .maybeSingle();
    if (!exercise) throw new ApiError(404, "Exercice introuvable");

    const exerciseLabel = `${exercise.start_date.slice(0, 4)}`;
    const siren = entity.siret ? String(entity.siret).slice(0, 9) : null;

    const { zip, filename, skipped } = await buildAccountingPack(serviceClient, {
      entityId,
      exerciseId,
      siren,
      entityName: entity.nom ?? "Entite",
      exerciseLabel,
      startDate: exercise.start_date,
      endDate: exercise.end_date,
      includeLiasse: entity.regime_fiscal === "is",
    });

    return new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...(skipped.length > 0 ? { "X-Talok-Pack-Skipped": skipped.join(" | ") } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
