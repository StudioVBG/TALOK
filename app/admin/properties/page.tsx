import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminProperties } from "../_data/fetchAdminProperties";
import { PropertiesClient } from "./PropertiesClient";

export default async function AdminPropertiesPage() {
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

  const propertiesData = await fetchAdminProperties({ limit: 100 });

  return (
    <PropertiesClient 
      initialData={propertiesData as any} 
    />
  );
}

