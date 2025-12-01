// @ts-nocheck
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VendorJobsClient } from "./VendorJobsClient";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

async function fetchVendorJobs(profileId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      tickets!inner(
        id,
        titre,
        description,
        priorite,
        statut,
        created_at,
        properties!inner(adresse_complete, ville, code_postal),
        profiles:created_by_profile_id(prenom, nom, telephone)
      )
    `)
    .eq("provider_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchVendorJobs] Error:", error);
    return [];
  }

  return (data || []).map((wo: any) => ({
    id: wo.id,
    ticket_id: wo.ticket_id,
    title: wo.tickets?.titre || "",
    description: wo.tickets?.description || "",
    priority: wo.tickets?.priorite || "normale",
    status: wo.statut,
    property_address: wo.tickets?.properties?.adresse_complete || "",
    property_city: wo.tickets?.properties?.ville || "",
    property_postal: wo.tickets?.properties?.code_postal || "",
    requester_name: wo.tickets?.profiles
      ? `${wo.tickets.profiles.prenom || ""} ${wo.tickets.profiles.nom || ""}`.trim()
      : "Propriétaire",
    requester_phone: wo.tickets?.profiles?.telephone || null,
    scheduled_date: wo.date_intervention_prevue,
    completed_date: wo.date_intervention_reelle,
    estimated_cost: wo.cout_estime,
    final_cost: wo.cout_final,
    created_at: wo.created_at,
  }));
}

function JobsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

async function JobsContent({ profileId }: { profileId: string }) {
  const jobs = await fetchVendorJobs(profileId);
  return <VendorJobsClient jobs={jobs} />;
}

export default async function VendorJobsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "provider") redirect("/dashboard");

  return (
    <Suspense fallback={<JobsSkeleton />}>
      <JobsContent profileId={profile.id} />
    </Suspense>
  );
}

