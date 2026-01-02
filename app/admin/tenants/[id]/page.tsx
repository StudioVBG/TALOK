export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantProfileClient } from "@/app/owner/tenants/[id]/TenantProfileClient";

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
      ),
      lease_signers:lease_signers(
        lease_id,
        role,
        signature_status,
        signed_at,
        lease:leases(
          id,
          statut,
          type_bail,
          loyer,
          property:properties(
            id,
            adresse_complete,
            ville
          )
        )
      )
    `)
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    console.log("[Admin Tenant] Erreur ou tenant non trouvé:", error);
    return null;
  }

  // Récupérer les documents du locataire depuis la table "documents"
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (docsError) {
    console.log("[Admin Tenant] Erreur documents:", docsError);
  }

  // Fallback: essayer tenant_documents si la table existe
  let allDocuments = documents || [];
  try {
    const { data: tenantDocs } = await supabase
      .from("tenant_documents")
      .select("*")
      .eq("tenant_profile_id", tenantId)
      .order("uploaded_at", { ascending: false });
    
    if (tenantDocs && tenantDocs.length > 0) {
      // Normaliser le format et fusionner
      const normalizedDocs = tenantDocs.map(d => ({
        ...d,
        created_at: d.uploaded_at || d.created_at,
        type: d.document_type || d.type,
      }));
      allDocuments = [...allDocuments, ...normalizedDocs];
    }
  } catch (e) {
    // Table tenant_documents n'existe peut-être pas
    console.log("[Admin Tenant] tenant_documents non disponible");
  }

  return {
    ...tenant,
    documents: allDocuments,
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

