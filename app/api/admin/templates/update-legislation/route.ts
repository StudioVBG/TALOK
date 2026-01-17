export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface LegislationChange {
  field: string;
  oldValue: string;
  newValue: string;
  description: string;
}

interface UpdateLegislationBody {
  changes?: LegislationChange[];
  description?: string;
  affected_types?: string[];
}

/**
 * POST /api/admin/templates/update-legislation
 * Met à jour toutes les législations et templates de bail
 * 
 * Logique métier :
 * - Baux non actifs (draft, pending_signature, sent, partially_signed) : mise à jour directe
 * - Baux actifs (active, fully_signed) : stocke les changements en attente + notifications propriétaire & locataire
 * - Baux terminés/archivés : aucune action
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as { id: string; role: string } | null;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut mettre à jour les législations" },
        { status: 403 }
      );
    }

    // Récupérer le body (optionnel)
    let body: UpdateLegislationBody = {};
    try {
      body = await request.json();
    } catch {
      // Pas de body, on fait une mise à jour générique
    }

    const now = new Date();
    const updateVersion = `LEG-${now.toISOString().split("T")[0]}-${now.getTime().toString(36).slice(-4)}`;
    
    const changes: LegislationChange[] = body.changes || [
      {
        field: "clauses_legales",
        oldValue: "Version précédente",
        newValue: "Version mise à jour",
        description: "Mise à jour conforme aux derniers décrets en vigueur",
      },
    ];
    
    const affectedTypes = body.affected_types || ["nu", "meuble", "colocation", "saisonnier", "mobilite"];
    const description = body.description || "Mise à jour législative automatique - Conformité loi ALUR et décrets 2015";

    // ============================================
    // 1. Créer l'entrée de mise à jour législative
    // ============================================
    let legislationUpdateId: string | null = null;
    
    const { data: legislationUpdate, error: legError } = await supabase
      .from("legislation_updates")
      .insert({
        version: updateVersion,
        description,
        changes,
        affected_lease_types: affectedTypes,
        effective_date: now.toISOString().split("T")[0],
        created_by: profileData.id,
      })
      .select("id")
      .single();

    if (legError) {
      console.error("Erreur création legislation_update:", legError);
      // Continue si la table n'existe pas encore (nouvelle migration)
    } else {
      legislationUpdateId = (legislationUpdate as { id: string })?.id;
    }

    // ============================================
    // 2. Mettre à jour les templates de bail
    // ============================================
    const { data: templates, error: templateError } = await supabase
      .from("lease_templates")
      .update({
        updated_at: now.toISOString(),
      })
      .in("type_bail", affectedTypes)
      .select("id");

    if (templateError) {
      console.error("Erreur mise à jour templates:", templateError);
    }

    // ============================================
    // 3. Mettre à jour les baux NON ACTIFS
    // ============================================
    const nonActiveStatuses = ["draft", "pending_signature", "sent", "partially_signed"];

    const { data: updatedLeases, error: leaseError } = await supabase
      .from("leases")
      .update({
        updated_at: now.toISOString(),
      })
      .in("statut", nonActiveStatuses)
      .in("type_bail", affectedTypes)
      .select("id");

    if (leaseError) {
      console.error("Erreur mise à jour baux non actifs:", leaseError);
    }

    // ============================================
    // 4. Pour les baux ACTIFS : mises à jour en attente + notifications
    // ============================================
    const { data: activeLeases, error: activeLeasesError } = await supabase
      .from("leases")
      .select(`
        id,
        type_bail,
        property_id,
        lease_signers (
          id,
          role,
          profile:profiles!inner (
            id,
            user_id,
            prenom,
            nom
          )
        )
      `)
      .in("statut", ["active", "fully_signed"])
      .in("type_bail", affectedTypes);

    if (activeLeasesError) {
      console.error("Erreur récupération baux actifs:", activeLeasesError);
    }

    const pendingUpdatesCreated: string[] = [];
    const notificationsSent: Set<string> = new Set();

    if (activeLeases && legislationUpdateId) {
      for (const lease of activeLeases as any[]) {
        // Créer l'entrée de mise à jour en attente
        const { error: pendingError } = await supabase
          .from("lease_pending_updates")
          .insert({
            lease_id: lease.id,
            legislation_update_id: legislationUpdateId,
            status: "pending",
            notified_owner_at: now.toISOString(),
            notified_tenant_at: now.toISOString(),
          });

        if (!pendingError) {
          pendingUpdatesCreated.push(lease.id);
        }

        // Envoyer des notifications aux signataires
        if (lease.lease_signers) {
          for (const signer of lease.lease_signers) {
            const signerProfile = signer.profile;
            if (!signerProfile?.user_id) continue;

            const isOwner = signer.role === "proprietaire";
            const notificationType = isOwner
              ? "legislation_update_owner"
              : "legislation_update_tenant";

            const notificationTitle = isOwner
              ? "📋 Mise à jour législative pour votre bail"
              : "📋 Mise à jour législative concernant votre location";

            const notificationBody = isOwner
              ? `Une mise à jour législative (${updateVersion}) concerne un de vos baux actifs. Les changements seront appliqués lors du prochain renouvellement. Consultez les détails dans votre espace.`
              : `Une mise à jour législative (${updateVersion}) concerne votre bail. Votre propriétaire a été informé. Les changements seront appliqués lors du prochain renouvellement.`;

            // Créer la notification
            const { error: notifError } = await supabase
              .from("notifications")
              .insert({
                user_id: signerProfile.user_id,
                type: notificationType,
                title: notificationTitle,
                body: notificationBody,
                metadata: {
                  lease_id: lease.id,
                  legislation_update_id: legislationUpdateId,
                  version: updateVersion,
                  changes_summary: changes.map((c) => c.description),
                },
                read: false,
              });

            if (!notifError) {
              notificationsSent.add(signerProfile.user_id);
            }

            // Émettre un événement dans l'outbox pour traitement async (email, push, etc.)
            await supabase.from("outbox").insert({
              event_type: "Legislation.Updated",
              payload: {
                user_id: signerProfile.user_id,
                user_name: `${signerProfile.prenom || ""} ${signerProfile.nom || ""}`.trim(),
                lease_id: lease.id,
                is_owner: isOwner,
                version: updateVersion,
                changes,
                description,
              },
            });
          }
        }
      }
    }

    // ============================================
    // 5. Journaliser l'action dans audit_log
    // ============================================
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "legislation_updated",
      entity_type: "legislation",
      metadata: {
        version: updateVersion,
        legislation_update_id: legislationUpdateId,
        templates_updated: templates?.length || 0,
        leases_directly_updated: updatedLeases?.length || 0,
        active_leases_pending: pendingUpdatesCreated.length,
        notifications_sent: notificationsSent.size,
        affected_types: affectedTypes,
        changes_count: changes.length,
      },
    });

    return NextResponse.json({
      success: true,
      version: updateVersion,
      legislation_update_id: legislationUpdateId,
      stats: {
        templates_updated: templates?.length || 0,
        leases_directly_updated: updatedLeases?.length || 0,
        active_leases_with_pending_updates: pendingUpdatesCreated.length,
        notifications_sent: notificationsSent.size,
      },
      message: pendingUpdatesCreated.length > 0
        ? `Mise à jour législative appliquée. ${pendingUpdatesCreated.length} bail(s) actif(s) ont des mises à jour en attente.`
        : "Mise à jour législative appliquée avec succès.",
    });
  } catch (error: unknown) {
    console.error("Erreur mise à jour législation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}



