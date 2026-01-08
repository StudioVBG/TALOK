export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { AgencyDashboardClient } from "./AgencyDashboardClient";
import { Skeleton } from "@/components/ui/skeleton";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard Agence | Talok",
  description: "Tableau de bord de votre agence immobilière",
};

async function fetchAgencyDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/auth/signin");
  }

  const { data, error } = await supabase.rpc("agency_dashboard", {
    p_user_id: user.id
  });

  if (error) {
    console.error("[fetchAgencyDashboardData] Error:", error);
    return null;
  }

  return data;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default async function AgencyDashboardPage() {
  const data = await fetchAgencyDashboardData();

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AgencyDashboardClient data={data} />
    </Suspense>
  );
}

