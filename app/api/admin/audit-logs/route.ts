export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/audit-logs - Récupérer les logs d'audit
 */
export async function GET(request: Request) {
  try {
    const { error: authError, user, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const userId = searchParams.get("user");
    const action = searchParams.get("action");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entity) {
      // @ts-ignore - Supabase typing issue
      query = query.eq("entity_type", entity);
    }

    if (userId) {
      // @ts-ignore - Supabase typing issue
      query = query.eq("user_id", userId);
    }

    if (action) {
      // @ts-ignore - Supabase typing issue
      query = query.eq("action", action);
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
