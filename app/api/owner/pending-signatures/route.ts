export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour récupérer les signatures en attente du propriétaire
 * GET /api/owner/pending-signatures
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      throw new ApiError(error.status || 401, error.message);
    }

    if (!user || !supabase) {
      throw new ApiError(401, "Non authentifié");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration manquante");
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil de l'utilisateur courant
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    // Vérifier que c'est un propriétaire ou admin
    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    // Récupérer les baux du propriétaire où il doit signer
    const { data: pendingSignatures, error: signaturesError } = await serviceClient
      .from("lease_signers")
      .select(`
        id,
        lease_id,
        role,
        signature_status,
        created_at,
        lease:leases(
          id,
          type_bail,
          loyer,
          date_debut,
          statut,
          property:properties(
            id,
            adresse_complete,
            owner_id
          )
        )
      `)
      .eq("profile_id", profile.id)
      .eq("role", "proprietaire")
      .eq("signature_status", "pending");

    if (signaturesError) {
      console.error("[pending-signatures] Error:", signaturesError);
      throw new ApiError(500, "Erreur lors de la récupération des signatures");
    }

    // Filtrer les signatures valides (bail en attente de signature)
    const validPendingSignatures = (pendingSignatures || []).filter((sig: any) => {
      const lease = sig.lease as any;
      return lease && lease.statut === "pending_signature";
    });

    // Formater la réponse
    const formattedSignatures = validPendingSignatures.map((sig: any) => {
      const lease = sig.lease as any;
      const property = lease?.property as any;
      return {
        id: sig.id,
        lease_id: sig.lease_id,
        created_at: sig.created_at,
        lease: {
          id: lease?.id,
          type_bail: lease?.type_bail,
          loyer: lease?.loyer,
          date_debut: lease?.date_debut,
        },
        property: {
          id: property?.id,
          adresse: property?.adresse_complete,
        },
      };
    });

    return NextResponse.json({
      count: formattedSignatures.length,
      signatures: formattedSignatures,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

