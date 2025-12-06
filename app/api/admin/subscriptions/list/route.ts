/**
 * GET /api/admin/subscriptions/list
 * Liste les abonnements avec pagination et filtres (admin only)
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSubscriptionsList } from "@/lib/subscriptions/subscription-service";
import type { PlanSlug } from "@/lib/subscriptions/plans";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
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

