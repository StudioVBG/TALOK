export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

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

    // Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await supabase
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

    // Utiliser le service client pour bypass RLS
    const serviceClient = getServiceClient();

    // ✅ Récupérer le bail avec les données COMPLÈTES de la propriété (source unique)
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties!inner(
          *
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
    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    // Vérifier si l'utilisateur est signataire du bail (locataire, colocataire, garant)
    let isSigner = false;
    if (!isOwner && !isAdmin) {
      const { data: signer } = await serviceClient
        .from("lease_signers")
        .select("id, role")
        .eq("lease_id", leaseId)
        .eq("profile_id", profile.id)
        .maybeSingle();
      
      isSigner = !!signer;
    }

    if (!isOwner && !isAdmin && !isSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à voir ce bail" },
        { status: 403 }
      );
    }

    // Si c'est un signataire (locataire), récupérer les infos des autres signataires
    let signers = null;
    if (isSigner || isOwner || isAdmin) {
      const { data: allSigners } = await serviceClient
        .from("lease_signers")
        .select(`
          id,
          role,
          signature_status,
          signed_at,
          profile:profiles(id, prenom, nom)
        `)
        .eq("lease_id", leaseId);
      signers = allSigners;
    }

    // ✅ SYNCHRONISATION : Les données financières viennent du BIEN (source unique SSOT 2026)
    const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
      switch (typeBail) {
        case "nu":
        case "etudiant":
          return loyerHC * 1;
        case "meuble":
        case "colocation":
          return loyerHC * 2;
        case "mobilite":
          return 0;
        case "saisonnier":
          return loyerHC * 2;
        default:
          return loyerHC;
      }
    };

    // ✅ SSOT 2026 : Priorité aux données du BIEN si elles existent
    const loyer = property.loyer_hc ?? property.loyer_base ?? lease.loyer ?? 0;
    const charges = property.charges_mensuelles ?? lease.charges_forfaitaires ?? 0;
    const maxDepot = lease.depot_de_garantie ?? getMaxDepotLegal(lease.type_bail, loyer);

    // Vérifier si un EDL d'entrée est signé
    const { data: edl } = await serviceClient
      .from("edl")
      .select("status")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .maybeSingle();

    // Vérifier si la première facture est payée
    const { data: firstInvoice } = await serviceClient
      .from("invoices")
      .select("statut")
      .eq("lease_id", leaseId)
      .eq("metadata->>type", "initial_invoice")
      .maybeSingle();

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
        mode_paiement: lease.mode_paiement || "virement",
        jour_paiement: lease.jour_paiement || 5,
        revision_autorisee: lease.revision_autorisee ?? true,
        clauses_particulieres: lease.clauses_particulieres || "",
        property: property,
        signers: signers || [],
      },
      viewer_role: isAdmin ? "admin" : isOwner ? "owner" : "tenant",
    });

  } catch (error: any) {
    console.error("Erreur API get lease:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/leases/[id]
 * Modifier un bail
 */
export async function PUT(request: Request, { params }: RouteParams) {
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

    // Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await supabase
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

    // Utiliser le service client pour bypass RLS
    const serviceClient = getServiceClient();

    // Vérifier que le bail existe et appartient au propriétaire
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        property:properties!inner(
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

    // Préparer les données de base à mettre à jour (colonnes garanties)
    const baseUpdateData: Record<string, any> = {};
    
    // Champs de base (existants dans le schéma initial)
    if (body.type_bail !== undefined) baseUpdateData.type_bail = body.type_bail;
    if (body.loyer !== undefined) baseUpdateData.loyer = body.loyer;
    if (body.charges_forfaitaires !== undefined) baseUpdateData.charges_forfaitaires = body.charges_forfaitaires;
    if (body.depot_garantie !== undefined) baseUpdateData.depot_de_garantie = body.depot_garantie;
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

    return NextResponse.json({
      success: true,
      lease: updatedLease,
    });

  } catch (error: any) {
    console.error("Erreur API update lease:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leases/[id]
 * Supprimer un bail et toutes ses données associées
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

    // Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await supabase
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

    // Utiliser le service client pour bypass RLS
    const serviceClient = getServiceClient();

    // Vérifier que le bail existe et appartient au propriétaire
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        property:properties!inner(
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

    // Vérifier les permissions
    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à supprimer ce bail" },
        { status: 403 }
      );
    }

    // Supprimer dans l'ordre pour respecter les contraintes FK
    // 1. Supprimer les documents liés
    await serviceClient
      .from("documents")
      .delete()
      .eq("lease_id", leaseId);

    // 2. Supprimer les paiements liés
    await serviceClient
      .from("payments")
      .delete()
      .match({ lease_id: leaseId });

    // 3. Supprimer les factures liées
    await serviceClient
      .from("invoices")
      .delete()
      .eq("lease_id", leaseId);

    // 4. Supprimer les signataires
    await serviceClient
      .from("lease_signers")
      .delete()
      .eq("lease_id", leaseId);

    // 5. Supprimer les roommates
    await serviceClient
      .from("roommates")
      .delete()
      .eq("lease_id", leaseId);

    // 6. Enfin, supprimer le bail
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

    return NextResponse.json({
      success: true,
      message: "Bail supprimé avec succès",
    });

  } catch (error: any) {
    console.error("Erreur API delete lease:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
