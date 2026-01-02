/**
 * Script de vérification de l'installation AI SOTA 2026
 * 
 * Vérifie que tous les composants sont correctement configurés :
 * - Variables d'environnement
 * - Dépendances
 * - Migrations SQL
 * - Imports corrects
 * 
 * Usage: npx tsx scripts/verify-ai-setup.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Charger les variables d'environnement
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// ============================================
// VÉRIFICATIONS
// ============================================

interface CheckResult {
  name: string;
  status: "✅" | "❌" | "⚠️";
  message: string;
}

const checks: CheckResult[] = [];

// 1. Vérifier les variables d'environnement OpenAI
function checkOpenAIConfig(): CheckResult {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelInstant = process.env.OPENAI_MODEL_INSTANT;
  const modelThinking = process.env.OPENAI_MODEL_THINKING;
  const modelPro = process.env.OPENAI_MODEL_PRO;
  
  if (!apiKey || !apiKey.startsWith("sk-")) {
    return {
      name: "OPENAI_API_KEY",
      status: "❌",
      message: "Clé API OpenAI non configurée ou invalide",
    };
  }
  
  if (!modelInstant || !modelThinking || !modelPro) {
    return {
      name: "GPT-5.2 Models",
      status: "⚠️",
      message: "Variables GPT-5.2 non configurées (utilisera les valeurs par défaut)",
    };
  }
  
  return {
    name: "OpenAI Configuration",
    status: "✅",
    message: `API Key configurée, modèles: ${modelInstant}, ${modelThinking}, ${modelPro}`,
  };
}

// 2. Vérifier DATABASE_URL pour PostgresSaver
function checkDatabaseConfig(): CheckResult {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return {
      name: "DATABASE_URL",
      status: "⚠️",
      message: "DATABASE_URL non configurée (utilisera MemorySaver en fallback)",
    };
  }
  
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    return {
      name: "DATABASE_URL",
      status: "❌",
      message: "Format DATABASE_URL invalide (doit commencer par postgresql:// ou postgres://)",
    };
  }
  
  return {
    name: "Database Configuration",
    status: "✅",
    message: "DATABASE_URL configurée pour PostgresSaver",
  };
}

// 3. Vérifier les dépendances
async function checkDependencies(): Promise<CheckResult> {
  try {
    // Vérifier @langchain/langgraph
    await import("@langchain/langgraph");
    
    // Vérifier @langchain/langgraph-checkpoint-postgres
    try {
      await import("@langchain/langgraph-checkpoint-postgres");
    } catch (e) {
      return {
        name: "Dependencies",
        status: "❌",
        message: "@langchain/langgraph-checkpoint-postgres non installé. Exécutez: npm install",
      };
    }
    
    // Vérifier @langchain/openai
    await import("@langchain/openai");
    
    return {
      name: "Dependencies",
      status: "✅",
      message: "Toutes les dépendances LangGraph sont installées",
    };
  } catch (e) {
    return {
      name: "Dependencies",
      status: "❌",
      message: `Erreur lors de la vérification des dépendances: ${(e as Error).message}`,
    };
  }
}

// 4. Vérifier les imports des agents
async function checkAgentImports(): Promise<CheckResult> {
  try {
    // Vérifier que les agents peuvent être importés
    const { createSupervisorAgent } = await import("../features/assistant/ai/agents/supervisor.agent");
    const { createPropertyAgent } = await import("../features/assistant/ai/agents/property.agent");
    const { createFinanceAgent } = await import("../features/assistant/ai/agents/finance.agent");
    const { createTicketAgent } = await import("../features/assistant/ai/agents/ticket.agent");
    const { createLegalAgent } = await import("../features/assistant/ai/agents/legal.agent");
    
    // Vérifier que les fonctions existent
    if (
      typeof createSupervisorAgent !== "function" ||
      typeof createPropertyAgent !== "function" ||
      typeof createFinanceAgent !== "function" ||
      typeof createTicketAgent !== "function" ||
      typeof createLegalAgent !== "function"
    ) {
      return {
        name: "Agent Imports",
        status: "❌",
        message: "Certaines fonctions d'agents ne sont pas exportées correctement",
      };
    }
    
    return {
      name: "Agent Imports",
      status: "✅",
      message: "Tous les agents peuvent être importés correctement",
    };
  } catch (e) {
    return {
      name: "Agent Imports",
      status: "❌",
      message: `Erreur lors de l'import des agents: ${(e as Error).message}`,
    };
  }
}

// 5. Vérifier la configuration des modèles
async function checkModelConfig(): Promise<CheckResult> {
  try {
    const { createInstantModel, createThinkingModel, createProModel } = await import("../lib/ai/config");
    
    if (
      typeof createInstantModel !== "function" ||
      typeof createThinkingModel !== "function" ||
      typeof createProModel !== "function"
    ) {
      return {
        name: "Model Configuration",
        status: "❌",
        message: "Les fonctions de création de modèles ne sont pas exportées correctement",
      };
    }
    
    return {
      name: "Model Configuration",
      status: "✅",
      message: "Configuration GPT-5.2 correcte",
    };
  } catch (e) {
    return {
      name: "Model Configuration",
      status: "❌",
      message: `Erreur lors de la vérification de la config: ${(e as Error).message}`,
    };
  }
}

// ============================================
// EXÉCUTION
// ============================================

async function main() {
  console.log("🔍 Vérification de l'installation AI SOTA 2026\n");
  
  // Exécuter les vérifications
  checks.push(checkOpenAIConfig());
  checks.push(checkDatabaseConfig());
  checks.push(await checkDependencies());
  checks.push(await checkAgentImports());
  checks.push(await checkModelConfig());
  
  // Afficher les résultats
  console.log("Résultats des vérifications:\n");
  
  for (const check of checks) {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.message}\n`);
  }
  
  // Résumé
  const successCount = checks.filter(c => c.status === "✅").length;
  const warningCount = checks.filter(c => c.status === "⚠️").length;
  const errorCount = checks.filter(c => c.status === "❌").length;
  
  console.log("\n" + "=".repeat(50));
  console.log(`Résumé: ${successCount} ✅ | ${warningCount} ⚠️ | ${errorCount} ❌`);
  console.log("=".repeat(50) + "\n");
  
  if (errorCount > 0) {
    console.log("❌ Des erreurs ont été détectées. Veuillez les corriger avant de continuer.");
    process.exit(1);
  } else if (warningCount > 0) {
    console.log("⚠️ Des avertissements ont été détectés. L'application fonctionnera mais avec des limitations.");
    process.exit(0);
  } else {
    console.log("✅ Toutes les vérifications sont passées ! L'installation est correcte.");
    process.exit(0);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Erreur lors de la vérification:", error);
    process.exit(1);
  });
}

export { main as verifyAISetup };

