export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantProfileClient } from "./TenantProfileClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTenantProfile(tenantId: string, ownerId: string) {
  const supabase = await createClient();

  // Récupérer le profil du locataire avec vérification des droits
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

  // Vérifier que le propriétaire a accès à ce locataire
  const hasAccess = (tenant.roommates as any[])?.some((r: any) => 
    r.lease?.property?.owner_id === ownerId
  );

  if (!hasAccess) {
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

export default async function TenantProfilePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Récupérer le profil propriétaire
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const tenant = await getTenantProfile(id, profile.id);

  if (!tenant) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Locataire non trouvé</h1>
        <p className="text-muted-foreground">
          Ce locataire n'existe pas ou vous n'avez pas les droits pour le consulter.
        </p>
      </div>
    );
  }

  return <TenantProfileClient tenant={tenant} isAdmin={profile.role === "admin"} />;
}

export const metadata = {
  title: "Fiche Locataire | Talok",
  description: "Consulter le profil complet du locataire",
};

