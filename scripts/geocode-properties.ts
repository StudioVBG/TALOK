/**
 * Script de géocodage rétroactif des propriétés
 * 
 * Ce script parcourt tous les logements sans coordonnées GPS
 * et utilise l'API BAN (Base Adresse Nationale) pour les géocoder.
 * 
 * Usage: npx tsx scripts/geocode-properties.ts
 * 
 * L'API BAN est 100% gratuite et sans limite.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Property {
  id: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  latitude: number | null;
  longitude: number | null;
}

interface GeocodingResult {
  latitude: number;
  longitude: number;
  label: string;
  score: number;
}

/**
 * Géocode une adresse via l'API BAN (Base Adresse Nationale)
 * API 100% gratuite du gouvernement français
 */
async function geocodeAddress(
  adresse: string,
  codePostal: string,
  ville: string
): Promise<GeocodingResult | null> {
  const query = `${adresse} ${codePostal} ${ville}`;
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        label: feature.properties.label,
        score: feature.properties.score,
      };
    }
    return null;
  } catch (error) {
    console.error(`  ⚠️ Erreur de géocodage:`, error);
    return null;
  }
}

/**
 * Délai entre les requêtes pour respecter l'API
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🗺️  Géocodage rétroactif des propriétés");
  console.log("========================================\n");

  // 1. Récupérer les propriétés sans coordonnées
  console.log("📍 Recherche des propriétés sans coordonnées GPS...\n");

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, adresse_complete, code_postal, ville, latitude, longitude")
    .or("latitude.is.null,longitude.is.null")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Erreur lors de la récupération des propriétés:", error);
    process.exit(1);
  }

  if (!properties || properties.length === 0) {
    console.log("✅ Toutes les propriétés ont déjà des coordonnées GPS !");
    return;
  }

  console.log(`📊 ${properties.length} propriété(s) à géocoder\n`);

  // 2. Géocoder chaque propriété
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i] as Property;
    const progress = `[${i + 1}/${properties.length}]`;

    // Vérifier si l'adresse est valide
    if (!property.adresse_complete || !property.code_postal || !property.ville) {
      console.log(`${progress} ⏭️  Propriété ${property.id.slice(0, 8)}... - Adresse incomplète`);
      skipped++;
      continue;
    }

    console.log(`${progress} 🔍 Géocodage: ${property.adresse_complete}, ${property.code_postal} ${property.ville}`);

    // Appeler l'API BAN
    const result = await geocodeAddress(
      property.adresse_complete,
      property.code_postal,
      property.ville
    );

    if (result) {
      // Vérifier la qualité du résultat (score > 0.5)
      if (result.score < 0.5) {
        console.log(`        ⚠️  Score faible (${result.score.toFixed(2)}) - Résultat ignoré`);
        failed++;
      } else {
        // Mettre à jour la propriété
        const { error: updateError } = await supabase
          .from("properties")
          .update({
            latitude: result.latitude,
            longitude: result.longitude,
          })
          .eq("id", property.id);

        if (updateError) {
          console.log(`        ❌ Erreur de mise à jour:`, updateError.message);
          failed++;
        } else {
          console.log(`        ✅ Coordonnées: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)} (score: ${result.score.toFixed(2)})`);
          success++;
        }
      }
    } else {
      console.log(`        ❌ Adresse non trouvée`);
      failed++;
    }

    // Petit délai pour ne pas surcharger l'API (100ms)
    await delay(100);
  }

  // 3. Résumé
  console.log("\n========================================");
  console.log("📊 Résumé du géocodage");
  console.log("========================================");
  console.log(`✅ Succès:    ${success}`);
  console.log(`❌ Échecs:    ${failed}`);
  console.log(`⏭️  Ignorés:   ${skipped}`);
  console.log(`📍 Total:     ${properties.length}`);

  if (failed > 0) {
    console.log("\n💡 Conseil: Les adresses en échec peuvent être corrigées manuellement");
    console.log("   ou via l'interface d'édition des logements.");
  }

  console.log("\n✨ Terminé !");
}

main().catch(console.error);

