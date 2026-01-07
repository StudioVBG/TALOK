// @ts-nocheck
import { Suspense } from "react";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateInspectionWizard } from "./CreateInspectionWizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouvel état des lieux | Talok",
  description: "Créer un nouvel état des lieux d'entrée ou de sortie",
};

async function fetchLeases(profileId: string) {
  const supabase = await createClient();

  // Fetch leases eligible for EDL:
  // - fully_signed: Bail signé par toutes les parties → EDL d'entrée requis avant activation
  // - active: Bail actif → EDL de sortie possible
  const { data: leases, error } = await supabase
    .from("leases")
    .select(`
      id,
      type_bail,
      statut,
      date_debut,
      properties!inner(
        id,
        adresse_complete,
        ville,
        code_postal,
        owner_id
      ),
      lease_signers(
        role,
        profiles(prenom, nom)
      )
    `)
    .eq("properties.owner_id", profileId)
    .in("statut", ["active", "fully_signed"]);

  if (error) {
    console.error("[fetchLeases] Error:", error);
    return [];
  }

  return (leases || []).map((lease: any) => ({
    id: lease.id,
    type_bail: lease.type_bail,
    statut: lease.statut,
    date_debut: lease.date_debut,
    property: {
      id: lease.properties.id,
      adresse_complete: lease.properties.adresse_complete,
      ville: lease.properties.ville,
      code_postal: lease.properties.code_postal,
    },
    tenant_name: lease.lease_signers
      ?.filter((s: any) => s.role === "locataire_principal" || s.role === "colocataire")
      .map((s: any) => `${s.profiles?.prenom || ""} ${s.profiles?.nom || ""}`.trim())
      .filter(Boolean)
      .join(", ") || "Locataire",
  }));
}

function WizardSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

async function WizardContent({ profileId }: { profileId: string }) {
  const leases = await fetchLeases(profileId);
  return <CreateInspectionWizard leases={leases} />;
}

export default async function NewInspectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  return (
    <Suspense fallback={<WizardSkeleton />}>
      <WizardContent profileId={profile.id} />
    </Suspense>
  );
}

