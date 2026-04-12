/**
 * Feature gate helper pour les routes /api/copro/*
 *
 * SOTA 2026 (S1-2) :
 * Toutes les routes POST/PUT/DELETE copro doivent refuser les requêtes
 * des utilisateurs sur un plan sans `hasCoproModule`. Les GET restent
 * ouverts (lecture seule = données vides pas de risque).
 *
 * Ce helper centralise :
 *   - L'authentification (Supabase Auth)
 *   - La récupération du profile
 *   - Le check de feature access via `withFeatureAccess('copro_module')`
 *   - La réponse d'erreur standardisée
 *
 * Usage dans une route :
 *   ```ts
 *   import { requireCoproFeature } from '@/lib/helpers/copro-feature-gate';
 *
 *   export async function POST(request: NextRequest) {
 *     const access = await requireCoproFeature();
 *     if (access instanceof NextResponse) return access;
 *     const { profile, serviceClient } = access;
 *     // ... reste du handler, utiliser profile.id et serviceClient
 *   }
 *   ```
 *
 * Pour les routes qui utilisent déjà `requireSyndic` (lib/helpers/syndic-auth.ts),
 * utiliser `checkCoproFeatureForProfile(profileId)` qui ne refait pas l'auth.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  withFeatureAccess,
  createSubscriptionErrorResponse,
} from "@/lib/middleware/subscription-check";

export interface CoproFeatureAccessResult {
  profile: {
    id: string;
    role: string;
  };
  user: { id: string; email?: string | null };
  serviceClient: ReturnType<typeof getServiceClient>;
}

/**
 * Auth + profil + feature gate copro_module.
 * Retourne soit une NextResponse d'erreur (à return directement),
 * soit l'objet d'accès contenant profile, user et serviceClient.
 */
export async function requireCoproFeature(): Promise<
  CoproFeatureAccessResult | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Non authentifié" },
      { status: 401 }
    );
  }

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "Profil non trouvé" },
      { status: 404 }
    );
  }

  const featureCheck = await withFeatureAccess(
    (profile as any).id,
    "copro_module"
  );
  if (!featureCheck.allowed) {
    return createSubscriptionErrorResponse(featureCheck);
  }

  return {
    profile: {
      id: (profile as any).id,
      role: (profile as any).role,
    },
    user: { id: user.id, email: user.email ?? null },
    serviceClient,
  };
}

/**
 * Variante à utiliser depuis une route qui a DÉJÀ récupéré le profile
 * (typiquement après `requireSyndic`). Ne refait pas l'auth, juste le
 * feature check.
 */
export async function checkCoproFeatureForProfile(
  profileId: string
): Promise<NextResponse | null> {
  const featureCheck = await withFeatureAccess(profileId, "copro_module");
  if (!featureCheck.allowed) {
    return createSubscriptionErrorResponse(featureCheck);
  }
  return null;
}
