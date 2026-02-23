export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/tenant/identity/my-leases
 *
 * Retourne la liste des baux du locataire authentifié avec les documents CNI.
 * Utilise le service client (bypass RLS) pour couvrir le cas où
 * profile_id est NULL dans lease_signers (orphan signers).
 * Auto-lie le profil si trouvé par invited_email.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // 1. Chercher les baux par profile_id (cas nominal)
    const { data: signersByProfile } = await serviceClient
      .from("lease_signers")
      .select("id, lease_id, profile_id, invited_email")
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"]);

    // 2. Chercher les baux orphelins par invited_email (fallback)
    let signersByEmail: typeof signersByProfile = [];
    if (user.email) {
      const { data } = await serviceClient
        .from("lease_signers")
        .select("id, lease_id, profile_id, invited_email")
        .is("profile_id", null)
        .ilike("invited_email", user.email)
        .in("role", ["locataire_principal", "colocataire"]);
      signersByEmail = data || [];

      // Auto-lier les orphelins
      for (const orphan of signersByEmail) {
        if (!orphan.profile_id) {
          await serviceClient
            .from("lease_signers")
            .update({ profile_id: profile.id })
            .eq("id", orphan.id);
          console.log(
            `[my-leases] Auto-link: signer ${orphan.id} -> profile ${profile.id}`
          );
        }
      }
    }

    // 3. Fusionner et dédupliquer les lease_ids
    const allSigners = [...(signersByProfile || []), ...signersByEmail];
    const uniqueLeaseIds = [...new Set(allSigners.map((s) => s.lease_id))];

    if (uniqueLeaseIds.length === 0) {
      return NextResponse.json({ leases: [], profile_id: profile.id });
    }

    // 4. Récupérer les données de chaque bail avec documents CNI
    const leases = [];
    for (const leaseId of uniqueLeaseIds) {
      const { data: leaseData } = await serviceClient
        .from("leases")
        .select(
          "id, type_bail, statut, properties (id, adresse_complete, ville)"
        )
        .eq("id", leaseId)
        .single();

      if (!leaseData) continue;

      const { data: documents } = await serviceClient
        .from("documents")
        .select(
          "id, type, storage_path, expiry_date, verification_status, is_archived, created_at, metadata"
        )
        .eq("lease_id", leaseId)
        .in("type", ["cni_recto", "cni_verso"])
        .order("created_at", { ascending: false });

      const lease = leaseData as Record<string, unknown>;
      leases.push({
        id: lease.id,
        type_bail: lease.type_bail,
        statut: lease.statut,
        property: lease.properties,
        documents: documents || [],
      });
    }

    return NextResponse.json({ leases, profile_id: profile.id });
  } catch (error: unknown) {
    console.error("[my-leases] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
