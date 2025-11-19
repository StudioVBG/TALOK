import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPropertyDetails } from "../../_data/fetchPropertyDetails";
import { PropertyDetailsClient } from "./PropertyDetailsClient";

interface PageProps {
  params: Promise<{ id: string }>;
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
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard"); // ou page erreur 403
  }

  // 3. Charger les détails de la propriété via la RPC
  try {
    const details = await fetchPropertyDetails(id, profile.id);

    if (!details) {
      // Propriété non trouvée ou n'appartenant pas à ce owner
      return (
        <div className="container mx-auto py-12 text-center">
           <h1 className="text-2xl font-bold mb-4">Propriété non trouvée</h1>
           <p className="text-muted-foreground">Ce bien n'existe pas ou vous n'avez pas les droits pour le voir.</p>
        </div>
      );
    }

    return <PropertyDetailsClient details={details} propertyId={id} />;
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
