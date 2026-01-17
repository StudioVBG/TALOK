export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { z } from "zod";

const unpublishListingSchema = z.object({
  unit_id: z.string().uuid(),
});

/**
 * POST /api/listings/unpublish - Dépublier une annonce
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      return NextResponse.json(
        { error: authError?.message || "Non authentifié" },
        { status: authError?.status || 401 }
      );
    }

    const body = await request.json();
    const validated = unpublishListingSchema.parse(body);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuration serveur manquante" },
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

    // Récupérer l'unité et vérifier les permissions
    const { data: unit } = await serviceClient
      .from("units")
      .select(`
        id,
        property:properties!inner(id, owner_id)
      `)
      .eq("id", validated.unit_id)
      .single();

    if (!unit) {
      return NextResponse.json(
        { error: "Unité non trouvée" },
        { status: 404 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const unitData = unit as any;
    if (unitData.property.owner_id !== profile?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Mettre à jour l'unité pour la dépublier
    const { data: updatedUnit, error: updateError } = await serviceClient
      .from("units")
      .update({
        publication: "PRIVATE",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", validated.unit_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      unit: updatedUnit,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("[POST /api/listings/unpublish] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

