/**
 * Service de liaison automatique des données locataire
 * Centralise l'auto-heal des signers orphelins et des profils non liés
 *
 * Anti-casse : toutes les mises à jour utilisent des clauses WHERE ... IS NULL
 * pour ne jamais écraser un lien existant.
 * Anti-doublons : les requêtes filtrent par ILIKE sur email et profile_id IS NULL
 * donc un signer déjà lié n'est jamais modifié.
 */

import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * Lie les lease_signers orphelins (sans profile_id) trouvés par email
 * au profil du locataire. Idempotent : ne touche que les lignes où profile_id IS NULL.
 *
 * @returns les lease_ids des signers nouvellement liés
 */
export async function linkOrphanSigners(
  profileId: string,
  email: string
): Promise<string[]> {
  if (!email || !profileId) return [];

  const supabase = getServiceClient();
  const linkedLeaseIds: string[] = [];

  try {
    // Chercher les signers orphelins par email (profile_id IS NULL)
    const { data: orphanSigners } = await supabase
      .from("lease_signers")
      .select("id, lease_id, profile_id")
      .ilike("invited_email", email.toLowerCase().trim())
      .is("profile_id", null);

    if (!orphanSigners || orphanSigners.length === 0) return [];

    // Lier chaque signer orphelin au profil
    for (const signer of orphanSigners) {
      const { error } = await supabase
        .from("lease_signers")
        .update({ profile_id: profileId })
        .eq("id", signer.id)
        .is("profile_id", null); // Double sécurité : ne touche que si toujours NULL

      if (!error) {
        linkedLeaseIds.push(signer.lease_id);
        console.log(
          "[tenant-linking] Auto-heal: signer orphelin",
          signer.id,
          "-> profile",
          profileId
        );
      }
    }
  } catch (err) {
    console.error("[tenant-linking] Erreur linkOrphanSigners:", err);
  }

  return linkedLeaseIds;
}

/**
 * Lie un profil existant (trouvé par email) à un user_id auth.
 * Ne touche que les profils où user_id IS NULL.
 *
 * @returns true si le profil a été lié
 */
export async function linkProfileToUser(
  profileId: string,
  userId: string
): Promise<boolean> {
  if (!profileId || !userId) return false;

  const supabase = getServiceClient();

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ user_id: userId })
      .eq("id", profileId)
      .is("user_id", null); // Ne touche que si user_id est NULL

    if (!error) {
      console.log(
        "[tenant-linking] Auto-heal: profil",
        profileId,
        "-> user_id",
        userId
      );
      return true;
    }
  } catch (err) {
    console.error("[tenant-linking] Erreur linkProfileToUser:", err);
  }

  return false;
}
