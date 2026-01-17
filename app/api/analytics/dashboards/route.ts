export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/analytics/dashboards - Récupérer les dashboards analytics
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "user"; // 'admin' | 'owner' | 'tenant' | 'provider' | 'user'

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    // Récupérer les dashboards selon le scope
    let dashboards;
    if (scope === "admin" && profileData?.role === "admin") {
      // Dashboards admin globaux
      const { data: adminDashboards } = await supabase
        .from("analytics_dashboards")
        .select(`
          *,
          widgets:analytics_widgets(*)
        `)
        // @ts-ignore - Supabase typing issue
        .eq("scope", "admin")
        .order("created_at", { ascending: false });

      dashboards = adminDashboards;
    } else {
      // Dashboards de l'utilisateur
      const { data: userDashboards } = await supabase
        .from("analytics_dashboards")
        .select(`
          *,
          widgets:analytics_widgets(*)
        `)
        // @ts-ignore - Supabase typing issue
        .or(`owner_id.eq.${profileData?.id},scope.eq.${profileData?.role}`)
        .order("created_at", { ascending: false });

      dashboards = userDashboards;
    }

    return NextResponse.json({ dashboards: dashboards || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/dashboards - Créer un dashboard
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { name, scope, widgets } = body;

    if (!name || !scope) {
      return NextResponse.json(
        { error: "name et scope requis" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileDataPost = profile as any;
    // Seul l'admin peut créer des dashboards admin
    if (scope === "admin" && profileDataPost?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut créer des dashboards admin" },
        { status: 403 }
      );
    }

    // Créer le dashboard
    const { data: dashboard, error: dashboardError } = await supabase
      .from("analytics_dashboards")
      .insert({
        name,
        scope,
        owner_id: scope !== "admin" ? profileDataPost?.id : null,
        is_default: false,
      } as any)
      .select()
      .single();

    if (dashboardError) throw dashboardError;

    // Créer les widgets si fournis
    if (widgets && Array.isArray(widgets)) {
      for (let i = 0; i < widgets.length; i++) {
        const widget = widgets[i];
        await supabase.from("analytics_widgets").insert({
          dashboard_id: (dashboard as any)?.id,
          type: widget.type,
          title: widget.title,
          config: widget.config || {},
          position: i,
          size: widget.size || "medium",
        } as any);
      }
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Analytics.WidgetUpdated",
      payload: {
        dashboard_id: (dashboard as any)?.id,
        action: "created",
      },
    } as any);

    return NextResponse.json({ dashboard });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

