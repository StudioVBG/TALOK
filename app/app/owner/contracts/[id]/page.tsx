export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLeaseDetails } from "../../_data/fetchLeaseDetails";
import { LeaseDetailsClient } from "./LeaseDetailsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerContractDetailPage({ params }: PageProps) {
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

  // 2. Récupérer le profil de base (sans jointure problématique)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, email, telephone")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // 3. Récupérer les infos owner_profiles séparément (optionnel, ne bloque pas si absent)
  const { data: ownerProfileData } = await supabase
    .from("owner_profiles")
    .select("adresse_facturation, adresse_siege, type, raison_sociale, forme_juridique, siret")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Utiliser adresse_facturation en priorité, sinon adresse_siege
  const ownerAddress = ownerProfileData?.adresse_facturation || ownerProfileData?.adresse_siege || "";

  // 4. Charger les détails du bail
  try {
    const details = await fetchLeaseDetails(id, profile.id);

    if (!details) {
      return (
        <div className="container mx-auto py-12 text-center">
           <h1 className="text-2xl font-bold mb-4">Bail non trouvé</h1>
           <p className="text-muted-foreground">Ce contrat n'existe pas ou vous n'avez pas les droits pour le voir.</p>
        </div>
      );
    }

    return (
      <LeaseDetailsClient 
        details={details} 
        leaseId={id} 
        ownerProfile={{
          id: profile.id,
          prenom: profile.prenom || "",
          nom: profile.nom || "",
          email: profile.email || "",
          telephone: profile.telephone || "",
          adresse: ownerAddress,
          type: ownerProfileData?.type || "particulier",
          raison_sociale: ownerProfileData?.raison_sociale || "",
          forme_juridique: ownerProfileData?.forme_juridique || "",
          siret: ownerProfileData?.siret || "",
        }}
      />
    );
  } catch (error) {
    console.error("Error loading lease details:", error);
    return (
        <div className="container mx-auto py-12 text-center">
           <h1 className="text-2xl font-bold mb-4 text-red-600">Erreur</h1>
           <p className="text-muted-foreground">Une erreur est survenue lors du chargement du bail.</p>
        </div>
      );
  }
}
