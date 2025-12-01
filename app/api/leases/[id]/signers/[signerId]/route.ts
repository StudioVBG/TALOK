// @ts-nocheck
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { updateLeaseSignerSchema } from "@/lib/validations/lease-signers";
import { z } from "zod";

/**
 * DELETE /api/leases/[id]/signers/[signerId] - Supprimer un signataire d'un bail
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; signerId: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Vérifier que le signataire existe et appartient au bail
    const { data: signer, error: signerError } = await serviceClient
      .from("lease_signers")
      .select("lease_id, profile_id")
      .eq("id", params.signerId as any)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signataire non trouvé" },
        { status: 404 }
      );
    }

    const signerData = signer as any;

    // Vérifier que le signataire appartient bien au bail spécifié
    if (signerData.lease_id !== params.id) {
      return NextResponse.json(
        { error: "Le signataire n'appartient pas à ce bail" },
        { status: 400 }
      );
    }

    // Vérifier les permissions (propriétaire, admin, ou le signataire lui-même)
    if (profileData.role !== "admin") {
      // Vérifier si c'est le propriétaire du bien
      const { data: lease } = await serviceClient
        .from("leases")
        .select("property_id")
        .eq("id", params.id as any)
        .single();

      if (lease && (lease as any).property_id) {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", (lease as any).property_id as any)
          .single();

        const isOwner = property && (property as any).owner_id === profileData.id;
        const isSelf = signerData.profile_id === profileData.id;

        if (!isOwner && !isSelf) {
          return NextResponse.json(
            { error: "Vous n'êtes pas autorisé à supprimer ce signataire" },
            { status: 403 }
          );
        }
      } else {
        // Si pas de propriété, seul le signataire lui-même peut se retirer
        if (signerData.profile_id !== profileData.id) {
          return NextResponse.json(
            { error: "Vous n'êtes pas autorisé à supprimer ce signataire" },
            { status: 403 }
          );
        }
      }
    }

    // Supprimer le signataire
    const { error: deleteError } = await serviceClient
      .from("lease_signers")
      .delete()
      .eq("id", params.signerId as any);

    if (deleteError) {
      console.error("Error deleting signer:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression du signataire" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error in DELETE /api/leases/[id]/signers/[signerId]:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leases/[id]/signers/[signerId] - Mettre à jour un signataire
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; signerId: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Valider le body
    const body = await request.json();
    const validated = updateLeaseSignerSchema.parse(body);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Vérifier que le signataire existe et appartient au bail
    const { data: signer, error: signerError } = await serviceClient
      .from("lease_signers")
      .select("lease_id, profile_id")
      .eq("id", params.signerId as any)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signataire non trouvé" },
        { status: 404 }
      );
    }

    const signerData = signer as any;

    // Vérifier que le signataire appartient bien au bail spécifié
    if (signerData.lease_id !== params.id) {
      return NextResponse.json(
        { error: "Le signataire n'appartient pas à ce bail" },
        { status: 400 }
      );
    }

    // Vérifier les permissions (propriétaire, admin, ou le signataire lui-même pour signer)
    if (profileData.role !== "admin") {
      const isSelf = signerData.profile_id === profileData.id;

      // Seul le signataire peut mettre à jour son propre statut de signature
      if (!isSelf) {
        return NextResponse.json(
          { error: "Vous ne pouvez mettre à jour que votre propre signature" },
          { status: 403 }
        );
      }
    }

    // Mettre à jour le signataire
    const updateData: any = {};
    if (validated.signature_status) {
      updateData.signature_status = validated.signature_status;
    }
    if (validated.signed_at !== undefined) {
      updateData.signed_at = validated.signed_at;
    }

    const { data: updatedSigner, error: updateError } = await serviceClient
      .from("lease_signers")
      .update(updateData)
      .eq("id", params.signerId as any)
      .select(`
        *,
        profiles:profiles(id, prenom, nom, user_id)
      `)
      .single();

    if (updateError) {
      console.error("Error updating signer:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du signataire" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signer: updatedSigner }, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error in PATCH /api/leases/[id]/signers/[signerId]:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

