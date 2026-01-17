/**
 * EDL Access Verification Helper - SOTA 2026
 * 
 * Centralise toute la logique de vérification des permissions pour les EDL.
 * Couvre tous les cas de figure :
 * - Admin (accès total)
 * - Owner (via propriété du bien)
 * - Créateur de l'EDL
 * - Signataire de l'EDL
 * - Signataire du bail
 * - Colocataire (roommate)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface EDLAccessResult {
  authorized: boolean;
  edl: any | null;
  reason?: string;
  accessType?: 
    | "admin"
    | "creator" 
    | "owner" 
    | "edl_signer" 
    | "lease_signer" 
    | "roommate";
}

export interface VerifyEDLAccessParams {
  edlId: string;
  userId: string;
  profileId: string;
  profileRole: string;
}

/**
 * Crée un client Supabase avec service role (bypass RLS)
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configuration Supabase manquante (SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

/**
 * Vérifie si un utilisateur a accès à un EDL
 * 
 * @param params - Paramètres de vérification
 * @param serviceClient - Client Supabase avec service role (optionnel, sera créé si non fourni)
 * @returns Résultat de la vérification avec l'EDL si autorisé
 */
export async function verifyEDLAccess(
  params: VerifyEDLAccessParams,
  serviceClient?: SupabaseClient
): Promise<EDLAccessResult> {
  const { edlId, userId, profileId, profileRole } = params;
  
  // Créer le service client si non fourni
  const client = serviceClient || createServiceClient();

  console.log(`[verifyEDLAccess] Checking access for EDL ${edlId}`, {
    userId: userId.slice(0, 8) + "...",
    profileId: profileId.slice(0, 8) + "...",
    profileRole
  });

  try {
    // 1. Récupérer l'EDL avec les relations nécessaires
    const { data: edl, error: edlError } = await client
      .from("edl")
      .select(`
        *,
        lease:leases(
          id,
          property_id,
          property:properties(id, owner_id, adresse_complete)
        )
      `)
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      console.log(`[verifyEDLAccess] EDL not found:`, edlError?.message);
      return { 
        authorized: false, 
        edl: null, 
        reason: "EDL non trouvé" 
      };
    }

    const edlData = edl as any;

    // 2. Admin = accès total
    if (profileRole === "admin") {
      console.log(`[verifyEDLAccess] ✅ Admin access granted`);
      return { authorized: true, edl: edlData, accessType: "admin" };
    }

    // 3. Créateur de l'EDL
    if (edlData.created_by === userId) {
      console.log(`[verifyEDLAccess] ✅ Creator access granted`);
      return { authorized: true, edl: edlData, accessType: "creator" };
    }

    // 4. Propriétaire du bien (via property.owner_id)
    const leaseData = Array.isArray(edlData.lease) ? edlData.lease[0] : edlData.lease;
    const propertyOwnerId = leaseData?.property?.owner_id;
    
    // Aussi vérifier si property_id direct (EDL sans bail)
    let directOwnerId = null;
    if (edlData.property_id && !propertyOwnerId) {
      const { data: property } = await client
        .from("properties")
        .select("owner_id")
        .eq("id", edlData.property_id)
        .single();
      directOwnerId = property?.owner_id;
    }

    if (propertyOwnerId === profileId || directOwnerId === profileId) {
      console.log(`[verifyEDLAccess] ✅ Owner access granted`);
      return { authorized: true, edl: edlData, accessType: "owner" };
    }

    // 5. Signataire de l'EDL (dans edl_signatures)
    const { data: edlSignature } = await client
      .from("edl_signatures")
      .select("id")
      .eq("edl_id", edlId)
      .eq("signer_profile_id", profileId)
      .maybeSingle();

    if (edlSignature) {
      console.log(`[verifyEDLAccess] ✅ EDL signer access granted`);
      return { authorized: true, edl: edlData, accessType: "edl_signer" };
    }

    // 6. Signataire du bail lié (dans lease_signers)
    if (edlData.lease_id) {
      const { data: leaseSigner } = await client
        .from("lease_signers")
        .select("id")
        .eq("lease_id", edlData.lease_id)
        .eq("profile_id", profileId)
        .maybeSingle();

      if (leaseSigner) {
        console.log(`[verifyEDLAccess] ✅ Lease signer access granted`);
        return { authorized: true, edl: edlData, accessType: "lease_signer" };
      }
    }

    // 7. Colocataire (roommate) via le bail
    if (edlData.lease_id) {
      const { data: roommate } = await client
        .from("roommates")
        .select("id")
        .eq("lease_id", edlData.lease_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (roommate) {
        console.log(`[verifyEDLAccess] ✅ Roommate access granted`);
        return { authorized: true, edl: edlData, accessType: "roommate" };
      }
    }

    // 8. Aucun accès trouvé
    console.warn(`[verifyEDLAccess] ❌ Access denied for user ${userId.slice(0, 8)}...`);
    return { 
      authorized: false, 
      edl: edlData, 
      reason: "Accès non autorisé à cet état des lieux" 
    };

  } catch (error: unknown) {
    console.error(`[verifyEDLAccess] Error:`, error);
    return { 
      authorized: false, 
      edl: null, 
      reason: error instanceof Error ? error.message : "Erreur lors de la vérification des permissions" 
    };
  }
}

/**
 * Vérifie si l'EDL peut être modifié (non signé)
 */
export function canEditEDL(edl: any): { canEdit: boolean; reason?: string } {
  if (!edl) {
    return { canEdit: false, reason: "EDL non trouvé" };
  }

  const status = edl.status;
  
  if (status === "signed") {
    return { canEdit: false, reason: "L'EDL est déjà signé et ne peut plus être modifié" };
  }

  // Statuts modifiables
  if (["draft", "scheduled", "in_progress", "completed"].includes(status)) {
    return { canEdit: true };
  }

  return { canEdit: false, reason: `Statut '${status}' non modifiable` };
}

/**
 * Helper pour obtenir le profil utilisateur
 */
export async function getUserProfile(
  serviceClient: SupabaseClient,
  userId: string
): Promise<{ id: string; role: string } | null> {
  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    console.error("[getUserProfile] Error:", error);
    return null;
  }

  return profile;
}

