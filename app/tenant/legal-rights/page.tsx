export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LegalRightsClient } from "./LegalRightsClient";

export const metadata: Metadata = {
  title: "Vos Droits | Locataire",
  description: "Vos droits en tant que locataire et protocoles de protection contre les expulsions illégales",
};

interface PropertyAddress {
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string | null;
}

export default async function TenantLegalRightsPage() {
  const supabase = await createClient();
  
  // Récupérer l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");
  
  // Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();
  
  if (!profile) redirect("/auth/signin");
  
  // Vérifier que c'est bien un locataire
  if (profile.role !== "tenant") {
    redirect("/");
  }
  
  // Récupérer le bail actif avec le logement
  let propertyAddress: PropertyAddress | null = null;
  
  try {
    const { data: leaseData } = await supabase
      .from("lease_signers")
      .select(`
        lease_id,
        leases:lease_id (
          id,
          property_id,
          statut,
          type_bail,
          loyer,
          date_debut,
          properties:property_id (
            id,
            adresse_complete,
            code_postal,
            ville,
            departement,
            type,
            dpe_classe_energie,
            owner_id
          )
        )
      `)
      .eq("profile_id", profile.id)
      .in("signature_status", ["signed", "pending"])
      .limit(1)
      .maybeSingle();
    
    // Extraire les données du logement si disponibles
    if (leaseData?.leases) {
      const lease = leaseData.leases as {
        properties?: {
          adresse_complete: string;
          code_postal: string;
          ville: string;
          departement: string | null;
        };
      };
      
      if (lease.properties) {
        propertyAddress = {
          adresse_complete: lease.properties.adresse_complete,
          code_postal: lease.properties.code_postal,
          ville: lease.properties.ville,
          departement: lease.properties.departement,
        };
      }
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du bail:", error);
    // On continue sans les données du logement
  }
  
  return (
    <LegalRightsClient propertyAddress={propertyAddress} />
  );
}







