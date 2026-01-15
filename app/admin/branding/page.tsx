export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminBrandingClient } from "./AdminBrandingClient";

export const metadata = {
  title: "Configuration White-Label | Administration",
  description: "Gérer la configuration de marque blanche pour les organisations",
};

function BrandingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
      <div className="h-12 w-full bg-slate-200 rounded animate-pulse" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

async function getOrganizations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select(`
      *,
      branding:organization_branding(*),
      domains:custom_domains(*),
      owner:profiles!organizations_owner_id_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur fetch organizations:", error);
    return [];
  }

  return data || [];
}

export default async function AdminBrandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Vérifier le rôle admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const organizations = await getOrganizations();

  return (
    <Suspense fallback={<BrandingSkeleton />}>
      <AdminBrandingClient organizations={organizations} />
    </Suspense>
  );
}
