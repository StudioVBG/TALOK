/**
 * API Routes pour les entités juridiques
 * GET /api/owner/legal-entities - Liste les entités
 * POST /api/owner/legal-entities - Crée une nouvelle entité
 *
 * Utilise le service_role pour bypasser les RLS sur legal_entities
 * (les policies passent par owner_profiles, qui peut être absent).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLegalEntity } from "@/features/legal-entities/services/legal-entities.service";
import type { CreateLegalEntityDTO } from "@/lib/types/legal-entity";

/**
 * GET /api/owner/legal-entities
 * Récupère toutes les entités juridiques du propriétaire connecté
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
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

    // Service role pour bypasser RLS (évite la dépendance à owner_profiles)
    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const adminClient = supabaseAdmin();

    // Récupérer le profil propriétaire
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Auto-créer owner_profiles si manquant (corrige la cause racine du RLS)
    const { data: ownerProfile } = await adminClient
      .from("owner_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .single();

    if (!ownerProfile) {
      await adminClient
        .from("owner_profiles")
        .upsert({ profile_id: profile.id, type: "particulier" }, { onConflict: "profile_id" });
      console.log(`[GET /api/owner/legal-entities] Auto-created owner_profiles for profile ${profile.id}`);
    }

    // Options de filtrage
    const searchParams = request.nextUrl.searchParams;
    const includeStats = searchParams.get("stats") !== "false";

    // Récupérer les entités via adminClient (bypass RLS)
    const { data: entities, error: entitiesError } = await adminClient
      .from("legal_entities")
      .select("*")
      .eq("owner_profile_id", profile.id)
      .eq("is_active", true)
      .order("nom");

    if (entitiesError) {
      console.error("[GET /api/owner/legal-entities] Error:", entitiesError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des entités" },
        { status: 500 }
      );
    }

    if (!includeStats) {
      return NextResponse.json({
        entities: entities || [],
        count: (entities || []).length,
      });
    }

    // Enrichir avec les stats (counts de propriétés et baux)
    const entityIds = (entities || []).map((e: Record<string, unknown>) => e.id as string);
    const propertyCounts: Record<string, number> = {};
    const leaseCounts: Record<string, number> = {};

    const particulierEntity = (entities || []).find(
      (e: Record<string, unknown>) => e.entity_type === "particulier"
    );

    if (entityIds.length > 0) {
      const { data: props } = await adminClient
        .from("properties")
        .select("legal_entity_id")
        .eq("owner_id", profile.id)
        .is("deleted_at", null);

      if (props) {
        for (const p of props as any[]) {
          if (p.legal_entity_id && entityIds.includes(p.legal_entity_id)) {
            propertyCounts[p.legal_entity_id] = (propertyCounts[p.legal_entity_id] || 0) + 1;
          } else if (!p.legal_entity_id && particulierEntity) {
            const pId = particulierEntity.id as string;
            propertyCounts[pId] = (propertyCounts[pId] || 0) + 1;
          }
        }
      }

      const { data: leases } = await adminClient
        .from("leases")
        .select("signatory_entity_id")
        .in("signatory_entity_id", entityIds)
        .in("statut", ["active", "pending_signature", "fully_signed"]);

      if (leases) {
        for (const l of leases as any[]) {
          if (l.signatory_entity_id) {
            leaseCounts[l.signatory_entity_id] = (leaseCounts[l.signatory_entity_id] || 0) + 1;
          }
        }
      }
    }

    const enriched = (entities || []).map((e: Record<string, unknown>) => ({
      ...e,
      property_count: propertyCounts[e.id as string] || 0,
      lease_count: leaseCounts[e.id as string] || 0,
    }));

    return NextResponse.json({
      entities: enriched,
      count: enriched.length,
    });
  } catch (error) {
    console.error("Error in GET /api/owner/legal-entities:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/legal-entities
 * Crée une nouvelle entité juridique
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
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

    // Récupérer le profil propriétaire
    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const adminClient = supabaseAdmin();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Parser le body
    const body: CreateLegalEntityDTO = await request.json();

    // Validation basique
    if (!body.entity_type) {
      return NextResponse.json(
        { error: "Le type d'entité est requis" },
        { status: 400 }
      );
    }

    if (!body.nom) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      );
    }

    if (!body.regime_fiscal) {
      return NextResponse.json(
        { error: "Le régime fiscal est requis" },
        { status: 400 }
      );
    }

    // M7: Validation du SIREN si fourni (9 chiffres exactement)
    if (body.siren && !/^\d{9}$/.test(body.siren)) {
      return NextResponse.json(
        { error: "Le SIREN doit contenir exactement 9 chiffres" },
        { status: 400 }
      );
    }

    // M7: Validation du SIRET si fourni (14 chiffres exactement)
    if (body.siret && !/^\d{14}$/.test(body.siret)) {
      return NextResponse.json(
        { error: "Le SIRET doit contenir exactement 14 chiffres" },
        { status: 400 }
      );
    }

    // Créer l'entité
    const entity = await createLegalEntity(profile.id, body);

    return NextResponse.json(
      { entity, message: "Entité créée avec succès" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/owner/legal-entities:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
