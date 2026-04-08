export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MandantDetailClient } from "./MandantDetailClient";

export const metadata = {
  title: "Detail Mandant | Comptabilite Agence | Talok",
  description: "Detail comptable d'un mandant",
};

async function fetchMandantData(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return { userId: user.id, mandantId: id };
}

function MandantSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-10 w-96" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default async function MandantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await fetchMandantData(id);

  return (
    <Suspense fallback={<MandantSkeleton />}>
      <MandantDetailClient mandantId={id} />
    </Suspense>
  );
}
