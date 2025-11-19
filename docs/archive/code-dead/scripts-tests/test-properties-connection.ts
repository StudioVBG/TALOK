/**
 * Script de test pour vérifier la connexion frontend/backend
 * et que le compte est bien lié à des propriétés existantes
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testConnection() {
  console.log("🔍 Vérification de la connexion frontend/backend...\n");

  try {
    // 1. Vérifier les profils owner
    console.log("1️⃣ Récupération des profils propriétaires...");
    const { data: ownerProfiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, user_id, role, prenom, nom")
      .eq("role", "owner")
      .limit(10);

    if (profilesError) {
      console.error("❌ Erreur lors de la récupération des profils:", profilesError);
      return;
    }

    console.log(`✅ ${ownerProfiles?.length || 0} profil(s) propriétaire(s) trouvé(s)\n`);

    if (!ownerProfiles || ownerProfiles.length === 0) {
      console.log("⚠️  Aucun profil propriétaire trouvé dans la base de données");
      return;
    }

    // 2. Vérifier les propriétés pour chaque propriétaire
    console.log("2️⃣ Vérification des propriétés liées à chaque propriétaire...\n");

    for (const profile of ownerProfiles) {
      const profileId = profile.id;
      const profileName = `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Sans nom";

      console.log(`   👤 Propriétaire: ${profileName} (ID: ${profileId})`);

      const { data: properties, error: propertiesError } = await serviceClient
        .from("properties")
        .select("id, type, adresse_complete, ville, created_at, etat")
        .eq("owner_id", profileId)
        .order("created_at", { ascending: false });

      if (propertiesError) {
        console.error(`   ❌ Erreur: ${propertiesError.message}`);
        continue;
      }

      if (!properties || properties.length === 0) {
        console.log(`   ⚠️  Aucune propriété liée à ce compte`);
      } else {
        console.log(`   ✅ ${properties.length} propriété(s) trouvée(s):`);
        properties.forEach((prop, index) => {
          const address = prop.adresse_complete || `${prop.ville || "Adresse non renseignée"}`;
          const status = prop.etat || "non défini";
          console.log(`      ${index + 1}. ${prop.type || "Type non défini"} - ${address} (${status})`);
        });
      }
      console.log("");
    }

    // 3. Test de l'API route
    console.log("3️⃣ Test de l'API route /api/properties...");
    console.log("   (Ce test nécessite une session authentifiée)");
    console.log("   ℹ️  Pour tester l'API, utilisez le navigateur avec un compte connecté\n");

    // 4. Résumé
    console.log("📊 Résumé:");
    const totalProperties = await serviceClient
      .from("properties")
      .select("id", { count: "exact", head: true });

    console.log(`   - Profils propriétaires: ${ownerProfiles.length}`);
    console.log(`   - Total propriétés dans la BDD: ${totalProperties.count || 0}`);

    // Compter les propriétés par propriétaire
    const propertiesByOwner = await serviceClient
      .from("properties")
      .select("owner_id")
      .not("owner_id", "is", null);

    const ownerCounts: Record<string, number> = {};
    propertiesByOwner.data?.forEach((p) => {
      const ownerId = p.owner_id as string;
      ownerCounts[ownerId] = (ownerCounts[ownerId] || 0) + 1;
    });

    console.log(`   - Propriétaires avec propriétés: ${Object.keys(ownerCounts).length}`);
    console.log("\n✅ Vérification terminée");

  } catch (error: any) {
    console.error("❌ Erreur lors de la vérification:", error.message);
    console.error(error);
  }
}

testConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

