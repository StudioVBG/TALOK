export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect } from "next/navigation";
import { InspectionsClient } from "./InspectionsClient";
import { Skeleton } from "@/components/ui/skeleton";


async function fetchInspections(profileId: string) {
  const supabase = await createClient();
  const serviceClient = getServiceClient();

  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", profileId);

  if (!properties?.length) return [];

  const propertyIds = properties.map((p) => p.id);

  const { data, error } = await serviceClient
    .from("edl")
    .select(`
      *,
      leases!inner(
        id,
        properties!inner(id, adresse_complete, ville),
        lease_signers(
          role,
          profiles(prenom, nom)
        )
      ),
      edl_signatures(*)
    `)
    .in("leases.property_id", propertyIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchInspections] Error:", error);
    return [];
  }

  return (data || []).map((edl: any) => ({
    ...edl,
    property_address: edl.leases?.properties?.adresse_complete || "",
    property_city: edl.leases?.properties?.ville || "",
    tenant_name: edl.leases?.lease_signers?.find((s: any) => s.role === "locataire_principal")?.profiles
      ? `${edl.leases.lease_signers.find((s: any) => s.role === "locataire_principal").profiles.prenom || ""} ${edl.leases.lease_signers.find((s: any) => s.role === "locataire_principal").profiles.nom || ""}`.trim()
      : "Locataire",
    signatures_count: edl.edl_signatures?.length || 0,
  }));
}

function InspectionsSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 container mx-auto max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 sm:w-48" />
          <Skeleton className="h-4 w-48 sm:w-64" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

async function InspectionsContent({ profileId }: { profileId: string }) {
  const inspections = await fetchInspections(profileId);
  return <InspectionsClient inspections={inspections} />;
}

export default async function OwnerInspectionsPage() {
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
    <Suspense fallback={<InspectionsSkeleton />}>
      <InspectionsContent profileId={profile.id} />
    </Suspense>
  );
}

