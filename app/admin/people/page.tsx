import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminUsers } from "../_data/fetchAdminUsers";
import { PeopleClient } from "./PeopleClient";

export default async function PeopleDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const activeTab = (params.tab as "owners" | "tenants" | "vendors") || "owners";
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Mapper l'onglet vers le rôle DB
  const roleMap: Record<string, string> = {
    owners: "owner",
    tenants: "tenant",
    vendors: "provider",
  };

  const targetRole = roleMap[activeTab];

  // Charger SEULEMENT les données de l'onglet actif
  const data = await fetchAdminUsers({
    role: targetRole,
    search,
    limit,
    offset,
  });

  return (
    <PeopleClient
      activeTab={activeTab}
      initialData={data} // On passe directement { users, total }
      currentPage={page}
      currentSearch={search}
    />
  );
}
