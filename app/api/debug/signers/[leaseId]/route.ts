export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const { leaseId } = await params;
  const serviceClient = getServiceClient();

  const { data: signers, error } = await serviceClient
    .from("lease_signers")
    .select("id, role, signature_status, profile_id, invited_email, invited_name")
    .eq("lease_id", leaseId);

  const { data: lease } = await serviceClient
    .from("leases")
    .select("id, statut, property_id, unit_id")
    .eq("id", leaseId)
    .single();

  return NextResponse.json({
    lease_id: leaseId,
    lease,
    signers_count: signers?.length ?? 0,
    signers,
    error: error?.message ?? null,
    timestamp: new Date().toISOString(),
  });
}
