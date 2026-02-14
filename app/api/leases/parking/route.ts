export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * POST /api/leases/parking
 * Crée un bail de parking/garage
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      throw new ApiError(401, "Non authentifié");
    }

    const body = await request.json();

    // Validation minimale
    if (!body.property_id && !body.propertyId) {
      throw new ApiError(400, "Le bien (property_id) est requis");
    }

    const propertyId = body.property_id || body.propertyId;

    // Utiliser le service role pour contourner les RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration serveur incomplète");
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Vérifier que l'utilisateur est bien propriétaire du bien
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès non autorisé");
    }

    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .single();

    if (!property || property.owner_id !== profile.id) {
      throw new ApiError(403, "Ce bien ne vous appartient pas");
    }

    // Créer le bail parking dans la table leases
    const leaseData = {
      property_id: propertyId,
      type_bail: "parking",
      loyer: body.loyer || body.rent || 0,
      charges_forfaitaires: body.charges || 0,
      depot_de_garantie: body.depot_de_garantie || body.deposit || 0,
      date_debut: body.date_debut || body.startDate || new Date().toISOString().split("T")[0],
      date_fin: body.date_fin || body.endDate || null,
      statut: "draft",
      // Métadonnées parking
      metadata: {
        parking_type: body.parkingType || body.parking_type || "exterieur",
        parking_number: body.parkingNumber || body.parking_number || "",
        vehicle_type: body.vehicleType || body.vehicle_type || "voiture",
        // Données du contrat complet
        bailleur: body.bailleur || {},
        locataire: body.locataire || {},
        clauses: body.clauses || {},
      },
    };

    const { data: lease, error: insertError } = await serviceClient
      .from("leases")
      .insert(leaseData)
      .select("id, statut, type_bail, loyer, date_debut")
      .single();

    if (insertError) {
      console.error("[API] Erreur création bail parking:", insertError);
      throw new ApiError(500, "Impossible de créer le bail parking");
    }

    return NextResponse.json(
      { id: lease.id, message: "Bail parking créé avec succès", lease },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
