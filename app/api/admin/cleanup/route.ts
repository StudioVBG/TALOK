/**
 * API Admin: Nettoyage des données orphelines
 *
 * GET /api/admin/cleanup - Rapport des données orphelines
 * POST /api/admin/cleanup - Exécuter le nettoyage
 *
 * ✅ SOTA 2026: Nettoyage automatique des données orphelines
 */

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
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
export async function GET(request: Request) {
  try {
    const { error: authError, user, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const report: OrphanReport[] = [];

    // 1. Documents avec lease_id invalide
    const { count: docsLeaseOrphans } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("lease_id", "is", null)
      .not("lease_id", "in", `(SELECT id FROM leases)`);

    // Correction: Utiliser une requête RPC ou une sous-requête
    const { data: orphanDocs } = await supabase.rpc("count_orphan_documents_lease");
    report.push({
      type: "documents_lease_orphan",
      count: (orphanDocs as number) || 0,
      description: "Documents avec lease_id vers un bail supprimé",
      canAutoClean: true,
    });

    // 2. Documents avec property_id invalide
    const { data: orphanDocsProperty } = await supabase.rpc("count_orphan_documents_property");
    report.push({
      type: "documents_property_orphan",
      count: (orphanDocsProperty as number) || 0,
      description: "Documents avec property_id vers une propriété supprimée",
      canAutoClean: true,
    });

    // 3. Factures orphelines
    const { data: orphanInvoices } = await supabase.rpc("count_orphan_invoices");
    report.push({
      type: "invoices_orphan",
      count: (orphanInvoices as number) || 0,
      description: "Factures avec bail supprimé",
      canAutoClean: true,
    });

    // 4. Signataires orphelins
    const { data: orphanSigners } = await supabase.rpc("count_orphan_signers");
    report.push({
      type: "signers_orphan",
      count: (orphanSigners as number) || 0,
      description: "Signataires avec bail supprimé",
      canAutoClean: true,
    });

    // 5. Notifications obsolètes (> 90 jours, lues)
    const { count: oldNotifications } = await supabase
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
    const { count: expiredOtp } = await supabase
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
    const { data: leasesWithoutSigners } = await supabase.rpc("count_leases_without_signers");
    report.push({
      type: "leases_no_signers",
      count: (leasesWithoutSigners as number) || 0,
      description: "Baux actifs sans aucun signataire",
      canAutoClean: false, // Nécessite révision manuelle
    });

    // 8. Dépôts de garantie incohérents
    const { data: inconsistentDeposits } = await supabase.rpc("count_inconsistent_deposits");
    report.push({
      type: "deposits_inconsistent",
      count: (inconsistentDeposits as number) || 0,
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
    const { error: authError, user, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const body = await request.json().catch(() => ({}));
    const { types = "all" } = body; // 'all' ou tableau de types spécifiques

    const results: { type: string; deleted: number }[] = [];

    // 1. Nettoyer les documents orphelins (lease_id invalide)
    if (types === "all" || types.includes("documents_lease_orphan")) {
      const { data: orphanDocs } = await supabase
        .from("documents")
        .select("id, storage_path, lease_id")
        .not("lease_id", "is", null);

      // Filtrer ceux dont le lease n'existe plus
      const { data: validLeases } = await supabase
        .from("leases")
        .select("id");

      const validLeaseIds = new Set((validLeases || []).map((l: any) => l.id));
      const docsToDelete = (orphanDocs || []).filter((d: any) => d.lease_id && !validLeaseIds.has(d.lease_id));

      if (docsToDelete.length > 0) {
        // Supprimer les fichiers du storage
        const storagePaths = docsToDelete.map((d: any) => d.storage_path).filter((p): p is string => Boolean(p));
        if (storagePaths.length > 0) {
          await supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).remove(storagePaths);
        }

        // Supprimer les entrées de la BDD
        const { error } = await supabase
          .from("documents")
          .delete()
          .in("id", docsToDelete.map((d: any) => d.id));

        if (!error) {
          results.push({ type: "documents_lease_orphan", deleted: docsToDelete.length });
        }
      }
    }

    // 2. Notifications obsolètes
    if (types === "all" || types.includes("notifications_old")) {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: oldNotifs, error } = await supabase
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
      const { data: expiredOtp, error } = await supabase
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
      const { data: fixed1 } = await supabase
        .from("leases")
        .update({ depot_de_garantie: supabase.rpc("", {}) as any })
        .eq("type_bail", "nu")
        .gt("depot_de_garantie", supabase.rpc("", {}) as any)
        .select("id");

      // Utiliser la fonction SQL directement
      const { data: fixedDeposits } = await supabase.rpc("fix_inconsistent_deposits");
      results.push({ type: "deposits_fixed", deleted: (fixedDeposits as number) || 0 });
    }

    // Calculer le total
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    // Log de l'action
    await supabase
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
