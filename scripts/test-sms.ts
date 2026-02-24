/**
 * Script de test pour l'envoi de SMS (Twilio)
 *
 * Phase 1 : simulation (vérifie que le service s'exécute sans erreur)
 * Phase 2 : envoi réel vers le numéro fourni
 *
 * Usage:
 *   npx tsx scripts/test-sms.ts [numero]
 *   TEST_PHONE_NUMBER=+33612345678 npx tsx scripts/test-sms.ts
 *
 * Prérequis : .env.local avec TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

import { config } from "dotenv";
import { sendSMS, isSMSServiceAvailable, invalidateCredentialsCache } from "../lib/services";

config({ path: ".env.local" });

const TEST_MESSAGE_SIM = "Test SMS Talok - Simulation OK";
const TEST_MESSAGE_REAL = "Test SMS Talok - Configuration OK !";

async function main() {
  const testNumber = process.argv[2] || process.env.TEST_PHONE_NUMBER;

  console.log("\n📱 Test d'envoi SMS (Twilio)");
  console.log("============================\n");

  console.log("🔧 Configuration :");
  console.log("   TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID ? "✅ Configuré" : "❌ Non configuré");
  console.log("   TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "✅ Configuré" : "❌ Non configuré");
  console.log("   TWILIO_PHONE_NUMBER:", process.env.TWILIO_PHONE_NUMBER || "❌ Non configuré");
  console.log("   NODE_ENV:", process.env.NODE_ENV || "development");
  console.log();

  if (!testNumber) {
    console.log("💡 Numéro de test manquant.");
    console.log("   Usage: npx tsx scripts/test-sms.ts +33612345678");
    console.log("   Ou:   TEST_PHONE_NUMBER=+33612345678 npx tsx scripts/test-sms.ts");
    console.log();
    return;
  }

  // --- Phase 1 : Simulation ---
  console.log("--- Phase 1 : Simulation ---");
  invalidateCredentialsCache("Twilio");
  const savedSid = process.env.TWILIO_ACCOUNT_SID;
  const savedToken = process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;

  const resultSim = await sendSMS({
    to: testNumber,
    message: TEST_MESSAGE_SIM,
  });

  if (savedSid !== undefined) process.env.TWILIO_ACCOUNT_SID = savedSid;
  if (savedToken !== undefined) process.env.TWILIO_AUTH_TOKEN = savedToken;
  invalidateCredentialsCache("Twilio");

  console.log("   Résultat:", resultSim.success ? "✅ Succès" : "❌ Échec");
  if (resultSim.messageId) console.log("   Message ID:", resultSim.messageId);
  if (resultSim.simulated) console.log("   Mode: simulé (aucun SMS envoyé)");
  if (resultSim.error) console.log("   Erreur:", resultSim.error);
  console.log();

  if (!resultSim.success) {
    console.log("⚠️ La simulation a échoué. Vérifiez le format du numéro (ex: +33612345678).");
    return;
  }

  // --- Phase 2 : Envoi réel ---
  console.log("--- Phase 2 : Envoi réel ---");

  const hasCredentials = await isSMSServiceAvailable();
  if (!hasCredentials) {
    console.log("   ⚠️ Twilio non configuré. Renseignez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_PHONE_NUMBER dans .env.local");
    console.log("   La phase 1 (simulation) a réussi : le service est opérationnel.");
    return;
  }

  const resultReal = await sendSMS({
    to: testNumber,
    message: TEST_MESSAGE_REAL,
  });

  console.log("   Résultat:", resultReal.success ? "✅ Succès" : "❌ Échec");
  if (resultReal.messageId) console.log("   SID Twilio:", resultReal.messageId);
  if (resultReal.error) console.log("   Erreur:", resultReal.error);
  console.log();

  if (resultReal.success) {
    console.log("🎉 Test réussi. Vérifiez la réception du SMS sur", testNumber);
  } else {
    console.log("⚠️ Envoi réel échoué. Vérifiez vos credentials et le numéro Twilio dans la console Twilio.");
  }
  console.log();
}

main().catch(console.error);
