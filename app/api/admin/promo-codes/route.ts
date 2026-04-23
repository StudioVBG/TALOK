export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";
import {
  createPromoCode,
  listPromoCodes,
  type Territory,
} from "@/lib/subscriptions/promo-codes.service";
import type { PlanSlug, BillingCycle } from "@/lib/subscriptions/plans";

const ALL_PLANS = [
  "gratuit",
  "starter",
  "confort",
  "pro",
  "enterprise_s",
  "enterprise_m",
  "enterprise_l",
  "enterprise_xl",
] as const;

const ALL_TERRITORIES = [
  "metropole",
  "martinique",
  "guadeloupe",
  "reunion",
  "guyane",
  "mayotte",
] as const;

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Caractères autorisés : lettres, chiffres, _ et -"),
  name: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().positive(),
  applicable_plans: z.array(z.enum(ALL_PLANS)).default([]),
  eligible_territories: z.array(z.enum(ALL_TERRITORIES)).default([]),
  min_billing_cycle: z.enum(["monthly", "yearly"]).nullable().optional(),
  first_subscription_only: z.boolean().default(false),
  max_uses: z.number().int().positive().nullable().optional(),
  max_uses_per_user: z.number().int().positive().default(1),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/admin/promo-codes
 * Liste tous les codes promo (actifs + archivés).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.plans.read"], {
    rateLimit: "adminStandard",
  });
  if (isAdminAuthError(auth)) return auth;

  try {
    const codes = await listPromoCodes();
    return NextResponse.json({ codes });
  } catch (err) {
    console.error("[admin/promo-codes GET]", err);
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/promo-codes
 * Crée un code promo : Stripe Coupon + Promotion Code + miroir DB.
 * Rollback Stripe si la création DB échoue.
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.promo-codes.create");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
    rateLimit: "adminCritical",
    auditAction: "promo_code_created",
  });
  if (isAdminAuthError(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Données invalides" },
      { status: 400 }
    );
  }

  if (parsed.data.discount_type === "percent" && parsed.data.discount_value > 100) {
    return NextResponse.json(
      { error: "Une remise en pourcentage ne peut pas dépasser 100 %" },
      { status: 400 }
    );
  }

  try {
    const created = await createPromoCode(
      {
        code: parsed.data.code,
        name: parsed.data.name ?? null,
        description: parsed.data.description ?? null,
        discount_type: parsed.data.discount_type,
        discount_value: parsed.data.discount_value,
        applicable_plans: parsed.data.applicable_plans as unknown as PlanSlug[],
        eligible_territories: parsed.data.eligible_territories as Territory[],
        min_billing_cycle: (parsed.data.min_billing_cycle ?? null) as BillingCycle | null,
        first_subscription_only: parsed.data.first_subscription_only,
        max_uses: parsed.data.max_uses ?? null,
        max_uses_per_user: parsed.data.max_uses_per_user,
        valid_from: parsed.data.valid_from,
        valid_until: parsed.data.valid_until ?? null,
      },
      auth.user.id
    );
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    if (msg.includes("23505") || msg.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 });
    }
    console.error("[admin/promo-codes POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
