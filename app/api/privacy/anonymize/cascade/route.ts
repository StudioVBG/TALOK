export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Anonymisation Cascade RGPD - Article 17 (Droit à l'effacement)
 *
 * Anonymise toutes les données d'un utilisateur de manière complète
 * en cascade sur toutes les tables liées.
 *
 * POST /api/privacy/anonymize/cascade
 *
 * IMPORTANT:
 * - Opération irréversible
 * - Nécessite confirmation explicite
 * - Conserve les données financières anonymisées (obligations légales)
 * - Log complet dans audit_log
 * - ✅ P2: Utilise une RPC transactionnelle pour garantir l'atomicité
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
import { NextRequest, NextResponse } from "next/server";

interface AnonymizeRequest {
  user_id: string;
  reason: string;
  confirmation: string; // Doit être "CONFIRMER_SUPPRESSION"
  keep_financial_records?: boolean; // true par défaut (obligation légale)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier que c'est un admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if ((adminProfile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut anonymiser les données" },
        { status: 403 }
      );
    }

    const body: AnonymizeRequest = await request.json();
    const { user_id, reason, confirmation, keep_financial_records = true } = body;

    // Validations
    if (!user_id) {
      return NextResponse.json(
        { error: "user_id requis" },
        { status: 400 }
      );
    }

    if (!reason || reason.length < 20) {
      return NextResponse.json(
        { error: "Une raison détaillée est requise (min 20 caractères)" },
        { status: 400 }
      );
    }

    if (confirmation !== "CONFIRMER_SUPPRESSION") {
      return NextResponse.json(
        { error: "Confirmation invalide. Envoyez confirmation: 'CONFIRMER_SUPPRESSION'" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // ============================================
    // PHASE 1 : Collecter les fichiers Storage à supprimer AVANT la transaction
    // (car la RPC SQL n'a pas accès au Storage)
    // ============================================
    const { data: targetProfile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    if ((targetProfile as any).role === "admin") {
      return NextResponse.json(
        { error: "Impossible d'anonymiser un administrateur" },
        { status: 403 }
      );
    }

    const profileId = (targetProfile as any).id;

    // Collecter les documents non-financiers à supprimer du Storage
    const { data: documents } = await serviceClient
      .from("documents")
      .select("id, storage_path, type")
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);

    const { data: identityDocs } = await serviceClient
      .from("tenant_identity_documents")
      .select("id, storage_path")
      .eq("tenant_id", profileId);

    // ============================================
    // PHASE 2 : Transaction atomique via RPC
    // ============================================
    const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
      "anonymize_user_cascade",
      {
        p_user_id: user_id,
        p_admin_user_id: user.id,
        p_reason: reason,
        p_keep_financial_records: keep_financial_records,
      }
    );

    if (rpcError) {
      console.error("[privacy/anonymize/cascade] RPC error:", rpcError);
      return NextResponse.json(
        { error: rpcError.message || "Erreur lors de l'anonymisation" },
        { status: 500 }
      );
    }

    // ============================================
    // PHASE 3 : Supprimer les fichiers Storage (hors transaction SQL)
    // ============================================
    let documentsDeleted = 0;

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const docType = (doc as any).type;
        const isFinancial = ['quittance', 'facture', 'invoice'].includes(docType);

        if (!isFinancial || !keep_financial_records) {
          try {
            await serviceClient.storage
              .from(STORAGE_BUCKETS.DOCUMENTS)
              .remove([(doc as any).storage_path]);
            documentsDeleted++;
          } catch (e) {
            console.warn(`Impossible de supprimer ${(doc as any).storage_path}`);
          }
        }
      }
    }

    if (identityDocs && identityDocs.length > 0) {
      for (const doc of identityDocs) {
        try {
          await serviceClient.storage
            .from(STORAGE_BUCKETS.IDENTITY)
            .remove([(doc as any).storage_path]);
          documentsDeleted++;
        } catch (e) {
          console.warn(`Impossible de supprimer identity/${(doc as any).storage_path}`);
        }
      }
    }

    const result = rpcResult as any;

    return NextResponse.json({
      success: true,
      message: "Données anonymisées avec succès (transaction atomique)",
      result: {
        success: true,
        user_id,
        tables_processed: result?.tables_processed || [],
        documents_deleted: documentsDeleted,
        total_rows_affected: result?.total_rows_affected || 0,
      },
    });

  } catch (error: unknown) {
    console.error("[privacy/anonymize/cascade] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
