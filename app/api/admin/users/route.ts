import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["admin", "platform_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Acces interdit" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "all";
  const status = searchParams.get("status") || "all";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("per_page") || "20", 10);
  const offset = (page - 1) * perPage;

  const serviceClient = createServiceRoleClient();

  let query = serviceClient
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (role !== "all") {
    query = query.eq("role", role);
  }

  if (status === "suspended") {
    query = query.eq("suspended", true);
  } else if (status === "active") {
    query = query.or("suspended.is.null,suspended.eq.false");
  }

  if (search) {
    query = query.or(
      `prenom.ilike.%${search}%,nom.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: profiles, count, error } = await query;

  if (error) {
    console.error("[admin/users] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // Fetch emails from auth.users
  const userIds = (profiles || [])
    .map((p: Record<string, unknown>) => p.user_id as string)
    .filter(Boolean);

  const emailMap = new Map<string, string>();
  await Promise.allSettled(
    userIds.map(async (userId: string) => {
      const { data } = await serviceClient.auth.admin.getUserById(userId);
      if (data?.user?.email) {
        emailMap.set(userId, data.user.email);
      }
    })
  );

  const users = (profiles || []).map((p: Record<string, unknown>) => ({
    ...p,
    email: emailMap.get(p.user_id as string) || (p.email as string) || null,
  }));

  return NextResponse.json({ users, total: count || 0 });
}
