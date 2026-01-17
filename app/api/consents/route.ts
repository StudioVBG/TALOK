export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { consentsSchema } from "@/lib/validations/onboarding";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validation
    const validated = consentsSchema.parse(body);

    // Récupérer l'utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Sauvegarder les consentements
    const { error } = await supabase.from("user_consents").upsert(
      {
        user_id: user.id as any,
        terms_version: validated.terms_version,
        privacy_version: validated.privacy_version,
        terms_accepted: validated.terms_accepted,
        privacy_accepted: validated.privacy_accepted,
        terms_accepted_at: validated.terms_accepted ? new Date().toISOString() : null,
        privacy_accepted_at: validated.privacy_accepted ? new Date().toISOString() : null,
        cookies_necessary: validated.cookies_necessary,
        cookies_analytics: validated.cookies_analytics,
        cookies_ads: validated.cookies_ads,
      } as any,
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("Erreur sauvegarde consentements:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

