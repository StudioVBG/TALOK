export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";

/**
 * POST /api/colocation/tasks/rotate
 * Rotation automatique des taches entre membres
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const propertyId = body.property_id;
    if (!propertyId) {
      return NextResponse.json({ error: "property_id requis" }, { status: 400 });
    }

    // Get active members
    const { data: members } = await supabase
      .from("colocation_members")
      .select("id")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .order("move_in_date", { ascending: true });

    if (!members || members.length === 0) {
      return NextResponse.json({ rotated: 0 });
    }

    const memberIds = members.map((m: any) => m.id);

    // Get tasks with rotation enabled and an assignee
    const { data: tasks } = await supabase
      .from("colocation_tasks")
      .select("id, assigned_member_id")
      .eq("property_id", propertyId)
      .eq("rotation_enabled", true)
      .not("assigned_member_id", "is", null);

    let rotated = 0;
    for (const task of tasks || []) {
      const currentIndex = memberIds.indexOf(task.assigned_member_id);
      const nextIndex = (currentIndex + 1) % memberIds.length;
      const nextMemberId = memberIds[nextIndex];

      await supabase
        .from("colocation_tasks")
        .update({
          assigned_member_id: nextMemberId,
          completed_at: null,
          completed_by: null,
        })
        .eq("id", task.id);

      rotated++;
    }

    return NextResponse.json({ rotated });
  } catch (err) {
    return handleApiError(err);
  }
}
