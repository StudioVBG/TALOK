/**
 * lib/properties/guards.ts — Vérifications avant suppression / archivage d'un bien
 *
 * Utilisé par :
 * - DELETE /api/properties/[id]
 * - GET /api/properties/[id]/can-delete (check côté client)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DeleteGuardResult {
  canDelete: boolean;
  canArchive: boolean;
  blockers: string[];
  warnings: string[];
  linkedData: {
    activeLeases: number;
    terminatedLeases: number;
    documents: number;
    photos: number;
    invoices: number;
  };
}

const ACTIVE_LEASE_STATUSES = [
  "active",
  "pending_signature",
  "partially_signed",
  "fully_signed",
];

const TERMINATED_LEASE_STATUSES = [
  "terminated",
  "expired",
  "cancelled",
  "resilie",
];

export async function canDeleteProperty(
  serviceClient: SupabaseClient,
  propertyId: string,
  profileId: string
): Promise<DeleteGuardResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Vérifier ownership
  const { data: property } = await serviceClient
    .from("properties")
    .select("id, owner_id, etat")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .single();

  if (!property) {
    return {
      canDelete: false,
      canArchive: false,
      blockers: ["Bien introuvable ou accès refusé"],
      warnings: [],
      linkedData: {
        activeLeases: 0,
        terminatedLeases: 0,
        documents: 0,
        photos: 0,
        invoices: 0,
      },
    };
  }

  if (property.owner_id !== profileId) {
    return {
      canDelete: false,
      canArchive: false,
      blockers: ["Vous n'êtes pas propriétaire de ce bien"],
      warnings: [],
      linkedData: {
        activeLeases: 0,
        terminatedLeases: 0,
        documents: 0,
        photos: 0,
        invoices: 0,
      },
    };
  }

  if (property.etat === "pending_review") {
    blockers.push(
      "Bien en cours de validation. Veuillez attendre la fin de la vérification."
    );
  }

  // 2. Compter les liaisons en parallèle
  const [leasesRes, docsRes, photosRes] = await Promise.all([
    serviceClient
      .from("leases")
      .select("id, statut")
      .eq("property_id", propertyId),
    serviceClient
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId),
    serviceClient
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId),
  ]);

  const allLeases: { id: string; statut: string }[] = leasesRes.data ?? [];
  const activeLeases = allLeases.filter((l: { statut: string }) =>
    ACTIVE_LEASE_STATUSES.includes(l.statut)
  ).length;
  const terminatedLeases = allLeases.filter((l: { statut: string }) =>
    TERMINATED_LEASE_STATUSES.includes(l.statut)
  ).length;

  // Factures liées via baux
  const leaseIds = allLeases.map((l: { id: string }) => l.id);
  let invoiceCount = 0;
  if (leaseIds.length > 0) {
    const { count } = await serviceClient
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("lease_id", leaseIds);
    invoiceCount = count ?? 0;
  }

  const linkedData = {
    activeLeases,
    terminatedLeases,
    documents: docsRes.count ?? 0,
    photos: photosRes.count ?? 0,
    invoices: invoiceCount,
  };

  // 3. Bloqueurs
  if (activeLeases > 0) {
    blockers.push(
      `Ce bien a ${activeLeases} bail${activeLeases > 1 ? "x" : ""} actif${activeLeases > 1 ? "s" : ""}. Résiliez-le${activeLeases > 1 ? "s" : ""} d'abord.`
    );
  }

  // 4. Warnings
  if (terminatedLeases > 0)
    warnings.push(`${terminatedLeases} bail(x) terminé(s) dans l'historique`);
  if (linkedData.documents > 0)
    warnings.push(`${linkedData.documents} document(s) lié(s)`);
  if (linkedData.photos > 0)
    warnings.push(`${linkedData.photos} photo(s) en storage`);
  if (linkedData.invoices > 0)
    warnings.push(`${linkedData.invoices} facture(s) dans l'historique`);

  return {
    canDelete: blockers.length === 0 && warnings.length === 0,
    canArchive: blockers.length === 0,
    blockers,
    warnings,
    linkedData,
  };
}

/**
 * Supprime les photos du storage Supabase pour un bien.
 * Non bloquant : les erreurs sont loguées mais ne cassent pas le flow.
 */
export async function cleanupPropertyPhotos(
  serviceClient: SupabaseClient,
  propertyId: string
): Promise<{ cleaned: number; errors: number }> {
  let cleaned = 0;
  let errors = 0;

  try {
    const { data: photos } = await serviceClient
      .from("photos")
      .select("id, storage_path")
      .eq("property_id", propertyId);

    if (!photos?.length) return { cleaned: 0, errors: 0 };

    const paths = photos
      .map((p: { storage_path?: string }) => p.storage_path)
      .filter((p): p is string => Boolean(p));

    if (paths.length > 0) {
      const { error } = await serviceClient.storage
        .from("property-photos")
        .remove(paths);

      if (error) {
        console.error(
          "[cleanupPropertyPhotos] Erreur suppression storage:",
          error
        );
        errors = paths.length;
      } else {
        cleaned = paths.length;
      }
    }
  } catch (err) {
    console.error("[cleanupPropertyPhotos] Erreur inattendue:", err);
    errors = 1;
  }

  return { cleaned, errors };
}
