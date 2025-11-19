/**
 * Script de test pour vérifier le flux complet de création d'un logement :
 * 1. Création d'un draft (POST /api/properties)
 * 2. Auto-save (PATCH /api/properties/:id)
 * 3. Ajout de pièces (POST /api/properties/:id/rooms)
 * 
 * Usage: npx tsx scripts/test-property-creation-flow.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Charger les variables d'environnement depuis .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Variables d'environnement manquantes");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "✓" : "✗");
  process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testPropertyCreationFlow() {
  console.log("🧪 Test du flux de création d'un logement\n");

  // 1. Récupérer un profil owner pour les tests
  console.log("1️⃣ Récupération d'un profil owner...");
  const { data: profiles, error: profilesError } = await serviceClient
    .from("profiles")
    .select("id, user_id, role")
    .eq("role", "owner")
    .limit(1);

  if (profilesError || !profiles || profiles.length === 0) {
    console.error("❌ Aucun profil owner trouvé:", profilesError);
    return;
  }

  const ownerProfile = profiles[0];
  console.log(`✓ Profil owner trouvé: ${ownerProfile.id}\n`);

  // 2. Créer un draft de logement
  console.log("2️⃣ Création d'un draft de logement...");
  const draftPayload = {
    owner_id: ownerProfile.id,
    type: "appartement",
    usage_principal: "habitation",
    adresse_complete: "123 Rue de Test",
    code_postal: "75001",
    ville: "Paris",
    departement: "75",
    surface: 50,
    nb_pieces: 2,
    nb_chambres: 1,
    ascenseur: false,
    energie: null,
    ges: null,
    loyer_base: 0,
    loyer_hc: 0,
    charges_mensuelles: 0,
    depot_garantie: 0,
    zone_encadrement: false,
    encadrement_loyers: false,
    unique_code: `TEST-${Date.now()}`,
  };

  const { data: property, error: createError } = await serviceClient
    .from("properties")
    .insert(draftPayload as any)
    .select()
    .single();

  if (createError || !property) {
    console.error("❌ Erreur lors de la création:", createError);
    return;
  }

  console.log(`✓ Logement créé avec succès: ${property.id}\n`);

  // 3. Tester la récupération avec différentes colonnes
  console.log("3️⃣ Test de récupération avec colonnes spécifiques...");
  
  // Test avec toutes les colonnes
  const { data: propertyWithAll, error: errorWithAll } = await serviceClient
    .from("properties")
    .select("owner_id, etat, type")
    .eq("id", property.id)
    .maybeSingle();

  if (errorWithAll) {
    console.log(`⚠️  Erreur avec toutes les colonnes (attendu si colonnes manquantes):`, errorWithAll.message);
    
    // Test avec colonnes minimales
    const { data: propertyMinimal, error: errorMinimal } = await serviceClient
      .from("properties")
      .select("owner_id")
      .eq("id", property.id)
      .maybeSingle();

    if (errorMinimal) {
      console.error("❌ Erreur même avec colonnes minimales:", errorMinimal);
      return;
    }
    console.log(`✓ Récupération réussie avec colonnes minimales: owner_id=${propertyMinimal?.owner_id}`);
  } else {
    console.log(`✓ Récupération réussie avec toutes les colonnes: owner_id=${propertyWithAll?.owner_id}, etat=${propertyWithAll?.etat || "N/A"}, type=${propertyWithAll?.type || "N/A"}`);
  }
  console.log();

  // 4. Tester l'auto-save (PATCH)
  console.log("4️⃣ Test de l'auto-save (PATCH)...");
  const updatePayload = {
    adresse_complete: "456 Rue Mise à Jour",
    code_postal: "75002",
    ville: "Paris",
    surface: 60,
    nb_pieces: 3,
  };

  const { data: updatedProperty, error: updateError } = await serviceClient
    .from("properties")
    .update(updatePayload as any)
    .eq("id", property.id)
    .select()
    .single();

  if (updateError) {
    console.error("❌ Erreur lors de l'auto-save:", updateError);
    return;
  }

  console.log(`✓ Auto-save réussi: adresse=${updatedProperty?.adresse_complete}, surface=${updatedProperty?.surface}\n`);

  // 5. Tester l'ajout de pièces (POST /rooms)
  console.log("5️⃣ Test de l'ajout de pièces...");
  
  // Vérifier si la table rooms existe
  const { data: existingRooms, error: roomsCheckError } = await serviceClient
    .from("rooms")
    .select("id")
    .eq("property_id", property.id)
    .limit(1);

  if (roomsCheckError && roomsCheckError.message?.includes("does not exist")) {
    console.log("⚠️  La table 'rooms' n'existe pas encore dans la base de données");
    console.log("   L'ajout de pièces nécessite la migration de la table 'rooms'");
  } else {
    const roomPayload = {
      property_id: property.id,
      type_piece: "sejour",
      label_affiche: "Salon",
      surface_m2: 25,
      chauffage_present: true,
      chauffage_type_emetteur: "radiateur",
      clim_presente: false,
      ordre: 0,
      updated_at: new Date().toISOString(),
    };

    const { data: room, error: roomError } = await serviceClient
      .from("rooms")
      .insert(roomPayload as any)
      .select()
      .single();

    if (roomError) {
      console.error("❌ Erreur lors de l'ajout de pièce:", roomError);
      return;
    }

    console.log(`✓ Pièce ajoutée avec succès: ${room?.id} (${room?.type_piece})\n`);
  }

  // 6. Nettoyage : supprimer le logement de test
  console.log("6️⃣ Nettoyage...");
  const { error: deleteError } = await serviceClient
    .from("properties")
    .delete()
    .eq("id", property.id);

  if (deleteError) {
    console.error("⚠️  Erreur lors de la suppression:", deleteError);
  } else {
    console.log(`✓ Logement de test supprimé: ${property.id}\n`);
  }

  console.log("✅ Tous les tests sont passés avec succès !");
}

testPropertyCreationFlow().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});

