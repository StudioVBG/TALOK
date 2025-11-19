/**
 * Script de diagnostic pour vérifier le flux complet de récupération des propriétés
 * Usage: npx tsx scripts/diagnose-properties-flow.ts
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

async function diagnosePropertiesFlow() {
  console.log("\n🔍 DIAGNOSTIC COMPLET - Flux de récupération des propriétés\n");

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Lister tous les profils owner
    console.log("1️⃣ LISTE DES PROFILS OWNER:");
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, user_id, role")
      .in("role", ["owner", "admin"])
      .limit(10);

    if (profilesError) {
      console.error("   ❌ Erreur:", profilesError.message);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log("   ⚠️ Aucun profil owner trouvé");
      return;
    }

    console.log(`   ✅ ${profiles.length} profil(s) owner trouvé(s):`);
    profiles.forEach((p) => {
      console.log(`      - id: ${p.id}, user_id: ${p.user_id}, role: ${p.role}`);
    });

    // 2. Pour chaque profil, vérifier ses propriétés
    console.log("\n2️⃣ PROPRIÉTÉS PAR PROFIL:");
    for (const profile of profiles) {
      console.log(`\n   👤 Profil: ${profile.id} (user_id: ${profile.user_id})`);

      // Compter les propriétés
      const { data: properties, error: propertiesError, count } = await serviceClient
        .from("properties")
        .select("id, owner_id, adresse_complete, etat, created_at", { count: "exact" })
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

      if (propertiesError) {
        console.error(`      ❌ Erreur lors de la récupération:`, propertiesError.message);
        continue;
      }

      console.log(`      ✅ ${properties?.length || 0} propriété(s) trouvée(s) (count: ${count})`);

      if (properties && properties.length > 0) {
        console.log(`      📋 Détails:`);
        properties.slice(0, 5).forEach((p) => {
          console.log(`         - id: ${p.id}`);
          console.log(`           owner_id: ${p.owner_id}`);
          console.log(`           adresse: ${p.adresse_complete || "N/A"}`);
          console.log(`           etat: ${p.etat || "N/A"}`);
          console.log(`           created_at: ${p.created_at}`);
        });
        if (properties.length > 5) {
          console.log(`         ... et ${properties.length - 5} autre(s)`);
        }
      } else {
        console.log(`      ⚠️ Aucune propriété trouvée pour ce profil`);
      }
    }

    // 3. Vérifier les propriétés sans owner_id valide
    console.log("\n3️⃣ PROPRIÉTÉS SANS OWNER_ID VALIDE:");
    const { data: allProperties } = await serviceClient
      .from("properties")
      .select("id, owner_id, adresse_complete")
      .limit(20);

    if (allProperties) {
      const profileIds = new Set(profiles.map((p) => p.id));
      const orphanProperties = allProperties.filter(
        (p) => !p.owner_id || !profileIds.has(p.owner_id)
      );

      if (orphanProperties.length > 0) {
        console.log(`   ⚠️ ${orphanProperties.length} propriété(s) avec owner_id invalide:`);
        orphanProperties.forEach((p) => {
          console.log(`      - id: ${p.id}, owner_id: ${p.owner_id || "NULL"}`);
        });
      } else {
        console.log(`   ✅ Toutes les propriétés ont un owner_id valide`);
      }
    }

    // 4. Résumé
    console.log("\n4️⃣ RÉSUMÉ:");
    const { count: totalProperties } = await serviceClient
      .from("properties")
      .select("*", { count: "exact", head: true });

    console.log(`   📊 Total de propriétés en base: ${totalProperties || 0}`);
    console.log(`   👥 Total de profils owner: ${profiles.length}`);

    // Calculer la distribution
    const distribution: Record<string, number> = {};
    for (const profile of profiles) {
      const { count } = await serviceClient
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", profile.id);
      distribution[profile.id] = count || 0;
    }

    console.log(`   📈 Distribution par profil:`);
    Object.entries(distribution).forEach(([profileId, count]) => {
      const profile = profiles.find((p) => p.id === profileId);
      console.log(`      - ${profileId}: ${count} propriété(s) ${profile ? `(user_id: ${profile.user_id})` : ""}`);
    });

    console.log("\n✅ Diagnostic terminé\n");
  } catch (error: any) {
    console.error("\n❌ Erreur lors du diagnostic:", error.message);
    console.error(error.stack);
  }
}

diagnosePropertiesFlow().catch(console.error);

