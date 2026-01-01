export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LegalProtocolsOwnerClient } from "./LegalProtocolsOwnerClient";

export const metadata: Metadata = {
  title: "Protocoles Juridiques | Propriétaire",
  description: "Protocoles anti-squat et mesures préventives pour propriétaires",
};

interface Property {
  id: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string | null;
}

export default async function OwnerLegalProtocolsPage() {
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
  
  // Vérifier que c'est bien un propriétaire
  if (profile.role !== "owner") {
    redirect("/");
  }
  
  // Récupérer les logements du propriétaire
  let properties: Property[] = [];
  
  try {
    const { data: propertiesData } = await supabase
      .from("properties")
      .select("id, adresse_complete, code_postal, ville, departement")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });
    
    if (propertiesData) {
      properties = propertiesData;
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des logements:", error);
  }
  
  return (
    <LegalProtocolsOwnerClient properties={properties} />
  );
}







