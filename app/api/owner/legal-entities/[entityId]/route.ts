/**
 * API Routes pour une entité juridique spécifique
 * GET /api/owner/legal-entities/[entityId] - Détails d'une entité
 * PATCH /api/owner/legal-entities/[entityId] - Met à jour une entité
 * DELETE /api/owner/legal-entities/[entityId] - Supprime/désactive une entité
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLegalEntityById,
  updateLegalEntity,
  deactivateLegalEntity,
  deleteLegalEntity,
  canDeleteEntity,
  getEntityAssociates,
} from "@/features/legal-entities/services/legal-entities.service";
import type { UpdateLegalEntityDTO } from "@/lib/types/legal-entity";
import { isValidSiret, isValidSiren } from "@/lib/entities/siret-validation";

interface RouteParams {
  params: Promise<{ entityId: string }>;
}

/**
 * Vérifie que l'utilisateur a accès à l'entité
 */
async function verifyEntityAccess(
  entityId: string
): Promise<{ authorized: boolean; error?: string; profileId?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { authorized: false, error: "Accès réservé aux propriétaires" };
  }

  // Vérifier que l'entité appartient au propriétaire
  const { data: entity } = await supabase
    .from("legal_entities")
    .select("owner_profile_id")
    .eq("id", entityId)
    .single();

  if (!entity) {
    return { authorized: false, error: "Entité non trouvée" };
  }

  if (entity.owner_profile_id !== profile.id) {
    return { authorized: false, error: "Accès non autorisé à cette entité" };
  }

  return { authorized: true, profileId: profile.id };
}

/**
 * GET /api/owner/legal-entities/[entityId]
 * Récupère les détails d'une entité
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { entityId } = await params;

    const access = await verifyEntityAccess(entityId);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error === "Non authentifié" ? 401 : 403 }
      );
    }

    // Récupérer l'entité
    const entity = await getLegalEntityById(entityId);
    if (!entity) {
      return NextResponse.json(
        { error: "Entité non trouvée" },
        { status: 404 }
      );
    }

    // Récupérer les associés
    const associates = await getEntityAssociates(entityId);

    // Vérifier si suppression possible
    const deleteCheck = await canDeleteEntity(entityId);

    return NextResponse.json({
      entity,
      associates,
      canDelete: deleteCheck.canDelete,
      deleteReason: deleteCheck.reason,
    });
  } catch (error) {
    console.error("Error in GET /api/owner/legal-entities/[entityId]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/owner/legal-entities/[entityId]
 * Met à jour une entité
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { entityId } = await params;

    const access = await verifyEntityAccess(entityId);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error === "Non authentifié" ? 401 : 403 }
      );
    }

    const body: UpdateLegalEntityDTO = await request.json();

    // Validation du SIREN si modifié (format + Luhn)
    if (body.siren !== undefined && body.siren) {
      if (body.siren.length !== 9 || !isValidSiren(body.siren)) {
        return NextResponse.json(
          { error: "Le SIREN est invalide (9 chiffres, clé de contrôle Luhn)" },
          { status: 400 }
        );
      }
    }

    // Validation du SIRET si modifié (format + Luhn)
    if (body.siret !== undefined && body.siret) {
      if (body.siret.length !== 14 || !isValidSiret(body.siret)) {
        return NextResponse.json(
          { error: "Le SIRET est invalide (14 chiffres, clé de contrôle Luhn)" },
          { status: 400 }
        );
      }
    }

    const entity = await updateLegalEntity(entityId, body, access.profileId!);

    return NextResponse.json({
      entity,
      message: "Entité mise à jour avec succès",
    });
  } catch (error) {
    console.error("Error in PATCH /api/owner/legal-entities/[entityId]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/legal-entities/[entityId]
 * Supprime ou désactive une entité
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { entityId } = await params;

    const access = await verifyEntityAccess(entityId);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error === "Non authentifié" ? 401 : 403 }
      );
    }

    // Vérifier les query params
    const searchParams = request.nextUrl.searchParams;
    const forceDelete = searchParams.get("force") === "true";
    const motif = searchParams.get("motif") || undefined;

    // Vérifier si suppression possible
    const deleteCheck = await canDeleteEntity(entityId);

    if (!deleteCheck.canDelete) {
      if (forceDelete) {
        // Suppression forcée impossible si des dépendances existent
        return NextResponse.json(
          {
            error: `Suppression impossible: ${deleteCheck.reason}`,
            canDeactivate: true,
          },
          { status: 400 }
        );
      }

      // Désactiver au lieu de supprimer
      await deactivateLegalEntity(entityId, motif);

      return NextResponse.json({
        message: "Entité désactivée (des dépendances existent)",
        deactivated: true,
        reason: deleteCheck.reason,
      });
    }

    // Suppression définitive
    await deleteLegalEntity(entityId);

    return NextResponse.json({
      message: "Entité supprimée définitivement",
      deleted: true,
    });
  } catch (error) {
    console.error("Error in DELETE /api/owner/legal-entities/[entityId]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
