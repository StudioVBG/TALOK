export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import {
  archivePromoCode,
  reactivatePromoCode,
} from "@/lib/subscriptions/promo-codes.service";

/**
 * PATCH /api/admin/promo-codes/[id]
 *
 * Met à jour un code promo :
 *  - is_active toggle   → sync Stripe (Promotion Code active=true/false)
 *  - autres champs      → UPDATE DB uniquement.
 *
 * Note : on ne met PAS à jour la remise (discount_type / discount_value)
 * d'un Stripe Coupon — Stripe l'interdit après création. Pour changer la
 * remise il faut archiver + créer un nouveau code.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
    rateLimit: "adminStandard",
    auditAction: "promo_code_updated",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    // Toggle actif/archivé : passe par le service pour sync Stripe.
    if (typeof body.is_active === "boolean") {
      if (body.is_active === false) {
        await archivePromoCode(id);
      } else {
        await reactivatePromoCode(id);
      }
    }

    // Autres champs modifiables (métadonnées Talok, pas de sync Stripe requise).
    const allowed = [
      "name",
      "description",
      "applicable_plans",
      "eligible_territories",
      "min_billing_cycle",
      "first_subscription_only",
      "max_uses_per_user",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length > 0) {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from("promo_codes").update(updates).eq("id", id);
      if (error) {
        console.error("[admin/promo-codes PATCH metadata]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Renvoyer l'état actualisé.
    const supabase = createServiceRoleClient();
    const { data } = await supabase.from("promo_codes").select("*").eq("id", id).single();
    return NextResponse.json({ code: data });
  } catch (err) {
    console.error("[admin/promo-codes PATCH]", err);
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/promo-codes/[id]
 *
 * Archive le code (pas de hard delete) :
 *   - is_active = false côté DB
 *   - Promotion Code Stripe désactivé
 *
 * Les lignes promo_code_uses et l'historique audit sont conservés
 * (conformité Stripe + audit RGPD).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
    rateLimit: "adminCritical",
    auditAction: "promo_code_archived",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id } = await params;

  try {
    await archivePromoCode(id);
    return NextResponse.json({ success: true, archived: true });
  } catch (err) {
    console.error("[admin/promo-codes DELETE]", err);
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
