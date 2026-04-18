/**
 * Script de test pour l'envoi de SMS (Twilio).
 *
 * Usage:
 *   npx tsx scripts/test-sms.ts [numero]
 *   TEST_PHONE_NUMBER=+596696123456 npx tsx scripts/test-sms.ts
 *
 * Prérequis : .env.local avec TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_PHONE_NUMBER (ou TWILIO_MESSAGING_SERVICE_SID).
 */

import { config } from "dotenv";
import { sendSMS, normalizePhoneE164 } from "../lib/sms";
import { invalidateCredentialsCache } from "../lib/services/credentials-service";

config({ path: ".env.local" });

async function main() {
  const testNumber = process.argv[2] || process.env.TEST_PHONE_NUMBER;

  console.log("\nTest d'envoi SMS (Twilio)");
  console.log("==========================\n");
  console.log("Configuration :");
  console.log("  TWILIO_ACCOUNT_SID :", process.env.TWILIO_ACCOUNT_SID ? "OK" : "MANQUANT");
  console.log("  TWILIO_AUTH_TOKEN  :", process.env.TWILIO_AUTH_TOKEN ? "OK" : "MANQUANT");
  console.log("  TWILIO_PHONE_NUMBER:", process.env.TWILIO_PHONE_NUMBER || "MANQUANT");
  console.log("  NODE_ENV           :", process.env.NODE_ENV || "development");
  console.log();

  if (!testNumber) {
    console.log("Numero de test manquant.");
    console.log("  Usage: npx tsx scripts/test-sms.ts +596696123456");
    console.log("  Ou:    TEST_PHONE_NUMBER=+596696123456 npx tsx scripts/test-sms.ts");
    return;
  }

  invalidateCredentialsCache("Twilio");

  let e164: string;
  try {
    e164 = normalizePhoneE164(testNumber);
  } catch (err) {
    console.log("Numero invalide :", err instanceof Error ? err.message : err);
    return;
  }
  console.log("Numero normalise :", e164, "\n");

  const result = await sendSMS({
    to: e164,
    body: "Test SMS Talok - Configuration OK !",
    context: { type: "custom" },
  });

  console.log("Resultat :", result.success ? "OK" : "Echec");
  if (result.sid) console.log("  SID Twilio :", result.sid);
  if (result.status) console.log("  Statut     :", result.status);
  if (result.error) console.log("  Erreur     :", result.error);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
