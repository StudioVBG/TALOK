export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/properties/diagnostic - Diagnostic complet de l'endpoint /api/properties
 * 
 * Cet endpoint teste chaque étape isolément et retourne un rapport détaillé
 * pour identifier précisément où l'erreur se produit.
 */
export async function GET(request: Request) {
  const diagnostic: any = {
    timestamp: new Date().toISOString(),
    steps: {},
    errors: [],
    success: false,
  };

  try {
    // ÉTAPE 1: Création du client Supabase
    diagnostic.steps.step1_createClient = { status: "pending", startTime: Date.now() };
    let supabase;
    try {
      supabase = await createClient();
      diagnostic.steps.step1_createClient = {
        status: "success",
        duration: Date.now() - diagnostic.steps.step1_createClient.startTime,
        message: "Client Supabase créé avec succès",
      };
    } catch (clientError: any) {
      diagnostic.steps.step1_createClient = {
        status: "error",
        duration: Date.now() - diagnostic.steps.step1_createClient.startTime,
        error: {
          message: clientError?.message,
          name: clientError?.name,
          stack: clientError?.stack,
        },
      };
      diagnostic.errors.push({ step: 1, error: clientError?.message });
      return NextResponse.json(diagnostic, { status: 500 });
    }

    // ÉTAPE 2: Authentification
    diagnostic.steps.step2_auth = { status: "pending", startTime: Date.now() };
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    diagnostic.steps.step2_auth = {
      status: authError || !user ? "error" : "success",
      duration: Date.now() - diagnostic.steps.step2_auth.startTime,
      hasUser: !!user,
      userId: user?.id,
      hasError: !!authError,
      error: authError ? {
        message: authError.message,
        code: authError.code,
        status: authError.status,
      } : null,
    };

    if (authError || !user) {
      diagnostic.errors.push({ step: 2, error: authError?.message || "User not found" });
      return NextResponse.json(diagnostic, { status: 401 });
    }

    // ÉTAPE 3: Récupération du profil
    diagnostic.steps.step3_profile = { status: "pending", startTime: Date.now() };
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, user_id")
      .eq("user_id", user.id)
      .single();

    diagnostic.steps.step3_profile = {
      status: profileError || !profile ? "error" : "success",
      duration: Date.now() - diagnostic.steps.step3_profile.startTime,
      hasProfile: !!profile,
      profileId: profile?.id,
      role: profile?.role,
      hasError: !!profileError,
      error: profileError ? {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      } : null,
    };

    if (profileError || !profile) {
      diagnostic.errors.push({ step: 3, error: profileError?.message || "Profile not found" });
      return NextResponse.json(diagnostic, { status: 404 });
    }

    // ÉTAPE 4: Construction de la requête (selon le rôle)
    diagnostic.steps.step4_buildQuery = { status: "pending", startTime: Date.now() };
    
    let query: any = null;
    let queryDescription = "";

    if (profile.role === "admin") {
      queryDescription = "Admin query: all properties";
      query = supabase
        .from("properties")
        .select("id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat")
        .order("created_at", { ascending: false });
    } else if (profile.role === "owner") {
      queryDescription = `Owner query: properties where owner_id = ${profile.id}`;
      query = supabase
        .from("properties")
        .select("id, owner_id, type, type_bien, adresse_complete, surface, nb_pieces, created_at")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });
    } else {
      // Locataires : logique complexe
      queryDescription = "Tenant query: properties via lease_signers → leases";
      
      // 4a: Récupérer les lease_signers
      diagnostic.steps.step4a_leaseSigners = { status: "pending", startTime: Date.now() };
      const { data: signers, error: signersError } = await supabase
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", profile.id)
        .in("role", ["locataire_principal", "colocataire"])
        .limit(50);

      diagnostic.steps.step4a_leaseSigners = {
        status: signersError ? "error" : "success",
        duration: Date.now() - diagnostic.steps.step4a_leaseSigners.startTime,
        signersCount: signers?.length || 0,
        hasError: !!signersError,
        error: signersError ? {
          message: signersError.message,
          code: signersError.code,
        } : null,
      };

      if (signersError || !signers || signers.length === 0) {
        diagnostic.steps.step4_buildQuery = {
          status: "success",
          duration: Date.now() - diagnostic.steps.step4_buildQuery.startTime,
          message: "No lease signers found, returning empty array",
          queryDescription,
        };
        return NextResponse.json({
          ...diagnostic,
          success: true,
          result: { properties: [], count: 0 },
        }, { status: 200 });
      }

      const leaseIds = signers.map((s) => s.lease_id).filter(Boolean) as string[];
      
      // 4b: Récupérer les leases actifs
      diagnostic.steps.step4b_leases = { status: "pending", startTime: Date.now() };
      const { data: leases, error: leasesError } = await supabase
        .from("leases")
        .select("property_id")
        .in("id", leaseIds)
        .eq("statut", "active")
        .limit(50);

      diagnostic.steps.step4b_leases = {
        status: leasesError ? "error" : "success",
        duration: Date.now() - diagnostic.steps.step4b_leases.startTime,
        leasesCount: leases?.length || 0,
        hasError: !!leasesError,
        error: leasesError ? {
          message: leasesError.message,
          code: leasesError.code,
        } : null,
      };

      if (leasesError || !leases || leases.length === 0) {
        diagnostic.steps.step4_buildQuery = {
          status: "success",
          duration: Date.now() - diagnostic.steps.step4_buildQuery.startTime,
          message: "No active leases found, returning empty array",
          queryDescription,
        };
        return NextResponse.json({
          ...diagnostic,
          success: true,
          result: { properties: [], count: 0 },
        }, { status: 200 });
      }

      const propertyIds = Array.from(new Set(leases.map((l) => l.property_id).filter(Boolean) as string[]));
      
      query = supabase
        .from("properties")
        .select("id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat")
        .in("id", propertyIds)
        .order("created_at", { ascending: false });
    }

    if (!query) {
      diagnostic.steps.step4_buildQuery = {
        status: "error",
        duration: Date.now() - diagnostic.steps.step4_buildQuery.startTime,
        error: "No query built",
        role: profile.role,
      };
      diagnostic.errors.push({ step: 4, error: "No query built" });
      return NextResponse.json(diagnostic, { status: 500 });
    }

    diagnostic.steps.step4_buildQuery = {
      status: "success",
      duration: Date.now() - diagnostic.steps.step4_buildQuery.startTime,
      queryDescription,
      role: profile.role,
    };

    // ÉTAPE 5: Exécution de la requête
    diagnostic.steps.step5_executeQuery = { status: "pending", startTime: Date.now() };
    const { data, error, count } = await query;

    diagnostic.steps.step5_executeQuery = {
      status: error ? "error" : "success",
      duration: Date.now() - diagnostic.steps.step5_executeQuery.startTime,
      dataLength: data?.length ?? 0,
      dataIsArray: Array.isArray(data),
      count,
      hasError: !!error,
      error: error ? {
        message: error instanceof Error ? error.message : "Une erreur est survenue",
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null,
      sampleData: data && data.length > 0 ? data.slice(0, 2) : null, // Premiers 2 éléments pour debug
    };

    if (error) {
      diagnostic.errors.push({ 
        step: 5, 
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(diagnostic, { status: 500 });
    }

    // SUCCÈS
    diagnostic.success = true;
    diagnostic.result = {
      propertiesCount: data?.length ?? 0,
      count,
      sampleProperties: data && data.length > 0 ? data.slice(0, 3) : [],
    };

    return NextResponse.json(diagnostic, { status: 200 });

  } catch (e: any) {
    diagnostic.errors.push({
      step: "unexpected",
      error: e?.message,
      stack: e?.stack,
    });
    diagnostic.steps.unexpectedError = {
      message: e?.message,
      name: e?.name,
      stack: e?.stack,
    };
    return NextResponse.json(diagnostic, { status: 500 });
  }
}

