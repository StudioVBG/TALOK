import { NextResponse } from "next/server";

/**
 * Endpoint de test pour diagnostiquer l'erreur d'insertion
 * Utilise directement le service client pour tester l'insertion
 * GET /api/properties/test-insert?profileId=xxx
 */
export async function GET(request: Request) {
  const logs: any[] = [];
  const addLog = (step: string, status: string, data?: any) => {
    logs.push({ step, status, timestamp: new Date().toISOString(), data });
    console.log(`[test-insert] ${step} - ${status}`, data || "");
  };

  try {
    // Step 1: Vérifier les variables d'environnement
    addLog("1-env", "start");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      addLog("1-env", "error", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!serviceRoleKey 
      });
      return NextResponse.json({ 
        error: "Configuration manquante", 
        logs 
      }, { status: 500 });
    }
    addLog("1-env", "success", { 
      url: supabaseUrl.substring(0, 30) + "...",
      keyLength: serviceRoleKey.length 
    });

    // Step 2: Créer le service client
    addLog("2-service-client", "start");
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    addLog("2-service-client", "success");

    // Step 3: Récupérer un profil propriétaire pour le test
    addLog("3-profile", "start");
    const { data: profiles, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, user_id")
      .eq("role", "owner")
      .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
      addLog("3-profile", "error", { error: profileError });
      return NextResponse.json({ 
        error: "Aucun profil propriétaire trouvé", 
        logs 
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    addLog("3-profile", "success", { 
      profileId: profile.id, 
      role: profile.role 
    });

    // Step 4: Générer un code unique
    addLog("4-unique-code", "start");
    const { generateCode } = await import("@/lib/helpers/code-generator");
    let uniqueCode: string;
    try {
      uniqueCode = await generateCode();
      addLog("4-unique-code", "success", { code: uniqueCode });
    } catch (codeError: any) {
      addLog("4-unique-code", "error", { error: codeError.message });
      return NextResponse.json({ 
        error: "Erreur génération code", 
        logs 
      }, { status: 500 });
    }

    // Step 5: Préparer le payload d'insertion (uniquement colonnes existantes)
    addLog("5-payload", "start");
    const insertPayload = {
      owner_id: profile.id,
      type: "appartement", // ✅ Utiliser 'type' (pas 'type_bien')
      adresse_complete: "Adresse à compléter",
      code_postal: "00000",
      ville: "Ville à préciser",
      departement: "00",
      surface: 0,
      nb_pieces: 0,
      nb_chambres: 0,
      ascenseur: false,
      energie: null,
      ges: null,
      loyer_hc: 0, // ✅ Colonne existante
      encadrement_loyers: false, // ✅ Colonne existante
      unique_code: uniqueCode,
      etat: "draft",
      // ✅ Colonnes supprimées car elles n'existent pas :
      // - type_bien (utiliser 'type' à la place)
      // - usage_principal
      // - loyer_base
      // - charges_mensuelles
      // - depot_garantie
      // - zone_encadrement
    };
    addLog("5-payload", "success", { 
      owner_id: insertPayload.owner_id,
      type: insertPayload.type,
      unique_code: insertPayload.unique_code
    });

    // Step 6: Tester l'insertion
    addLog("6-insert", "start");
    console.log("[test-insert] Attempting insert with payload:", JSON.stringify(insertPayload, null, 2));
    
    const { data, error: insertError } = await serviceClient
      .from("properties")
      .insert(insertPayload)
      .select("id, owner_id, type, etat, unique_code")
      .single();

    if (insertError) {
      addLog("6-insert", "error", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        error: insertError,
      });
      
      console.error("[test-insert] Insert error details:", JSON.stringify({
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      }, null, 2));
      
      return NextResponse.json({
        error: "Erreur insertion",
        insertError: {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        },
        logs,
        payload: insertPayload,
      }, { status: 500 });
    }

    addLog("6-insert", "success", {
      id: data.id,
      owner_id: data.owner_id,
      type: data.type,
      etat: data.etat,
      unique_code: data.unique_code,
    });

    return NextResponse.json({
      success: true,
      property: data,
      logs,
    }, { status: 201 });

  } catch (error: unknown) {
    addLog("catch", "error", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    console.error("[test-insert] Unexpected error:", error);
    
    return NextResponse.json({
      error: "Erreur inattendue",
      errorDetails: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      },
      logs,
    }, { status: 500 });
  }
}

