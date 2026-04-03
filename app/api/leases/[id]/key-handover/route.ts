/**
 * POST /api/leases/[id]/key-handover — Générer un token QR pour la remise des clés
 * GET  /api/leases/[id]/key-handover — Récupérer le statut de la remise des clés
 *
 * Sécurité : Seul le propriétaire du bail peut générer le QR.
 * Le token expire après 1 heure.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createHmac } from "crypto";
import { getInitialInvoiceSettlement } from "@/lib/services/invoice-status.service";
import { sendKeyHandoverScanRequest } from "@/lib/emails/resend.service";
import { sendSMS } from "@/lib/services/sms.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function generateHandoverToken(leaseId: string, expiresAt: string): string {
  const payload = JSON.stringify({ leaseId, expiresAt, nonce: randomUUID() });
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "talok-key-handover-secret";
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  // Token = base64(payload) + "." + hmac
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${hmac}`;
}

// verifyHandoverToken is in ./utils.ts (exported helpers are not allowed in Next.js route files)

/**
 * GET — Statut de la remise des clés pour ce bail
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id,
        property_id,
        properties!leases_property_id_fkey(owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    const isOwner = profile.role === "owner" && (lease as any).properties?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";
    let isSigner = false;

    if (!isOwner && !isAdmin) {
      const { data: signer } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("profile_id", profile.id)
        .maybeSingle();
      isSigner = !!signer;
    }

    if (!isOwner && !isAdmin && !isSigner) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Chercher une remise des clés existante
    const { data: handover } = await (serviceClient
      .from("key_handovers") as any)
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      exists: !!handover,
      handover: handover || null,
      confirmed: handover?.confirmed_at ? true : false,
    });
  } catch (error: unknown) {
    console.error("[key-handover GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST — Générer un QR code token pour la remise des clés
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Vérifier que l'utilisateur est propriétaire de ce bail
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Seul le propriétaire peut initier la remise des clés" }, { status: 403 });
    }

    // Vérifier que le bail existe et est en état approprié
    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        property_id,
        properties!leases_property_id_fkey(owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    if ((lease as any).properties?.owner_id !== profile.id) {
      return NextResponse.json({ error: "Ce bail ne vous appartient pas" }, { status: 403 });
    }

    if (!["fully_signed", "active"].includes(lease.statut)) {
      return NextResponse.json(
        { error: "Le bail doit être signé avant la remise des clés" },
        { status: 400 }
      );
    }

    if (!lease.property_id) {
      return NextResponse.json({ error: "Bail sans bien associé" }, { status: 400 });
    }

    const initialInvoiceSettlement = await getInitialInvoiceSettlement(serviceClient as any, leaseId);
    if (!initialInvoiceSettlement?.isSettled) {
      // Fallback: vérifier le flag initial_payment_confirmed sur le bail
      const { data: leasePaymentFlag } = await serviceClient
        .from("leases")
        .select("initial_payment_confirmed")
        .eq("id", leaseId)
        .single();
      if (!(leasePaymentFlag as any)?.initial_payment_confirmed) {
        return NextResponse.json(
          { error: "Le paiement initial doit être confirmé avant la remise des clés" },
          { status: 400 }
        );
      }
    }

    // Récupérer les clés depuis le dernier EDL d'entrée
    const { data: edl } = await (serviceClient
      .from("edl") as any)
      .select("id, keys, status")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const keys = edl?.keys || [];

    if (!edl || edl.status !== "signed") {
      return NextResponse.json(
        { error: "L'EDL d'entrée signé est requis avant la remise des clés" },
        { status: 400 }
      );
    }

    // Récupérer l'adresse du bien
    const { data: property } = await serviceClient
      .from("properties")
      .select("adresse_complete, code_postal, ville")
      .eq("id", lease.property_id)
      .single();

    // Vérifier s'il y a déjà une remise non confirmée
    const { data: existingHandover } = await (serviceClient
      .from("key_handovers") as any)
      .select("id, token, expires_at, confirmed_at")
      .eq("lease_id", leaseId)
      .is("confirmed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si un token existe et n'est pas expiré, le réutiliser
    if (existingHandover && new Date(existingHandover.expires_at) > new Date()) {
      return NextResponse.json({
        token: existingHandover.token,
        expires_at: existingHandover.expires_at,
        keys,
        property_address: property?.adresse_complete || "",
        handover_id: existingHandover.id,
      });
    }

    // Générer un nouveau token (expire dans 1h)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const token = generateHandoverToken(leaseId, expiresAt);

    // Enregistrer en DB
    const { data: handover, error: insertError } = await (serviceClient
      .from("key_handovers") as any)
      .insert({
        lease_id: leaseId,
        property_id: lease.property_id,
        owner_profile_id: profile.id,
        token,
        keys_list: keys,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[key-handover POST] Insert error:", insertError);
      throw insertError;
    }

    // === Notifications multi-canal au locataire ===
    // Ne jamais faire échouer la génération du QR code si une notification plante
    const propertyAddress = property?.adresse_complete || "";

    try {
      // Récupérer le(s) locataire(s) lié(s) au bail via lease_signers
      const { data: tenantSigners } = await serviceClient
        .from("lease_signers")
        .select("profile_id, profiles!lease_signers_profile_id_fkey(id, email, prenom, nom, telephone, user_id)")
        .eq("lease_id", leaseId)
        .in("role", ["locataire_principal", "colocataire"]);

      const tenants = (tenantSigners || [])
        .map((s: any) => s.profiles)
        .filter(Boolean);

      for (const tenant of tenants) {
        // 1. Email
        try {
          await sendKeyHandoverScanRequest({
            tenantEmail: tenant.email,
            tenantFirstName: tenant.prenom || tenant.nom || "Locataire",
            propertyAddress,
            leaseId,
            handoverId: handover.id,
            expiresAt: new Date(expiresAt),
          });
        } catch (emailError) {
          console.error("[key-handover] email notification failed:", emailError);
        }

        // 2. Push notification (Web Push + FCM via push_subscriptions)
        try {
          const { data: pushSubs } = await serviceClient
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", tenant.user_id)
            .eq("is_active", true)
            .limit(1);

          if (pushSubs && pushSubs.length > 0) {
            // Send via internal push API (handles both Web Push and FCM)
            const pushPayload = {
              user_ids: [tenant.user_id],
              title: "🔑 Remise des clefs",
              body: "Votre propriétaire vous attend. Ouvrez Talok pour scanner le QR code.",
              data: {
                action: "key_handover_scan",
                leaseId,
                redirectUrl: `/tenant/lease/${leaseId}/handover`,
              },
              action_url: `/tenant/lease/${leaseId}/handover`,
              tag: `key-handover-${handover.id}`,
            };

            // Use VAPID + FCM logic from push service inline
            const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
            const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@talok.fr";

            const { data: subscriptions } = await serviceClient
              .from("push_subscriptions")
              .select("*")
              .eq("user_id", tenant.user_id)
              .eq("is_active", true);

            if (subscriptions && subscriptions.length > 0) {
              const webSubs = subscriptions.filter((s: any) => s.device_type === "web" || !s.device_type);
              const nativeSubs = subscriptions.filter((s: any) => s.device_type === "android" || s.device_type === "ios");

              const payload = JSON.stringify({
                title: pushPayload.title,
                body: pushPayload.body,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/badge-72x72.png",
                data: pushPayload.data,
                tag: pushPayload.tag,
              });

              // Web Push
              if (webSubs.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
                try {
                  // @ts-ignore
                  const webPush = await import("web-push");
                  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
                  await Promise.allSettled(
                    webSubs.map((sub: any) =>
                      webPush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                        payload
                      ).catch(() => {})
                    )
                  );
                } catch (webPushErr) {
                  console.error("[key-handover] web push failed:", webPushErr);
                }
              }

              // FCM native
              if (nativeSubs.length > 0 && process.env.FIREBASE_SERVICE_ACCOUNT) {
                try {
                  const admin = await import("firebase-admin");
                  if (!admin.default.apps?.length) {
                    admin.default.initializeApp({
                      credential: admin.default.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
                    });
                  }
                  await Promise.allSettled(
                    nativeSubs.map((sub: any) => {
                      const fcmToken = sub.endpoint.startsWith("fcm://") ? sub.endpoint.slice(6) : sub.endpoint;
                      return admin.default.messaging().send({
                        token: fcmToken,
                        notification: { title: pushPayload.title, body: pushPayload.body },
                        data: { action: "key_handover_scan", leaseId, redirectUrl: `/tenant/lease/${leaseId}/handover` },
                      }).catch(() => {});
                    })
                  );
                } catch (fcmErr) {
                  console.error("[key-handover] FCM push failed:", fcmErr);
                }
              }
            }
          }
        } catch (pushError) {
          console.error("[key-handover] push notification failed:", pushError);
        }

        // 3. SMS si téléphone renseigné
        try {
          if (tenant.telephone) {
            await sendSMS({
              to: tenant.telephone,
              message: `[Talok] Votre propriétaire attend que vous confirmiez la remise des clefs. Ouvrez l'app Talok pour scanner le QR code. Support : support@talok.fr`,
            });
          }
        } catch (smsError) {
          console.error("[key-handover] SMS notification failed:", smsError);
        }
      }
    } catch (notifError) {
      // Ne jamais faire échouer la génération du QR code si les notifications plantent
      console.error("[key-handover] notification orchestration failed:", notifError);
    }

    return NextResponse.json({
      token,
      expires_at: expiresAt,
      keys,
      property_address: propertyAddress,
      handover_id: handover.id,
    });
  } catch (error: unknown) {
    console.error("[key-handover POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
