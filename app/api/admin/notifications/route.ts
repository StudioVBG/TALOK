export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

/**
 * GET /api/admin/notifications — Liste des notifications admin (non lues en premier)
 * PATCH /api/admin/notifications — Marquer comme lue { id: string }
 */
export async function GET(request: Request) {
  const { error: authError, supabase, user } = await requireAdmin(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  // Fetch admin notifications (notifications targeted at admin role)
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${user.id},type.in.(new_user,payment_failed,trial_expired,new_ticket,admin_alert)`)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;

  return NextResponse.json({
    notifications: notifications || [],
    unread_count: unreadCount,
  });
}

export async function PATCH(request: NextRequest) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.notifications.update");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const { error: authError, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
