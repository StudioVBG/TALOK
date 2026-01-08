/**
 * Script de test pour l'envoi d'emails
 * 
 * Usage:
 *   npx tsx scripts/test-email.ts [email_destinataire]
 * 
 * Exemple:
 *   npx tsx scripts/test-email.ts votre.email@gmail.com
 */

import { config } from "dotenv";
import { sendEmail, sendLeaseInviteEmail, EMAIL_TEMPLATES } from "../lib/services/email-service";

// Charger .env.local
config({ path: ".env.local" });

async function main() {
  const testEmail = process.argv[2];

  console.log("\n📧 Test d'envoi d'emails");
  console.log("========================\n");

  // Vérifier la configuration
  console.log("🔧 Configuration :");
  console.log("   EMAIL_PROVIDER:", process.env.EMAIL_PROVIDER || "resend (par défaut)");
  console.log("   RESEND_API_KEY:", process.env.RESEND_API_KEY ? "✅ Configurée" : "❌ Non configurée");
  console.log("   EMAIL_API_KEY:", process.env.EMAIL_API_KEY ? "✅ Configurée" : "❌ Non configurée");
  console.log("   EMAIL_FROM:", process.env.EMAIL_FROM || "Talok <noreply@talok.fr>");
  console.log("   EMAIL_FORCE_SEND:", process.env.EMAIL_FORCE_SEND || "false");
  console.log("   NODE_ENV:", process.env.NODE_ENV || "development");
  console.log();

  // Vérifier si une clé API est disponible
  const hasApiKey = !!(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY);

  if (!hasApiKey) {
    console.log("⚠️  Aucune clé API email configurée !");
    console.log("\n📋 Pour configurer Resend :");
    console.log("   1. Créez un compte sur https://resend.com (gratuit)");
    console.log("   2. Récupérez votre API Key");
    console.log("   3. Ajoutez dans .env.local :");
    console.log('      RESEND_API_KEY=re_xxxxxxxxxx');
    console.log('      EMAIL_FORCE_SEND=true');
    console.log();
    
    if (!testEmail) {
      console.log("💡 Pour tester, ajoutez un email de test :");
      console.log("   npx tsx scripts/test-email.ts votre.email@gmail.com");
      return;
    }
  }

  if (!testEmail) {
    console.log("📋 Templates disponibles :");
    Object.keys(EMAIL_TEMPLATES).forEach((key) => {
      const template = EMAIL_TEMPLATES[key];
      console.log(`   - ${key}: "${template.subject}"`);
    });
    
    console.log("\n💡 Pour envoyer un email de test :");
    console.log("   npx tsx scripts/test-email.ts votre.email@gmail.com");
    return;
  }

  console.log(`📤 Envoi d'un email de test à : ${testEmail}\n`);

  // Test 1: Email simple
  console.log("Test 1: Email simple...");
  const result1 = await sendEmail({
    to: testEmail,
    subject: "🧪 Test Talok - Email simple",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h1 style="color: #3b82f6;">✅ Configuration réussie !</h1>
        <p>Cet email confirme que votre service d'email est correctement configuré.</p>
        <p><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          Talok - Test automatique
        </p>
      </div>
    `,
  });
  console.log(`   Résultat: ${result1.success ? "✅ Succès" : "❌ Échec"}`);
  if (result1.messageId) console.log(`   Message ID: ${result1.messageId}`);
  if (result1.error) console.log(`   Erreur: ${result1.error}`);
  console.log();

  // Test 2: Invitation de bail
  console.log("Test 2: Invitation de bail...");
  const result2 = await sendLeaseInviteEmail({
    to: testEmail,
    tenantName: "Marie Martin",
    ownerName: "Jean Dupont",
    propertyAddress: "15 rue Schoelcher, 97200 Fort-de-France",
    rent: 1000,
    charges: 200,
    leaseType: "meuble",
    inviteUrl: "http://localhost:3000/signature/test-token-12345",
  });
  console.log(`   Résultat: ${result2.success ? "✅ Succès" : "❌ Échec"}`);
  if (result2.messageId) console.log(`   Message ID: ${result2.messageId}`);
  if (result2.error) console.log(`   Erreur: ${result2.error}`);
  console.log();

  // Résumé
  console.log("📊 Résumé :");
  console.log(`   Email simple: ${result1.success ? "✅" : "❌"}`);
  console.log(`   Invitation bail: ${result2.success ? "✅" : "❌"}`);
  
  if (result1.success && result2.success) {
    console.log("\n🎉 Tous les tests ont réussi !");
    console.log(`   Vérifiez votre boîte de réception : ${testEmail}`);
  } else {
    console.log("\n⚠️  Certains tests ont échoué.");
    console.log("   Vérifiez votre configuration dans .env.local");
  }

  console.log();
}

main().catch(console.error);

