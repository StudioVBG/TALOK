export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/meters/[id]/history - Récupérer l'historique des relevés d'un compteur
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params is now a Promise
  const { id: meterId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "12");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Récupérer le compteur
    const { data: meter, error: meterError } = await supabase
      .from("meters")
      .select("*, lease:leases(id)")
      .eq("id", meterId as any)
      .single();

    if (meterError || !meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    const meterData = meter as any;

    // Vérifier les permissions (propriétaire, locataire, ou admin)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";

    if (!isAdmin) {
      // Vérifier si propriétaire du logement
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id")
        .eq("id", meterData.property_id)
        .single();

      const isOwner = property && (property as any).owner_id === profileData?.id;

      if (!isOwner) {
        // Vérifier si locataire (via lease_signers)
        const { data: signer } = await supabase
          .from("lease_signers")
          .select("id")
          .eq("profile_id", profileData?.id)
          .in("lease_id", 
            supabase
              .from("leases")
              .select("id")
              .eq("property_id", meterData.property_id)
              .eq("statut", "active")
          )
          .maybeSingle();

        if (!signer) {
          return NextResponse.json(
            { error: "Accès non autorisé" },
            { status: 403 }
          );
        }
      }
    }

    // Construire la requête
    let query = supabase
      .from("meter_readings")
      .select("*")
      .eq("meter_id", meterId as any)
      .order("reading_date", { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte("reading_date", startDate);
    }
    if (endDate) {
      query = query.lte("reading_date", endDate);
    }

    const { data: readings, error: readingsError } = await query;

    if (readingsError) throw readingsError;

    // Récupérer les estimations de consommation
    const { data: estimates, error: estimatesError } = await supabase
      .from("consumption_estimates")
      .select("*")
      .eq("meter_id", meterId as any)
      .order("period_start", { ascending: false })
      .limit(limit);

    if (estimatesError) throw estimatesError;

    return NextResponse.json({
      meter: meterData,
      readings: readings || [],
      estimates: estimates || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





