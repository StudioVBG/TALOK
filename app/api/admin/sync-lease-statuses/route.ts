export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfOrCronSecret, logCsrfFailure } from "@/lib/security/csrf";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Synchronise les statuts des baux ayant toutes les signatures mais dont le statut n'a pas été mis à jour
 * @usage POST /api/admin/sync-lease-statuses
 */
export async function POST(request: Request) {
  try {
    const check = await validateCsrfOrCronSecret(request);
    if (!check.valid) {
      await logCsrfFailure(request, check.reason!, "admin.maintenance.sync-lease-statuses");
      return NextResponse.json({ error: "CSRF ou cron secret requis" }, { status: 403 });
    }

    const auth = await requireAdminPermissions(request, ["admin.properties.write"], {
      rateLimit: "adminCritical",
      auditAction: "sync-lease-statuses",
    });
    if (isAdminAuthError(auth)) return auth;

    const serviceClient = getServiceClient();

    // Récupérer les baux concernés (admin has access to all)
    const query = serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        property_id,
        properties!inner(owner_id)
      `)
      .in("statut", ["pending_signature", "partially_signed", "sent", "draft"]);

    const { data: leases, error: leasesError } = await query;

    if (leasesError) {
      console.error("[sync-lease-statuses] Erreur récupération baux:", leasesError);
      return NextResponse.json({ error: "Erreur lors de la récupération des baux" }, { status: 500 });
    }

    const results = {
      checked: 0,
      fixed: 0,
      details: [] as Array<{ id: string; oldStatus: string; newStatus: string }>,
    };

    for (const lease of leases || []) {
      results.checked++;

      // Vérifier les signataires
      const { data: signers } = await serviceClient
        .from("lease_signers")
        .select("role, signature_status")
        .eq("lease_id", lease.id);

      if (!signers || signers.length === 0) {
        continue;
      }

      const allSigned = signers.every((s: any) => s.signature_status === "signed");
      const ownerSigned = signers.find((s: any) => s.role === "proprietaire")?.signature_status === "signed";
      const tenantSigned = signers.some(
        (s: any) => ["locataire_principal", "colocataire"].includes(s.role) && s.signature_status === "signed"
      );

      let newStatus: string | null = null;

      if (allSigned) {
        newStatus = "fully_signed";
      } else if (ownerSigned && tenantSigned) {
        // Au moins une signature de chaque côté mais pas tout le monde
        newStatus = "partially_signed";
      } else if (tenantSigned && !ownerSigned) {
        newStatus = "pending_signature"; // Attente propriétaire
      } else if (ownerSigned && !tenantSigned) {
        newStatus = "pending_signature"; // Attente locataire
      }

      // Mettre à jour si le statut a changé
      if (newStatus && newStatus !== lease.statut) {
        const { error: updateError } = await serviceClient
          .from("leases")
          .update({ statut: newStatus })
          .eq("id", lease.id);

        if (!updateError) {
          results.fixed++;
          results.details.push({
            id: lease.id,
            oldStatus: lease.statut,
            newStatus: newStatus,
          });
        } else {
          console.error(`❌ Erreur correction bail ${lease.id}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.fixed} bail(s) corrigé(s) sur ${results.checked} vérifié(s)`,
      ...results,
    });

  } catch (error: unknown) {
    console.error("[sync-lease-statuses] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-lease-statuses
 * 
 * Vérifie les baux qui pourraient avoir un statut incorrect (preview sans modification)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.properties.write"], {
      rateLimit: "adminCritical",
    });
    if (isAdminAuthError(auth)) return auth;

    const serviceClient = getServiceClient();

    // Récupérer les baux concernés (admin has access to all)
    const query = serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        property_id,
        properties!inner(owner_id, adresse_complete)
      `)
      .in("statut", ["pending_signature", "partially_signed", "sent", "draft"]);

    const { data: leases } = await query;

    const issues = [];

    for (const lease of leases || []) {
      const { data: signers } = await serviceClient
        .from("lease_signers")
        .select("role, signature_status, signed_at")
        .eq("lease_id", lease.id);

      if (!signers || signers.length === 0) continue;

      const allSigned = signers.every((s: any) => s.signature_status === "signed");
      
      if (allSigned && lease.statut !== "fully_signed") {
        issues.push({
          lease_id: lease.id,
          current_status: lease.statut,
          expected_status: "fully_signed",
          address: (lease as any).properties?.adresse_complete,
          signers: signers.map((s: any) => ({
            role: s.role,
            status: s.signature_status,
            signed_at: s.signed_at,
          })),
        });
      }
    }

    return NextResponse.json({
      issues_count: issues.length,
      issues,
      message: issues.length > 0 
        ? `${issues.length} bail(s) avec un statut incorrect détecté(s). Utilisez POST pour corriger.`
        : "Tous les baux ont un statut correct.",
    });

  } catch (error: unknown) {
    console.error("[sync-lease-statuses] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

