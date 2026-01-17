/**
 * Script de vérification de la connexion via l'endpoint /api/debug/properties
 * Usage: npx tsx scripts/verify-debug-endpoint.ts
 * 
 * Ce script appelle l'endpoint de diagnostic et affiche un rapport détaillé
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DEBUG_ENDPOINT = `${APP_URL}/api/debug/properties`;

interface DebugStep {
  step: number;
  name: string;
  status: string;
  data?: any;
  error?: any;
}

interface DebugResponse {
  timestamp: string;
  steps: DebugStep[];
  errors: any[];
  finalResult?: {
    userId?: string;
    profileId?: string;
    profileUserId?: string;
    directQueryCount?: number;
    apiQueryCount?: number;
    match?: string;
    ownerIdFilter?: string;
  };
}

function formatStep(step: DebugStep): string {
  const statusIcon = step.status === "success" ? "✅" : step.status === "error" ? "❌" : "⏳";
  let output = `   ${statusIcon} Étape ${step.step}: ${step.name} - ${step.status}`;
  
  if (step.data) {
    if (typeof step.data === "object") {
      output += `\n      Données: ${JSON.stringify(step.data, null, 2).split("\n").join("\n      ")}`;
    } else {
      output += `\n      Données: ${step.data}`;
    }
  }
  
  if (step.error) {
    const errorMsg = typeof step.error === "object" ? step.error.message || JSON.stringify(step.error) : step.error;
    output += `\n      ❌ Erreur: ${errorMsg}`;
  }
  
  return output;
}

async function verifyDebugEndpoint() {
  console.log("🔍 VÉRIFICATION DE LA CONNEXION VIA /api/debug/properties\n");
  console.log("=".repeat(80));
  console.log(`📡 Endpoint: ${DEBUG_ENDPOINT}\n`);

  try {
    // Appeler l'endpoint
    console.log("⏳ Appel de l'endpoint...\n");
    const response = await fetch(DEBUG_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Important: inclure les cookies si disponibles
      credentials: "include",
    });

    console.log(`📊 Statut HTTP: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ ERREUR DE RÉPONSE\n");
      console.log(`   Code: ${response.status}`);
      console.log(`   Message: ${errorText}\n`);
      
      if (response.status === 401) {
        console.log("⚠️  AUTHENTIFICATION REQUISE");
        console.log("   → Assurez-vous d'être connecté dans le navigateur");
        console.log("   → Ou utilisez curl avec les cookies de session\n");
      }
      
      return;
    }

    const debug: DebugResponse = await response.json();

    // Afficher le timestamp
    console.log(`🕐 Timestamp: ${debug.timestamp}\n`);

    // Afficher chaque étape
    console.log("📋 DÉTAILS DES ÉTAPES\n");
    debug.steps.forEach((step) => {
      console.log(formatStep(step));
      console.log("");
    });

    // Afficher les erreurs si présentes
    if (debug.errors && debug.errors.length > 0) {
      console.log("❌ ERREURS DÉTECTÉES\n");
      debug.errors.forEach((error, index) => {
        console.log(`   Erreur ${index + 1}:`);
        if (typeof error === "object") {
          console.log(`      Étape: ${error.step || "N/A"}`);
          console.log(`      Message: ${error.error || JSON.stringify(error)}`);
        } else {
          console.log(`      ${error}`);
        }
        console.log("");
      });
    }

    // Afficher le résultat final
    if (debug.finalResult) {
      console.log("=".repeat(80));
      console.log("📊 RÉSULTAT FINAL\n");
      
      const result = debug.finalResult;
      
      console.log(`   👤 User ID: ${result.userId || "N/A"}`);
      console.log(`   🆔 Profile ID: ${result.profileId || "N/A"}`);
      console.log(`   🔗 Profile User ID: ${result.profileUserId || "N/A"}`);
      console.log(`   📊 Requête directe: ${result.directQueryCount || 0} propriété(s)`);
      console.log(`   📊 Requête API: ${result.apiQueryCount || 0} propriété(s)`);
      console.log(`   🔍 Filtre owner_id: ${result.ownerIdFilter || "N/A"}`);
      console.log(`   ${result.match || "N/A"}\n`);

      // Analyse
      console.log("=".repeat(80));
      console.log("🔍 ANALYSE\n");

      if (result.directQueryCount === 0 && result.apiQueryCount === 0) {
        console.log("⚠️  AUCUNE PROPRIÉTÉ TROUVÉE\n");
        console.log("   Causes possibles:");
        console.log("   1. Aucune propriété créée pour ce propriétaire");
        console.log("   2. Problème de mapping owner_id");
        console.log("   3. Problème RLS (Row Level Security)");
        console.log("   4. Problème d'authentification\n");
      } else if (result.directQueryCount !== result.apiQueryCount) {
        console.log("⚠️  INCOHÉRENCE DÉTECTÉE\n");
        console.log(`   Requête directe: ${result.directQueryCount} propriétés`);
        console.log(`   Requête API: ${result.apiQueryCount} propriétés`);
        console.log("   → Les deux requêtes devraient retourner le même nombre\n");
      } else {
        console.log(`✅ ${result.directQueryCount} propriété(s) trouvée(s) correctement\n`);
      }

      if (result.profileId === result.profileUserId) {
        console.log("⚠️  ATTENTION: profile.id = user_id (anormal)");
        console.log("   → Normalement, profile.id ≠ user_id");
        console.log("   → Vérifier la structure de la table profiles\n");
      }

      if (result.userId && result.profileId && result.profileUserId) {
        if (result.userId !== result.profileUserId) {
          console.log("❌ INCOHÉRENCE: user.id ≠ profile.user_id");
          console.log("   → Le profil ne correspond pas à l'utilisateur connecté\n");
        } else {
          console.log("✅ Cohérence user.id = profile.user_id vérifiée\n");
        }
      }
    }

    // Résumé des étapes
    const successSteps = debug.steps.filter((s) => s.status === "success").length;
    const errorSteps = debug.steps.filter((s) => s.status === "error").length;
    const totalSteps = debug.steps.length;

    console.log("=".repeat(80));
    console.log("📈 RÉSUMÉ\n");
    console.log(`   ✅ Étapes réussies: ${successSteps}/${totalSteps}`);
    console.log(`   ❌ Étapes en erreur: ${errorSteps}/${totalSteps}`);
    console.log(`   ⏳ Étapes en cours: ${totalSteps - successSteps - errorSteps}/${totalSteps}\n`);

    if (errorSteps === 0 && successSteps === totalSteps) {
      console.log("✅ Toutes les vérifications sont passées avec succès !\n");
    } else if (errorSteps > 0) {
      console.log("❌ Des erreurs ont été détectées. Consultez les détails ci-dessus.\n");
    }

  } catch (error: unknown) {
    console.log("❌ ERREUR LORS DE L'APPEL\n");
    console.log(`   Type: ${error.name || "Error"}`);
    console.log(`   Message: ${error.message}\n`);

    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      console.log("⚠️  LE SERVEUR N'EST PAS DÉMARRÉ\n");
      console.log("   Solution:");
      console.log("   1. Démarrer le serveur: npm run dev");
      console.log("   2. Attendre que le serveur soit prêt");
      console.log("   3. Relancer ce script\n");
    } else if (error.message.includes("CORS")) {
      console.log("⚠️  ERREUR CORS\n");
      console.log("   Solution:");
      console.log("   1. Vérifier la configuration CORS");
      console.log("   2. Utiliser le même domaine (localhost:3000)\n");
    }
  }
}

// Fonction pour tester avec curl (alternative)
function printCurlCommand() {
  console.log("\n" + "=".repeat(80));
  console.log("💡 ALTERNATIVE: Utiliser curl\n");
  console.log("Si le script ne fonctionne pas, vous pouvez utiliser curl:\n");
  console.log(`curl -X GET "${DEBUG_ENDPOINT}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  | jq '.'\n`);
  console.log("Ou ouvrir directement dans le navigateur:");
  console.log(`   ${DEBUG_ENDPOINT}\n`);
}

// Exécuter la vérification
verifyDebugEndpoint()
  .then(() => {
    printCurlCommand();
  })
  .catch((error) => {
    console.error("Erreur fatale:", error);
    printCurlCommand();
    process.exit(1);
  });

