/**
 * Page dispatcher `/admin/people/[id]`.
 *
 * **Ce n'est PAS un doublon** des pages `/admin/people/{owners,tenants,vendors}/[id]` —
 * c'est une porte d'entrée unique qui redirige selon le rôle du profile :
 *   - owner   → `/admin/people/owners/[id]`
 *   - tenant  → `/admin/people/tenants/[id]`
 *   - provider → `/admin/people/vendors/[id]`
 *   - syndic / agency / guarantor → rendu inline ici (pas de page dédiée)
 *
 * Permet à l'admin d'arriver depuis n'importe quel lien (`/admin/people/<uuid>`)
 * sans connaître le rôle à l'avance. Next.js privilégie les routes plus
 * spécifiques (`/people/owners/[id]`) quand elles matchent — pas de
 * conflit de routing.
 *
 * Ne pas "consolider" en un seul layout sous prétexte de DRY : les pages
 * spécialisées ont leurs propres data-loaders et clients (OwnerDetailsClient,
 * etc.) qui dépendent de hooks et d'écrans propres au rôle.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdminServiceClient } from "@/app/admin/_data/requireAdminServiceClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Calendar } from "lucide-react";
import { getUserRoleLabel } from "@/lib/constants/roles";
import { AdminResetPasswordButton } from "@/components/admin/AdminResetPasswordButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface DetailField {
  label: string;
  value: string | number | null | undefined;
}

interface DetailSection {
  title: string;
  description?: string;
  fields: DetailField[];
}

const fmtMoney = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : `${Number(v).toLocaleString("fr-FR")} €`;

const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("fr-FR") : null;

function buildSyndicSections(syndic: any): DetailSection[] {
  return [
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
        { label: "Validité", value: fmtDate(syndic?.carte_pro_validite) },
        { label: "Garantie financière", value: syndic?.garantie_financiere_organisme },
        { label: "Montant garantie", value: fmtMoney(syndic?.garantie_financiere_montant) },
        { label: "Assurance RCP", value: syndic?.assurance_rcp_organisme },
      ],
    },
    {
      title: "Coordonnées cabinet",
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
}

function buildAgencySections(agency: any, mandatesCount: number): DetailSection[] {
  return [
    {
      title: "Agence",
      description: "Identité de l'agence / conciergerie",
      fields: [
        { label: "Raison sociale", value: agency?.raison_sociale },
        { label: "Forme juridique", value: agency?.forme_juridique },
        { label: "SIRET", value: agency?.siret },
        {
          label: "Commission par défaut",
          value: agency?.commission_gestion_defaut ? `${agency.commission_gestion_defaut} %` : null,
        },
        { label: "Mandats actifs", value: mandatesCount },
      ],
    },
    {
      title: "Loi Hoguet",
      description: "Obligations réglementaires immobilier",
      fields: [
        { label: "Carte professionnelle", value: agency?.numero_carte_pro },
        { label: "Délivrée par", value: agency?.carte_pro_delivree_par },
        { label: "Validité", value: fmtDate(agency?.carte_pro_validite) },
        { label: "Garantie financière", value: agency?.garantie_financiere_organisme },
        { label: "Montant garantie", value: fmtMoney(agency?.garantie_financiere_montant) },
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
}

function buildGuarantorSections(guarantor: any): DetailSection[] {
  return [
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
}

const ANNUAIRE_TAB_BY_ROLE: Record<string, string> = {
  syndic: "syndics",
  agency: "agencies",
  guarantor: "guarantors",
  owner: "owners",
  tenant: "tenants",
  provider: "vendors",
};

export default async function AdminPersonDetailPage({ params }: PageProps) {
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
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Utilisateur introuvable</h1>
        <p className="text-muted-foreground">Ce profil n'existe pas.</p>
      </div>
    );
  }

  // Redirige vers les pages dédiées existantes pour les rôles historiques
  if (profile.role === "owner") redirect(`/admin/people/owners/${id}`);
  if (profile.role === "tenant") redirect(`/admin/people/tenants/${id}`);
  if (profile.role === "provider") redirect(`/admin/people/vendors/${id}`);

  const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.user_id);
  const email = authUser?.user?.email || null;

  let sections: DetailSection[] = [];
  let title = `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Utilisateur";

  if (profile.role === "syndic") {
    const { data: syndicRows } = await serviceClient
      .from("syndic_profiles")
      .select("*")
      .eq("profile_id", id)
      .limit(1);
    const syndic = syndicRows?.[0] ?? null;
    sections = buildSyndicSections(syndic);
  } else if (profile.role === "agency") {
    const { data: agencyRows } = await serviceClient
      .from("agency_profiles")
      .select("*")
      .eq("profile_id", id)
      .limit(1);
    const agency = agencyRows?.[0] ?? null;
    const { count: mandatesCount } = await serviceClient
      .from("mandates")
      .select("*", { count: "exact", head: true })
      .eq("agency_profile_id", id);
    sections = buildAgencySections(agency, mandatesCount ?? 0);
    if (agency?.raison_sociale) title = agency.raison_sociale;
  } else if (profile.role === "guarantor") {
    const { data: guarantorRows } = await serviceClient
      .from("guarantor_profiles")
      .select("*")
      .eq("profile_id", id)
      .limit(1);
    sections = buildGuarantorSections(guarantorRows?.[0] ?? null);
  } else {
    sections = [];
  }

  const backTab = ANNUAIRE_TAB_BY_ROLE[profile.role] || "owners";
  const backHref = `/admin/people?tab=${backTab}`;
  const roleLabel = getUserRoleLabel(profile.role);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{title}</h1>
            <Badge variant="secondary">{roleLabel}</Badge>
          </div>
          <p className="text-muted-foreground">Détail du compte depuis l'annuaire</p>
        </div>
        {email && profile.role !== "admin" && profile.role !== "platform_admin" && (
          <AdminResetPasswordButton
            profileId={profile.id}
            email={email}
            userName={title}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Coordonnées principales du compte</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{email || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{profile.telephone || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              Créé le {fmtDate(profile.created_at) || "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            {section.fields.length === 0 ? (
              <p className="text-muted-foreground">Aucune donnée renseignée.</p>
            ) : (
              section.fields.map((field) => (
                <div key={field.label}>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">{field.label}</p>
                  <p className="font-medium">
                    {field.value === null || field.value === undefined || field.value === ""
                      ? "—"
                      : String(field.value)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export const metadata = {
  title: "Détail utilisateur | Administration",
  description: "Consulter le profil complet depuis l'annuaire admin",
};
