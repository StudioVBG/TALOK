// @ts-nocheck
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { addLeaseSignerSchema } from "@/lib/validations/lease-signers";
import { z } from "zod";

/**
 * GET /api/leases/[id]/signers - Récupérer les signataires d'un bail
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    // Vérifier l'accès au bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, property_id")
      .eq("id", params.id as any)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;

    // Vérifier les permissions
    if (profileData.role !== "admin") {
      let authorized = false;

      // Propriétaire du bien
      if (leaseData.property_id) {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", leaseData.property_id as any)
          .single();

        if (property && (property as any).owner_id === profileData.id) {
          authorized = true;
        }
      }

      // Signataire du bail
      if (!authorized) {
        const { data: signers } = await serviceClient
          .from("lease_signers")
          .select("profile_id")
          .eq("lease_id", params.id as any)
          .eq("profile_id", profileData.id);

        authorized = (signers || []).length > 0;
      }

      if (!authorized) {
        return NextResponse.json(
          { error: "Vous n'avez pas accès à ce bail" },
          { status: 403 }
        );
      }
    }

    // Récupérer les signataires avec leurs profils
    const { data: signers, error: signersError } = await serviceClient
      .from("lease_signers")
      .select(`
        *,
        profiles:profiles(id, prenom, nom, user_id)
      `)
      .eq("lease_id", params.id as any)
      .order("created_at", { ascending: true });

    if (signersError) {
      console.error("Error fetching signers:", signersError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des signataires" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signers: signers || [] });
  } catch (error: any) {
    console.error("Error in GET /api/leases/[id]/signers:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/signers - Ajouter un signataire à un bail
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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
    const validated = addLeaseSignerSchema.parse(body);

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

    // Vérifier l'accès au bail (seul le propriétaire peut ajouter des signataires)
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, property_id")
      .eq("id", params.id as any)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;

    // Vérifier les permissions (propriétaire ou admin uniquement)
    if (profileData.role !== "admin") {
      if (!leaseData.property_id) {
        return NextResponse.json(
          { error: "Bail invalide (pas de propriété associée)" },
          { status: 400 }
        );
      }

      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", leaseData.property_id as any)
        .single();

      if (!property || (property as any).owner_id !== profileData.id) {
        return NextResponse.json(
          { error: "Vous n'êtes pas autorisé à ajouter des signataires à ce bail" },
          { status: 403 }
        );
      }
    }

    // Vérifier que le signataire n'existe pas déjà
    const { data: existing } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", params.id as any)
      .eq("profile_id", validated.profile_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Ce profil est déjà signataire de ce bail" },
        { status: 409 }
      );
    }

    // Ajouter le signataire
    const { data: signer, error: signerError } = await serviceClient
      .from("lease_signers")
      .insert({
        lease_id: params.id as any,
        profile_id: validated.profile_id,
        role: validated.role,
        signature_status: "pending",
      } as any)
      .select(`
        *,
        profiles:profiles(id, prenom, nom, user_id)
      `)
      .single();

    if (signerError) {
      console.error("Error adding signer:", signerError);
      return NextResponse.json(
        { error: "Erreur lors de l'ajout du signataire" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signer }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error in POST /api/leases/[id]/signers:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

