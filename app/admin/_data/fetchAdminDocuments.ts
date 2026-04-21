import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

interface FetchAdminDocumentsOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  owner_id?: string;
  tenant_id?: string;
  property_id?: string;
  from?: string;
  to?: string;
}

interface FetchAdminDocumentsResult {
  documents: unknown[];
  total: number;
}

export async function fetchAdminDocuments(
  options: FetchAdminDocumentsOptions = {}
): Promise<FetchAdminDocumentsResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { documents: [], total: 0 };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "admin" && adminProfile.role !== "platform_admin")) {
    return { documents: [], total: 0 };
  }

  const { page = 1, limit = 20, search, type, owner_id, tenant_id, property_id, from, to } = options;
  const offset = (Math.max(1, page) - 1) * limit;

  const serviceClient = createServiceRoleClient();

  let query = serviceClient
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

  if (type) query = query.eq("type", type);
  if (owner_id) query = query.eq("owner_id", owner_id);
  if (tenant_id) query = query.eq("tenant_id", tenant_id);
  if (property_id) query = query.eq("property_id", property_id);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching admin documents:", error);
    return { documents: [], total: 0 };
  }

  return { documents: data || [], total: count || 0 };
}
