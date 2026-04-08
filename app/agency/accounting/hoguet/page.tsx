export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HoguetClient } from "./HoguetClient";

export const metadata = {
  title: "Conformite Hoguet | Comptabilite Agence | Talok",
  description: "Verification automatique de conformite loi Hoguet",
};

async function fetchHoguetData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return { userId: user.id };
}

function HoguetSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default async function HoguetPage() {
  await fetchHoguetData();

  return (
    <Suspense fallback={<HoguetSkeleton />}>
      <HoguetClient />
    </Suspense>
  );
}
