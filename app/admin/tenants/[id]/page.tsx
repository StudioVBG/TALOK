import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantProfileClient } from "@/app/app/owner/tenants/[id]/TenantProfileClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTenantProfileAdmin(tenantId: string) {
  const supabase = await createClient();

  // Admin peut voir tous les locataires
  const { data: tenant, error } = await supabase
    .from("profiles")
    .select(`
      *,
      tenant_profile:tenant_profiles(*),
      roommates:roommates(
        *,
        lease:leases(
          *,
          property:properties(
            id,
            adresse_complete,
            code_postal,
            ville,
            owner_id
          )
        )
      )
    `)
    .eq("id", tenantId)
    .eq("role", "tenant")
    .single();

  if (error || !tenant) {
    return null;
  }

  // Récupérer les documents du locataire
  const { data: documents } = await supabase
    .from("tenant_documents")
    .select("*")
    .eq("tenant_profile_id", tenantId)
    .order("uploaded_at", { ascending: false });

  return {
    ...tenant,
    documents: documents || [],
  };
}

export default async function AdminTenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Vérifier l'authentification admin
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const tenant = await getTenantProfileAdmin(id);

  if (!tenant) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Locataire non trouvé</h1>
        <p className="text-muted-foreground">
          Ce locataire n'existe pas.
        </p>
      </div>
    );
  }

  return <TenantProfileClient tenant={tenant} isAdmin={true} />;
}

export const metadata = {
  title: "Détail Locataire | Administration",
  description: "Consulter le profil complet du locataire",
};

