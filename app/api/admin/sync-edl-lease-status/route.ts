import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/sync-edl-lease-status
 * Synchronise les statuts des EDL et des baux basés sur les signatures réelles
 * 
 * Cette route corrige les incohérences où :
 * - Un EDL a toutes les signatures mais reste en "draft" ou "in_progress"
 * - Un bail a son EDL d'entrée signé mais reste en "fully_signed" au lieu de "active"
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que c'est un admin ou owner
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const results = {
      edlsUpdated: 0,
      leasesActivated: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    // 1. Trouver tous les EDL avec signatures complètes mais pas en statut "signed"
    const { data: edlsToFix, error: edlError } = await supabase
      .from("edl")
      .select(`
        id,
        status,
        type,
        lease_id,
        edl_signatures (
          id,
          signer_role,
          signature_image_path,
          signed_at
        )
      `)
      .neq("status", "signed");

    if (edlError) {
      console.error("[sync-edl-lease-status] Erreur récupération EDL:", edlError);
      results.errors.push(`Erreur EDL: ${edlError.message}`);
    }

    // Parcourir les EDL et vérifier les signatures
    for (const edl of edlsToFix || []) {
      const signatures = (edl as any).edl_signatures || [];
      
      const hasOwnerSignature = signatures.some((s: any) => 
        ["owner", "proprietaire", "bailleur"].includes(s.signer_role) &&
        s.signature_image_path &&
        s.signed_at
      );
      
      const hasTenantSignature = signatures.some((s: any) => 
        ["tenant", "locataire", "locataire_principal"].includes(s.signer_role) &&
        s.signature_image_path &&
        s.signed_at
      );

      if (hasOwnerSignature && hasTenantSignature) {
        // Mettre à jour le statut de l'EDL
        const { error: updateError } = await supabase
          .from("edl")
          .update({
            status: "signed",
            completed_date: new Date().toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", edl.id);

        if (updateError) {
          results.errors.push(`Erreur mise à jour EDL ${edl.id}: ${updateError.message}`);
        } else {
          results.edlsUpdated++;
          results.details.push({
            type: "edl_updated",
            edl_id: edl.id,
            old_status: edl.status,
            new_status: "signed",
          });

          // Si c'est un EDL d'entrée, activer le bail
          if (edl.type === "entree" && edl.lease_id) {
            const { data: lease } = await supabase
              .from("leases")
              .select("statut")
              .eq("id", edl.lease_id)
              .single();

            if (lease && lease.statut !== "active") {
              const { error: leaseError } = await supabase
                .from("leases")
                .update({
                  statut: "active",
                  activated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as any)
                .eq("id", edl.lease_id);

              if (leaseError) {
                results.errors.push(`Erreur activation bail ${edl.lease_id}: ${leaseError.message}`);
              } else {
                results.leasesActivated++;
                results.details.push({
                  type: "lease_activated",
                  lease_id: edl.lease_id,
                  old_status: lease.statut,
                  new_status: "active",
                  triggered_by_edl: edl.id,
                });

                // Émettre un événement pour générer la première facture
                await supabase.from("outbox").insert({
                  event_type: "Lease.Activated",
                  payload: {
                    lease_id: edl.lease_id,
                    edl_id: edl.id,
                    action: "generate_initial_invoice",
                    synced_at: new Date().toISOString(),
                  },
                } as any);
              }
            }
          }
        }
      }
    }

    // 2. Vérifier s'il y a des baux "fully_signed" avec EDL d'entrée signé
    const { data: leasesToActivate } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
        edl!inner (
          id,
          type,
          status
        )
      `)
      .in("statut", ["fully_signed", "pending_signature", "partially_signed"])
      .eq("edl.type", "entree")
      .eq("edl.status", "signed");

    for (const lease of leasesToActivate || []) {
      // Éviter les doublons (déjà traité ci-dessus)
      if (results.details.some(d => d.type === "lease_activated" && d.lease_id === lease.id)) {
        continue;
      }

      const { error: activateError } = await supabase
        .from("leases")
        .update({
          statut: "active",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", lease.id);

      if (activateError) {
        results.errors.push(`Erreur activation bail ${lease.id}: ${activateError.message}`);
      } else {
        results.leasesActivated++;
        results.details.push({
          type: "lease_activated",
          lease_id: lease.id,
          old_status: lease.statut,
          new_status: "active",
          triggered_by_edl: (lease as any).edl?.[0]?.id,
        });
      }
    }

    // Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "sync_edl_lease_status",
      entity_type: "system",
      entity_id: null,
      metadata: {
        edls_updated: results.edlsUpdated,
        leases_activated: results.leasesActivated,
        errors_count: results.errors.length,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: `Synchronisation terminée: ${results.edlsUpdated} EDL(s) mis à jour, ${results.leasesActivated} bail(s) activé(s)`,
      ...results,
    });

  } catch (error: any) {
    console.error("[sync-edl-lease-status] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-edl-lease-status
 * Affiche le rapport des incohérences sans les corriger
 */
export async function GET(request: Request) {
  try {
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

    if (!profile || !["admin", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Trouver les incohérences
    const { data: edls } = await supabase
      .from("edl")
      .select(`
        id,
        status,
        type,
        lease_id,
        lease:leases (
          id,
          statut
        ),
        edl_signatures (
          signer_role,
          signature_image_path,
          signed_at
        )
      `)
      .neq("status", "signed");

    const inconsistencies = [];

    for (const edl of edls || []) {
      const signatures = (edl as any).edl_signatures || [];
      
      const hasOwner = signatures.some((s: any) => 
        ["owner", "proprietaire", "bailleur"].includes(s.signer_role) &&
        s.signature_image_path && s.signed_at
      );
      
      const hasTenant = signatures.some((s: any) => 
        ["tenant", "locataire", "locataire_principal"].includes(s.signer_role) &&
        s.signature_image_path && s.signed_at
      );

      if (hasOwner && hasTenant) {
        inconsistencies.push({
          edl_id: edl.id,
          edl_status: edl.status,
          edl_type: edl.type,
          lease_id: edl.lease_id,
          lease_status: (edl as any).lease?.statut,
          has_owner_signature: hasOwner,
          has_tenant_signature: hasTenant,
          issue: "EDL avec signatures complètes mais statut non 'signed'",
          fix: "POST sur cette route pour corriger",
        });
      }
    }

    // Baux avec EDL signé mais pas actifs
    const { data: leases } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
        edl (
          id,
          type,
          status
        )
      `)
      .in("statut", ["fully_signed", "pending_signature", "partially_signed"]);

    for (const lease of leases || []) {
      const signedEntryEdl = ((lease as any).edl || []).find(
        (e: any) => e.type === "entree" && e.status === "signed"
      );
      
      if (signedEntryEdl) {
        inconsistencies.push({
          lease_id: lease.id,
          lease_status: lease.statut,
          edl_id: signedEntryEdl.id,
          edl_status: signedEntryEdl.status,
          issue: "Bail avec EDL d'entrée signé mais pas activé",
          fix: "POST sur cette route pour corriger",
        });
      }
    }

    return NextResponse.json({
      total_inconsistencies: inconsistencies.length,
      inconsistencies,
      action: inconsistencies.length > 0 
        ? "Utilisez POST /api/admin/sync-edl-lease-status pour corriger automatiquement"
        : "Aucune incohérence détectée",
    });

  } catch (error: any) {
    console.error("[sync-edl-lease-status] Erreur GET:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

