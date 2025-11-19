/**
 * Script de test pour vérifier directement fetchProperties
 * Usage: npx tsx scripts/test-fetch-properties-direct.ts
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

// Charger les variables d'environnement
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.error("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  process.exit(1);
}

async function testFetchProperties() {
  const { createClient } = await import("@supabase/supabase-js");
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("\n🔍 TEST DIRECT - fetchProperties\n");

  // 1. Lister tous les biens en base
  console.log("1️⃣ Liste de tous les biens en base:");
  const { data: allProperties, error: allError } = await serviceClient
    .from("properties")
    .select("id, owner_id, adresse_complete, etat, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (allError) {
    console.error("❌ Erreur:", allError);
    return;
  }

  console.log(`   Total trouvé: ${allProperties?.length || 0}`);
  if (allProperties && allProperties.length > 0) {
    allProperties.forEach((p: any) => {
      console.log(`   - ID: ${p.id}`);
      console.log(`     owner_id: ${p.owner_id}`);
      console.log(`     adresse: ${p.adresse_complete || "N/A"}`);
      console.log(`     etat: ${p.etat || "N/A"}`);
      console.log(`     créé: ${p.created_at}`);
      console.log("");
    });
  } else {
    console.log("   ⚠️ Aucun bien trouvé en base");
  }

  // 2. Compter les biens par owner_id
  console.log("\n2️⃣ Comptage par owner_id:");
  const { data: countByOwner, error: countError } = await serviceClient
    .from("properties")
    .select("owner_id");

  if (!countError && countByOwner) {
    const counts = countByOwner.reduce((acc: Record<string, number>, p: any) => {
      acc[p.owner_id] = (acc[p.owner_id] || 0) + 1;
      return acc;
    }, {});

    Object.entries(counts).forEach(([ownerId, count]) => {
      console.log(`   owner_id ${ownerId}: ${count} bien(s)`);
    });
  }

  // 3. Tester avec un owner_id spécifique (si des biens existent)
  if (allProperties && allProperties.length > 0) {
    const testOwnerId = allProperties[0].owner_id;
    console.log(`\n3️⃣ Test avec owner_id=${testOwnerId}:`);

    const { data: testProperties, error: testError, count } = await serviceClient
      .from("properties")
      .select("id, owner_id, adresse_complete, etat", { count: "exact" })
      .eq("owner_id", testOwnerId)
      .order("created_at", { ascending: false });

    if (testError) {
      console.error("❌ Erreur:", testError);
    } else {
      console.log(`   ✅ ${testProperties?.length || 0} bien(s) trouvé(s) (count: ${count})`);
      if (testProperties && testProperties.length > 0) {
        testProperties.forEach((p: any) => {
          console.log(`   - ${p.id}: ${p.adresse_complete || "N/A"} (${p.etat || "N/A"})`);
        });
      }
    }
  }

  console.log("\n✅ Test terminé\n");
}

testFetchProperties().catch(console.error);
