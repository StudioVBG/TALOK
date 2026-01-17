export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { z } from "zod";

const publishListingSchema = z.object({
  unit_id: z.string().uuid(),
  title: z.string().min(8).optional(),
  description: z.string().min(30).optional(),
  rent_cents: z.number().int().min(0).optional(),
  charges_cents: z.number().int().min(0).optional(),
  available_from: z.string().datetime().optional(),
});

/**
 * POST /api/listings/publish - Publier une annonce avec validation lint
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
    const validated = publishListingSchema.parse(body);

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
        property:properties!inner(id, owner_id, address, geo)
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

    // Lint : vérifier les exigences de publication
    const errors: Array<{ field: string; message: string }> = [];

    // Vérifier les photos (≥3)
    const { data: photos } = await serviceClient
      .from("photos")
      .select("id")
      .eq("unit_id", validated.unit_id);

    if (!photos || photos.length < 3) {
      errors.push({
        field: "photos",
        message: "Au moins 3 photos sont requises pour publier",
      });
    }

    // Vérifier l'adresse (géocodée)
    const propertyData = unitData.property as any;
    if (!propertyData.geo || !propertyData.geo.lat || !propertyData.geo.lng) {
      errors.push({
        field: "address",
        message: "L'adresse doit être géocodée",
      });
    }

    // Vérifier les champs requis si publication publique
    if (validated.title && validated.title.length < 8) {
      errors.push({
        field: "title",
        message: "Le titre doit contenir au moins 8 caractères",
      });
    }

    if (validated.description && validated.description.length < 30) {
      errors.push({
        field: "description",
        message: "La description doit contenir au moins 30 caractères",
      });
    }

    if (validated.rent_cents !== undefined && validated.rent_cents < 0) {
      errors.push({
        field: "rent_cents",
        message: "Le loyer doit être positif",
      });
    }

    // Si erreurs de lint, retourner les erreurs
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          errors,
        },
        { status: 400 }
      );
    }

    // Mettre à jour l'unité avec les données de publication
    const { data: updatedUnit, error: updateError } = await serviceClient
      .from("units")
      .update({
        publication: "PUBLIC",
        title: validated.title,
        description: validated.description,
        rent_cents: validated.rent_cents,
        charges_cents: validated.charges_cents,
        available_from: validated.available_from,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", validated.unit_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "PropertyWizard.ListingPublished",
      payload: {
        unit_id: validated.unit_id,
        property_id: unitData.property.id,
        has_title: !!validated.title,
        has_description: !!validated.description,
        photos_count: photos?.length || 0,
      },
    } as any);

    return NextResponse.json({
      success: true,
      listing_id: updatedUnit?.id,
      unit: updatedUnit,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("[POST /api/listings/publish] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

