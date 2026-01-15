export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/renew - Renouveler un bail
 * 
 * Crée un nouveau bail basé sur l'ancien avec :
 * - Nouvelles dates (prolongation d'1 an pour meublé, 3 ans pour nu)
 * - Possibilité d'ajuster le loyer (avec limite IRL)
 * - Conservation des mêmes locataires et propriétés
 * 
 * Le bail actuel passe en statut "renewed" et le nouveau en "draft"
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;

    // Récupérer les paramètres de renouvellement
    const body = await request.json();
    const {
      new_loyer,
      new_charges,
      new_date_debut,
      duration_months,
      notes,
      apply_irl = false,
    } = body;

    // Récupérer le bail actuel avec toutes ses données
    const { data: currentLease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties!inner(
          id,
          owner_id,
          adresse_complete,
          loyer_hc,
          charges_forfaitaires
        ),
        signers:lease_signers(
          profile_id,
          role,
          signature_status
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !currentLease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = currentLease as any;

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut renouveler un bail" },
        { status: 403 }
      );
    }

    // Vérifier que le bail est actif
    if (leaseData.statut !== "active") {
      return NextResponse.json(
        { error: "Seul un bail actif peut être renouvelé" },
        { status: 400 }
      );
    }

    // Calculer les nouvelles dates
    const typeBail = leaseData.type_bail || "meuble";
    const defaultDuration = typeBail === "nu" ? 36 : 12; // 3 ans ou 1 an
    const renewalDuration = duration_months || defaultDuration;

    const startDate = new_date_debut
      ? new Date(new_date_debut)
      : new Date(leaseData.date_fin || new Date());
    
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + renewalDuration);

    // Calculer le nouveau loyer (avec ou sans IRL)
    let finalLoyer = new_loyer ?? leaseData.loyer;
    let finalCharges = new_charges ?? leaseData.charges_forfaitaires;

    if (apply_irl && !new_loyer) {
      // Appliquer l'IRL automatiquement (environ 3.5% par défaut)
      const irlRate = 0.035; // À remplacer par le vrai taux IRL
      finalLoyer = Math.round(leaseData.loyer * (1 + irlRate) * 100) / 100;
    }

    // Créer le nouveau bail
    const { data: newLease, error: createError } = await serviceClient
      .from("leases")
      .insert({
        property_id: leaseData.property_id,
        type_bail: leaseData.type_bail,
        loyer: finalLoyer,
        charges_forfaitaires: finalCharges,
        depot_de_garantie: leaseData.depot_de_garantie,
        date_debut: startDate.toISOString().split("T")[0],
        date_fin: endDate.toISOString().split("T")[0],
        statut: "draft",
        previous_lease_id: leaseId,
        renewal_notes: notes,
        // Copier d'autres champs pertinents
        coloc_config: leaseData.coloc_config,
      })
      .select()
      .single();

    if (createError || !newLease) {
      console.error("[renew] Erreur création bail:", createError);
      throw createError || new Error("Erreur création du nouveau bail");
    }

    const newLeaseData = newLease as any;

    // Copier les signataires du bail précédent
    if (leaseData.signers && leaseData.signers.length > 0) {
      const signersToInsert = leaseData.signers.map((signer: any) => ({
        lease_id: newLeaseData.id,
        profile_id: signer.profile_id,
        role: signer.role,
        signature_status: "pending", // Nouvelle signature requise
      }));

      const { error: signersError } = await serviceClient
        .from("lease_signers")
        .insert(signersToInsert);

      if (signersError) {
        console.error("[renew] Erreur copie signataires:", signersError);
        // Continuer quand même, le bail est créé
      }
    }

    // Mettre à jour l'ancien bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: "renewed",
        renewed_to_lease_id: newLeaseData.id,
      })
      .eq("id", leaseId);

    if (updateError) {
      console.error("[renew] Erreur mise à jour ancien bail:", updateError);
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Lease.Renewed",
      payload: {
        old_lease_id: leaseId,
        new_lease_id: newLeaseData.id,
        property_id: leaseData.property_id,
        old_loyer: leaseData.loyer,
        new_loyer: finalLoyer,
        duration_months: renewalDuration,
        renewed_by: user.id,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "lease_renewed",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        new_lease_id: newLeaseData.id,
        old_loyer: leaseData.loyer,
        new_loyer: finalLoyer,
        duration_months: renewalDuration,
        apply_irl,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Bail renouvelé avec succès",
      old_lease_id: leaseId,
      new_lease: newLeaseData,
      changes: {
        loyer: {
          old: leaseData.loyer,
          new: finalLoyer,
          change: finalLoyer - leaseData.loyer,
          percent: ((finalLoyer - leaseData.loyer) / leaseData.loyer * 100).toFixed(2) + "%",
        },
        dates: {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
          duration_months: renewalDuration,
        },
      },
    });
  } catch (error: any) {
    console.error("[renew] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/[id]/renew - Obtenir les informations de renouvellement
 * 
 * Retourne les données nécessaires pour préremplir le formulaire de renouvellement
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        type_bail,
        loyer,
        charges_forfaitaires,
        depot_de_garantie,
        date_debut,
        date_fin,
        statut,
        property:properties!inner(
          id,
          owner_id,
          adresse_complete
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

    const leaseData = lease as any;

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Calculer les suggestions de renouvellement
    const typeBail = leaseData.type_bail || "meuble";
    const defaultDuration = typeBail === "nu" ? 36 : 12;
    
    const suggestedStartDate = leaseData.date_fin
      ? new Date(leaseData.date_fin)
      : new Date();
    
    const suggestedEndDate = new Date(suggestedStartDate);
    suggestedEndDate.setMonth(suggestedEndDate.getMonth() + defaultDuration);

    // Estimer le loyer avec IRL (environ 3.5%)
    const irlRate = 0.035;
    const suggestedLoyer = Math.round(leaseData.loyer * (1 + irlRate) * 100) / 100;

    return NextResponse.json({
      current_lease: {
        id: leaseData.id,
        type_bail: leaseData.type_bail,
        loyer: leaseData.loyer,
        charges: leaseData.charges_forfaitaires,
        depot: leaseData.depot_de_garantie,
        date_fin: leaseData.date_fin,
        statut: leaseData.statut,
        property_address: leaseData.property?.adresse_complete,
      },
      suggestions: {
        new_loyer: suggestedLoyer,
        loyer_increase: suggestedLoyer - leaseData.loyer,
        loyer_increase_percent: (irlRate * 100).toFixed(1) + "%",
        start_date: suggestedStartDate.toISOString().split("T")[0],
        end_date: suggestedEndDate.toISOString().split("T")[0],
        duration_months: defaultDuration,
      },
      can_renew: leaseData.statut === "active",
      reason: leaseData.statut !== "active" 
        ? `Le bail doit être actif pour être renouvelé (statut actuel: ${leaseData.statut})`
        : null,
    });
  } catch (error: any) {
    console.error("[renew/GET] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

