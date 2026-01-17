export const runtime = 'nodejs';

/**
 * API Route pour s'abonner aux notifications push
 * POST /api/notifications/push/subscribe
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  device_type: z.enum(["web", "ios", "android"]).optional().default("web"),
  device_name: z.string().optional(),
  browser: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = subscribeSchema.parse(body);

    // Vérifier si l'abonnement existe déjà
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", validatedData.endpoint)
      .maybeSingle();

    if (existing) {
      // Mettre à jour
      await supabase
        .from("push_subscriptions")
        .update({
          p256dh_key: validatedData.keys.p256dh,
          auth_key: validatedData.keys.auth,
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      return NextResponse.json({ success: true, updated: true });
    }

    // Créer l'abonnement
    const { error: insertError } = await supabase
      .from("push_subscriptions")
      .insert({
        user_id: user.id,
        profile_id: profile.id,
        endpoint: validatedData.endpoint,
        p256dh_key: validatedData.keys.p256dh,
        auth_key: validatedData.keys.auth,
        device_type: validatedData.device_type,
        device_name: validatedData.device_name,
        browser: validatedData.browser,
      });

    if (insertError) {
      console.error("Erreur création abonnement push:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Créer les préférences de notification par défaut si elles n'existent pas
    await supabase
      .from("notification_preferences")
      .upsert({
        profile_id: profile.id,
        push_enabled: true,
      }, {
        onConflict: "profile_id",
      });

    return NextResponse.json({ success: true, created: true }, { status: 201 });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur subscribe push:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint requis" }, { status: 400 });
    }

    // Supprimer l'abonnement
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Erreur unsubscribe push:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}







