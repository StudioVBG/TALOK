#!/usr/bin/env tsx
/**
 * Script de vérification des variables d'environnement
 * Usage: npm run check-env
 */

import * as dotenv from "dotenv";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: ".env.local" });

interface EnvVar {
  name: string;
  required: boolean;
  pattern?: RegExp;
  description: string;
}

const REQUIRED_VARS: EnvVar[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    pattern: /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
    description: "URL de l'API Supabase (format: https://xxxxx.supabase.co)",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    pattern: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
    description: "Clé anonyme publique Supabase",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    pattern: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
    description: "Clé service role Supabase (secrète)",
  },
];

const OPTIONAL_VARS: EnvVar[] = [
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: false,
    pattern: /^https?:\/\/.+/,
    description: "URL de l'application",
  },
];

function checkEnvVar(envVar: EnvVar): { valid: boolean; error?: string } {
  const value = process.env[envVar.name];

  if (envVar.required && !value) {
    return {
      valid: false,
      error: `Variable manquante: ${envVar.name}`,
    };
  }

  if (value && envVar.pattern && !envVar.pattern.test(value)) {
    return {
      valid: false,
      error: `Format invalide pour ${envVar.name}`,
    };
  }

  // Vérification spéciale pour NEXT_PUBLIC_SUPABASE_URL
  if (envVar.name === "NEXT_PUBLIC_SUPABASE_URL" && value) {
    if (value.includes("supabase.com/dashboard")) {
      return {
        valid: false,
        error: `❌ ERREUR: L'URL pointe vers le dashboard Supabase au lieu de l'API. Utilisez: https://xxxxx.supabase.co`,
      };
    }
    if (!value.includes(".supabase.co")) {
      return {
        valid: false,
        error: `Format d'URL invalide. Doit se terminer par .supabase.co`,
      };
    }
  }

  return { valid: true };
}

function main() {
  console.log("🔍 Vérification des variables d'environnement...\n");

  let hasErrors = false;
  let hasWarnings = false;

  // Vérifier les variables obligatoires
  console.log("📋 Variables OBLIGATOIRES:\n");
  for (const envVar of REQUIRED_VARS) {
    const result = checkEnvVar(envVar);
    if (result.valid) {
      const value = process.env[envVar.name];
      const maskedValue =
        value && value.length > 20
          ? `${value.substring(0, 10)}...${value.substring(value.length - 10)}`
          : value;
      console.log(`  ✅ ${envVar.name}: ${maskedValue || "(non définie)"}`);
      console.log(`     ${envVar.description}\n`);
    } else {
      console.log(`  ❌ ${envVar.name}: ${result.error}`);
      console.log(`     ${envVar.description}\n`);
      hasErrors = true;
    }
  }

  // Vérifier les variables optionnelles
  console.log("📋 Variables OPTIONNELLES:\n");
  for (const envVar of OPTIONAL_VARS) {
    const value = process.env[envVar.name];
    if (value) {
      const result = checkEnvVar(envVar);
      if (result.valid) {
        console.log(`  ✅ ${envVar.name}: Définie`);
        console.log(`     ${envVar.description}\n`);
      } else {
        console.log(`  ⚠️  ${envVar.name}: ${result.error}`);
        console.log(`     ${envVar.description}\n`);
        hasWarnings = true;
      }
    } else {
      console.log(`  ⚪ ${envVar.name}: Non définie (optionnel)`);
      console.log(`     ${envVar.description}\n`);
    }
  }

  // Résumé
  console.log("\n" + "=".repeat(60));
  if (hasErrors) {
    console.log("❌ ERREURS DÉTECTÉES");
    console.log("\nCorrigez les erreurs ci-dessus avant de déployer.\n");
    process.exit(1);
  } else if (hasWarnings) {
    console.log("⚠️  AVERTISSEMENTS DÉTECTÉS");
    console.log("\nVérifiez les avertissements ci-dessus.\n");
    process.exit(0);
  } else {
    console.log("✅ Toutes les variables sont correctement configurées !\n");
    process.exit(0);
  }
}

main();

