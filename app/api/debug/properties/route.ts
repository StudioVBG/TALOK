/**
 * GET /api/debug/properties - Endpoint de debug pour vérifier le flux complet
 * 
 * Cet endpoint affiche toutes les étapes du processus de récupération des propriétés
 * pour faciliter le diagnostic
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
    finalResult: null,
  };

  try {
    // Étape 1 : Créer le client
    debug.steps.push({ step: 1, name: "createClient", status: "start" });
    const supabase = await createClient();
    debug.steps.push({ step: 1, name: "createClient", status: "success" });

    // Étape 2 : Authentification
    debug.steps.push({ step: 2, name: "getUser", status: "start" });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      debug.errors.push({ step: 2, error: authError?.message || "No user" });
      debug.steps.push({ step: 2, name: "getUser", status: "error", error: authError });
      return NextResponse.json(debug, { status: 401 });
    }
    
    debug.steps.push({ 
      step: 2, 
      name: "getUser", 
      status: "success", 
      data: { userId: user.id } 
    });

    // Étape 3 : Récupérer le profil
    debug.steps.push({ step: 3, name: "getProfile", status: "start" });
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      debug.errors.push({ step: 3, error: profileError?.message || "No profile" });
      debug.steps.push({ step: 3, name: "getProfile", status: "error", error: profileError });
      return NextResponse.json(debug, { status: 404 });
    }

    debug.steps.push({ 
      step: 3, 
      name: "getProfile", 
      status: "success", 
      data: { 
        profileId: profile.id, 
        userId: profile.user_id,
        role: profile.role,
        profileIdMatchesUserId: profile.id === profile.user_id,
      } 
    });

    // Étape 4 : Vérifier directement dans la base avec le profile.id
    debug.steps.push({ step: 4, name: "directQuery", status: "start" });
    const { data: directProperties, error: directError } = await supabase
      .from("properties")
      .select("id, owner_id, adresse_complete, etat, type, created_at")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });

    if (directError) {
      debug.errors.push({ step: 4, error: directError.message });
      debug.steps.push({ step: 4, name: "directQuery", status: "error", error: directError });
    } else {
      debug.steps.push({ 
        step: 4, 
        name: "directQuery", 
        status: "success", 
        data: { 
          count: directProperties?.length || 0,
          properties: directProperties || [],
        } 
      });
    }

    // Étape 5 : Requête via l'API normale (comme dans GET /api/properties)
    debug.steps.push({ step: 5, name: "apiQuery", status: "start" });
    const { data: apiProperties, error: apiError } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });

    if (apiError) {
      debug.errors.push({ step: 5, error: apiError.message });
      debug.steps.push({ step: 5, name: "apiQuery", status: "error", error: apiError });
    } else {
      debug.steps.push({ 
        step: 5, 
        name: "apiQuery", 
        status: "success", 
        data: { 
          count: apiProperties?.length || 0,
          // Ne pas inclure toutes les propriétés pour éviter une réponse trop lourde
          sampleProperty: apiProperties?.[0] ? {
            id: apiProperties[0].id,
            owner_id: apiProperties[0].owner_id,
            adresse_complete: apiProperties[0].adresse_complete,
            etat: apiProperties[0].etat,
          } : null,
        } 
      });
    }

    // Résultat final
    debug.finalResult = {
      userId: user.id,
      profileId: profile.id,
      profileUserId: profile.user_id,
      directQueryCount: directProperties?.length || 0,
      apiQueryCount: apiProperties?.length || 0,
      match: profile.id === profile.user_id ? "⚠️ profile.id = user_id (anormal)" : "✅ profile.id ≠ user_id (normal)",
      ownerIdFilter: profile.id,
    };

    return NextResponse.json(debug, { status: 200 });

  } catch (error: any) {
    debug.errors.push({ 
      step: "catch", 
      error: error?.message || String(error),
      stack: error?.stack 
    });
    debug.steps.push({ step: "catch", name: "exception", status: "error", error: error?.message });
    return NextResponse.json(debug, { status: 500 });
  }
}
