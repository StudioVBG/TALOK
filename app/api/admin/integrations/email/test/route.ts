export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/services/email-service";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Envoie un email de test pour vérifier la configuration email
 * @usage POST /api/admin/integrations/email/test { to: string }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.integrations.write"], {
      rateLimit: "adminCritical",
      auditAction: "Send test email",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", auth.user.id)
      .single();

    // Récupérer l'email de destination depuis le body (optionnel)
    let body: { to?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body vide, utiliser l'email de l'admin
    }

    const recipientEmail = body.to || auth.user.email;
    
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Aucune adresse email de destination" },
        { status: 400 }
      );
    }

    // Envoyer l'email de test
    const result = await sendEmail({
      to: recipientEmail,
      subject: "🧪 Test de configuration email - Talok",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">✅ Email de test</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
        Bonjour ${profile?.prenom || "Admin"} ${profile?.nom || ""},
      </p>
      
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
        🎉 <strong>Félicitations !</strong> Votre configuration email fonctionne parfaitement.
      </p>

      <!-- Config summary -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e293b;">📧 Configuration actuelle :</p>
        
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Fournisseur</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">Resend</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Environnement</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">${process.env.NODE_ENV || "development"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Force Send</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">${process.env.EMAIL_FORCE_SEND === "true" ? "Activé" : "Désactivé"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Date du test</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #64748b; margin: 0;">
        Cet email a été envoyé depuis la page d'intégrations de l'admin.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">
        Talok - Votre solution de gestion immobilière<br>
        © ${new Date().getFullYear()} Tous droits réservés
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email de test envoyé à ${recipientEmail}`,
        messageId: result.messageId,
        simulated: result.simulated || false,
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || "Échec de l'envoi",
          details: result.details 
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Erreur test email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

