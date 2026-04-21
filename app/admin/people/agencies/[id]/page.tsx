export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminServiceClient } from "@/app/admin/_data/requireAdminServiceClient";
import { AdminPersonDetail, DetailSection } from "../../_shared/AdminPersonDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAgencyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "admin" && adminProfile.role !== "platform_admin")) {
    redirect("/dashboard");
  }

  const serviceClient = await requireAdminServiceClient();
  if (!serviceClient) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Accès impossible</h1>
        <p className="text-muted-foreground">Service admin indisponible.</p>
      </div>
    );
  }

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("*, agency_profile:agency_profiles(*)")
    .eq("id", id)
    .eq("role", "agency")
    .single();

  if (!profile) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Agence introuvable</h1>
        <p className="text-muted-foreground">Cette agence n'existe pas.</p>
      </div>
    );
  }

  const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.user_id);
  const agency = Array.isArray(profile.agency_profile)
    ? profile.agency_profile[0]
    : profile.agency_profile;

  const { count: mandatesCount } = await serviceClient
    .from("mandates")
    .select("*", { count: "exact", head: true })
    .eq("agency_profile_id", id);

  const sections: DetailSection[] = [
    {
      title: "Agence",
      description: "Identité de l'agence / conciergerie",
      fields: [
        { label: "Raison sociale", value: agency?.raison_sociale },
        { label: "Forme juridique", value: agency?.forme_juridique },
        { label: "SIRET", value: agency?.siret },
        { label: "Commission par défaut", value: agency?.commission_gestion_defaut ? `${agency.commission_gestion_defaut} %` : null },
        { label: "Mandats actifs", value: mandatesCount ?? 0 },
      ],
    },
    {
      title: "Loi Hoguet",
      description: "Obligations réglementaires immobilier",
      fields: [
        { label: "Carte professionnelle", value: agency?.numero_carte_pro },
        { label: "Délivrée par", value: agency?.carte_pro_delivree_par },
        {
          label: "Validité",
          value: agency?.carte_pro_validite
            ? new Date(agency.carte_pro_validite).toLocaleDateString("fr-FR")
            : null,
        },
        { label: "Garantie financière", value: agency?.garantie_financiere_organisme },
        {
          label: "Montant garantie",
          value: agency?.garantie_financiere_montant
            ? `${Number(agency.garantie_financiere_montant).toLocaleString("fr-FR")} €`
            : null,
        },
        { label: "Assurance RCP", value: agency?.assurance_rcp_organisme },
      ],
    },
    {
      title: "Coordonnées",
      fields: [
        { label: "Adresse", value: agency?.adresse_siege },
        { label: "Site web", value: agency?.website },
        { label: "Zones d'intervention", value: agency?.zones_intervention?.join(", ") },
        { label: "Services proposés", value: agency?.services_proposes?.join(", ") },
      ],
    },
  ];

  return (
    <AdminPersonDetail
      title={agency?.raison_sociale || `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Agence"}
      subtitle="Détails de l'agence"
      roleLabel="Agence"
      profile={{
        prenom: profile.prenom,
        nom: profile.nom,
        email: authUser?.user?.email || null,
        telephone: profile.telephone,
        created_at: profile.created_at,
      }}
      sections={sections}
    />
  );
}

export const metadata = {
  title: "Détail Agence | Administration",
  description: "Consulter le profil complet de l'agence",
};
