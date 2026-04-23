import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["admin", "platform_admin"].includes(profile.role)) return null;
  return profile;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.flags.update");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const body = await request.json();
  const { enabled, rollout_percentage, description } = body;

  const serviceClient = createServiceRoleClient();

  const updates: Record<string, unknown> = {
    updated_by: admin.id,
    updated_at: new Date().toISOString(),
  };
  if (enabled !== undefined) updates.enabled = enabled;
  if (rollout_percentage !== undefined) updates.rollout_percentage = rollout_percentage;
  if (description !== undefined) updates.description = description;

  const { data, error } = await serviceClient
    .from("feature_flags")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await serviceClient.rpc("log_admin_action", {
    p_action: "feature_flag_updated",
    p_target_type: "feature_flag",
    p_target_id: id,
    p_details: updates,
  }).catch(() => {});

  return NextResponse.json({ flag: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.flags.delete");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const serviceClient = createServiceRoleClient();

  const { error } = await serviceClient
    .from("feature_flags")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await serviceClient.rpc("log_admin_action", {
    p_action: "feature_flag_deleted",
    p_target_type: "feature_flag",
    p_target_id: id,
    p_details: {},
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
