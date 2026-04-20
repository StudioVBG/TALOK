export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

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
  min_billing_cycle: z.enum(["monthly", "yearly"]).nullable().optional(),
  first_subscription_only: z.boolean().default(false),
  max_uses: z.number().int().positive().nullable().optional(),
  max_uses_per_user: z.number().int().positive().default(1),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  is_active: z.boolean().default(true),
});

/**
 * GET /api/admin/promo-codes
 * Liste tous les codes promo.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.plans.read"], {
    rateLimit: "adminStandard",
  });
  if (isAdminAuthError(auth)) return auth;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/promo-codes GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data || [] });
}

/**
 * POST /api/admin/promo-codes
 * Crée un nouveau code promo.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
    rateLimit: "adminCritical",
    auditAction: "promo_code_created",
  });
  if (isAdminAuthError(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, {
      status: 400,
    });
  }

  if (parsed.data.discount_type === "percent" && parsed.data.discount_value > 100) {
    return NextResponse.json(
      { error: "Une remise en pourcentage ne peut pas dépasser 100 %" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      uses_count: 0,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 });
    }
    console.error("[admin/promo-codes POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code: data }, { status: 201 });
}
