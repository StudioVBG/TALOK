// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications
 * Récupère les notifications de l'utilisateur connecté
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer les notifications
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error("[API notifications] Erreur:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    // Compter les non-lues
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error("[API notifications] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Marquer les notifications comme lues
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all } = body;

    if (mark_all) {
      // Marquer toutes les notifications comme lues
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) {
        return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Toutes les notifications marquées comme lues" });
    }

    if (notification_ids && Array.isArray(notification_ids)) {
      // Marquer des notifications spécifiques comme lues
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("id", notification_ids);

      if (error) {
        return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Notifications marquées comme lues" });
    }

    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  } catch (error) {
    console.error("[API notifications] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
