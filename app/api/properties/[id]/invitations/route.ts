export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateCode } from "@/lib/helpers/code-generator";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

/**
 * POST /api/properties/[id]/invitations - Générer un code d'invitation unique pour un logement
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting: 20 invitations par heure par utilisateur
    const rateLimitResponse = applyRateLimit(request, "invitation", user.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { unit_id, role = "locataire_principal" } = body;

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", id as any)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    // SOTA 2026: Vérifier que le profil existe AVANT de comparer
    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    const propertyData = property as any;
    if (propertyData.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si un code actif existe déjà pour cette unité
    if (unit_id) {
      const { data: existing } = await supabase
        .from("unit_access_codes")
        .select("id")
        .eq("unit_id", unit_id)
        .eq("status", "active" as any)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "Un code actif existe déjà pour cette unité" },
          { status: 409 }
        );
      }
    }

    // Générer un code unique (ULID ou UUID + préfixe lisible)
    const code = await generateUniqueCode(supabase);

    // Créer le code d'accès
    const { data: accessCode, error } = await supabase
      .from("unit_access_codes")
      .insert({
        unit_id: unit_id || null,
        property_id: id,
        code,
        status: "active",
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const accessCodeData = accessCode as any;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Property.InvitationCreated",
      payload: {
        access_code_id: accessCodeData.id,
        property_id: id as any,
        unit_id: unit_id || null,
        code,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "invitation_created",
      entity_type: "property",
      entity_id: id,
      metadata: { code, unit_id },
    } as any);

    return NextResponse.json({
      access_code: accessCode,
      invitation_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${code}`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/properties/[id]/invitations - Lister les codes d'invitation d'un logement
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", id as any)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    // SOTA 2026: Vérifier que le profil existe AVANT de comparer
    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    const propertyData = property as any;
    if (propertyData.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les codes
    const { data: codes, error } = await supabase
      .from("unit_access_codes")
      .select("*")
      .eq("property_id", id as any)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ codes: codes || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Génère un index aléatoire cryptographiquement sécurisé
 */
function getSecureRandomIndex(max: number): number {
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return randomBuffer[0] % max;
}

/**
 * Génère une chaîne aléatoire cryptographiquement sécurisée
 */
function getSecureRandomString(length: number, charset: string): string {
  return Array.from({ length }, () => charset[getSecureRandomIndex(charset.length)]).join("");
}

/**
 * Génère un code unique cryptographiquement sécurisé au format PROP-XXXX-XXXX
 * Vérifie l'unicité en base de données avant de retourner
 */
async function generateUniqueCode(supabase: any): Promise<string> {
  const prefix = "PROP";
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code: string;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    // Générer 8 caractères aléatoires cryptographiquement sécurisés
    const randomPart = getSecureRandomString(8, charset);
    code = `${prefix}-${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}`;

    // Vérifier l'unicité
    const { data: existing } = await supabase
      .from("unit_access_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    exists = !!existing;
    attempts++;
  }

  if (exists) {
    throw new Error("Impossible de générer un code unique après 10 tentatives");
  }

  return code!;
}





