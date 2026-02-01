export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EndView } from "./EndView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseEndPage({ params }: PageProps) {
  const { id: leaseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  // Fetch lease with property and financial info
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id, statut, type_bail, date_debut, date_fin, depot_garantie,
      property:properties!inner(id, adresse_complete, ville, owner_id)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease || (lease.property as any)?.owner_id !== profile.id) {
    redirect("/owner/leases");
  }

  // Fetch end-of-lease process if any
  const { data: endProcess } = await supabase
    .from("lease_end_processes")
    .select("id, status, lease_end_date, departure_notice_date, total_budget, created_at, updated_at")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch exit EDL if any
  const { data: exitEdl } = await supabase
    .from("edl")
    .select("id, status, type, scheduled_at, completed_date, created_at")
    .eq("lease_id", leaseId)
    .eq("type", "sortie")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <EndView
      leaseId={leaseId}
      leaseStatus={lease.statut}
      propertyId={(lease.property as any).id}
      dateFin={lease.date_fin}
      depotGarantie={lease.depot_garantie || 0}
      endProcess={endProcess}
      exitEdl={exitEdl}
    />
  );
}
