export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page /owner/entities/[entityId]/edit — Server Component wrapper
 *
 * Loads entity server-side with auth check, then passes data to EditEntityClient.
 * Mirrors the pattern of [entityId]/page.tsx for consistency.
 */

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { EditEntityClient } from "./EditEntityClient";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

interface PageProps {
  params: Promise<{ entityId: string }>;
}

export default async function EditEntityPage({ params }: PageProps) {
  const { entityId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const serviceClient = getServiceClient();

  // Fetch entity server-side
  const { data: entity, error } = await serviceClient
    .from("legal_entities")
    .select("*")
    .eq("id", entityId)
    .single();

  if (error || !entity) notFound();

  const e = entity as Record<string, unknown>;

  // Fetch gerant associate for representative data
  const { data: associates } = await serviceClient
    .from("entity_associates")
    .select("*")
    .eq("legal_entity_id", entityId)
    .eq("is_current", true)
    .eq("is_gerant", true)
    .limit(1);

  const gerant = (associates?.[0] || null) as Record<string, unknown> | null;
  const hasSelfRepresentant = gerant?.profile_id != null;

  // Extract email/telephone from metadata
  const metadata = (e.metadata as Record<string, unknown>) || {};

  const initialData: EntityFormData = {
    entityType: (e.entity_type as string) || "",
    nom: (e.nom as string) || "",
    formeJuridique: (e.forme_juridique as string) || "",
    regimeFiscal: (e.regime_fiscal as string) || "ir",
    siret: (e.siret as string) || "",
    capitalSocial: e.capital_social != null ? String(e.capital_social) : "",
    nombreParts: e.nombre_parts != null ? String(e.nombre_parts) : "",
    rcsVille: (e.rcs_ville as string) || "",
    dateCreation: (e.date_creation as string) || "",
    numeroTva: (e.numero_tva as string) || "",
    objetSocial: "Gestion de biens immobiliers",
    adresseSiege: (e.adresse_siege as string) || "",
    codePostalSiege: (e.code_postal_siege as string) || "",
    villeSiege: (e.ville_siege as string) || "",
    emailEntite: (metadata.email as string) || "",
    telephoneEntite: (metadata.telephone as string) || "",
    representantMode: hasSelfRepresentant ? "self" : "other",
    representantPrenom: (gerant?.prenom as string) || "",
    representantNom: (gerant?.nom as string) || "",
    representantQualite: "Gérant(e)",
    representantDateNaissance: (gerant?.date_naissance as string) || "",
    iban: (e.iban as string) || "",
    bic: (e.bic as string) || "",
    banqueNom: (e.banque_nom as string) || "",
    premierExerciceDebut: (e.premier_exercice_debut as string) || "",
    premierExerciceFin: (e.premier_exercice_fin as string) || "",
    dateClotureExercice: (e.date_cloture_exercice as string) || "",
  };

  return (
    <EditEntityClient
      entityId={entityId}
      initialData={initialData}
      entityName={(e.nom as string) || "Entité juridique"}
    />
  );
}
