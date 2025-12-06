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

    // Récupérer le bail avec la propriété
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties!inner(
          id,
          adresse_complete,
          ville,
          code_postal,
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
        { error: "Vous n'êtes pas autorisé à voir ce bail" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      lease: {
        id: lease.id,
        type_bail: lease.type_bail,
        loyer: lease.loyer,
        charges_forfaitaires: lease.charges_forfaitaires,
        depot_garantie: lease.depot_de_garantie,
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        statut: lease.statut,
        clauses_particulieres: lease.clauses_particulieres,
        property: {
          id: property.id,
          adresse_complete: property.adresse_complete,
        },
      },
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

    // Préparer les données à mettre à jour
    const updateData: Record<string, any> = {};
    
    if (body.type_bail !== undefined) updateData.type_bail = body.type_bail;
    if (body.loyer !== undefined) updateData.loyer = body.loyer;
    if (body.charges_forfaitaires !== undefined) updateData.charges_forfaitaires = body.charges_forfaitaires;
    if (body.depot_garantie !== undefined) updateData.depot_de_garantie = body.depot_garantie;
    if (body.date_debut !== undefined) updateData.date_debut = body.date_debut;
    if (body.date_fin !== undefined) updateData.date_fin = body.date_fin;
    if (body.clauses_particulieres !== undefined) updateData.clauses_particulieres = body.clauses_particulieres;

    // Mettre à jour le bail
    const { data: updatedLease, error: updateError } = await serviceClient
      .from("leases")
      .update(updateData)
      .eq("id", leaseId)
      .select()
      .single();

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
