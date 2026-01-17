/**
 * API Admin: Nettoyage des données orphelines
 * 
 * GET /api/admin/cleanup - Rapport des données orphelines
 * POST /api/admin/cleanup - Exécuter le nettoyage
 * 
 * ✅ SOTA 2026: Nettoyage automatique des données orphelines
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface OrphanReport {
  type: string;
  count: number;
  description: string;
  canAutoClean: boolean;
}

/**
 * GET: Rapport des données orphelines
 */
export async function GET() {
  try {
    // Vérifier l'authentification admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const serviceClient = getServiceClient();
    const report: OrphanReport[] = [];

    // 1. Documents avec lease_id invalide
    const { count: docsLeaseOrphans } = await serviceClient
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("lease_id", "is", null)
      .not("lease_id", "in", `(SELECT id FROM leases)`);
    
    // Correction: Utiliser une requête RPC ou une sous-requête
    const { data: orphanDocs } = await serviceClient.rpc("count_orphan_documents_lease");
    report.push({
      type: "documents_lease_orphan",
      count: orphanDocs || 0,
      description: "Documents avec lease_id vers un bail supprimé",
      canAutoClean: true,
    });

    // 2. Documents avec property_id invalide
    const { data: orphanDocsProperty } = await serviceClient.rpc("count_orphan_documents_property");
    report.push({
      type: "documents_property_orphan",
      count: orphanDocsProperty || 0,
      description: "Documents avec property_id vers une propriété supprimée",
      canAutoClean: true,
    });

    // 3. Factures orphelines
    const { data: orphanInvoices } = await serviceClient.rpc("count_orphan_invoices");
    report.push({
      type: "invoices_orphan",
      count: orphanInvoices || 0,
      description: "Factures avec bail supprimé",
      canAutoClean: true,
    });

    // 4. Signataires orphelins
    const { data: orphanSigners } = await serviceClient.rpc("count_orphan_signers");
    report.push({
      type: "signers_orphan",
      count: orphanSigners || 0,
      description: "Signataires avec bail supprimé",
      canAutoClean: true,
    });

    // 5. Notifications obsolètes (> 90 jours, lues)
    const { count: oldNotifications } = await serviceClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", true)
      .lt("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    report.push({
      type: "notifications_old",
      count: oldNotifications || 0,
      description: "Notifications lues de plus de 90 jours",
      canAutoClean: true,
    });

    // 6. OTP codes expirés
    const { count: expiredOtp } = await serviceClient
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    report.push({
      type: "otp_expired",
      count: expiredOtp || 0,
      description: "Codes OTP expirés depuis plus de 24h",
      canAutoClean: true,
    });

    // 7. Baux sans signataires (anomalie)
    const { data: leasesWithoutSigners } = await serviceClient.rpc("count_leases_without_signers");
    report.push({
      type: "leases_no_signers",
      count: leasesWithoutSigners || 0,
      description: "Baux actifs sans aucun signataire",
      canAutoClean: false, // Nécessite révision manuelle
    });

    // 8. Dépôts de garantie incohérents
    const { data: inconsistentDeposits } = await serviceClient.rpc("count_inconsistent_deposits");
    report.push({
      type: "deposits_inconsistent",
      count: inconsistentDeposits || 0,
      description: "Baux avec dépôt supérieur au maximum légal",
      canAutoClean: true,
    });

    // Calculer les totaux
    const totalOrphans = report.reduce((sum, r) => sum + r.count, 0);
    const autoCleanable = report.filter(r => r.canAutoClean).reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({
      success: true,
      report,
      summary: {
        totalOrphans,
        autoCleanable,
        requiresReview: totalOrphans - autoCleanable,
      },
      lastCheck: new Date().toISOString(),
    });

  } catch (error: unknown) {
    console.error("[Cleanup Report] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST: Exécuter le nettoyage
 */
export async function POST(request: Request) {
  try {
    // Vérifier l'authentification admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { types = "all" } = body; // 'all' ou tableau de types spécifiques

    const serviceClient = getServiceClient();
    const results: { type: string; deleted: number }[] = [];

    // 1. Nettoyer les documents orphelins (lease_id invalide)
    if (types === "all" || types.includes("documents_lease_orphan")) {
      const { data: orphanDocs } = await serviceClient
        .from("documents")
        .select("id, storage_path, lease_id")
        .not("lease_id", "is", null);

      // Filtrer ceux dont le lease n'existe plus
      const { data: validLeases } = await serviceClient
        .from("leases")
        .select("id");
      
      const validLeaseIds = new Set((validLeases || []).map(l => l.id));
      const docsToDelete = (orphanDocs || []).filter(d => !validLeaseIds.has(d.lease_id));

      if (docsToDelete.length > 0) {
        // Supprimer les fichiers du storage
        const storagePaths = docsToDelete.map(d => d.storage_path).filter(Boolean);
        if (storagePaths.length > 0) {
          await serviceClient.storage.from("documents").remove(storagePaths);
        }

        // Supprimer les entrées de la BDD
        const { error } = await serviceClient
          .from("documents")
          .delete()
          .in("id", docsToDelete.map(d => d.id));

        if (!error) {
          results.push({ type: "documents_lease_orphan", deleted: docsToDelete.length });
        }
      }
    }

    // 2. Notifications obsolètes
    if (types === "all" || types.includes("notifications_old")) {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: oldNotifs, error } = await serviceClient
        .from("notifications")
        .delete()
        .eq("is_read", true)
        .lt("created_at", cutoffDate)
        .select("id");

      if (!error) {
        results.push({ type: "notifications_old", deleted: oldNotifs?.length || 0 });
      }
    }

    // 3. OTP codes expirés
    if (types === "all" || types.includes("otp_expired")) {
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: expiredOtp, error } = await serviceClient
        .from("otp_codes")
        .delete()
        .lt("expires_at", cutoffDate)
        .select("id");

      if (!error) {
        results.push({ type: "otp_expired", deleted: expiredOtp?.length || 0 });
      }
    }

    // 4. Corriger les dépôts de garantie incohérents
    if (types === "all" || types.includes("deposits_inconsistent")) {
      // Baux nus
      const { data: fixed1 } = await serviceClient
        .from("leases")
        .update({ depot_de_garantie: serviceClient.rpc("", {}) })
        .eq("type_bail", "nu")
        .gt("depot_de_garantie", serviceClient.rpc("", {}))
        .select("id");

      // Utiliser la fonction SQL directement
      const { data: fixedDeposits } = await serviceClient.rpc("fix_inconsistent_deposits");
      results.push({ type: "deposits_fixed", deleted: fixedDeposits || 0 });
    }

    // Calculer le total
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    // Log de l'action
    await serviceClient
      .from("admin_logs")
      .insert({
        admin_id: user.id,
        action: "cleanup_orphans",
        details: { results, totalDeleted },
      })
      .single();

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalDeleted,
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error: unknown) {
    console.error("[Cleanup Execute] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

