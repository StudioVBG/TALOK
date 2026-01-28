import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Classe d'erreur API standardisée
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Helper pour gérer les erreurs API de manière standardisée
 * 
 * @param error - L'erreur à gérer
 * @returns NextResponse avec le bon code HTTP et message
 */
export function handleApiError(error: unknown): NextResponse {
  // Erreur Zod (validation)
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Données invalides",
        details: error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        })),
      },
      { status: 400 }
    );
  }

  // Erreur API personnalisée
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Erreur Supabase
  if (error && typeof error === "object" && "code" in error) {
    const supabaseError = error as any;
    
    // Erreurs de permission RLS
    if (supabaseError.code === "42501" || supabaseError.code === "42P17") {
      return NextResponse.json(
        { error: "Accès refusé", details: "Vous n'avez pas les permissions nécessaires" },
        { status: 403 }
      );
    }

    // Ressource non trouvée
    if (supabaseError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Ressource non trouvée" },
        { status: 404 }
      );
    }

    // Contrainte de clé étrangère
    if (supabaseError.code === "23503") {
      return NextResponse.json(
        { error: "Référence invalide", details: supabaseError.message },
        { status: 400 }
      );
    }

    // Contrainte unique violée
    if (supabaseError.code === "23505") {
      return NextResponse.json(
        { error: "Conflit", details: "Cette ressource existe déjà" },
        { status: 409 }
      );
    }
  }

  // Erreur générique
  const errorMessage =
    error instanceof Error ? error.message : "Erreur serveur inattendue";

  console.error("[handleApiError] Unexpected error:", error);

  return NextResponse.json(
    { error: errorMessage },
    { status: 500 }
  );
}

/**
 * Helper pour valider les données avec Zod et retourner une erreur standardisée si invalide
 * 
 * @param schema - Schéma Zod
 * @param data - Données à valider
 * @returns Données validées
 * @throws ApiError si validation échoue
 */
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, "Données invalides", error.errors);
    }
    throw error;
  }
}

/**
 * Helper pour vérifier l'authentification et retourner une erreur standardisée si non authentifié
 */
export function requireAuth(user: any): void {
  if (!user) {
    throw new ApiError(401, "Non authentifié");
  }
}

/**
 * Helper pour vérifier les permissions et retourner une erreur standardisée si non autorisé
 */
export function requireRole(userRole: string, allowedRoles: string[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw new ApiError(403, "Accès refusé", {
      required: allowedRoles,
      current: userRole,
    });
  }
}

/**
 * SOTA 2026: Erreur spécialisée pour les limites de quota d'abonnement
 * Inclut un message clair et un lien vers la page d'upgrade
 */
export class QuotaExceededError extends ApiError {
  constructor(
    resourceType: string,
    current: number,
    max: number,
    plan: string
  ) {
    const resourceLabels: Record<string, string> = {
      properties: "biens",
      leases: "baux",
      users: "utilisateurs",
      signatures: "signatures ce mois",
      documents_gb: "Go de stockage",
    };

    const label = resourceLabels[resourceType] || resourceType;
    const message = `Limite de ${max} ${label} atteinte pour votre forfait "${plan}". Passez à un forfait supérieur pour continuer.`;

    super(403, message, {
      code: "QUOTA_EXCEEDED",
      resource_type: resourceType,
      current,
      max,
      plan,
      upgrade_url: "/settings/billing",
      help_text: "Consultez nos offres pour débloquer plus de fonctionnalités.",
    });
  }
}

/**
 * Helper pour lancer une erreur de quota dépassé
 */
export function requireQuotaAvailable(
  resourceType: string,
  current: number,
  max: number,
  plan: string
): void {
  if (current >= max) {
    throw new QuotaExceededError(resourceType, current, max, plan);
  }
}

