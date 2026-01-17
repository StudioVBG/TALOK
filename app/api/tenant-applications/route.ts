export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/tenant-applications - Créer un dossier locataire avec code
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { code, unit_id, property_id } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Code requis" },
        { status: 400 }
      );
    }

    // Vérifier le code d'accès
    const { data: accessCode, error: codeError } = await supabaseClient
      .from("unit_access_codes")
      .select("*, unit:units(*), property:properties(*)")
      .eq("code", code as any)
      .eq("status", "active" as any)
      .single();

    if (codeError || !accessCode) {
      return NextResponse.json(
        { error: "Code invalide ou expiré" },
        { status: 404 }
      );
    }

    const accessCodeData = accessCode as any;
    const resolvedUnitId = unit_id || accessCodeData.unit_id;
    const resolvedPropertyId = property_id || accessCodeData.property_id || accessCodeData.unit?.property_id;

    // Récupérer le profil locataire
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .eq("role", "tenant" as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil locataire non trouvé" },
        { status: 404 }
      );
    }

    const profileData = profile as any;

    // Vérifier si un dossier existe déjà
    const { data: existing } = await supabaseClient
      .from("tenant_applications")
      .select("id")
      .eq("tenant_user", user.id as any)
      .eq("unit_id", resolvedUnitId as any)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Un dossier existe déjà pour ce logement" },
        { status: 409 }
      );
    }

    // Créer le dossier
    const { data: application, error: appError } = await supabaseClient
      .from("tenant_applications")
      .insert({
        unit_id: resolvedUnitId as any,
        property_id: resolvedPropertyId as any,
        tenant_user: user.id as any,
        tenant_profile_id: profileData.id,
        status: "started" as any,
      } as any)
      .select()
      .single();

    if (appError) throw appError;

    const applicationData = application as any;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "tenant.invite.accepted",
      payload: {
        application_id: applicationData.id,
        unit_id: resolvedUnitId,
        property_id: resolvedPropertyId,
        tenant_user: user.id,
      },
    } as any);

    return NextResponse.json({ application: applicationData });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tenant-applications - Lister les dossiers de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: applications, error } = await supabaseClient
      .from("tenant_applications")
      .select(`
        *,
        unit:units(*),
        property:properties(*)
      `)
      .eq("tenant_user", user.id as any)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ applications });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





