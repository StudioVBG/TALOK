/**
 * Envoie un email de test
 * Usage: npx tsx scripts/test-email-to-user.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Charger .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Note: En mode gratuit Resend, on ne peut envoyer qu'à l'adresse du compte
const RECIPIENT = "support@talok.fr";
// IMPORTANT: Utiliser l'adresse de test Resend (pas besoin de vérification de domaine)
const FROM = "Talok <onboarding@resend.dev>";

async function send() {
  console.log("📧 Préparation de l'envoi...\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Récupérer la clé Resend depuis la DB
  const { data: provider, error: providerErr } = await supabase
    .from("api_providers")
    .select("id")
    .eq("name", "Resend")
    .single();

  if (providerErr || !provider) {
    console.error("❌ Provider Resend non trouvé");
    return;
  }

  const { data: cred, error: credErr } = await supabase
    .from("api_credentials")
    .select("secret_ref")
    .eq("provider_id", provider.id)
    .single();

  if (credErr || !cred?.secret_ref) {
    console.error("❌ Credentials Resend non trouvées");
    return;
  }

  // Déchiffrer la clé API
  const masterKey =
    process.env.API_KEY_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  const [ivHex, authTagHex, encrypted] = cred.secret_ref.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const apiKey =
    decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");

  console.log("✅ Clé API récupérée et déchiffrée");
  console.log("📤 Envoi vers:", RECIPIENT);
  console.log("📨 Depuis:", FROM);
  console.log("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [RECIPIENT],
      subject: "✅ Test Talok - Configuration réussie !",
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 40px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Configuration réussie !</h1>
    </div>
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: 0;">
      <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
        Bonjour <strong>Thomas</strong>,
      </p>
      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        Votre service d'envoi d'emails <strong>Resend</strong> est maintenant 
        correctement configuré pour votre application <strong>Talok</strong>.
      </p>
      
      <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: #166534;">✅ Fonctionnalités activées</h3>
        <ul style="margin: 0; padding-left: 20px; color: #15803d;">
          <li>Invitations de bail par email</li>
          <li>Notifications de paiement</li>
          <li>Rappels de loyer</li>
          <li>Confirmations de signature</li>
        </ul>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
        <strong>Note :</strong> Cet email a été envoyé depuis l'adresse de test Resend 
        (<code>onboarding@resend.dev</code>). Pour envoyer depuis votre propre domaine, 
        <a href="https://resend.com/domains" style="color: #10b981;">vérifiez-le sur Resend</a>.
      </p>
    </div>
    
    <div style="text-align: center; padding: 20px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} Talok - Tous droits réservés
      </p>
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af;">
        Email envoyé le ${new Date().toLocaleString("fr-FR")}
      </p>
    </div>
  </div>
</body>
</html>`,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log("═══════════════════════════════════════════");
    console.log("✅ EMAIL ENVOYÉ AVEC SUCCÈS !");
    console.log("═══════════════════════════════════════════");
    console.log("📧 Message ID:", data.id);
    console.log("");
    console.log("📬 Vérifiez votre boîte mail :", RECIPIENT);
    console.log("   (Pensez aussi au dossier spam/promotions)");
    console.log("");
  } else {
    const err = await res.json();
    console.error("❌ Erreur lors de l'envoi :");
    console.error(JSON.stringify(err, null, 2));
  }
}

send().catch(console.error);

