export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * POST /api/leases/[id]/activate
 * 
 * Active un bail après vérification des conditions :
 * 1. Le bail doit être au statut "fully_signed"
 * 2. Un EDL d'entrée doit exister et être signé
 * 3. La date de début du bail doit être atteinte ou dépassée (optionnel mais recommandé)
 * 
 * FLUX LÉGAL FRANÇAIS :
 * - Bail signé → EDL d'entrée → Remise des clés → Bail actif
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leaseId = params.id;
  
  try {
    // Auth client pour vérifier l'utilisateur
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    // Service client pour les opérations
    const serviceClient = getServiceClient();
    
    // 1. Récupérer le profil de l'utilisateur
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }
    
    // 2. Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        date_debut,
        property_id,
        unit_id,
        properties!leases_property_id_fkey (
          id,
          owner_id
        )
      `)
      .eq("id", leaseId)
      .single();
    
    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }
    
    // 3. Vérifier les droits (propriétaire uniquement)
    const property = (lease as any).properties;
    if (profile.role !== "owner" || property?.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut activer le bail" },
        { status: 403 }
      );
    }
    
    // 4. Vérifier le statut actuel du bail
    if (lease.statut !== "fully_signed") {
      const statusMessages: Record<string, string> = {
        draft: "Le bail est encore en brouillon",
        sent: "Le bail a été envoyé mais pas encore signé",
        pending_signature: "Le bail attend des signatures",
        partially_signed: "Toutes les parties n'ont pas encore signé",
        active: "Le bail est déjà actif",
        terminated: "Le bail est terminé",
        archived: "Le bail est archivé",
      };
      
      return NextResponse.json({
        error: statusMessages[lease.statut] || `Le bail doit être entièrement signé (statut actuel: ${lease.statut})`,
        current_status: lease.statut,
        required_status: "fully_signed"
      }, { status: 400 });
    }
    
    // 5. Vérifier l'EDL d'entrée
    const { data: edl, error: edlError } = await serviceClient
      .from("edl")
      .select("id, type, status, completed_date")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .single();
    
    // Options selon le body de la requête
    const body = await request.json().catch(() => ({}));
    const { force_without_edl = false, skip_date_check = false } = body;
    
    if (!edl && !force_without_edl) {
      return NextResponse.json({
        error: "Aucun état des lieux d'entrée n'existe pour ce bail",
        hint: "Créez un EDL d'entrée avant d'activer le bail, ou utilisez force_without_edl: true",
        can_force: true
      }, { status: 400 });
    }
    
    if (edl && edl.status !== "signed" && !force_without_edl) {
      const edlStatusMessages: Record<string, string> = {
        draft: "L'EDL d'entrée est en brouillon",
        in_progress: "L'EDL d'entrée est en cours",
        completed: "L'EDL d'entrée est complété mais pas signé",
        disputed: "L'EDL d'entrée est contesté",
      };
      
      return NextResponse.json({
        error: edlStatusMessages[edl.status] || `L'EDL d'entrée doit être signé (statut actuel: ${edl.status})`,
        edl_status: edl.status,
        required_edl_status: "signed",
        can_force: true,
        hint: "Faites signer l'EDL, ou utilisez force_without_edl: true"
      }, { status: 400 });
    }
    
    // 6. Vérifier la date de début (avertissement si dans le futur)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(lease.date_debut);
    
    let dateWarning = null;
    if (startDate > today && !skip_date_check) {
      dateWarning = `La date de début du bail (${lease.date_debut}) est dans le futur. L'activation anticipée est possible mais inhabituelle.`;
    }
    
    // 7. Activer le bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: "active",
        updated_at: new Date().toISOString()
      })
      .eq("id", leaseId);
    
    if (updateError) {
      throw updateError;
    }
    
    // 8. Créer un événement dans l'outbox
    await serviceClient.from("outbox").insert({
      event_type: "Lease.Activated",
      payload: {
        lease_id: leaseId,
        activated_by: profile.id,
        activated_at: new Date().toISOString(),
        edl_present: !!edl,
        edl_signed: edl?.status === "signed",
        forced: force_without_edl
      }
    }).catch(() => {}); // Non bloquant
    
    // 9. Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_activated",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        previous_status: lease.statut,
        new_status: "active",
        edl_id: edl?.id || null,
        forced: force_without_edl
      }
    }).catch(() => {}); // Non bloquant
    
    return NextResponse.json({
      success: true,
      message: "Bail activé avec succès",
      lease_id: leaseId,
      new_status: "active",
      edl_status: edl?.status || null,
      warning: dateWarning
    });
    
  } catch (error: any) {
    console.error("[Activate Lease] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/[id]/activate
 * 
 * Vérifie si le bail peut être activé et retourne les conditions manquantes
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leaseId = params.id;
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    const serviceClient = getServiceClient();
    
    // Récupérer le bail
    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        date_debut,
        date_fin,
        type_bail
      `)
      .eq("id", leaseId)
      .single();
    
    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }
    
    // Récupérer l'EDL d'entrée s'il existe
    const { data: edl } = await serviceClient
      .from("edl")
      .select("id, type, status, scheduled_date, completed_date")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .maybeSingle();
    
    // Récupérer les signatures
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("role, signature_status")
      .eq("lease_id", leaseId);
    
    // Analyser les conditions
    const conditions = {
      bail_signe: lease.statut === "fully_signed",
      edl_existe: !!edl,
      edl_signe: edl?.status === "signed",
      date_debut_atteinte: new Date(lease.date_debut) <= new Date(),
      toutes_signatures: signers?.every((s: any) => s.signature_status === "signed") || false
    };
    
    const canActivate = conditions.bail_signe && conditions.edl_signe;
    const canForceActivate = conditions.bail_signe; // Force si au moins signé
    
    const missingConditions: string[] = [];
    if (!conditions.bail_signe) {
      missingConditions.push("Le bail n'est pas entièrement signé");
    }
    if (!conditions.edl_existe) {
      missingConditions.push("Aucun état des lieux d'entrée n'a été créé");
    } else if (!conditions.edl_signe) {
      missingConditions.push(`L'état des lieux d'entrée n'est pas signé (statut: ${edl?.status})`);
    }
    if (!conditions.date_debut_atteinte) {
      missingConditions.push(`La date de début (${lease.date_debut}) n'est pas encore atteinte`);
    }
    
    return NextResponse.json({
      lease_id: leaseId,
      current_status: lease.statut,
      can_activate: canActivate,
      can_force_activate: canForceActivate,
      conditions,
      missing_conditions: missingConditions,
      edl: edl ? {
        id: edl.id,
        status: edl.status,
        scheduled_date: edl.scheduled_date,
        completed_date: edl.completed_date
      } : null,
      signatures: signers?.map((s: any) => ({
        role: s.role,
        signed: s.signature_status === "signed"
      })) || []
    });
    
  } catch (error: any) {
    console.error("[Check Activation] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
