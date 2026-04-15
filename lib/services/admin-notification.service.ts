/**
 * Lightweight service for creating admin notifications.
 * Uses service-role client to bypass RLS.
 */

import { getServiceClient } from "@/lib/supabase/service-client";

interface AdminNotifParams {
  type: "new_user" | "payment_failed" | "trial_expired" | "new_ticket" | "admin_alert";
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert a notification visible to all admins.
 * Uses a sentinel admin user_id from the profiles table.
 * Non-blocking: errors are logged but never thrown.
 */
export async function notifyAdmins(params: AdminNotifParams): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Find all admin profile IDs
    const { data: admins } = await supabase
      .from("profiles")
      .select("user_id")
      .in("role", ["admin", "platform_admin"])
      .limit(10);

    if (!admins || admins.length === 0) return;

    // Insert one notification per admin
    const rows = admins.map((admin: { user_id: string }) => ({
      user_id: admin.user_id,
      type: params.type,
      title: params.title,
      body: params.body,
      message: params.body,
      action_url: params.actionUrl || null,
      metadata: params.metadata || {},
      is_read: false,
    }));

    const { error } = await supabase.from("notifications").insert(rows);

    if (error) {
      console.error("[admin-notification] Insert error:", error.message);
    }
  } catch (err) {
    console.error("[admin-notification] Error:", err);
  }
}
