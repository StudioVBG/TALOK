export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminUsers } from "../_data/fetchAdminUsers";
import { PeopleClient } from "./PeopleClient";

const VALID_TABS = ["owners", "tenants", "vendors", "syndics", "agencies", "guarantors"] as const;
type PeopleTab = (typeof VALID_TABS)[number];

export default async function PeopleDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const rawTab = params.tab as PeopleTab | undefined;
  const activeTab: PeopleTab = VALID_TABS.includes(rawTab as PeopleTab) ? (rawTab as PeopleTab) : "owners";
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

  if (profileError || !profile || (profile.role !== "admin" && profile.role !== "platform_admin")) {
    redirect("/dashboard");
  }

  // Mapper l'onglet vers le rôle DB
  const roleMap: Record<PeopleTab, string> = {
    owners: "owner",
    tenants: "tenant",
    vendors: "provider",
    syndics: "syndic",
    agencies: "agency",
    guarantors: "guarantor",
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
