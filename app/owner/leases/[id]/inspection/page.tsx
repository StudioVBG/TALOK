export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InspectionView } from "./InspectionView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseInspectionPage({ params }: PageProps) {
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

  // Fetch lease with property info
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id, statut, type_bail, date_debut,
      property:properties!inner(id, adresse_complete, ville, owner_id)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease || (lease.property as any)?.owner_id !== profile.id) {
    redirect("/owner/leases");
  }

  // Fetch EDLs for this lease
  const { data: edls } = await supabase
    .from("edl")
    .select("id, type, status, scheduled_at, completed_date, created_at")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });

  return (
    <InspectionView
      leaseId={leaseId}
      leaseStatus={lease.statut}
      propertyId={(lease.property as any).id}
      edls={edls || []}
    />
  );
}
