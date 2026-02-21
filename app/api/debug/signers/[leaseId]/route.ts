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

  // Test 1: Requête simple (fonctionne)
  const { data: signersSimple, error: errorSimple } = await serviceClient
    .from("lease_signers")
    .select("id, role, signature_status, profile_id, invited_email, invited_name")
    .eq("lease_id", leaseId);

  // Test 2: Requête IDENTIQUE à fetchLeaseDetails (avec join profiles + toutes colonnes)
  const { data: signersFull, error: errorFull } = await serviceClient
    .from("lease_signers")
    .select(`
      id,
      role,
      signature_status,
      signed_at,
      signature_image,
      signature_image_path,
      proof_id,
      ip_inet,
      invited_email,
      invited_name,
      invited_at,
      profiles (
        id,
        prenom,
        nom,
        email,
        telephone,
        avatar_url,
        date_naissance,
        lieu_naissance,
        nationalite,
        adresse
      )
    `)
    .eq("lease_id", leaseId);

  // Test 3: Colonnes une par une pour identifier le problème
  const columnTests: Record<string, string | null> = {};
  for (const col of [
    "signed_at",
    "signature_image",
    "signature_image_path",
    "proof_id",
    "ip_inet",
    "invited_at",
  ]) {
    const { error: colError } = await serviceClient
      .from("lease_signers")
      .select(`id, ${col}`)
      .eq("lease_id", leaseId)
      .limit(1);
    columnTests[col] = colError?.message ?? "OK";
  }

  // Test 4: Join profiles seul
  const { data: signersJoin, error: errorJoin } = await serviceClient
    .from("lease_signers")
    .select("id, profiles (id, prenom, nom)")
    .eq("lease_id", leaseId);

  const { data: lease } = await serviceClient
    .from("leases")
    .select("id, statut, property_id, unit_id")
    .eq("id", leaseId)
    .single();

  return NextResponse.json({
    lease_id: leaseId,
    lease,
    test1_simple: {
      count: signersSimple?.length ?? 0,
      data: signersSimple,
      error: errorSimple?.message ?? null,
    },
    test2_full_query: {
      count: signersFull?.length ?? 0,
      data: signersFull,
      error: errorFull?.message ?? null,
    },
    test3_columns: columnTests,
    test4_profiles_join: {
      count: signersJoin?.length ?? 0,
      data: signersJoin,
      error: errorJoin?.message ?? null,
    },
    timestamp: new Date().toISOString(),
  });
}
