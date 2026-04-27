/**
 * API Route: Export FEC propriétaire (form-friendly endpoint).
 *
 * GET /api/accounting/fec?year=YYYY&entityId=...
 *
 * Wrapper amical autour du moteur FEC officiel (lib/accounting/fec.ts).
 * La version historique de cette route reconstituait un FEC "maison" en
 * agrégeant `invoices` + `payments` + `deposit_operations` + `expenses`,
 * avec des comptes hardcodés et sans filtre `is_validated=true` —
 * autrement dit, elle produisait un fichier que la DGFIP aurait rejeté
 * pour non-conformité art. A47 A-1 LPF.
 *
 * Le nouveau comportement :
 *   1. Résout l'exercice qui couvre l'année demandée pour cette entité.
 *   2. Récupère le SIREN sur `legal_entities`.
 *   3. Délègue à `exportFEC()` du moteur, qui ne lit que les écritures
 *      validées et émet les 18 colonnes officielles, UTF-8 BOM,
 *      séparateur tabulation, montants en virgule FR.
 *   4. Renvoie le blob en text/plain ; le filename respecte la convention
 *      DGFIP `{SIREN}FEC{YYYYMMDD}.txt`.
 *
 * Pour passer un exerciseId explicite (cas multi-exercices sur la même
 * année), utilisez plutôt `/api/accounting/fec/{exerciseId}?siren=...`.
 *
 * Feature gate : `bank_reconciliation` (plan Confort+).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { userHasFeature } from "@/lib/subscriptions/subscription-service";
import { exportFEC } from "@/lib/accounting/fec";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "L'export FEC est disponible a partir du plan Confort.",
          upgrade: true,
        },
        { status: 403 },
      );
    }

    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Acces reserve aux proprietaires");
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const entityIdParam = searchParams.get("entityId");

    if (!yearParam) throw new ApiError(400, "Le parametre year est requis");
    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
      throw new ApiError(400, "Annee invalide");
    }
    if (!entityIdParam) {
      throw new ApiError(
        400,
        "Le parametre entityId est requis pour cibler une entite legale.",
      );
    }

    // Verify ownership (admin bypass) before any further work.
    if (profile.role !== "admin") {
      const { data: entity } = await (serviceClient as any)
        .from("legal_entities")
        .select("id")
        .eq("id", entityIdParam)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) {
        throw new ApiError(403, "Acces refuse a cette entite");
      }
    }

    // Resolve the exercise covering the requested year. We pick the
    // exercise whose start_date falls in the same calendar year ; if
    // there are several (split fiscal years) the most recent wins —
    // explicit exerciseId selection should use /api/accounting/fec/[id].
    const { data: exercises } = await (serviceClient as any)
      .from("accounting_exercises")
      .select("id, start_date, end_date")
      .eq("entity_id", entityIdParam)
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
      .order("start_date", { ascending: false })
      .limit(1);

    const exercise = (exercises ?? [])[0];
    if (!exercise) {
      throw new ApiError(
        404,
        `Aucun exercice comptable trouve pour l'annee ${year} sur cette entite.`,
      );
    }

    // SIREN required by FEC spec — read from legal_entities. The engine
    // validates the format (9 digits) and refuses to emit the file
    // otherwise, so a missing or malformed SIREN bubbles up as a 400.
    const { data: entityRow } = await (serviceClient as any)
      .from("legal_entities")
      .select("siren")
      .eq("id", entityIdParam)
      .maybeSingle();
    const siren = (entityRow?.siren as string | undefined) ?? "";
    if (!siren || !/^\d{9}$/.test(siren)) {
      throw new ApiError(
        400,
        "SIREN manquant ou invalide sur l'entite. Renseigne un SIREN a 9 chiffres dans les parametres.",
      );
    }

    const result = await exportFEC(
      serviceClient,
      entityIdParam,
      exercise.id as string,
      siren,
    );

    if ("errors" in result) {
      throw new ApiError(400, result.errors.join("; "));
    }

    return new NextResponse(result.blob as unknown as BodyInit, {
      headers: {
        "Content-Type": result.mimeType ?? "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
