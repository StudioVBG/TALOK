export const runtime = 'nodejs';

/**
 * API Route pour envoyer des notifications push
 * POST /api/notifications/push/send
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { z } from "zod";

const sendPushSchema = z.object({
  profile_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).optional(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  icon: z.string().optional(),
  badge: z.string().optional(),
  data: z.record(z.any()).optional(),
  action_url: z.string().optional(),
  tag: z.string().optional(),
});

// Configuration VAPID
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@talok.fr";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = sendPushSchema.parse(body);

    if (!validatedData.profile_id && !validatedData.user_ids) {
      return NextResponse.json(
        { error: "profile_id ou user_ids requis" },
        { status: 400 }
      );
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "VAPID keys non configurées" },
        { status: 500 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Récupérer les abonnements push
    let query = serviceClient
      .from("push_subscriptions")
      .select("*")
      .eq("is_active", true);

    if (validatedData.profile_id) {
      query = query.eq("profile_id", validatedData.profile_id);
    } else if (validatedData.user_ids) {
      query = query.in("user_id", validatedData.user_ids);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error("Erreur récupération abonnements:", subError);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "Aucun abonnement push trouvé",
      });
    }

    // Importer web-push
    const webPush = await import("web-push");
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
      title: validatedData.title,
      body: validatedData.body,
      icon: validatedData.icon || "/icons/icon-192x192.png",
      badge: validatedData.badge || "/icons/badge-72x72.png",
      data: {
        ...validatedData.data,
        url: validatedData.action_url,
      },
      tag: validatedData.tag,
    });

    // Envoyer les notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key,
              },
            },
            payload
          );
          return { success: true, subscriptionId: sub.id };
        } catch (error: unknown) {
          // Si l'abonnement est invalide, le désactiver
          if (error.statusCode === 410 || error.statusCode === 404) {
            await serviceClient
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id);
          }
          return { success: false, subscriptionId: sub.id, error: error instanceof Error ? error.message : "Une erreur est survenue" };
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success
    ).length;
    const failed = results.length - sent;

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur envoi push:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Route GET pour récupérer la clé publique VAPID
export async function GET() {
  if (!VAPID_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "VAPID non configuré" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    publicKey: VAPID_PUBLIC_KEY,
  });
}







