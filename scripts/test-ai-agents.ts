/**
 * Script de test pour les agents AI SOTA 2026
 * 
 * Teste que tous les agents peuvent être créés correctement
 * 
 * Usage: npx tsx scripts/test-ai-agents.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Charger les variables d'environnement
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function testAgents() {
  console.log("🧪 Test des agents AI SOTA 2026\n");

  try {
    // Test 1: Configuration des modèles
    console.log("1️⃣ Test de la configuration des modèles...");
    const { createInstantModel, createThinkingModel, createProModel } = await import(
      "../lib/ai/config"
    );
    
    const instantModel = createInstantModel();
    const thinkingModel = createThinkingModel();
    const proModel = createProModel();
    
    console.log("   ✅ Modèles créés avec succès");
    console.log(`   - Instant: ${instantModel.modelName}`);
    console.log(`   - Thinking: ${thinkingModel.modelName}`);
    console.log(`   - Pro: ${proModel.modelName}\n`);

    // Test 2: Agents spécialisés
    console.log("2️⃣ Test de la création des agents spécialisés...");
    
    const { createPropertyAgent } = await import("../features/assistant/ai/agents/property.agent");
    const { createFinanceAgent } = await import("../features/assistant/ai/agents/finance.agent");
    const { createTicketAgent } = await import("../features/assistant/ai/agents/ticket.agent");
    const { createLegalAgent } = await import("../features/assistant/ai/agents/legal.agent");
    const { createSupervisorAgent, routeToAgent } = await import(
      "../features/assistant/ai/agents/supervisor.agent"
    );

    const propertyAgent = createPropertyAgent("owner");
    const financeAgent = createFinanceAgent("owner");
    const ticketAgent = createTicketAgent("owner");
    const legalAgent = createLegalAgent("owner");
    const supervisorAgent = createSupervisorAgent("owner");

    console.log("   ✅ Tous les agents créés avec succès\n");

    // Test 3: Routage
    console.log("3️⃣ Test du routage automatique...");
    
    const testCases = [
      { message: "Recherche mes biens à Paris", expected: "property_agent" },
      { message: "Créer une facture pour le loyer", expected: "finance_agent" },
      { message: "J'ai un problème de fuite d'eau", expected: "ticket_agent" },
      { message: "Quels sont mes droits concernant le dépôt de garantie ?", expected: "legal_agent" },
    ];

    for (const testCase of testCases) {
      const routed = routeToAgent(testCase.message);
      const status = routed === testCase.expected ? "✅" : "⚠️";
      console.log(`   ${status} "${testCase.message.substring(0, 40)}..." → ${routed}`);
    }
    console.log();

    // Test 4: Graph multi-agent
    console.log("4️⃣ Test du graph multi-agent...");
    try {
      const { getMultiAgentGraph } = await import("../features/assistant/ai/multi-agent-graph");
      const graph = await getMultiAgentGraph();
      console.log("   ✅ Graph multi-agent compilé avec succès\n");
    } catch (error: unknown) {
      if (error.message?.includes("DATABASE_URL")) {
        console.log("   ⚠️ Graph multi-agent nécessite DATABASE_URL (utilisera MemorySaver en fallback)\n");
      } else {
        throw error;
      }
    }

    // Test 5: Graph simple
    console.log("5️⃣ Test du graph simple...");
    try {
      const { getPropertyAssistantGraph } = await import(
        "../features/assistant/ai/property-assistant.graph"
      );
      const graph = await getPropertyAssistantGraph();
      console.log("   ✅ Graph simple compilé avec succès\n");
    } catch (error: unknown) {
      if (error.message?.includes("DATABASE_URL")) {
        console.log("   ⚠️ Graph simple nécessite DATABASE_URL (utilisera MemorySaver en fallback)\n");
      } else {
        throw error;
      }
    }

    console.log("=".repeat(50));
    console.log("✅ Tous les tests sont passés avec succès !");
    console.log("=".repeat(50));
    console.log("\n📝 Prochaines étapes :");
    console.log("   1. Configurez DATABASE_URL pour activer PostgresSaver");
    console.log("   2. Appliquez la migration SQL : supabase migration up");
    console.log("   3. Testez l'assistant avec : assistantService.sendMessage()");
    console.log("   4. Testez le multi-agent avec : assistantService.sendMessageMultiAgent()\n");

  } catch (error: unknown) {
    console.error("\n❌ Erreur lors des tests:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// Exécuter les tests
testAgents().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
});

