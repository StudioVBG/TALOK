#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Vérifie les webhooks Stripe enregistrés et ajoute ceux qui manquent
 * pour le flux escrow Work Orders (Sprints A à E).
 *
 * Usage :
 *   STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_URL=https://app.talok.fr/api/webhooks/stripe \
 *     node scripts/sync-stripe-webhooks.mjs
 *
 *   # Mode dry-run (liste seulement, n'ajoute rien) :
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/sync-stripe-webhooks.mjs --dry-run
 *
 * Idempotent : si le webhook URL existe déjà, le script vérifie qu'il
 * écoute bien tous les événements requis et ajoute UNIQUEMENT ceux qui
 * manquent (via update). Sinon il en crée un nouveau.
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, "..", ".env.local") });

const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_URL =
  process.env.STRIPE_WEBHOOK_URL ||
  "https://app.talok.fr/api/webhooks/stripe";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SECRET) {
  console.error("❌ STRIPE_SECRET_KEY manquant (env ou .env.local)");
  process.exit(1);
}

const stripe = new Stripe(SECRET, { apiVersion: "2024-11-20.acacia" });

// ============================================================================
// Événements requis par le code Talok (lecture du switch dans
// app/api/webhooks/stripe/route.ts au moment de l'écriture du script).
// ============================================================================
const REQUIRED_EVENTS = [
  // Abonnements + paiements (existants)
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",

  // Stripe Connect (Sprints A→E work orders)
  "account.updated",
  "transfer.created",
  "transfer.failed",
  "transfer.reversed",

  // Payouts bancaires (legacy + WO)
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",

  // Litiges + remboursements (Sprint D)
  "charge.refunded",
  "charge.dispute.created",
];

async function main() {
  console.log(`\n🔍 Audit des webhooks Stripe pour ${WEBHOOK_URL}\n`);

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  console.log(`   ${endpoints.data.length} webhook(s) trouvé(s) au total.\n`);

  // Imprimer tous les endpoints existants pour visibilité
  endpoints.data.forEach((e, i) => {
    const matches = e.url === WEBHOOK_URL;
    const status = e.status === "enabled" ? "✅" : "⚠️ ";
    console.log(`   ${i + 1}. ${status} ${e.url}`);
    console.log(`      id=${e.id}, status=${e.status}, events=${e.enabled_events.length}`);
    if (matches) {
      console.log(`      ↑ MATCH (cible Talok)`);
    }
  });
  console.log("");

  // Trouver le webhook Talok
  const matching = endpoints.data.find((e) => e.url === WEBHOOK_URL);

  if (!matching) {
    console.log(`❌ Aucun webhook trouvé pour ${WEBHOOK_URL}`);
    if (DRY_RUN) {
      console.log(`   (dry-run) Aurait créé un nouveau webhook avec ${REQUIRED_EVENTS.length} événements`);
    } else {
      console.log(`   → Création d'un nouveau webhook…`);
      const created = await stripe.webhookEndpoints.create({
        url: WEBHOOK_URL,
        enabled_events: REQUIRED_EVENTS as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
        description: "Talok production webhook (auto-synced by sync-stripe-webhooks.mjs)",
      });
      console.log(`   ✅ Créé : id=${created.id}`);
      console.log(`   ⚠️  IMPORTANT : copie le secret de signature dans STRIPE_WEBHOOK_SECRET (Netlify env) :`);
      console.log(`      ${created.secret}\n`);
    }
    return;
  }

  console.log(`✅ Webhook Talok trouvé : ${matching.id}`);
  console.log(`   ${matching.enabled_events.length} événement(s) actuellement souscrits\n`);

  const currentEvents = new Set(matching.enabled_events);
  const missing = REQUIRED_EVENTS.filter((e) => !currentEvents.has(e));
  const extra = matching.enabled_events.filter(
    (e) => !REQUIRED_EVENTS.includes(e),
  );

  if (missing.length === 0) {
    console.log(`✅ Tous les événements requis sont souscrits — rien à faire.`);
  } else {
    console.log(`⚠️  ${missing.length} événement(s) manquant(s) :`);
    missing.forEach((e) => console.log(`     - ${e}`));
    console.log("");

    if (DRY_RUN) {
      console.log(`   (dry-run) Aurait ajouté ces événements à l'endpoint existant`);
    } else {
      console.log(`   → Mise à jour de l'endpoint pour ajouter les événements manquants…`);
      // L'API Stripe remplace la liste complète : on fusionne current + missing
      const updatedEvents = Array.from(
        new Set([...matching.enabled_events, ...missing]),
      ) as Stripe.WebhookEndpointUpdateParams.EnabledEvent[];

      const updated = await stripe.webhookEndpoints.update(matching.id, {
        enabled_events: updatedEvents,
      });
      console.log(`   ✅ Mis à jour : ${updated.enabled_events.length} événements souscrits`);
    }
  }

  if (extra.length > 0) {
    console.log(`\nℹ️  ${extra.length} événement(s) souscrit(s) mais pas listé(s) dans REQUIRED_EVENTS :`);
    extra.forEach((e) => console.log(`     - ${e}`));
    console.log(`   (laissés tel quel — ne pas désouscrire automatiquement)`);
  }

  console.log("\n✨ Terminé.\n");
}

main().catch((err) => {
  console.error("❌ Erreur :", err.message || err);
  if (err.raw) console.error("   Stripe raw:", JSON.stringify(err.raw, null, 2));
  process.exit(1);
});
