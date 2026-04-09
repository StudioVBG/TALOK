export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * API RGPD Consentements
 *
 * GET  /api/rgpd/consent → Récupérer les consentements de l'utilisateur
 * POST /api/rgpd/consent → Enregistrer/mettre à jour des consentements
 *
 * Enregistre chaque changement dans consent_records (historique)
 * et synchronise user_consents (état courant).
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const consentUpdateSchema = z.object({
  consents: z
    .array(
      z.object({
        consent_type: z.enum([
          "cgu",
          "privacy_policy",
          "marketing",
          "analytics",
          "cookies_functional",
          "cookies_analytics",
        ]),
        granted: z.boolean(),
        version: z.string().min(1),
      })
    )
    .optional(),
  // Single consent shorthand (from CookieBanner)
  consent_type: z
    .enum([
      "cgu",
      "privacy_policy",
      "marketing",
      "analytics",
      "cookies_functional",
      "cookies_analytics",
    ])
    .optional(),
  granted: z.boolean().optional(),
  version: z.string().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Get current consents from user_consents
    const { data: userConsents } = await supabase
      .from("user_consents")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get consent history from consent_records
    const { data: records } = await supabase
      .from("consent_records")
      .select("*")
      .eq("profile_id", (profile as any).id)
      .order("granted_at", { ascending: false })
      .limit(50);

    // Get latest data request
    const { data: lastExport } = await supabase
      .from("data_requests")
      .select("created_at")
      .eq("profile_id", (profile as any).id)
      .eq("request_type", "export")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      consents: userConsents || null,
      history: records || [],
      last_export_date: (lastExport as any)?.created_at || null,
    });
  } catch (error: unknown) {
    console.error("[rgpd/consent] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = consentUpdateSchema.parse(body);

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileId = (profile as any).id;

    // Normalize to array of consents
    let consentUpdates: { consent_type: string; granted: boolean; version: string }[];
    if (validated.consents) {
      consentUpdates = validated.consents;
    } else if (validated.consent_type !== undefined && validated.granted !== undefined) {
      consentUpdates = [
        {
          consent_type: validated.consent_type,
          granted: validated.granted,
          version: validated.version || "1.0",
        },
      ];
    } else {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    // Get IP and user agent from headers
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    // Insert into consent_records (history)
    const records = consentUpdates.map((c) => ({
      profile_id: profileId,
      consent_type: c.consent_type,
      granted: c.granted,
      version: c.version,
      ip_address: ip,
      user_agent: userAgent,
    }));

    const { error: recordError } = await supabase.from("consent_records").insert(records as any);

    if (recordError) {
      console.error("[rgpd/consent] Record insert error:", recordError);
    }

    // Sync user_consents (current state)
    const consentMap: Record<string, boolean> = {};
    for (const c of consentUpdates) {
      if (c.consent_type === "cookies_analytics") consentMap.cookies_analytics = c.granted;
      if (c.consent_type === "marketing") consentMap.cookies_ads = c.granted;
    }

    if (Object.keys(consentMap).length > 0) {
      await supabase
        .from("user_consents")
        .upsert(
          {
            user_id: user.id,
            ...consentMap,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id" }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("[rgpd/consent] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
