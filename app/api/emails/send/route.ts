export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emails/resend.service";
import { validateEmailContent, validateEmails } from "@/lib/emails/utils/validation";
import { checkRateLimitBatch } from "@/lib/emails/utils/rate-limit";

/**
 * API Route pour l'envoi d'emails
 *
 * POST /api/emails/send
 *
 * SÉCURITÉ: Cette route est protégée par authentification.
 * Seuls les utilisateurs connectés avec le rôle 'admin' ou 'owner' peuvent l'utiliser.
 * Alternative: utiliser un header x-internal-api-key pour les appels internes.
 *
 * Body:
 * - to: string | string[] - Destinataire(s)
 * - subject: string - Sujet
 * - html: string - Contenu HTML
 * - text?: string - Version texte (optionnel)
 * - replyTo?: string - Adresse de réponse
 * - cc?: string[] - Copie carbone
 * - bcc?: string[] - Copie cachée
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================
    // AUTHENTIFICATION
    // ========================================

    // Option 1: Vérifier le header API key pour les appels internes
    const internalApiKey = request.headers.get("x-internal-api-key");
    const expectedApiKey = process.env.INTERNAL_EMAIL_API_KEY;

    let isInternalCall = false;
    if (expectedApiKey && internalApiKey === expectedApiKey) {
      isInternalCall = true;
    }

    // Option 2: Vérifier l'authentification utilisateur
    if (!isInternalCall) {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Non authentifié", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }

      // Vérifier le rôle
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: "Profil non trouvé", code: "PROFILE_NOT_FOUND" },
          { status: 403 }
        );
      }

      // Seuls les admins et owners peuvent envoyer des emails via cette route
      const allowedRoles = ["admin", "owner"];
      if (!allowedRoles.includes(profile.role)) {
        console.warn(
          `[API Email] Accès refusé pour user ${user.id} avec rôle ${profile.role}`
        );
        return NextResponse.json(
          {
            error: "Accès refusé. Rôle insuffisant.",
            code: "FORBIDDEN",
            requiredRoles: allowedRoles,
          },
          { status: 403 }
        );
      }
    }

    // ========================================
    // VALIDATION
    // ========================================

    const body = await request.json();
    const { to, subject, html, text, replyTo, cc, bcc } = body;

    // Validation du contenu
    const contentValidation = validateEmailContent({ to, subject, html, text });
    if (!contentValidation.valid) {
      return NextResponse.json(
        {
          error: "Données invalides",
          code: "VALIDATION_ERROR",
          details: contentValidation.errors,
        },
        { status: 400 }
      );
    }

    // Validation des destinataires
    const recipients = Array.isArray(to) ? to : [to];
    const emailValidation = validateEmails(recipients);

    if (!emailValidation.valid) {
      return NextResponse.json(
        {
          error: "Adresses email invalides",
          code: "INVALID_RECIPIENTS",
          invalidEmails: emailValidation.invalidEmails,
        },
        { status: 400 }
      );
    }

    // ========================================
    // RATE LIMITING
    // ========================================

    const rateLimitResult = checkRateLimitBatch(emailValidation.validEmails);

    if (!rateLimitResult.allowed) {
      console.warn(`[API Email] Rate limit: ${rateLimitResult.reason}`);
      return NextResponse.json(
        {
          error: rateLimitResult.reason,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)
            ),
          },
        }
      );
    }

    // ========================================
    // ENVOI
    // ========================================

    // Vérifier si Resend est configuré
    if (!process.env.RESEND_API_KEY) {
      console.warn("[Email] RESEND_API_KEY non configurée - Mode simulation");
      console.log("[Email] Simulation d'envoi:", {
        to: emailValidation.validEmails,
        subject,
      });

      return NextResponse.json({
        success: true,
        message: "Email simulé (RESEND_API_KEY non configurée)",
        simulated: true,
      });
    }

    // Envoyer l'email via Resend
    const result = await sendEmail({
      to: emailValidation.validEmails,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    if (!result.success) {
      console.error("[API Email] Échec envoi:", result.error);
      return NextResponse.json(
        {
          error: result.error || "Erreur lors de l'envoi",
          code: "SEND_FAILED",
        },
        { status: 500 }
      );
    }

    console.log(
      `[API Email] Email envoyé avec succès à ${emailValidation.validEmails.length} destinataire(s), ID: ${result.id}`
    );

    return NextResponse.json({
      success: true,
      message: "Email envoyé avec succès",
      id: result.id,
      recipientCount: emailValidation.validEmails.length,
    });
  } catch (error: any) {
    console.error("[API Email] Erreur:", error);
    return NextResponse.json(
      {
        error: error.message || "Erreur interne",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
