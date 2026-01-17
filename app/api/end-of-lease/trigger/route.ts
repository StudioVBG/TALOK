export const runtime = 'nodejs';

/**
 * API Route: Déclenchement automatique des processus de fin de bail
 * POST /api/end-of-lease/trigger
 * 
 * Cette route peut être appelée par un cron job pour déclencher
 * automatiquement les processus de fin de bail.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Vérifier l'authentification (admin ou cron)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Autoriser soit un admin connecté, soit le cron secret
    let isAuthorized = false;

    if (authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        isAuthorized = profile?.role === "admin";
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Appeler la fonction RPC pour déclencher les processus
    const { data: triggeredCount, error } = await supabase.rpc("trigger_lease_end_processes");

    if (error) {
      console.error("Erreur déclenchement processus:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      triggered_count: triggeredCount || 0,
      message: `${triggeredCount || 0} processus de fin de bail déclenchés`,
    });
  } catch (error) {
    console.error("Erreur API trigger:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// GET - Récupérer les baux qui seront déclenchés prochainement
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les baux actifs avec une date de fin dans les 90 prochains jours
    const today = new Date();
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);

    let query = supabase
      .from("leases")
      .select(`
        id,
        property_id,
        type_bail,
        loyer,
        date_debut,
        date_fin,
        depot_de_garantie,
        property:properties(id, adresse_complete, ville, type, owner_id)
      `)
      .eq("statut", "active")
      .not("date_fin", "is", null)
      .gte("date_fin", today.toISOString().split("T")[0])
      .lte("date_fin", in90Days.toISOString().split("T")[0])
      .order("date_fin", { ascending: true });

    // Si pas admin, filtrer par propriétaire
    if (profile.role !== "admin") {
      query = query.eq("properties.owner_id", profile.id);
    }

    const { data: leases, error } = await query;

    if (error) {
      throw error;
    }

    // Calculer les dates de déclenchement
    const triggerDaysMap: Record<string, number> = {
      nu: 90,
      meuble: 30,
      colocation: 30,
      saisonnier: 0,
      mobilite: 15,
      etudiant: 30,
      commercial: 180,
    };

    const upcomingTriggers = (leases || []).map((lease) => {
      const endDate = new Date(lease.date_fin!);
      const triggerDays = triggerDaysMap[lease.type_bail] || 30;
      const triggerDate = new Date(endDate);
      triggerDate.setDate(triggerDate.getDate() - triggerDays);

      const daysUntilTrigger = Math.ceil(
        (triggerDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        lease_id: lease.id,
        property: lease.property,
        type_bail: lease.type_bail,
        loyer: lease.loyer,
        date_fin: lease.date_fin,
        trigger_date: triggerDate.toISOString().split("T")[0],
        days_until_trigger: daysUntilTrigger,
        will_trigger_soon: daysUntilTrigger <= 0,
      };
    });

    return NextResponse.json({ 
      upcoming_triggers: upcomingTriggers,
      count: upcomingTriggers.length,
    });
  } catch (error) {
    console.error("Erreur API trigger GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

