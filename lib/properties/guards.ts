/**
 * lib/properties/guards.ts — Fonctions de garde pour la gestion des biens
 *
 * Fonctions reutilisables pour verifier les permissions et contraintes
 * avant creation, modification ou suppression d'un bien.
 *
 * Utilise par :
 *  - app/api/properties/route.ts (POST)
 *  - app/api/properties/[id]/route.ts (PATCH, DELETE)
 *  - Composants UI pour pre-validation cote client
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS } from '@/lib/subscriptions/plan-limits';
import type { PlanSlug } from '@/lib/subscriptions/plans';

// ============================================
// 1. GUARD CREATION — Verification limite du plan
// ============================================

export interface PropertyGuardResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  plan: string;
  message?: string;
}

/**
 * Verifie si l'utilisateur peut creer un nouveau bien selon son forfait.
 *
 * La limite est par COMPTE (owner_id), pas par entite.
 * Les biens avec etat='deleted' ne comptent pas.
 */
export async function canCreateProperty(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<PropertyGuardResult> {
  // 1. Recuperer le plan actif
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
    .single();

  const plan = (sub?.plan as PlanSlug) ?? 'gratuit';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.gratuit;
  const maxAllowed = limits.maxProperties;

  // 2. Compter les biens actifs de TOUTES les entites du proprietaire
  // On exclut les biens supprimes (etat = 'deleted')
  let countQuery = supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);

  // Essayer d'exclure les biens supprimes via la colonne etat
  // Si la colonne n'existe pas, la requete fonctionnera quand meme sans le filtre
  countQuery = countQuery.neq('etat', 'deleted');

  const { count, error } = await countQuery;

  // Si erreur due a la colonne etat manquante, reessayer sans filtre
  let currentCount: number;
  if (error && (error.message?.includes('does not exist') || error.code === '42703')) {
    const { count: fallbackCount } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    currentCount = fallbackCount ?? 0;
  } else {
    currentCount = count ?? 0;
  }

  // -1 = illimite
  if (maxAllowed === -1) {
    return { allowed: true, currentCount, maxAllowed, plan };
  }

  if (currentCount >= maxAllowed) {
    return {
      allowed: false,
      currentCount,
      maxAllowed,
      plan,
      message: `Votre forfait ${plan} autorise ${maxAllowed} bien${maxAllowed > 1 ? 's' : ''}. Passez au forfait superieur pour en ajouter.`,
    };
  }

  return { allowed: true, currentCount, maxAllowed, plan };
}

// ============================================
// 2. GUARD SUPPRESSION — Verification des liaisons
// ============================================

export interface DeleteGuardResult {
  canDelete: boolean;
  canArchive: boolean;
  blockers: string[];
  warnings: string[];
  linkedData: {
    activeLeases: number;
    terminatedLeases: number;
    documents: number;
    tickets: number;
    photos: number;
  };
}

/**
 * Verifie si un bien peut etre supprime ou archive.
 *
 * Regles :
 *  - Bail actif/en signature → BLOQUEUR (ni suppression ni archivage)
 *  - Baux termines, documents, tickets → WARNING (archivage OK, pas suppression definitive)
 *  - Aucune liaison → Suppression definitive OK
 */
export async function canDeleteProperty(
  supabase: SupabaseClient,
  propertyId: string,
  ownerId: string,
): Promise<DeleteGuardResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Verifier ownership
  const { data: property } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', propertyId)
    .eq('owner_id', ownerId)
    .single();

  if (!property) {
    return {
      canDelete: false,
      canArchive: false,
      blockers: ['Bien introuvable ou non autorise'],
      warnings: [],
      linkedData: { activeLeases: 0, terminatedLeases: 0, documents: 0, tickets: 0, photos: 0 },
    };
  }

  // Compter les liaisons en parallele
  const [leasesResult, docsResult, ticketsResult, photosResult] = await Promise.all([
    supabase
      .from('leases')
      .select('id, statut')
      .eq('property_id', propertyId),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),
    supabase
      .from('property_photos')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),
  ]);

  const allLeases = leasesResult.data ?? [];
  const activeStatuses = ['active', 'pending_signature', 'partially_signed', 'fully_signed'];
  const terminatedStatuses = ['terminated', 'expired', 'cancelled'];

  const activeLeases = allLeases.filter((l: { statut: string }) => activeStatuses.includes(l.statut)).length;
  const terminatedLeases = allLeases.filter((l: { statut: string }) => terminatedStatuses.includes(l.statut)).length;

  const linkedData = {
    activeLeases,
    terminatedLeases,
    documents: docsResult.count ?? 0,
    tickets: ticketsResult.count ?? 0,
    photos: photosResult.count ?? 0,
  };

  // BLOQUEURS — empechent toute suppression/archivage
  if (activeLeases > 0) {
    blockers.push(
      `Ce bien a ${activeLeases} bail${activeLeases > 1 ? 'x' : ''} actif${activeLeases > 1 ? 's' : ''} ou en cours de signature. Terminez-le${activeLeases > 1 ? 's' : ''} d'abord.`,
    );
  }

  // WARNINGS — permettent l'archivage mais pas la suppression definitive
  if (terminatedLeases > 0) {
    warnings.push(`${terminatedLeases} bail${terminatedLeases > 1 ? 'x' : ''} termine${terminatedLeases > 1 ? 's' : ''}`);
  }
  if (linkedData.documents > 0) {
    warnings.push(`${linkedData.documents} document${linkedData.documents > 1 ? 's' : ''} lie${linkedData.documents > 1 ? 's' : ''}`);
  }
  if (linkedData.tickets > 0) {
    warnings.push(`${linkedData.tickets} ticket${linkedData.tickets > 1 ? 's' : ''} d'intervention`);
  }

  return {
    canDelete: blockers.length === 0 && warnings.length === 0,
    canArchive: blockers.length === 0,
    blockers,
    warnings,
    linkedData,
  };
}

// ============================================
// 3. GUARD MODIFICATION — Verification etat
// ============================================

export interface EditGuardResult {
  canEdit: boolean;
  reason?: string;
}

/**
 * Verifie si un bien peut etre modifie selon son etat.
 * Seuls les biens en 'draft' ou 'rejected' sont modifiables (sauf admin).
 */
export function canEditProperty(
  etat: string | null | undefined,
  isAdmin: boolean,
): EditGuardResult {
  if (isAdmin) return { canEdit: true };

  // Si pas d'etat (colonne manquante), on autorise
  if (!etat) return { canEdit: true };

  if (['draft', 'rejected'].includes(etat)) {
    return { canEdit: true };
  }

  if (etat === 'pending_review') {
    return { canEdit: false, reason: 'Impossible de modifier un bien en cours de validation.' };
  }

  if (etat === 'published') {
    return { canEdit: false, reason: 'Impossible de modifier un bien publie. Repassez-le en brouillon.' };
  }

  if (etat === 'deleted') {
    return { canEdit: false, reason: 'Ce bien a ete supprime.' };
  }

  return { canEdit: true };
}

// ============================================
// 4. GUARD OWNERSHIP — Verification proprietaire
// ============================================

/**
 * Verifie que le profil est bien le proprietaire du bien ou un admin.
 */
export function isPropertyOwnerOrAdmin(
  propertyOwnerId: string,
  profileId: string,
  profileRole: string,
): boolean {
  return profileRole === 'admin' || propertyOwnerId === profileId;
}
