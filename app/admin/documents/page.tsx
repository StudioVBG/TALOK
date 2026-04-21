export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminDocuments } from "../_data/fetchAdminDocuments";
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

  const { documents, total } = await fetchAdminDocuments({
    page,
    limit,
    search: params.search,
    type: params.type,
    owner_id: params.owner_id,
    tenant_id: params.tenant_id,
    property_id: params.property_id,
    from: params.from,
    to: params.to,
  });

  return (
    <AdminDocumentsClient
      documents={(documents as any) || []}
      total={total}
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
