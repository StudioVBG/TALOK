/**
 * API Route: TALO Comptabilite agent
 * POST /api/accounting/agent/chat
 *   { entityId, exerciseId, question }
 *
 * Returns a grounded, retrieval-augmented answer from the TALO IA
 * agent based on the entity's books. Auth: owner / admin / agency
 * with an active subscription that includes the agent feature.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { askTaloAccounting } from "@/lib/accounting/agent/talo-accounting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  entityId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  question: z.string().min(3).max(2000),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil introuvable");

    if (
      profile.role !== "admin" &&
      profile.role !== "owner" &&
      profile.role !== "agency"
    ) {
      throw new ApiError(403, "Acces refuse");
    }

    const featureGate = await requireAccountingAccess(profile.id, "agent");
    if (featureGate) return featureGate;

    const body = await request.json();
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      throw new ApiError(400, parse.error.errors[0].message);
    }
    const { entityId, exerciseId, question } = parse.data;

    // Scope check: non-admin must be a member of the entity
    if (profile.role !== "admin") {
      const { data: member } = await supabase
        .from("entity_members")
        .select("entity_id")
        .eq("entity_id", entityId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) {
        throw new ApiError(403, "Acces refuse a cette entite");
      }
    }

    const result = await askTaloAccounting(supabase, {
      entityId,
      exerciseId,
      question,
    });

    return NextResponse.json({
      success: true,
      data: {
        answer: result.answer,
        modelUsed: result.modelUsed,
        contextSummary: {
          entityName: result.context.entityName,
          declarationMode: result.context.declarationMode,
          exerciseLabel: result.context.exerciseLabel,
          totals: result.context.totals,
          openInvoiceCount: result.context.openInvoiceCount,
          unpaidCents: result.context.unpaidCents,
        },
      },
      meta: {
        generated_at: new Date().toISOString(),
        disclaimer:
          "Reponse generee par TALO a partir de vos donnees comptables. Aide indicative — ne remplace pas un expert-comptable.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
