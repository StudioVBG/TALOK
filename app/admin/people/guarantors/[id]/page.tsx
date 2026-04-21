export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminServiceClient } from "@/app/admin/_data/requireAdminServiceClient";
import { AdminPersonDetail, DetailSection } from "../../_shared/AdminPersonDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminGuarantorDetailPage({ params }: PageProps) {
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
    .select("*, guarantor_profile:guarantor_profiles(*)")
    .eq("id", id)
    .eq("role", "guarantor")
    .single();

  if (!profile) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Garant introuvable</h1>
        <p className="text-muted-foreground">Ce garant n'existe pas.</p>
      </div>
    );
  }

  const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.user_id);
  const guarantor = Array.isArray(profile.guarantor_profile)
    ? profile.guarantor_profile[0]
    : profile.guarantor_profile;

  const fmtMoney = (v: number | string | null | undefined) =>
    v === null || v === undefined ? null : `${Number(v).toLocaleString("fr-FR")} €`;

  const sections: DetailSection[] = [
    {
      title: "Situation professionnelle",
      fields: [
        { label: "Situation", value: guarantor?.situation_professionnelle },
        { label: "Profession", value: guarantor?.profession },
        { label: "Employeur", value: guarantor?.employeur },
        { label: "Revenus mensuels nets", value: fmtMoney(guarantor?.revenus_mensuels_nets) },
        { label: "Revenus annuels", value: fmtMoney(guarantor?.revenus_annuels) },
      ],
    },
    {
      title: "Patrimoine",
      fields: [
        { label: "Propriétaire de sa résidence", value: guarantor?.proprietaire_residence ? "Oui" : "Non" },
        { label: "Valeur patrimoine immobilier", value: fmtMoney(guarantor?.valeur_patrimoine_immobilier) },
        { label: "Épargne disponible", value: fmtMoney(guarantor?.epargne_disponible) },
      ],
    },
    {
      title: "Vérifications",
      description: "Statut des documents et onboarding",
      fields: [
        { label: "Documents vérifiés", value: guarantor?.documents_verified ? "Oui" : "Non" },
        { label: "Onboarding terminé", value: guarantor?.onboarding_completed ? "Oui" : "Non" },
        { label: "Étape onboarding", value: guarantor?.onboarding_step ?? 0 },
      ],
    },
  ];

  return (
    <AdminPersonDetail
      title={`${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Garant"}
      subtitle="Détails du garant"
      roleLabel="Garant"
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
  title: "Détail Garant | Administration",
  description: "Consulter le profil complet du garant",
};
