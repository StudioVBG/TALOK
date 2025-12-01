// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
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
