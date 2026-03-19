/**
 * Diagnostic complet de la configuration email (Resend)
 *
 * Usage:
 *   npx tsx scripts/diagnose-email.ts
 *
 * Verifie toutes les variables d'env, la resolution runtime,
 * la connexion Supabase et la table password_reset_requests.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const OK = "\x1b[32mOK\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const WARN = "\x1b[33mWARN\x1b[0m";

interface CheckResult {
  label: string;
  status: "ok" | "fail" | "warn";
  detail: string;
}

const results: CheckResult[] = [];

function check(label: string, status: "ok" | "fail" | "warn", detail: string) {
  results.push({ label, status, detail });
  const icon = status === "ok" ? OK : status === "fail" ? FAIL : WARN;
  console.log(`  [${icon}] ${label}: ${detail}`);
}

async function main() {
  console.log("\n============================================");
  console.log("  DIAGNOSTIC EMAIL — Talok (Resend)");
  console.log("============================================\n");

  // -------------------------------------------------------
  // 1. Variables d'environnement critiques
  // -------------------------------------------------------
  console.log("1. Variables d'environnement\n");

  const nodeEnv = process.env.NODE_ENV || "undefined";
  check(
    "NODE_ENV",
    nodeEnv === "production" ? "ok" : "warn",
    `${nodeEnv}${nodeEnv === "development" ? " — emails SIMULES sauf si EMAIL_FORCE_SEND=true" : ""}`
  );

  const forceSend = process.env.EMAIL_FORCE_SEND;
  check(
    "EMAIL_FORCE_SEND",
    forceSend === "true" ? "ok" : nodeEnv === "production" ? "ok" : "warn",
    forceSend || "unset (default false)"
  );

  const resendKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
  if (!resendKey) {
    check("RESEND_API_KEY", "fail", "ABSENTE — aucun email ne sera envoye");
  } else if (!resendKey.startsWith("re_")) {
    check("RESEND_API_KEY", "warn", `prefixe inattendu (attendu: re_...), valeur: ${resendKey.substring(0, 8)}...`);
  } else {
    check("RESEND_API_KEY", "ok", `${resendKey.substring(0, 8)}...${resendKey.substring(resendKey.length - 4)}`);
  }

  const emailFrom = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  if (!emailFrom) {
    check("EMAIL_FROM", "warn", "unset — fallback vers Talok <noreply@talok.fr>");
  } else if (emailFrom.includes("onboarding@resend.dev")) {
    check("EMAIL_FROM", "fail", `${emailFrom} — adresse de test, limites en prod`);
  } else {
    check("EMAIL_FROM", "ok", emailFrom);
  }

  const replyTo = process.env.EMAIL_REPLY_TO || process.env.RESEND_REPLY_TO;
  check("EMAIL_REPLY_TO", replyTo ? "ok" : "warn", replyTo || "unset");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    check("NEXT_PUBLIC_APP_URL", "fail", "ABSENTE — liens dans les emails casss");
  } else {
    check("NEXT_PUBLIC_APP_URL", "ok", appUrl);
  }

  const pwSecret = process.env.PASSWORD_RESET_COOKIE_SECRET;
  check(
    "PASSWORD_RESET_COOKIE_SECRET",
    pwSecret && pwSecret.length >= 32 ? "ok" : pwSecret ? "warn" : "fail",
    pwSecret ? `set (${pwSecret.length} chars)` : "ABSENTE — reset mot de passe non securise"
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  check("SUPABASE_URL", supabaseUrl ? "ok" : "fail", supabaseUrl || "ABSENTE");
  check("SERVICE_ROLE_KEY", serviceKey ? "ok" : "fail", serviceKey ? "set" : "ABSENTE");

  // -------------------------------------------------------
  // 2. Resolution runtime Resend config
  // -------------------------------------------------------
  console.log("\n2. Resolution runtime (resend-config.ts)\n");

  try {
    const { resolveResendRuntimeConfig } = await import("../lib/services/resend-config");
    const cfg = await resolveResendRuntimeConfig({ skipDatabase: true });

    check("apiKey source (env only)", cfg.apiKey ? "ok" : "fail", cfg.apiKey ? `found (${cfg.sources.apiKey})` : "NONE");
    check("fromAddress", "ok", `${cfg.fromAddress} (source: ${cfg.sources.fromAddress})`);
    check("replyTo", cfg.replyTo ? "ok" : "warn", cfg.replyTo || "null");

    if (cfg.fromAddress.includes("onboarding@resend.dev")) {
      check("fromAddress prod-safe", "fail", "onboarding@resend.dev ne fonctionne qu'en test");
    }
  } catch (err) {
    check("resolveResendRuntimeConfig", "fail", `import error: ${err instanceof Error ? err.message : err}`);
  }

  // -------------------------------------------------------
  // 3. Connexion Supabase + table password_reset_requests
  // -------------------------------------------------------
  console.log("\n3. Supabase — table password_reset_requests\n");

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase
        .from("password_reset_requests")
        .select("id")
        .limit(1);

      if (error) {
        if (error.message.includes("does not exist") || error.code === "42P01") {
          check("password_reset_requests", "fail", "TABLE ABSENTE — migration non appliquee. L'email de reset sera bloque.");
        } else {
          check("password_reset_requests", "warn", `Erreur query: ${error.message}`);
        }
      } else {
        check("password_reset_requests", "ok", `table existe (${data?.length ?? 0} rows en sample)`);
      }
    } catch (err) {
      check("Supabase connexion", "fail", `${err instanceof Error ? err.message : err}`);
    }
  } else {
    check("Supabase", "fail", "variables manquantes, test impossible");
  }

  // -------------------------------------------------------
  // 4. Simulation du mode d'envoi
  // -------------------------------------------------------
  console.log("\n4. Mode d'envoi simule\n");

  const isSimulated = nodeEnv === "development" && forceSend !== "true";
  if (isSimulated) {
    check(
      "Envoi reel",
      "fail",
      "NON — NODE_ENV=development et EMAIL_FORCE_SEND != true. Les emails sont SIMULES."
    );
  } else if (!resendKey) {
    check("Envoi reel", "fail", "NON — cle API Resend absente.");
  } else {
    check("Envoi reel", "ok", "OUI — les emails seront envoyes via Resend.");
  }

  // -------------------------------------------------------
  // Resume
  // -------------------------------------------------------
  console.log("\n============================================");
  console.log("  RESUME");
  console.log("============================================\n");

  const fails = results.filter((r) => r.status === "fail");
  const warns = results.filter((r) => r.status === "warn");

  if (fails.length === 0 && warns.length === 0) {
    console.log("  Tout est OK. Les emails devraient etre envoyes correctement.\n");
  } else {
    if (fails.length > 0) {
      console.log(`  ${fails.length} ERREUR(S) CRITIQUE(S):`);
      for (const f of fails) {
        console.log(`    - ${f.label}: ${f.detail}`);
      }
    }
    if (warns.length > 0) {
      console.log(`  ${warns.length} AVERTISSEMENT(S):`);
      for (const w of warns) {
        console.log(`    - ${w.label}: ${w.detail}`);
      }
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
