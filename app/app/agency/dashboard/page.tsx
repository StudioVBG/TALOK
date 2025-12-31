import { Suspense } from "react";
import { AgencyDashboardClient } from "./AgencyDashboardClient";
import { Skeleton } from "@/components/ui/skeleton";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard Agence | Gestion Locative",
  description: "Tableau de bord de votre agence immobilière",
};

async function fetchAgencyDashboardData() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/db008224-e4e1-4d8a-b3aa-f82f98e7a371',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2',location:'app/app/agency/dashboard/page.tsx:fetchAgencyDashboardData',message:'fetchAgencyDashboardData invoked',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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

