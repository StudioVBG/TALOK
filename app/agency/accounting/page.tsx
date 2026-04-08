export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgencyAccountingDashboardClient } from "./AgencyAccountingDashboardClient";

export const metadata = {
  title: "Comptabilite Agence | Talok",
  description: "Tableau de bord comptable de votre agence immobiliere",
};

async function fetchAgencyAccountingData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return { userId: user.id };
}

function AccountingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default async function AgencyAccountingPage() {
  await fetchAgencyAccountingData();

  return (
    <Suspense fallback={<AccountingSkeleton />}>
      <AgencyAccountingDashboardClient />
    </Suspense>
  );
}
