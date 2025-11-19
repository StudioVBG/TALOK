import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminStats } from "../_data/fetchAdminStats";
import { DashboardClient } from "./DashboardClient";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    // Si pas admin, rediriger vers le bon dashboard
    if (profile?.role === "owner") redirect("/app/owner/dashboard");
    if (profile?.role === "tenant") redirect("/app/tenant/dashboard");
    redirect("/");
  }

  const stats = await fetchAdminStats();

  if (!stats) {
    return <div>Erreur de chargement des statistiques.</div>;
  }

  return <DashboardClient stats={stats} />;
}
