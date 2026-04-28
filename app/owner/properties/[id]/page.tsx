export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { fetchPropertyDetails } from "../../_data/fetchPropertyDetails";
import { PropertyDetailsClient } from "./PropertyDetailsClient";
import type { Metadata, ResolvingMetadata } from "next";

// Pas d'ISR : la page est dynamique côté propriétaire (édition + photos en
// temps réel). Le cache 1h cassait l'affichage des photos / champs juste après
// sauvegarde. La révalidation est déclenchée explicitement par router.refresh().
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const serviceClient = getServiceClient();

  // Récupérer les infos basiques pour les métadonnées
  const { data: property } = await serviceClient
    .from("properties")
    .select("adresse_complete, ville, surface, nb_pieces, type")
    .eq("id", id)
    .single();

  if (!property) {
    return {
      title: "Bien non trouvé | Talok",
    };
  }

  return {
    title: `${property.adresse_complete} | Talok`,
    description: `${property.type}${property.surface ? ` de ${property.surface}m²` : ''}${property.nb_pieces ? ` avec ${property.nb_pieces} pièce(s)` : ''} à ${property.ville}`,
  };
}

export default async function OwnerPropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // 2. Récupérer le profil (nécessaire pour le role ET pour l'ID owner)
  const serviceClient = getServiceClient();
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard"); // ou page erreur 403
  }

  // 3. Charger les détails de la propriété via la RPC
  try {
    const details = await fetchPropertyDetails(id, profile.id, user.id);

    if (!details) {
      return (
        <div className="container mx-auto py-12 text-center">
           <h1 className="text-2xl font-bold mb-4">Propriété non trouvée</h1>
           <p className="text-muted-foreground">Ce bien n'existe pas ou vous n'avez pas les droits pour le voir.</p>
        </div>
      );
    }

    // Immeuble → rediriger vers le dashboard immeuble
    if ((details as any).type === "immeuble") {
      redirect(`/owner/buildings/${id}`);
    }

    // Item #13 : si la property est un lot d'immeuble, enrichir le contexte
    // avec l'adresse du parent pour afficher un breadcrumb "Mes biens >
    // Immeuble [X] > Lot [Y]" et un badge cliquable vers le hub immeuble.
    let parentBuilding: { id: string; adresse_complete: string | null } | null = null;
    const parentPropertyId = (details as any).parent_property_id as string | null | undefined;
    if (parentPropertyId) {
      const { data: parent } = await serviceClient
        .from("properties")
        .select("id, adresse_complete")
        .eq("id", parentPropertyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (parent) {
        parentBuilding = {
          id: parent.id,
          adresse_complete: parent.adresse_complete ?? null,
        };
      }
    }

    return (
      <PropertyDetailsClient
        details={details}
        propertyId={id}
        parentBuilding={parentBuilding}
      />
    );
  } catch (error) {
    console.error("Error loading property details:", error);
    return (
        <div className="container mx-auto py-12 text-center">
           <h1 className="text-2xl font-bold mb-4 text-red-600">Erreur</h1>
           <p className="text-muted-foreground">Une erreur est survenue lors du chargement du bien.</p>
        </div>
      );
  }
}
