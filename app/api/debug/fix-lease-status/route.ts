export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/debug/fix-lease-status?leaseId=xxx&fix=true
 * Vérifie le statut d'un bail et le corrige si fix=true
 * 
 * Route publique pour debug - À SUPPRIMER EN PRODUCTION
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leaseId = url.searchParams.get("leaseId");
    const shouldFix = url.searchParams.get("fix") === "true";
    
    if (!leaseId) {
      return NextResponse.json({ error: "leaseId requis" }, { status: 400 });
    }
    
    const serviceClient = getServiceClient();
    
    // 1. Vérifier le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut, type_bail, date_debut")
      .eq("id", leaseId)
      .single();
    
    if (leaseError || !lease) {
      return NextResponse.json({ 
        error: "Bail non trouvé",
        details: leaseError?.message 
      }, { status: 404 });
    }
    
    // 2. Vérifier les signataires
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("role, signature_status, signed_at")
      .eq("lease_id", leaseId);
    
    const allSigned = signers && signers.length > 0 && 
      signers.every((s: any) => s.signature_status === "signed");
    
    const needsFix = allSigned && lease.statut !== "fully_signed" && lease.statut !== "active";
    
    let fixResult = null;
    
    // Corriger si demandé
    if (shouldFix && needsFix) {
      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ statut: "fully_signed" })
        .eq("id", leaseId);
      
      if (updateError) {
        fixResult = {
          success: false,
          error: updateError.message,
          hint: updateError.message.includes("check constraint") 
            ? "Migration 20251228000000_edl_before_activation.sql nécessaire"
            : undefined,
        };
      } else {
        fixResult = {
          success: true,
          message: "✅ Statut corrigé vers 'fully_signed'",
          new_status: "fully_signed",
        };
      }
    }
    
    return NextResponse.json({
      lease: {
        id: lease.id,
        statut: lease.statut,
        type_bail: lease.type_bail,
        date_debut: lease.date_debut,
      },
      signers: signers?.map((s: any) => ({
        role: s.role,
        status: s.signature_status,
        signed_at: s.signed_at,
      })),
      all_signed: allSigned,
      needs_fix: needsFix,
      fix_requested: shouldFix,
      fix_result: fixResult,
    });
    
  } catch (error: any) {
    console.error("[fix-lease-status] Erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}










