/**
 * API Route: Grand Livre (General Ledger)
 * GET /api/accounting/exercises/[exerciseId]/grand-livre - Get grand livre
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getGrandLivre } from "@/lib/accounting/engine";
import { renderGrandLivrePdf } from "@/lib/accounting/exports/pdf";
import { buildGrandLivreWorkbook } from "@/lib/accounting/exports/xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/exercises/[exerciseId]/grand-livre?entityId=...&account=512
 * Get the grand livre for an exercise, optionally filtered by account prefix.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  try {
    const { exerciseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const accountFilter = searchParams.get("account") || undefined;
    const format = (searchParams.get("format") ?? "json") as "json" | "pdf" | "xlsx";

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const serviceClient = getServiceClient();

    // Ownership enforcement — service client bypasses RLS. Trois chemins :
    //   1. admin : bypass complet (gate aussi sauté)
    //   2. propriétaire de l'entité → gating sur SON plan
    //   3. expert-comptable invité (lookup ec_access par user.id ou
    //      user.email) → gating sur le plan du PROPRIÉTAIRE
    const isAdmin = profile.role === "admin";
    let isOwner = false;
    let ownerProfileId: string | null = null;

    if (!isAdmin) {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id, owner_profile_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!entity) throw new ApiError(404, "Entité introuvable");

      ownerProfileId = entity.owner_profile_id ?? null;
      isOwner = ownerProfileId === profile.id;

      if (!isOwner) {
        const { data: ecAccess } = await serviceClient
          .from("ec_access")
          .select("id")
          .eq("entity_id", entityId)
          .eq("is_active", true)
          .is("revoked_at", null)
          .or(`ec_user_id.eq.${user.id},ec_email.eq.${user.email ?? ""}`)
          .limit(1)
          .maybeSingle();
        if (!ecAccess) throw new ApiError(403, "Accès refusé à cette entité");
      }

      const gateProfileId = isOwner ? profile.id : ownerProfileId;
      if (!gateProfileId) {
        throw new ApiError(404, "Propriétaire de l'entité introuvable");
      }
      const featureGate = await requireAccountingAccess(gateProfileId, "gl");
      if (featureGate) return featureGate;
    }

    const grandLivre = await getGrandLivre(serviceClient, entityId, exerciseId, accountFilter);

    if (format === "pdf" || format === "xlsx") {
      const [{ data: exercise }, { data: entity }] = await Promise.all([
        serviceClient
          .from("accounting_exercises")
          .select("start_date, end_date")
          .eq("id", exerciseId)
          .maybeSingle(),
        serviceClient
          .from("legal_entities")
          .select("nom")
          .eq("id", entityId)
          .maybeSingle(),
      ]);

      if (format === "pdf") {
        const pdf = await renderGrandLivrePdf(grandLivre, {
          entityName: entity?.nom ?? "",
          startDate: exercise?.start_date ?? "",
          endDate: exercise?.end_date ?? "",
        });
        return new Response(pdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="grand-livre_${exerciseId}.pdf"`,
          },
        });
      }

      const xlsx = await buildGrandLivreWorkbook(grandLivre);
      return new Response(xlsx, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="grand-livre_${exerciseId}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: { grandLivre } });
  } catch (error) {
    return handleApiError(error);
  }
}
