export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Suspense } from "react";
import { MandantDetailClient } from "./MandantDetailClient";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const metadata = {
  title: "Detail Mandant | Talok",
  description: "Detail du compte mandant",
};

async function fetchMandantData(mandantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Verify agency role
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["admin", "agency"].includes(profile.role ?? "")) {
    redirect("/auth/signin");
  }

  // Fetch mandant profile
  const { data: mandantProfile } = await supabase
    .from("profiles")
    .select(
      `
      id,
      prenom,
      nom,
      email,
      owner_profiles(
        type,
        siret,
        raison_sociale,
        adresse_facturation
      )
    `
    )
    .eq("id", mandantId)
    .single();

  if (!mandantProfile) {
    return null;
  }

  const ownerData = (mandantProfile as any).owner_profiles as any;

  // Fetch CRGs for current year
  const now = new Date();
  const startDate = `${now.getFullYear()}-01-01`;
  const endDate = now.toISOString().split("T")[0];

  let crgs: any[] = [];
  try {
    crgs = await accountingService.generateCRG(mandantId, {
      debut: startDate,
      fin: endDate,
    });
  } catch {
    // CRG generation may fail if no properties exist
    crgs = [];
  }

  // Collect all entries from CRGs
  const entries = crgs.flatMap((crg) => crg.mouvements || []);

  return {
    info: {
      id: mandantProfile.id,
      nom: mandantProfile.nom || "",
      prenom: mandantProfile.prenom || "",
      email: mandantProfile.email || undefined,
      type: ownerData?.type || "particulier",
      raison_sociale: ownerData?.raison_sociale || undefined,
      adresse: ownerData?.adresse_facturation || undefined,
      siret: ownerData?.siret || undefined,
    },
    entries,
    crgs,
    isLoading: false,
  };
}

function MandantSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default async function MandantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchMandantData(id);

  return (
    <Suspense fallback={<MandantSkeleton />}>
      <MandantDetailClient data={data} />
    </Suspense>
  );
}
