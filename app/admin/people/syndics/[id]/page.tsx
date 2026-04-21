export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminServiceClient } from "@/app/admin/_data/requireAdminServiceClient";
import { AdminPersonDetail, DetailSection } from "../../_shared/AdminPersonDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSyndicDetailPage({ params }: PageProps) {
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
    .select("*, syndic_profile:syndic_profiles(*)")
    .eq("id", id)
    .eq("role", "syndic")
    .single();

  if (!profile) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Syndic introuvable</h1>
        <p className="text-muted-foreground">Ce syndic n'existe pas.</p>
      </div>
    );
  }

  const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.user_id);
  const syndic = Array.isArray(profile.syndic_profile)
    ? profile.syndic_profile[0]
    : profile.syndic_profile;

  const sections: DetailSection[] = [
    {
      title: "Cabinet",
      description: "Identité du cabinet de syndic",
      fields: [
        { label: "Raison sociale", value: syndic?.raison_sociale },
        { label: "Type de syndic", value: syndic?.type_syndic },
        { label: "Forme juridique", value: syndic?.forme_juridique },
        { label: "SIRET", value: syndic?.siret },
        { label: "Copropriétés gérées", value: syndic?.nombre_coproprietes_gerees },
      ],
    },
    {
      title: "Loi Hoguet",
      description: "Obligations réglementaires",
      fields: [
        { label: "Carte professionnelle", value: syndic?.numero_carte_pro },
        { label: "Délivrée par", value: syndic?.carte_pro_delivree_par },
        {
          label: "Validité",
          value: syndic?.carte_pro_validite
            ? new Date(syndic.carte_pro_validite).toLocaleDateString("fr-FR")
            : null,
        },
        { label: "Garantie financière", value: syndic?.garantie_financiere_organisme },
        {
          label: "Montant garantie",
          value: syndic?.garantie_financiere_montant
            ? `${Number(syndic.garantie_financiere_montant).toLocaleString("fr-FR")} €`
            : null,
        },
        { label: "Assurance RCP", value: syndic?.assurance_rcp_organisme },
      ],
    },
    {
      title: "Coordonnées",
      fields: [
        { label: "Adresse", value: syndic?.adresse_siege },
        { label: "Code postal", value: syndic?.code_postal },
        { label: "Ville", value: syndic?.ville },
        { label: "Email contact", value: syndic?.email_contact },
        { label: "Téléphone cabinet", value: syndic?.telephone },
        { label: "Site web", value: syndic?.website },
      ],
    },
  ];

  return (
    <AdminPersonDetail
      title={`${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Syndic"}
      subtitle="Détails du syndic"
      roleLabel="Syndic"
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
  title: "Détail Syndic | Administration",
  description: "Consulter le profil complet du syndic",
};
