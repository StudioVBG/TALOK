export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/tenant/pending-signatures
 * 
 * Retourne les baux en attente de signature pour le locataire connecté.
 * 
 * FIX P0-E2: Inclure TOUS les rôles de signataires tenant (locataire_principal,
 * colocataire, garant) au lieu de filtrer uniquement sur locataire_principal.
 * 
 * FIX P0-E2b: Inclure aussi les baux en partially_signed (pas seulement pending_signature)
 */
export async function GET() {
  try {
    // Authentifier l'utilisateur
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ pendingLeases: [] });
    }

    // Vérifier que c'est bien un locataire (ou garant)
    if (profile.role !== "tenant" && profile.role !== "guarantor") {
      return NextResponse.json({ pendingLeases: [] });
    }

    // FIX P0-E2: Récupérer les signers en attente pour TOUS les rôles tenant
    // (locataire_principal, colocataire, garant)
    const { data: pendingSigners, error: signersError } = await serviceClient
      .from("lease_signers")
      .select("lease_id, role")
      .eq("profile_id", profile.id)
      .eq("signature_status", "pending")
      .in("role", ["locataire_principal", "colocataire", "garant"]);

    if (signersError || !pendingSigners || pendingSigners.length === 0) {
      return NextResponse.json({ pendingLeases: [] });
    }

    // Récupérer les détails des baux
    const leaseIds = pendingSigners.map(s => s.lease_id);
    
    // FIX P0-E2b: Inclure baux pending_signature ET partially_signed
    const { data: leases, error: leasesError } = await serviceClient
      .from("leases")
      .select("id, statut, type_bail, loyer")
      .in("id", leaseIds)
      .in("statut", ["pending_signature", "partially_signed"]);

    if (leasesError) {
      console.error("[pending-signatures] Erreur leases:", leasesError);
      return NextResponse.json({ pendingLeases: [] });
    }

    // Enrichir avec le rôle du signataire
    const signerRoleMap = new Map(
      pendingSigners.map(s => [s.lease_id, s.role])
    );

    const pendingLeases = (leases || []).map((lease: any) => ({
      id: lease.id,
      type_bail: lease.type_bail || "meuble",
      loyer: lease.loyer || 0,
      signer_role: signerRoleMap.get(lease.id) || "locataire_principal",
    }));

    return NextResponse.json({ pendingLeases });
  } catch (error) {
    console.error("[pending-signatures] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

