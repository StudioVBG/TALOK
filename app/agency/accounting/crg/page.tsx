export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CRGClient } from "./CRGClient";

export const metadata = {
  title: "Gestion CRG | Comptabilite Agence | Talok",
  description: "Comptes Rendus de Gestion — generation, envoi, suivi",
};

async function fetchCRGData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return { userId: user.id };
}

function CRGSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-10 w-80" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export default async function CRGPage() {
  await fetchCRGData();

  return (
    <Suspense fallback={<CRGSkeleton />}>
      <CRGClient />
    </Suspense>
  );
}
