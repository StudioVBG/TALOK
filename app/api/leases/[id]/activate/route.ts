export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getInitialInvoiceSettlement } from "@/lib/services/invoice-status.service";

/**
 * POST /api/leases/[id]/activate
 *
 * Active un bail après vérification des conditions :
 * 1. Le bail doit être au statut "fully_signed"
 * 2. Un EDL d'entrée doit exister et être signé
 * 3. La facture initiale doit être intégralement payée
 * 4. La remise des clés doit être confirmée
 * 5. La date de début du bail doit être atteinte ou dépassée (optionnel mais recommandé)
 *
 * FLUX LÉGAL FRANÇAIS :
 * - Bail signé → EDL d'entrée → Paiement initial → Remise des clés → Bail actif
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;
  
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
    
    const body = await request.json().catch(() => ({}));
    const { skip_date_check = false } = body;

    if (!edl) {
      return NextResponse.json({
        error: "Aucun état des lieux d'entrée n'existe pour ce bail",
        hint: "Créez et faites signer l'EDL d'entrée avant d'activer le bail.",
      }, { status: 400 });
    }
    
    if (edl.status !== "signed") {
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
        hint: "Faites signer l'EDL avant d'activer le bail."
      }, { status: 400 });
    }

    // 6. Vérifier le paiement intégral de la facture initiale
    const initialInvoiceSettlement = await getInitialInvoiceSettlement(serviceClient as any, leaseId);
    if (!initialInvoiceSettlement?.invoice) {
      return NextResponse.json({
        error: "La facture initiale n'existe pas encore pour ce bail",
        hint: "Le bail doit générer une facture initiale avant activation.",
      }, { status: 400 });
    }

    if (!initialInvoiceSettlement.isSettled) {
      return NextResponse.json({
        error: "Le paiement initial n'est pas encore confirmé",
        invoice_status: initialInvoiceSettlement.status,
        total_paid: initialInvoiceSettlement.totalPaid,
        remaining: initialInvoiceSettlement.remaining,
        required_status: "paid",
      }, { status: 400 });
    }

    // 7. Vérifier la remise des clés
    const { data: handover } = await (serviceClient
      .from("key_handovers") as any)
      .select("id, confirmed_at")
      .eq("lease_id", leaseId)
      .not("confirmed_at", "is", null)
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!handover?.confirmed_at) {
      return NextResponse.json({
        error: "La remise des clés n'est pas encore confirmée",
        hint: "Confirmez la remise des clés pour finaliser l'activation du bail.",
      }, { status: 400 });
    }
    
    // 8. Vérifier la date de début (avertissement si dans le futur)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(lease.date_debut);
    
    let dateWarning = null;
    if (startDate > today && !skip_date_check) {
      dateWarning = `La date de début du bail (${lease.date_debut}) est dans le futur. L'activation anticipée est possible mais inhabituelle.`;
    }
    
    // 9. Activer le bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: "active",
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", leaseId);
    
    if (updateError) {
      throw updateError;
    }

    // 10. Créer un événement dans l'outbox
    await serviceClient.from("outbox").insert({
      event_type: "Lease.Activated",
      payload: {
        lease_id: leaseId,
        activated_by: profile.id,
        activated_at: new Date().toISOString(),
        edl_present: !!edl,
        edl_signed: edl?.status === "signed",
        initial_invoice_id: initialInvoiceSettlement.invoice.id,
        initial_payment_confirmed: true,
        key_handover_id: handover.id,
        key_handover_confirmed: true,
      }
    });

    // 11. Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_activated",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        previous_status: lease.statut,
        new_status: "active",
        edl_id: edl?.id || null,
        initial_invoice_id: initialInvoiceSettlement.invoice.id,
        key_handover_id: handover.id,
      }
    });
    
    // ✅ SOTA 2026: Invalider le cache ISR pour refléter le statut "Loué" sur la page propriété
    const activatedPropertyId = property?.id;
    if (activatedPropertyId) {
      revalidatePath(`/owner/properties/${activatedPropertyId}`);
      revalidatePath("/owner/properties");
    }
    revalidatePath("/owner/leases");

    const warnings = [dateWarning].filter(Boolean);

    return NextResponse.json({
      success: true,
      message: "Bail activé avec succès",
      lease_id: leaseId,
      new_status: "active",
      edl_status: edl?.status || null,
      ...(warnings.length > 0 ? { warnings } : {})
    });
    
  } catch (error: unknown) {
    console.error("[Activate Lease] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/[id]/activate
 *
 * Vérifie si le bail peut être activé et retourne les conditions manquantes
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;
  
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
    
    const initialInvoiceSettlement = await getInitialInvoiceSettlement(serviceClient as any, leaseId);
    const { data: handover } = await (serviceClient
      .from("key_handovers") as any)
      .select("id, confirmed_at")
      .eq("lease_id", leaseId)
      .not("confirmed_at", "is", null)
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Analyser les conditions
    const conditions = {
      bail_signe: lease.statut === "fully_signed",
      edl_existe: !!edl,
      edl_signe: edl?.status === "signed",
      paiement_initial_existe: !!initialInvoiceSettlement?.invoice,
      paiement_initial_confirme: initialInvoiceSettlement?.isSettled ?? false,
      remise_cles_confirmee: !!handover?.confirmed_at,
      date_debut_atteinte: new Date(lease.date_debut) <= new Date(),
      toutes_signatures: signers?.every((s: any) => s.signature_status === "signed") || false
    };
    
    const canActivate =
      conditions.bail_signe &&
      conditions.edl_signe &&
      conditions.paiement_initial_confirme &&
      conditions.remise_cles_confirmee;
    
    const missingConditions: string[] = [];
    if (!conditions.bail_signe) {
      missingConditions.push("Le bail n'est pas entièrement signé");
    }
    if (!conditions.edl_existe) {
      missingConditions.push("Aucun état des lieux d'entrée n'a été créé");
    } else if (!conditions.edl_signe) {
      missingConditions.push(`L'état des lieux d'entrée n'est pas signé (statut: ${edl?.status})`);
    }
    if (!conditions.paiement_initial_existe) {
      missingConditions.push("La facture initiale n'existe pas encore");
    } else if (!conditions.paiement_initial_confirme) {
      missingConditions.push("Le paiement initial n'est pas intégralement confirmé");
    }
    if (!conditions.remise_cles_confirmee) {
      missingConditions.push("La remise des clés n'est pas encore confirmée");
    }
    if (!conditions.date_debut_atteinte) {
      missingConditions.push(`La date de début (${lease.date_debut}) n'est pas encore atteinte`);
    }
    
    return NextResponse.json({
      lease_id: leaseId,
      current_status: lease.statut,
      can_activate: canActivate,
      conditions,
      missing_conditions: missingConditions,
      initial_invoice: initialInvoiceSettlement
        ? {
            status: initialInvoiceSettlement.status,
            total_paid: initialInvoiceSettlement.totalPaid,
            remaining: initialInvoiceSettlement.remaining,
          }
        : null,
      key_handover: handover
        ? {
            id: handover.id,
            confirmed_at: handover.confirmed_at,
          }
        : null,
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
    
  } catch (error: unknown) {
    console.error("[Check Activation] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
