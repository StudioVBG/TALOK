/**
 * Script de test pour l'API Management Supabase
 * 
 * Usage:
 *   npx tsx scripts/test-management-api.ts
 * 
 * Ce script teste la connexion à l'API Management et liste les projets accessibles.
 */

import * as dotenv from "dotenv";
import { createManagementClient } from "../lib/supabase/management-api";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: ".env.local" });

async function testManagementApi() {
  console.log("🔍 Test de l'API Management Supabase...\n");

  try {
    // Créer le client
    console.log("1. Création du client...");
    const client = createManagementClient();
    console.log("✅ Client créé avec succès\n");

    // Tester la liste des projets
    console.log("2. Récupération de la liste des projets...");
    const projects = await client.listProjects();
    console.log(`✅ ${projects.length} projet(s) trouvé(s)\n`);

    if (projects.length > 0) {
      console.log("📋 Projets disponibles :");
      projects.forEach((project, index) => {
        console.log(`\n${index + 1}. ${project.name}`);
        console.log(`   - Ref: ${project.ref}`);
        console.log(`   - Status: ${project.status}`);
        console.log(`   - Region: ${project.region}`);
        console.log(`   - Créé le: ${new Date(project.created_at).toLocaleDateString("fr-FR")}`);
      });
    } else {
      console.log("ℹ️  Aucun projet trouvé. Créez un projet sur https://app.supabase.com");
    }

    console.log("\n✅ Test réussi ! L'API Management fonctionne correctement.");
  } catch (error: any) {
    console.error("\n❌ Erreur lors du test :");
    
    if (error.message.includes("SUPABASE_MANAGEMENT_API_TOKEN")) {
      console.error("   → Le token n'est pas configuré.");
      console.error("   → Ajoutez SUPABASE_MANAGEMENT_API_TOKEN dans votre fichier .env.local");
    } else if (error.message.includes("401") || error.message.includes("403")) {
      console.error("   → Le token est invalide ou expiré.");
      console.error("   → Générez un nouveau token sur https://app.supabase.com/account/tokens");
    } else {
      console.error(`   → ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Exécuter le test
testManagementApi();

