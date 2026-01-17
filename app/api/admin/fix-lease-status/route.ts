export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * POST /api/admin/fix-lease-status
 * Corrige le statut d'un bail signé vers "fully_signed"
 * 
 * Body: { leaseId: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    const { leaseId } = await request.json();
    
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
    const { data: signers, error: signersError } = await serviceClient
      .from("lease_signers")
      .select("role, signature_status, signed_at")
      .eq("lease_id", leaseId);
    
    if (signersError) {
      return NextResponse.json({ 
        error: "Erreur lecture signataires",
        details: signersError.message 
      }, { status: 500 });
    }
    
    // 3. Vérifier si tous ont signé
    const allSigned = signers && signers.length > 0 && 
      signers.every((s: any) => s.signature_status === "signed");
    
    const result = {
      lease: {
        id: lease.id,
        statut_avant: lease.statut,
        type_bail: lease.type_bail,
        date_debut: lease.date_debut,
      },
      signers: signers?.map((s: any) => ({
        role: s.role,
        status: s.signature_status,
        signed_at: s.signed_at,
      })),
      all_signed: allSigned,
      action: "none",
      statut_apres: lease.statut,
    };
    
    // 4. Corriger si nécessaire
    if (allSigned && lease.statut !== "fully_signed" && lease.statut !== "active") {
      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ statut: "fully_signed" })
        .eq("id", leaseId);
      
      if (updateError) {
        return NextResponse.json({ 
          error: "Erreur mise à jour statut",
          details: updateError.message,
          hint: updateError.message.includes("check constraint") 
            ? "La migration 20251228000000_edl_before_activation.sql doit être appliquée"
            : undefined,
          ...result,
        }, { status: 500 });
      }
      
      result.action = "updated";
      result.statut_apres = "fully_signed";
    } else if (lease.statut === "fully_signed" || lease.statut === "active") {
      result.action = "already_correct";
    } else {
      result.action = "no_change_needed";
    }
    
    return NextResponse.json({
      success: true,
      message: result.action === "updated" 
        ? "✅ Statut corrigé vers 'fully_signed'" 
        : result.action === "already_correct"
        ? "✅ Le statut est déjà correct"
        : "⚠️ Aucune modification (signatures manquantes)",
      ...result,
    });
    
  } catch (error: unknown) {
    console.error("[fix-lease-status] Erreur:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Erreur serveur" 
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/fix-lease-status?leaseId=xxx&fix=true
 * Vérifie le statut d'un bail et le corrige si fix=true
 *
 * NOTE: Cette route utilise le service client pour le debug
 * SECURITY: Requiert authentification admin
 */
export async function GET(request: Request) {
  try {
    // SECURITY: Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

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
        error: "Bail non trouvé" 
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
    
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

