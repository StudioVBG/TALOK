export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { z } from "zod";

const bulkFeaturesSchema = z.object({
  unit_id: z.string().uuid().optional(),
  features: z.array(
    z.object({
      feature: z.string(),
      value: z.union([z.boolean(), z.string()]).optional(),
    })
  ),
});

/**
 * POST /api/properties/[id]/features/bulk - Ajouter des équipements en masse
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      return NextResponse.json(
        { error: authError?.message || "Non authentifié" },
        { status: authError?.status || 401 }
      );
    }

    const body = await request.json();
    const validated = bulkFeaturesSchema.parse(body);

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

    // Vérifier les permissions
    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", params.id)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Propriété non trouvée" },
        { status: 404 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const propertyData = property as any;
    if (propertyData.owner_id !== profile?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Si unit_id fourni, vérifier qu'il appartient à la propriété
    if (validated.unit_id) {
      const { data: unit } = await serviceClient
        .from("units")
        .select("id, property_id")
        .eq("id", validated.unit_id)
        .single();

      if (!unit || (unit as any).property_id !== params.id) {
        return NextResponse.json(
          { error: "Unité non trouvée ou n'appartient pas à cette propriété" },
          { status: 404 }
        );
      }
    }

    // Insérer les équipements
    const featuresToInsert = validated.features.map((f) => ({
      property_id: params.id,
      unit_id: validated.unit_id || null,
      feature: f.feature,
      value: f.value !== undefined ? (typeof f.value === "boolean" ? f.value : f.value) : true,
    }));

    // Supprimer les équipements existants pour cette unité/propriété avant d'insérer
    const deleteQuery = serviceClient
      .from("features")
      .delete()
      .eq("property_id", params.id);

    if (validated.unit_id) {
      deleteQuery.eq("unit_id", validated.unit_id);
    } else {
      deleteQuery.is("unit_id", null);
    }

    await deleteQuery;

    // Insérer les nouveaux équipements
    const { data: insertedFeatures, error: insertError } = await serviceClient
      .from("features")
      .insert(featuresToInsert as any)
      .select();

    if (insertError) {
      throw insertError;
    }

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "PropertyWizard.FeaturesSaved",
      payload: {
        property_id: params.id,
        unit_id: validated.unit_id,
        features_count: validated.features.length,
        features: validated.features.map((f) => f.feature),
      },
    } as any);

    return NextResponse.json({
      success: true,
      features: insertedFeatures,
      count: insertedFeatures?.length || 0,
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

    console.error("[POST /api/properties/[id]/features/bulk] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

