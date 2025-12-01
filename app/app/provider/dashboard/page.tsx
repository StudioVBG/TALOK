// @ts-nocheck
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VendorDashboardClient } from "./VendorDashboardClient";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

async function fetchVendorDashboard(profileId: string) {
  const supabase = await createClient();

  // Tickets assignés à ce prestataire
  const { data: workOrders, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      tickets!inner(
        id,
        titre,
        description,
        priorite,
        statut,
        properties!inner(adresse_complete, ville)
      )
    `)
    .eq("provider_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchVendorDashboard] Error:", error);
    return {
      jobs: [],
      stats: { assigned: 0, in_progress: 0, done: 0, total_revenue: 0 },
    };
  }

  const jobs = (workOrders || []).map((wo: any) => ({
    id: wo.id,
    ticket_id: wo.ticket_id,
    title: wo.tickets?.titre || "",
    description: wo.tickets?.description || "",
    priority: wo.tickets?.priorite || "normale",
    status: wo.statut,
    property_address: wo.tickets?.properties?.adresse_complete || "",
    property_city: wo.tickets?.properties?.ville || "",
    scheduled_date: wo.date_intervention_prevue,
    estimated_cost: wo.cout_estime,
    final_cost: wo.cout_final,
    created_at: wo.created_at,
  }));

  const stats = {
    assigned: jobs.filter((j: any) => j.status === "assigned").length,
    in_progress: jobs.filter((j: any) => j.status === "scheduled").length,
    done: jobs.filter((j: any) => j.status === "done").length,
    total_revenue: jobs
      .filter((j: any) => j.status === "done")
      .reduce((sum: number, j: any) => sum + (Number(j.final_cost) || 0), 0),
  };

  return { jobs, stats };
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

async function DashboardContent({ profileId }: { profileId: string }) {
  const data = await fetchVendorDashboard(profileId);
  return <VendorDashboardClient data={data} />;
}

export default async function VendorDashboardPage() {
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
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent profileId={profile.id} />
    </Suspense>
  );
}

