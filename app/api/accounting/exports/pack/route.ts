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

    const featureGate = await requireAccountingAccess(profile.id, "pack");
    if (featureGate) return featureGate;

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

    if (profile.role !== "admin" && entity.owner_profile_id !== profile.id) {
      throw new ApiError(403, "Accès refusé à cette entité");
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
