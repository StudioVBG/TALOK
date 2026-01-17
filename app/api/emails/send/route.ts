export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/emails/resend.service";

/**
 * API Route pour l'envoi d'emails
 * 
 * POST /api/emails/send
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
    const body = await request.json();
    const { to, subject, html, text, replyTo, cc, bcc } = body;

    // Validation basique
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Les champs 'to', 'subject' et 'html' sont requis" },
        { status: 400 }
      );
    }

    // Vérifier si Resend est configuré
    if (!process.env.RESEND_API_KEY) {
      console.warn("[Email] RESEND_API_KEY non configurée - Mode simulation");
      console.log("[Email] Simulation d'envoi:", { to, subject });
      
      return NextResponse.json({ 
        success: true, 
        message: "Email simulé (RESEND_API_KEY non configurée)",
        simulated: true 
      });
    }

    // Envoyer l'email via Resend
    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erreur lors de l'envoi" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Email envoyé avec succès",
      id: result.id 
    });
  } catch (error: unknown) {
    console.error("[API Email] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
