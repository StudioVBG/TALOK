export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { z } from "zod";

const auditLogsQuerySchema = z.object({
  entity: z.string().optional(),
  user: z.string().uuid().optional(),
  action: z.string().optional(),
  risk_level: z.enum(["low", "medium", "high", "critical"]).optional(),
  entity_type: z.string().optional(),
  user_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/audit-logs - Récupérer les logs d'audit
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.compliance.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const params = auditLogsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!params.success) {
      return NextResponse.json({ error: params.error.message }, { status: 400 });
    }

    const { entity, user: userId, action, risk_level, entity_type, user_id, limit, offset } = params.data;

    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entity || entity_type) {
      query = query.eq("entity_type" as any, entity || entity_type);
    }

    if (userId || user_id) {
      query = query.eq("user_id" as any, userId || user_id);
    }

    if (action) {
      query = query.eq("action" as any, action);
    }

    if (risk_level) {
      query = query.eq("risk_level" as any, risk_level);
    }

    const { data: logs, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

