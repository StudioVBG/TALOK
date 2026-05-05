export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Inviter un prestataire externe (Google/OSM) à rejoindre Talok
// POST /api/providers/external-favorites/[placeId]/invite
//
// Remplace l'ancien `mailto:` qui sortait de l'app : on envoie
// désormais le mail depuis no-reply@talok.fr (Resend) avec un lien
// d'inscription tracké, et l'utilisateur reste dans l'app.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { withFeatureAccess } from "@/lib/middleware/subscription-check";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";
import { applyRateLimit } from "@/lib/rate-limit/upstash";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InvitePayload {
  email: string;
  custom_message?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  if (!placeId) {
    return NextResponse.json({ error: "placeId manquant" }, { status: 400 });
  }

  let body: InvitePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  // Garde-fou anti-abus : un message custom de 2000 caractères max, sinon
  // un propriétaire pourrait écrire un essai entier.
  const customMessage = body.custom_message?.trim().slice(0, 2000) || undefined;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .eq("user_id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  // Même feature gate que /nearby — la marketplace est Pro+.
  const featureCheck = await withFeatureAccess(profile.id, "providers_management");
  if (!featureCheck.allowed) {
    return NextResponse.json(
      {
        error: "premium_required",
        message: featureCheck.message,
        required_plan: featureCheck.requiredPlan,
      },
      { status: 403 },
    );
  }

  // Rate-limit anti-abus : max 20 invitations/jour par owner. Évite qu'un
  // compte compromis spamme tout le carnet d'artisans Google.
  const rl = await applyRateLimit({
    key: `provider-invite:${profile.id}`,
    limit: 20,
    windowSec: 24 * 60 * 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Limite quotidienne atteinte (20 invitations/24 h)." },
      { status: 429 },
    );
  }

  // Vérifier que le placeId est bien dans les favoris du propriétaire.
  // On évite ainsi qu'un owner spamme un place_id arbitraire sans l'avoir
  // ajouté en favori, et on récupère le nom enregistré pour personnaliser.
  const { data: favorite } = await (supabase as any)
    .from("provider_external_favorites")
    .select("name, phone")
    .eq("owner_profile_id", profile.id)
    .eq("place_id", placeId)
    .maybeSingle();

  if (!favorite) {
    return NextResponse.json(
      { error: "Ce prestataire doit être enregistré en favori avant d'envoyer une invitation." },
      { status: 404 },
    );
  }

  const ownerName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Un propriétaire";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
  // UTM pour tracer la conversion côté analytics (PostHog) sans passer par
  // une table de tracking dédiée — chaque inscription `provider` issue de
  // ce flux remontera un `utm_source=marketplace_invite`.
  const registerUrl = `${appUrl}/auth/register?role=provider&utm_source=marketplace_invite&utm_medium=email&utm_campaign=owner_invite`;

  const template = emailTemplates.providerInviteFromOwner({
    providerName: favorite.name || "Prestataire",
    ownerName,
    customMessage,
    registerUrl,
  });

  try {
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      tags: [{ name: "type", value: "provider_invite_from_owner" }],
      // Idempotency-key par couple owner+place+email : si l'utilisateur clique
      // 2 fois, on ne renvoie pas 2 mails dans la même fenêtre.
      idempotencyKey: `provider-invite-from-owner/${profile.id}/${placeId}/${email}`,
    });
  } catch (err) {
    console.error("[providers/invite] Resend error:", err);
    return NextResponse.json(
      { error: "L'envoi de l'email a échoué. Réessayez dans un instant." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
