import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * GET /api/properties/test - Endpoint de test minimal pour diagnostiquer l'erreur 500
 */
export async function GET(request: Request) {
  console.log("[TEST /api/properties/test] === START ===");
  
  try {
    // Test 1: Authentification
    console.log("[TEST] Step 1: Authentication");
    const authResult = await getAuthenticatedUser(request);
    console.log("[TEST] Auth result:", {
      hasUser: !!authResult.user,
      hasError: !!authResult.error,
      errorMessage: authResult.error?.message,
    });

    if (authResult.error || !authResult.user) {
      return NextResponse.json({
        step: "authentication",
        error: "Auth failed",
        details: authResult.error,
      }, { status: 401 });
    }

    // Test 2: Variables d'environnement
    console.log("[TEST] Step 2: Environment variables");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[TEST] Env vars:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        step: "environment",
        error: "Missing env vars",
        details: { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey },
      }, { status: 500 });
    }

    // Test 3: Création du client Supabase
    console.log("[TEST] Step 3: Creating Supabase client");
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const dbClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[TEST] Client created successfully");

    // Test 4: Récupération du profil
    console.log("[TEST] Step 4: Fetching profile");
    const profileResult = await dbClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", authResult.user.id)
      .single();

    console.log("[TEST] Profile result:", {
      hasProfile: !!profileResult.data,
      hasError: !!profileResult.error,
      errorMessage: profileResult.error?.message,
      errorCode: profileResult.error?.code,
      errorDetails: profileResult.error?.details,
      errorHint: profileResult.error?.hint,
    });

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json({
        step: "profile",
        error: "Profile not found",
        details: profileResult.error,
      }, { status: 404 });
    }

    // Test 5: Requête properties simple
    console.log("[TEST] Step 5: Fetching properties");
    const propertiesResult = await dbClient
      .from("properties")
      .select("id, owner_id, adresse_complete")
      .eq("owner_id", profileResult.data.id)
      .limit(5);

    console.log("[TEST] Properties result:", {
      hasData: !!propertiesResult.data,
      dataLength: propertiesResult.data?.length || 0,
      hasError: !!propertiesResult.error,
      errorMessage: propertiesResult.error?.message,
      errorCode: propertiesResult.error?.code,
      errorDetails: propertiesResult.error?.details,
      errorHint: propertiesResult.error?.hint,
    });

    return NextResponse.json({
      success: true,
      steps: {
        authentication: "✅ OK",
        environment: "✅ OK",
        client: "✅ OK",
        profile: "✅ OK",
        properties: propertiesResult.error ? "❌ ERROR" : "✅ OK",
      },
      profile: {
        id: profileResult.data.id,
        role: profileResult.data.role,
      },
      properties: {
        count: propertiesResult.data?.length || 0,
        error: propertiesResult.error ? {
          message: propertiesResult.error.message,
          code: propertiesResult.error.code,
          details: propertiesResult.error.details,
          hint: propertiesResult.error.hint,
        } : null,
        data: propertiesResult.data || [],
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error("[TEST] Unexpected error:", error);
    return NextResponse.json({
      step: "unexpected",
      error: "Unexpected error",
      message: error?.message,
      stack: error?.stack,
    }, { status: 500 });
  }
}

