export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLeaseDetails } from "../../../_data/fetchLeaseDetails";
import { SignersClient } from "./SignersClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SignersPage({ params }: PageProps) {
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

  // 2. Récupérer le profil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // 3. Charger les détails du bail
  try {
    const details = await fetchLeaseDetails(id, profile.id);

    if (!details) {
      return (
        <div className="container mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Bail non trouvé</h1>
          <p className="text-muted-foreground">
            Ce contrat n'existe pas ou vous n'avez pas les droits pour le voir.
          </p>
        </div>
      );
    }

    return (
      <SignersClient
        signers={details.signers}
        lease={details.lease}
        property={details.property}
        leaseId={id}
        ownerProfile={{
          id: profile.id,
          prenom: profile.prenom || "",
          nom: profile.nom || "",
        }}
      />
    );
  } catch (error) {
    console.error("Error loading signers:", error);
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Erreur</h1>
        <p className="text-muted-foreground">
          Une erreur est survenue lors du chargement des signataires.
        </p>
      </div>
    );
  }
}

