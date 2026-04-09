import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

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

export async function GET() {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const serviceClient = createServiceRoleClient();

  const { data: flags, error } = await serviceClient
    .from("feature_flags")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin/flags] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ flags: flags || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, enabled, rollout_percentage } = body;

  if (!name) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient
    .from("feature_flags")
    .insert({
      name,
      description: description || "",
      enabled: enabled ?? false,
      rollout_percentage: rollout_percentage ?? 0,
      updated_by: admin.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ce flag existe deja" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await serviceClient.rpc("log_admin_action", {
    p_action: "feature_flag_created",
    p_target_type: "feature_flag",
    p_target_id: data.id,
    p_details: { name, enabled },
  }).catch(() => {});

  return NextResponse.json({ flag: data }, { status: 201 });
}
