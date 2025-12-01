import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TenantsListClient } from "./TenantsListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Locataires | Administration",
  description: "Gérer tous les locataires de la plateforme",
};

async function fetchAllTenants() {
  const supabase = await createClient();
  
  const { data: tenants, error } = await supabase
    .from("profiles")
    .select(`
      *,
      tenant_profile:tenant_profiles(*),
      roommates:roommates(
        lease:leases(
          id,
          type_bail,
          loyer,
          statut,
          date_debut,
          property:properties(
            adresse_complete,
            ville,
            owner:profiles!properties_owner_id_fkey(
              prenom,
              nom
            )
          )
        )
      )
    `)
    .eq("role", "tenant")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur fetch tenants:", error);
    return [];
  }

  return tenants || [];
}

async function TenantsContent() {
  const tenants = await fetchAllTenants();
  return <TenantsListClient tenants={tenants} />;
}

export default async function AdminTenantsPage() {
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

  return (
    <Suspense fallback={<TenantsSkeleton />}>
      <TenantsContent />
    </Suspense>
  );
}

function TenantsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

