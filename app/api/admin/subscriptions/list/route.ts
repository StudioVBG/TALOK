export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/subscriptions/list
 * Liste les abonnements avec pagination et filtres (admin only)
 */

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSubscriptionsList } from "@/lib/subscriptions/subscription-service";
import type { PlanSlug } from "@/lib/subscriptions/plans";

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "20");
    const search = searchParams.get("search") || undefined;
    const plan = searchParams.get("plan");
    const status = searchParams.get("status");

    const planFilter = plan && plan !== "all" ? [plan as PlanSlug] : undefined;
    const statusFilter = status && status !== "all" ? [status] : undefined;

    const { data, total } = await getAdminSubscriptionsList({
      page,
      perPage,
      search,
      planFilter,
      statusFilter,
    });

    return NextResponse.json({
      users: data,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin List GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

