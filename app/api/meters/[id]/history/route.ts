import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/meters/[id]/history - Récupérer l'historique des relevés d'un compteur
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const meterId = params.id;
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

    // Vérifier les permissions
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", meterData.lease_id)
      .eq("user_id", user.id as any)
      .maybeSingle();

    if (!roommate) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





