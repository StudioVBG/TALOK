export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDocumentsClient } from "./AdminDocumentsClient";

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    type?: string;
    owner_id?: string;
    tenant_id?: string;
    property_id?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "platform_admin")) {
    redirect("/dashboard");
  }

  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build query — admin RLS policy gives full access
  let query = supabase
    .from("documents")
    .select(
      `
      id,
      type,
      title,
      original_filename,
      visible_tenant,
      is_generated,
      created_at,
      file_size,
      mime_type,
      storage_path,
      owner:profiles!documents_owner_id_fkey(id, nom, prenom),
      tenant:profiles!documents_tenant_id_fkey(id, nom, prenom),
      property:properties!documents_property_id_fkey(id, adresse_complete)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.type) {
    query = query.eq("type", params.type);
  }
  if (params.owner_id) {
    query = query.eq("owner_id", params.owner_id);
  }
  if (params.tenant_id) {
    query = query.eq("tenant_id", params.tenant_id);
  }
  if (params.property_id) {
    query = query.eq("property_id", params.property_id);
  }
  if (params.from) {
    query = query.gte("created_at", params.from);
  }
  if (params.to) {
    query = query.lte("created_at", params.to + "T23:59:59");
  }

  // Full-text search via title ilike (simpler than RPC for admin view)
  if (params.search) {
    query = query.ilike("title", `%${params.search}%`);
  }

  const { data: documents, count, error } = await query;

  return (
    <AdminDocumentsClient
      documents={(documents as any) || []}
      total={count || 0}
      page={page}
      limit={limit}
      filters={{
        search: params.search || "",
        type: params.type || "",
        owner_id: params.owner_id || "",
        tenant_id: params.tenant_id || "",
        property_id: params.property_id || "",
        from: params.from || "",
        to: params.to || "",
      }}
    />
  );
}
