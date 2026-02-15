import { Suspense } from "react";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
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
  const serviceClient = getServiceClient();

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

  // Récupérer les EDL existants pour tous les baux éligibles
  const leaseIds = (leases || []).map((l: any) => l.id);
  let existingEdls: any[] = [];
  if (leaseIds.length > 0) {
    const { data: edls } = await serviceClient
      .from("edl")
      .select("id, lease_id, type, status, scheduled_at, completed_date, created_at")
      .in("lease_id", leaseIds)
      .order("created_at", { ascending: false });
    existingEdls = edls || [];
  }

  return (leases || []).map((lease: any) => {
    // Trouver les EDL existants pour ce bail
    const leaseEdls = existingEdls.filter((e: any) => e.lease_id === lease.id);
    const entryEdl = leaseEdls.find((e: any) => e.type === "entree");
    const exitEdl = leaseEdls.find((e: any) => e.type === "sortie");

    return {
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
      // EDL existants
      existing_edl_entree: entryEdl ? {
        id: entryEdl.id,
        status: entryEdl.status,
        scheduled_at: entryEdl.scheduled_at,
      } : null,
      existing_edl_sortie: exitEdl ? {
        id: exitEdl.id,
        status: exitEdl.status,
        scheduled_at: exitEdl.scheduled_at,
      } : null,
    };
  });
}

function WizardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 w-full max-w-4xl mx-auto">
      <Skeleton className="h-8 md:h-10 w-48 md:w-72" />
      <Skeleton className="h-4 w-full max-w-[280px] md:max-w-[384px]" />
      <Skeleton className="h-64 md:h-96 rounded-xl w-full" />
    </div>
  );
}

async function WizardContent({ profileId, preselectedLeaseId, preselectedType }: { profileId: string; preselectedLeaseId?: string; preselectedType?: string }) {
  const leases = await fetchLeases(profileId);
  return <CreateInspectionWizard leases={leases} preselectedLeaseId={preselectedLeaseId} preselectedType={preselectedType as "entree" | "sortie" | undefined} />;
}

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ lease_id?: string; property_id?: string; type?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  const preselectedLeaseId = resolvedSearchParams?.lease_id;
  const preselectedType = resolvedSearchParams?.type;

  return (
    <Suspense fallback={<WizardSkeleton />}>
      <WizardContent profileId={profile.id} preselectedLeaseId={preselectedLeaseId} preselectedType={preselectedType} />
    </Suspense>
  );
}
