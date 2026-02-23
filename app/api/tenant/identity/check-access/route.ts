export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/tenant/identity/check-access?lease_id=...
 *
 * Vérifie que le locataire authentifié a accès au bail donné pour
 * la gestion CNI. Utilise le service client (bypass RLS) afin de
 * couvrir le cas où profile_id est NULL dans lease_signers
 * (locataire invité par email, auto-link pas encore effectué).
 *
 * Si le signer est trouvé par invited_email mais profile_id est NULL,
 * on effectue l'auto-link immédiatement.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get("lease_id");

    if (!leaseId) {
      return NextResponse.json(
        { authorized: false, reason: "ID du bail manquant" },
        { status: 400 }
      );
    }

    // 1. Authentification
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { authorized: false, reason: "Non authentifié" },
        { status: 401 }
      );
    }

    // 2. Récupérer le profil
    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { authorized: false, reason: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // 3. Chercher le signer par profile_id (cas nominal)
    let { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id, invited_email")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"])
      .maybeSingle();

    // 4. Fallback : chercher par invited_email
    if (!signer && user.email) {
      const { data: signerByEmail } = await serviceClient
        .from("lease_signers")
        .select("id, profile_id, invited_email")
        .eq("lease_id", leaseId)
        .ilike("invited_email", user.email)
        .in("role", ["locataire_principal", "colocataire"])
        .maybeSingle();

      if (signerByEmail) {
        // Auto-lier le profil si pas encore fait
        if (!signerByEmail.profile_id) {
          await serviceClient
            .from("lease_signers")
            .update({ profile_id: profile.id })
            .eq("id", signerByEmail.id);

          console.log(
            `[check-access] Auto-link: signer ${signerByEmail.id} -> profile ${profile.id} (email: ${user.email})`
          );
        }
        signer = signerByEmail;
      }
    }

    if (!signer) {
      return NextResponse.json(
        {
          authorized: false,
          reason:
            "Vous n'êtes pas autorisé à gérer la CNI pour ce bail. " +
            "Assurez-vous d'être bien locataire de ce logement et " +
            "d'avoir accepté l'invitation si vous en avez reçu une.",
        },
        { status: 403 }
      );
    }

    // 5. Récupérer les données du bail
    const { data: leaseData } = await serviceClient
      .from("leases")
      .select("id, type_bail, statut, properties (id, adresse_complete, ville)")
      .eq("id", leaseId)
      .single();

    const lease = leaseData as Record<string, unknown> | null;
    const properties = lease?.properties as {
      adresse_complete: string;
      ville: string;
    } | null;

    return NextResponse.json({
      authorized: true,
      signer_id: signer.id,
      lease: lease
        ? {
            id: lease.id as string,
            type_bail: lease.type_bail as string,
            statut: lease.statut as string,
            properties,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("[check-access] Erreur:", error);
    return NextResponse.json(
      {
        authorized: false,
        reason: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
