/**
 * API Route pour la vérification d'avis d'imposition français
 *
 * POST /api/verification/tax-notice
 *
 * Permet de vérifier l'authenticité d'un avis d'imposition
 * via l'API Particulier officielle de l'État français.
 *
 * @requires Authentification utilisateur
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  verifyTaxNotice,
  createVerificationLog,
  hashNumeroFiscal,
} from "@/lib/services/tax-verification.service";
import { taxNoticeVerificationRequestSchema } from "@/lib/validations/tax-verification";
import type { TaxVerificationConfig } from "@/lib/types/tax-verification";

// ============================================================================
// TYPES
// ============================================================================

interface VerifyTaxNoticeRequestBody {
  numeroFiscal: string;
  referenceAvis: string;
  tenantId?: string;
  applicationId?: string;
  saveToHistory?: boolean;
}

// ============================================================================
// POST - Vérifier un avis d'imposition
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authentification
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Non autorisé" },
        { status: 401 }
      );
    }

    // 2. Parser et valider le body
    const body: VerifyTaxNoticeRequestBody = await request.json();

    const validation = taxNoticeVerificationRequestSchema.safeParse({
      numeroFiscal: body.numeroFiscal,
      referenceAvis: body.referenceAvis,
    });

    if (!validation.success) {
      const errors = validation.error.errors.map((e: { path: (string | number)[]; message: string }) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      return NextResponse.json(
        {
          success: false,
          error: "Données invalides",
          details: errors,
        },
        { status: 400 }
      );
    }

    // 3. Configurer le service
    const config: Partial<TaxVerificationConfig> = {
      environment:
        process.env.NODE_ENV === "production" ? "production" : "test",
    };

    // 4. Effectuer la vérification
    const result = await verifyTaxNotice(validation.data, config);

    // 5. Sauvegarder dans l'historique si demandé
    if (body.saveToHistory !== false && result.success) {
      try {
        const log = createVerificationLog(user.id, validation.data, result, {
          tenantId: body.tenantId,
          applicationId: body.applicationId,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        });

        await supabase.from("tax_verification_logs").insert([
          {
            user_id: log.userId,
            tenant_id: log.tenantId,
            application_id: log.applicationId,
            numero_fiscal_hash: log.numeroFiscalHash,
            reference_avis_hash: log.referenceAvisHash,
            status: log.status,
            verification_mode: log.verificationMode,
            ip_address: log.ipAddress,
          },
        ]);
      } catch (logError) {
        // Ne pas bloquer la réponse si le log échoue
        console.error("[TaxVerification] Failed to save log:", logError);
      }
    }

    // 6. Retourner le résultat
    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
      data: result.data
        ? {
            declarant1: {
              nom: result.data.declarant1.nom,
              prenoms: result.data.declarant1.prenoms,
            },
            declarant2: result.data.declarant2
              ? {
                  nom: result.data.declarant2.nom,
                  prenoms: result.data.declarant2.prenoms,
                }
              : undefined,
            anneeRevenus: result.data.anneeRevenus,
            revenuFiscalReference: result.data.revenuFiscalReference,
            nombreParts: result.data.nombreParts,
            situationFamille: result.data.situationFamille,
            adresse: result.data.foyerFiscal.adresse,
          }
        : undefined,
      summary: result.summary,
      verifiedAt: result.verifiedAt,
    });
  } catch (error) {
    console.error("[API] Tax verification error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la vérification",
        message:
          error instanceof Error
            ? error.message
            : "Une erreur inattendue s'est produite",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Récupérer l'historique des vérifications
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // 1. Authentification
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Non autorisé" },
        { status: 401 }
      );
    }

    // 2. Récupérer les paramètres de requête
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const applicationId = searchParams.get("applicationId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // 3. Construire la requête
    let query = supabase
      .from("tax_verification_logs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    if (applicationId) {
      query = query.eq("application_id", applicationId);
    }

    // 4. Exécuter la requête
    const { data, count, error } = await query;

    if (error) {
      console.error("[API] Tax verification history error:", error);
      return NextResponse.json(
        { success: false, error: "Erreur lors de la récupération de l'historique" },
        { status: 500 }
      );
    }

    // 5. Retourner les résultats
    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("[API] Tax verification history error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération de l'historique",
      },
      { status: 500 }
    );
  }
}
