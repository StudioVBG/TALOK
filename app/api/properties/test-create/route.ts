import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";

/**
 * Endpoint de test pour diagnostiquer l'erreur 500 sur POST /api/properties
 * GET /api/properties/test-create
 */
export async function GET(request: Request) {
  const logs: any[] = [];
  const addLog = (step: string, status: string, data?: any) => {
    logs.push({ step, status, timestamp: new Date().toISOString(), data });
    console.log(`[test-create] ${step} - ${status}`, data || "");
  };

  try {
    // Step 1: Vérifier l'authentification
    addLog("1-auth", "start");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      addLog("1-auth", "error", { error: authError });
      return NextResponse.json({ error: "Non authentifié", logs }, { status: 401 });
    }
    addLog("1-auth", "success", { userId: user.id });

    // Step 2: Vérifier les variables d'environnement
    addLog("2-env", "start");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      addLog("2-env", "error", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!serviceRoleKey 
      });
      return NextResponse.json({ 
        error: "Configuration manquante", 
        logs 
      }, { status: 500 });
    }
    addLog("2-env", "success", { 
      url: supabaseUrl.substring(0, 20) + "...",
      keyLength: serviceRoleKey.length 
    });

    // Step 3: Créer le service client
    addLog("3-service-client", "start");
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    addLog("3-service-client", "success");

    // Step 4: Récupérer le profil
    addLog("4-profile", "start");
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      addLog("4-profile", "error", { error: profileError });
      return NextResponse.json({ 
        error: "Profil non trouvé", 
        logs 
      }, { status: 404 });
    }
    addLog("4-profile", "success", { 
      profileId: profile.id, 
      role: profile.role 
    });

    // Step 5: Vérifier les permissions
    addLog("5-permissions", "start");
    if (profile.role !== "owner") {
      addLog("5-permissions", "error", { role: profile.role });
      return NextResponse.json({ 
        error: "Seuls les propriétaires peuvent créer des propriétés", 
        logs 
      }, { status: 403 });
    }
    addLog("5-permissions", "success");

    // Step 6: Générer un code unique
    addLog("6-unique-code", "start");
    const { generateCode } = await import("@/lib/helpers/code-generator");
    let uniqueCode: string;
    try {
      uniqueCode = await generateCode();
      addLog("6-unique-code", "success", { code: uniqueCode });
    } catch (codeError: any) {
      addLog("6-unique-code", "error", { error: codeError.message });
      return NextResponse.json({ 
        error: "Erreur génération code", 
        logs 
      }, { status: 500 });
    }

    // Step 7: Préparer le payload d'insertion
    addLog("7-payload", "start");
    const insertPayload = {
      owner_id: profile.id,
      type_bien: "appartement",
      type: "appartement",
      usage_principal: "habitation",
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
      loyer_base: 0,
      loyer_hc: 0,
      charges_mensuelles: 0,
      depot_garantie: 0,
      zone_encadrement: false,
      encadrement_loyers: false,
      unique_code: uniqueCode,
      etat: "draft",
    };
    addLog("7-payload", "success", { 
      owner_id: insertPayload.owner_id,
      type_bien: insertPayload.type_bien 
    });

    // Step 8: Tenter l'insertion
    addLog("8-insert", "start");
    const { data, error: insertError } = await serviceClient
      .from("properties")
      .insert(insertPayload)
      .select("id, owner_id, type_bien, etat")
      .single();

    if (insertError) {
      addLog("8-insert", "error", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        error: insertError,
      });
      return NextResponse.json({
        error: "Erreur insertion",
        insertError: {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        },
        logs,
      }, { status: 500 });
    }

    addLog("8-insert", "success", {
      id: data.id,
      owner_id: data.owner_id,
      type_bien: data.type_bien,
      etat: data.etat,
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
    return NextResponse.json({
      error: "Erreur inattendue",
      errorDetails: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : typeof error,
      },
      logs,
    }, { status: 500 });
  }
}

