import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminUsers } from "../_data/fetchAdminUsers";
import { PeopleClient } from "./PeopleClient";

export default async function PeopleDirectoryPage() {
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

  // Charger les 3 onglets en parallèle
  const [ownersData, tenantsData, vendorsData] = await Promise.all([
    fetchAdminUsers({ role: "owner", limit: 50 }),
    fetchAdminUsers({ role: "tenant", limit: 50 }),
    fetchAdminUsers({ role: "provider", limit: 50 }),
  ]);

  return (
    <PeopleClient 
      initialData={{
        owners: ownersData as any,
        tenants: tenantsData as any,
        vendors: vendorsData as any
      }} 
    />
  );
}
