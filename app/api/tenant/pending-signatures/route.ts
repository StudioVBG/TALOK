// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    // Authentifier l'utilisateur
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Utiliser le service role pour contourner les RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Configuration manquante" }, { status: 500 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ pendingLeases: [] });
    }

    // Récupérer les signers en attente
    const { data: pendingSigners, error: signersError } = await serviceClient
      .from("lease_signers")
      .select("lease_id")
      .eq("profile_id", profile.id)
      .eq("signature_status", "pending")
      .eq("role", "locataire_principal");

    if (signersError || !pendingSigners || pendingSigners.length === 0) {
      return NextResponse.json({ pendingLeases: [] });
    }

    // Récupérer les détails des baux
    const leaseIds = pendingSigners.map(s => s.lease_id);
    const { data: leases, error: leasesError } = await serviceClient
      .from("leases")
      .select("id, statut, type_bail, loyer")
      .in("id", leaseIds)
      .eq("statut", "pending_signature");

    if (leasesError) {
      console.error("[pending-signatures] Erreur leases:", leasesError);
      return NextResponse.json({ pendingLeases: [] });
    }

    const pendingLeases = (leases || []).map((lease: any) => ({
      id: lease.id,
      type_bail: lease.type_bail || "meuble",
      loyer: lease.loyer || 0,
    }));

    return NextResponse.json({ pendingLeases });
  } catch (error) {
    console.error("[pending-signatures] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

