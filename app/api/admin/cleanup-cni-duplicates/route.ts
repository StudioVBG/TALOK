export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfOrCronSecret, logCsrfFailure } from "@/lib/security/csrf";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Nettoie les doublons de CNI en archivant les anciennes versions (garde le plus récent par lease_id+type)
 * @usage POST /api/admin/cleanup-cni-duplicates
 */
export async function POST(request: Request) {
  try {
    const check = await validateCsrfOrCronSecret(request);
    if (!check.valid) {
      await logCsrfFailure(request, check.reason!, "admin.maintenance.cleanup-cni-duplicates");
      return NextResponse.json({ error: "CSRF ou cron secret requis" }, { status: 403 });
    }

    const auth = await requireAdminPermissions(request, ["admin.compliance.write"], {
      rateLimit: "adminCritical",
      auditAction: "cleanup-cni-duplicates",
    });
    if (isAdminAuthError(auth)) return auth;

    const serviceClient = getServiceClient();

    // 1. Trouver les doublons
    // Si owner : filtrer par ses propriétés uniquement
    let query = serviceClient
      .from("documents")
      .select("id, lease_id, type, created_at, is_archived, owner_id")
      .in("type", ["cni_recto", "cni_verso"])
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    // Admin has access to all documents (RBAC enforced)

    const { data: allCniDocs, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    // 2. Grouper par (lease_id, type)
    const groups = new Map<string, typeof allCniDocs>();
    for (const doc of allCniDocs || []) {
      const key = `${doc.lease_id}:${doc.type}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(doc);
    }

    // 3. Identifier les doublons (tous sauf le plus récent)
    const toArchive: string[] = [];
    const latestDocs = new Map<string, string>(); // key -> latest doc id

    for (const [key, docs] of groups.entries()) {
      if (docs.length > 1) {
        // Le premier est le plus récent (trié DESC)
        const [latest, ...duplicates] = docs;
        latestDocs.set(key, latest.id);
        
        for (const dup of duplicates) {
          toArchive.push(dup.id);
        }
      }
    }

    if (toArchive.length === 0) {
      return NextResponse.json({
        message: "Aucun doublon trouvé",
        archived: 0,
        total: allCniDocs?.length || 0,
      });
    }

    // 4. Archiver les doublons
    const { error: archiveError } = await serviceClient
      .from("documents")
      .update({ 
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", toArchive);

    if (archiveError) {
      throw archiveError;
    }

    // 5. Mettre à jour replaced_by
    for (const [key, latestId] of latestDocs.entries()) {
      const [leaseId, type] = key.split(":");
      await serviceClient
        .from("documents")
        .update({ replaced_by: latestId })
        .eq("lease_id", leaseId)
        .eq("type", type)
        .eq("is_archived", true)
        .is("replaced_by", null);
    }

    // 6. Compter les documents restants
    const { count: remainingCount } = await serviceClient
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("type", ["cni_recto", "cni_verso"])
      .eq("is_archived", false);

    return NextResponse.json({
      message: `${toArchive.length} doublons archivés`,
      archived: toArchive.length,
      remaining: remainingCount || 0,
      details: {
        archivedIds: toArchive,
        groupsProcessed: groups.size,
      },
    });

  } catch (error: unknown) {
    console.error("[Cleanup CNI] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cleanup-cni-duplicates
 * 
 * Affiche les statistiques des doublons sans les modifier
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.compliance.write"], {
      rateLimit: "adminCritical",
    });
    if (isAdminAuthError(auth)) return auth;

    const serviceClient = getServiceClient();

    // Compter les documents par type et statut
    let statsQuery = serviceClient
      .from("documents")
      .select("type, is_archived, owner_id")
      .in("type", ["cni_recto", "cni_verso"]);

    // Admin has access to all documents (RBAC enforced)

    const { data: stats } = await statsQuery;

    const summary = {
      cni_recto: { active: 0, archived: 0 },
      cni_verso: { active: 0, archived: 0 },
    };

    for (const doc of stats || []) {
      const type = doc.type as keyof typeof summary;
      if (summary[type]) {
        if (doc.is_archived) {
          summary[type].archived++;
        } else {
          summary[type].active++;
        }
      }
    }

    // Trouver les doublons potentiels
    let activeQuery = serviceClient
      .from("documents")
      .select("lease_id, type, owner_id")
      .in("type", ["cni_recto", "cni_verso"])
      .eq("is_archived", false);

    // Admin has access to all documents (RBAC enforced)

    const { data: allActive } = await activeQuery;

    const duplicateGroups = new Map<string, number>();
    for (const doc of allActive || []) {
      const key = `${doc.lease_id}:${doc.type}`;
      duplicateGroups.set(key, (duplicateGroups.get(key) || 0) + 1);
    }

    const duplicatesCount = Array.from(duplicateGroups.values()).filter(v => v > 1).length;

    return NextResponse.json({
      summary,
      total: stats?.length || 0,
      duplicateGroups: duplicatesCount,
      message: duplicatesCount > 0 
        ? `${duplicatesCount} groupe(s) avec doublons détecté(s)` 
        : "Aucun doublon détecté",
    });

  } catch (error: unknown) {
    console.error("[Cleanup CNI Stats] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

