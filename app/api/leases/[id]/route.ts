export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { LeaseUpdateSchema, getMaxDepotLegal, getMaxDepotMois } from "@/lib/validations/lease-financial";
import { SIGNER_ROLES, isTenantRole, isOwnerRole } from "@/lib/constants/roles";
import { withSecurity } from "@/lib/api/with-security";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leases/[id]
 * Récupérer les détails d'un bail
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json(
        { error: "ID du bail requis" },
        { status: 400 }
      );
    }

    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Utiliser le service client pour bypass RLS
    const serviceClient = getServiceClient();

    // Récupérer le profil avec service role (bypass RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // ✅ SOTA 2026: Récupérer le bail avec jointures (property + signers en une requête)
    // FIX AUDIT: Réduit les requêtes de 5 séquentielles → 2 parallèles
    const [leaseResult, auxiliaryResult] = await Promise.all([
      // Requête 1: Bail + Propriété + Signataires (tout en une jointure)
      serviceClient
        .from("leases")
        .select(`
          *,
          property:properties(*),
          lease_signers(
            id,
            role,
            signature_status,
            signed_at,
            profile_id,
            invited_email,
            invited_name,
            profile:profiles(id, prenom, nom, email)
          )
        `)
        .eq("id", leaseId)
        .single(),
      // Requête 2: EDL + première facture en parallèle
      Promise.all([
        serviceClient
          .from("edl")
          .select("status")
          .eq("lease_id", leaseId)
          .eq("type", "entree")
          .maybeSingle(),
        serviceClient
          .from("invoices")
          .select("statut")
          .eq("lease_id", leaseId)
          .eq("metadata->>type", "initial_invoice")
          .maybeSingle(),
      ]),
    ]);

    const { data: lease, error: leaseError } = leaseResult;
    const [edlResult, firstInvoiceResult] = auxiliaryResult;
    const edl = edlResult.data;
    const firstInvoice = firstInvoiceResult.data;

    if (leaseError || !lease) {
      console.error("[GET /api/leases] Erreur:", leaseError?.message);
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Extraire les signataires de la jointure
    const allSignersFromJoin = (lease as any).lease_signers || [];

    // Vérifier si la propriété existe et n'est pas supprimée
    const property = lease.property as any;
    const isPropertyDeleted = !property || property.etat === "deleted" || property.deleted_at;
    
    if (isPropertyDeleted && profile.role !== "admin") {
      console.log(`[GET /api/leases] Propriété supprimée pour bail ${leaseId}`);
    }

    // Vérifier les permissions
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    // Vérifier si l'utilisateur est signataire du bail (locataire, colocataire, garant)
    const userSigner = allSignersFromJoin.find((s: any) => s.profile_id === profile.id);
    const isSigner = !!userSigner;
    const signerRole: string | null = userSigner?.role || null;

    if (!isOwner && !isAdmin && !isSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à voir ce bail" },
        { status: 403 }
      );
    }

    // Les signataires sont déjà chargés via la jointure
    const signers = (isSigner || isOwner || isAdmin) ? allSignersFromJoin : null;

    // ✅ SSOT 2026 : Priorité aux données du BAIL (source unique)
    const loyer = lease.loyer ?? property.loyer_hc ?? property.loyer_base ?? 0;
    const charges = lease.charges_forfaitaires ?? property.charges_mensuelles ?? 0;
    const maxDepot = lease.depot_de_garantie ?? getMaxDepotLegal(lease.type_bail, loyer);

    return NextResponse.json({
      lease: {
        id: lease.id,
        type_bail: lease.type_bail,
        // ✅ Données consolidées SSOT
        loyer,
        charges_forfaitaires: charges,
        depot_garantie: maxDepot,
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        statut: lease.statut,
        // Flags pour le tracker UI
        has_signed_edl: edl?.status === "signed",
        has_paid_initial: firstInvoice?.statut === "paid",
        // Indice de référence
        indice_reference: lease.indice_reference || "IRL",
        // ... (reste des champs)
        charges_type: lease.charges_type || "forfait",
        mode_paiement: (lease as any).mode_paiement || "virement",
        jour_paiement: (lease as any).jour_paiement || 5,
        revision_autorisee: (lease as any).revision_autorisee ?? true,
        clauses_particulieres: (lease as any).clauses_particulieres || "",
        property: property,
        signers: signers || [],
        // ✅ SOTA 2026: Indicateur de propriété supprimée
        property_deleted: isPropertyDeleted,
      },
      viewer_role: isAdmin ? "admin" : isOwner ? "owner" : isSigner ? "tenant" : "viewer",
      signer_role: signerRole,
    });

  } catch (error: unknown) {
    console.error("Erreur API get lease:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/leases/[id]
 * Modifier un bail
 * FIX AUDIT: Wrappé avec withSecurity (CSRF + error handling centralisé)
 */
export const PUT = withSecurity(async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const body = await request.json();

    if (!leaseId) {
      return NextResponse.json(
        { error: "ID du bail requis" },
        { status: 400 }
      );
    }

    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Utiliser le service client pour bypass RLS
    const serviceClient = getServiceClient();

    // Récupérer le profil avec service role (bypass RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que le bail existe et récupérer les données actuelles
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        loyer,
        type_bail,
        depot_de_garantie,
        statut,
        property:properties(
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

    // Vérifier si le bail peut être modifié
    const leaseData = lease as any;
    if (leaseData.statut === "terminated" || leaseData.statut === "archived") {
      return NextResponse.json(
        { error: "Ce bail est terminé et ne peut plus être modifié" },
        { status: 400 }
      );
    }

    // Vérifier les permissions
    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à modifier ce bail" },
        { status: 403 }
      );
    }

    // ✅ SSOT 2026: Déterminer les nouvelles valeurs (ou garder les actuelles)
    const currentLease = lease as any;
    const newLoyer = body.loyer !== undefined ? parseFloat(body.loyer) : currentLease.loyer;
    const newTypeBail = body.type_bail !== undefined ? body.type_bail : currentLease.type_bail;
    
    // ✅ CALCUL AUTOMATIQUE: Recalculer le dépôt si loyer ou type change
    let newDepot: number;
    if (body.depot_garantie !== undefined) {
      // Dépôt fourni manuellement - vérifier le max légal
      newDepot = parseFloat(body.depot_garantie);
      const maxDepot = getMaxDepotLegal(newTypeBail, newLoyer);
      const maxMois = getMaxDepotMois(newTypeBail);
      
      if (newTypeBail === "mobilite" && newDepot > 0) {
        return NextResponse.json(
          { error: "Le dépôt de garantie est interdit pour un bail mobilité (Art. 25-13 Loi ELAN)" },
          { status: 400 }
        );
      } else if (newDepot > maxDepot && maxDepot > 0) {
        return NextResponse.json(
          { error: `Dépôt de garantie (${newDepot}€) supérieur au maximum légal (${maxMois} mois = ${maxDepot}€)` },
          { status: 400 }
        );
      }
    } else if (body.loyer !== undefined || body.type_bail !== undefined) {
      // Loyer ou type change sans dépôt fourni → recalculer automatiquement
      newDepot = getMaxDepotLegal(newTypeBail, newLoyer);
      console.log(`[PUT /api/leases] Dépôt recalculé automatiquement: ${newDepot}€ (${newTypeBail}, loyer: ${newLoyer}€)`);
    } else {
      // Aucun changement financier
      newDepot = currentLease.depot_de_garantie;
    }

    // Préparer les données de base à mettre à jour (colonnes garanties)
    const baseUpdateData: Record<string, any> = {};
    
    // Champs de base (existants dans le schéma initial)
    if (body.type_bail !== undefined) baseUpdateData.type_bail = body.type_bail;
    if (body.loyer !== undefined) baseUpdateData.loyer = parseFloat(body.loyer);
    if (body.charges_forfaitaires !== undefined) baseUpdateData.charges_forfaitaires = parseFloat(body.charges_forfaitaires);
    // ✅ Toujours mettre à jour le dépôt (recalculé auto si nécessaire)
    if (body.depot_garantie !== undefined || body.loyer !== undefined || body.type_bail !== undefined) {
      baseUpdateData.depot_de_garantie = newDepot;
    }
    if (body.date_debut !== undefined) baseUpdateData.date_debut = body.date_debut;
    if (body.date_fin !== undefined) baseUpdateData.date_fin = body.date_fin;

    // Champs additionnels (nécessitent migrations)
    const extendedFields: Record<string, any> = {};
    if (body.indice_reference !== undefined) extendedFields.indice_reference = body.indice_reference;
    if (body.charges_type !== undefined) extendedFields.charges_type = body.charges_type;
    if (body.mode_paiement !== undefined) extendedFields.mode_paiement = body.mode_paiement;
    if (body.jour_paiement !== undefined) extendedFields.jour_paiement = body.jour_paiement;
    if (body.revision_autorisee !== undefined) extendedFields.revision_autorisee = body.revision_autorisee;
    if (body.clauses_particulieres !== undefined) extendedFields.clauses_particulieres = body.clauses_particulieres;

    // Essayer d'abord avec tous les champs
    let updateData = { ...baseUpdateData, ...extendedFields };
    let { data: updatedLease, error: updateError } = await serviceClient
      .from("leases")
      .update(updateData)
      .eq("id", leaseId)
      .select()
      .single();

    // Si erreur de colonne manquante, réessayer avec seulement les champs de base
    if (updateError && updateError.message?.includes("column")) {
      console.log("Colonnes étendues non disponibles, mise à jour avec champs de base uniquement");
      const result = await serviceClient
        .from("leases")
        .update(baseUpdateData)
        .eq("id", leaseId)
        .select()
        .single();
      updatedLease = result.data;
      updateError = result.error;
    }

    if (updateError) {
      console.error("Erreur mise à jour bail:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour", details: updateError.message },
        { status: 500 }
      );
    }

    // ✅ SOTA 2026: Invalider le cache ISR pour refléter les changements du bail sur la page propriété
    const propertyIdForRevalidation = property?.id;
    if (propertyIdForRevalidation) {
      revalidatePath(`/owner/properties/${propertyIdForRevalidation}`);
      revalidatePath("/owner/properties");
    }
    revalidatePath("/owner/leases");

    return NextResponse.json({
      success: true,
      lease: updatedLease,
    });

  } catch (error: unknown) {
    console.error("Erreur API update lease:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, { routeName: "PUT /api/leases/[id]", csrf: true });

/**
 * DELETE /api/leases/[id]
 * Supprimer un bail et toutes ses données associées
 * 
 * ✅ SOTA 2026: Seuls les baux en brouillon ou en attente de signature peuvent être supprimés.
 * Les baux actifs/terminés/archivés doivent être conservés pour l'historique légal.
 * FIX AUDIT: Wrappé avec withSecurity (CSRF + error handling centralisé)
 */
export const DELETE = withSecurity(async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    
    if (!leaseId) {
      return NextResponse.json(
        { error: "ID du bail requis" },
        { status: 400 }
      );
    }

    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Utiliser le service client pour bypass RLS
    const serviceClient = getServiceClient();

    // Récupérer le profil avec service role (bypass RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // ✅ SOTA 2026: Récupérer le bail avec son statut (LEFT JOIN pour propriétés supprimées)
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        type_bail,
        property:properties(
          id,
          owner_id,
          adresse_complete
        ),
        signers:lease_signers(
          profile_id,
          role,
          signature_status,
          invited_email,
          invited_name,
          profile:profiles(prenom, nom, email)
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

    // Vérifier les permissions
    const property = (lease as any).property;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à supprimer ce bail" },
        { status: 403 }
      );
    }

    // ✅ SOTA 2026: Bloquer la suppression des baux actifs/terminés/archivés
    const NON_DELETABLE_STATUS = ["fully_signed", "active", "terminated", "archived"];
    const leaseStatus = (lease as any).statut;
    
    if (!isAdmin && NON_DELETABLE_STATUS.includes(leaseStatus)) {
      // Trouver le locataire principal pour le message
      const tenantSigner = (lease as any).signers?.find((s: any) => 
        isTenantRole(s.role)
      );
      const tenantName = tenantSigner?.profile 
        ? `${tenantSigner.profile.prenom || ""} ${tenantSigner.profile.nom || ""}`.trim() || tenantSigner.profile.email
        : null;

      let errorMessage = "";
      let suggestion = "";
      
      switch (leaseStatus) {
        case "active":
          errorMessage = `Ce bail est actif${tenantName ? ` avec ${tenantName}` : ""}. Il ne peut pas être supprimé.`;
          suggestion = "Terminez d'abord le bail via la procédure de fin de bail (EDL sortie + restitution caution).";
          break;
        case "fully_signed":
          errorMessage = "Ce bail est entièrement signé et en attente d'activation. Il ne peut pas être supprimé.";
          suggestion = "Activez le bail ou demandez une annulation aux signataires.";
          break;
        case "terminated":
        case "archived":
          errorMessage = "Ce bail est terminé et conservé pour l'historique légal (5 ans minimum).";
          suggestion = "Les baux terminés ne peuvent pas être supprimés pour des raisons légales.";
          break;
        default:
          errorMessage = "Ce bail ne peut pas être supprimé dans son état actuel.";
      }

      return NextResponse.json({
        error: errorMessage,
        suggestion,
        leaseStatus,
        canDelete: false,
      }, { status: 400 });
    }

    // ✅ Notifier les locataires avant suppression (si bail en attente de signature)
    if (leaseStatus === "pending_signature" || leaseStatus === "partially_signed") {
      const tenantSigners = (lease as any).signers?.filter((s: any) => 
        isTenantRole(s.role) && s.profile_id
      ) || [];
      
      for (const signer of tenantSigners) {
        await serviceClient
          .from("notifications")
          .insert({
            recipient_id: signer.profile_id,
            type: "alert",
            title: "Bail annulé",
            message: `Le bail pour "${property?.adresse_complete || 'le logement'}" a été annulé par le propriétaire.`,
            link: "/tenant/dashboard",
            related_id: leaseId,
            related_type: "lease"
          });
      }
    }

    // Supprimer dans l'ordre pour respecter les contraintes FK
    // Note: La plupart sont ON DELETE CASCADE, mais on supprime explicitement pour plus de sécurité

    // 1. Supprimer les EDL et leurs items
    const { data: edls } = await serviceClient
      .from("edl")
      .select("id")
      .eq("lease_id", leaseId);
    
    // FIX AUDIT 2026-02-16: Ajout de vérifications d'erreurs sur chaque étape de suppression
    // pour détecter les échecs partiels et les journaliser.
    const deleteErrors: string[] = [];

    if (edls && edls.length > 0) {
      const edlIds = edls.map(e => e.id);
      const { error: e1 } = await serviceClient.from("edl_items").delete().in("edl_id", edlIds);
      if (e1) deleteErrors.push(`edl_items: ${e1.message}`);
      const { error: e2 } = await serviceClient.from("edl_media").delete().in("edl_id", edlIds);
      if (e2) deleteErrors.push(`edl_media: ${e2.message}`);
      const { error: e3 } = await serviceClient.from("edl_signatures").delete().in("edl_id", edlIds);
      if (e3) deleteErrors.push(`edl_signatures: ${e3.message}`);
      const { error: e4 } = await serviceClient.from("edl").delete().in("id", edlIds);
      if (e4) deleteErrors.push(`edl: ${e4.message}`);
    }

    // 2. Supprimer les documents liés (storage + DB)
    const { data: leaseDocuments } = await serviceClient
      .from("documents")
      .select("id, storage_path")
      .eq("lease_id", leaseId);

    if (leaseDocuments && leaseDocuments.length > 0) {
      const storagePaths = leaseDocuments
        .map((d: any) => d.storage_path)
        .filter((p: string | null): p is string => Boolean(p));
      if (storagePaths.length > 0) {
        const { error: storageErr } = await serviceClient.storage.from(STORAGE_BUCKETS.DOCUMENTS).remove(storagePaths);
        if (storageErr) deleteErrors.push(`storage: ${(storageErr as any)?.message || String(storageErr)}`);
      }
      const { error: docsErr } = await serviceClient
        .from("documents")
        .delete()
        .eq("lease_id", leaseId);
      if (docsErr) deleteErrors.push(`documents: ${docsErr.message}`);
    }

    // 3. Supprimer les paiements liés aux factures
    const { data: invoices } = await serviceClient
      .from("invoices")
      .select("id")
      .eq("lease_id", leaseId);
    
    if (invoices && invoices.length > 0) {
      const { error: payErr } = await serviceClient
        .from("payments")
        .delete()
        .in("invoice_id", invoices.map(i => i.id));
      if (payErr) deleteErrors.push(`payments: ${payErr.message}`);
    }

    // 4. Supprimer les factures liées
    const { error: invErr } = await serviceClient
      .from("invoices")
      .delete()
      .eq("lease_id", leaseId);
    if (invErr) deleteErrors.push(`invoices: ${invErr.message}`);

    // 5. Supprimer les signataires
    const { error: sigErr } = await serviceClient
      .from("lease_signers")
      .delete()
      .eq("lease_id", leaseId);
    if (sigErr) deleteErrors.push(`lease_signers: ${sigErr.message}`);

    // 6. Supprimer les roommates
    const { error: rmErr } = await serviceClient
      .from("roommates")
      .delete()
      .eq("lease_id", leaseId);
    if (rmErr) deleteErrors.push(`roommates: ${rmErr.message}`);

    // 7. Supprimer les mouvements de dépôt
    const { error: depErr } = await serviceClient
      .from("deposit_movements")
      .delete()
      .eq("lease_id", leaseId);
    if (depErr) deleteErrors.push(`deposit_movements: ${depErr.message}`);

    // Journaliser les erreurs partielles (non bloquantes pour la suppression du bail)
    if (deleteErrors.length > 0) {
      console.warn(`[DELETE /api/leases/${leaseId}] Erreurs partielles lors de la cascade:`, deleteErrors);
    }

    // 8. Enfin, supprimer le bail
    const { error: deleteError } = await serviceClient
      .from("leases")
      .delete()
      .eq("id", leaseId);

    if (deleteError) {
      console.error("Erreur suppression bail:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression", details: deleteError.message },
        { status: 500 }
      );
    }

    // ✅ SOTA 2026: Invalider le cache ISR pour que le CTA "Créer un bail" réapparaisse
    const propertyId = property?.id;
    if (propertyId) {
      revalidatePath(`/owner/properties/${propertyId}`);
      revalidatePath("/owner/properties");
    }
    revalidatePath("/owner/leases");

    return NextResponse.json({
      success: true,
      message: "Bail supprimé avec succès",
      propertyId: propertyId || null,
      notifiedTenants: (lease as any).signers?.filter((s: any) => isTenantRole(s.role)).length || 0,
    });

  } catch (error: unknown) {
    console.error("Erreur API delete lease:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, { routeName: "DELETE /api/leases/[id]", csrf: true });
