/**
 * Script pour lister toutes les photos des propriétés et vérifier leur connexion
 * Usage: npx tsx scripts/list-property-photos.ts
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listPropertyPhotos() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Variables d'environnement manquantes");
    return;
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("📸 LISTE DES PHOTOS DES PROPRIÉTÉS\n");
  console.log("=".repeat(80));

  // 1. Compter les photos
  const { count, error: countError } = await serviceClient
    .from("photos")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Erreur:", countError);
    return;
  }

  console.log(`\n📊 Total: ${count || 0} photo(s)\n`);

  // 2. Lister toutes les photos avec détails
  const { data: photos, error: photosError } = await serviceClient
    .from("photos")
    .select(`
      id,
      property_id,
      properties:property_id (
        id,
        adresse_complete,
        type,
        etat,
        owner_id
      ),
      url,
      storage_path,
      tag,
      is_main,
      ordre,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (photosError) {
    console.error("❌ Erreur:", photosError);
    return;
  }

  if (!photos || photos.length === 0) {
    console.log("⚠️  Aucune photo trouvée\n");
    
    // Vérifier les propriétés sans photos
    console.log("🔍 Vérification des propriétés sans photos...\n");
    const { data: propertiesWithoutPhotos } = await serviceClient
      .from("properties")
      .select("id, adresse_complete, type, etat")
      .order("created_at", { ascending: false });
    
    if (propertiesWithoutPhotos && propertiesWithoutPhotos.length > 0) {
      console.log(`⚠️  ${propertiesWithoutPhotos.length} propriété(s) sans photos:\n`);
      propertiesWithoutPhotos.forEach((prop: any) => {
        console.log(`   - ${prop.adresse_complete || "Adresse à compléter"} (${prop.type}, ${prop.etat})`);
      });
    }
    
    return;
  }

  // 3. Afficher les photos par propriété
  const photosByProperty = new Map<string, any[]>();
  
  photos.forEach((photo: any) => {
    const propId = photo.property_id;
    if (!photosByProperty.has(propId)) {
      photosByProperty.set(propId, []);
    }
    photosByProperty.get(propId)!.push(photo);
  });

  console.log(`📋 ${photosByProperty.size} propriété(s) avec photos\n`);

  // 4. Vérifier la connexion et afficher les détails
  let totalConnected = 0;
  let totalDisconnected = 0;

  photosByProperty.forEach((propertyPhotos, propertyId) => {
    const firstPhoto = propertyPhotos[0];
    const property = firstPhoto.properties;
    
    const isConnected = property && property.id === propertyId;
    if (isConnected) {
      totalConnected++;
    } else {
      totalDisconnected++;
    }

    console.log("─".repeat(80));
    console.log(`\n🏠 Propriété: ${property?.adresse_complete || propertyId}`);
    console.log(`   ID: ${propertyId}`);
    console.log(`   Type: ${property?.type || "N/A"}`);
    console.log(`   État: ${property?.etat || "N/A"}`);
    console.log(`   Propriétaire: ${property?.owner_id || "N/A"}`);
    console.log(`   Connexion: ${isConnected ? "✅ Connectée" : "❌ Non connectée"}`);
    console.log(`   Nombre de photos: ${propertyPhotos.length}\n`);

    propertyPhotos.forEach((photo, index) => {
      console.log(`   📸 Photo ${index + 1}:`);
      console.log(`      ID: ${photo.id}`);
      console.log(`      Tag: ${photo.tag || "N/A"}`);
      console.log(`      Photo principale: ${photo.is_main ? "✅ Oui" : "❌ Non"}`);
      console.log(`      Ordre: ${photo.ordre || 0}`);
      console.log(`      URL: ${photo.url}`);
      console.log(`      Chemin storage: ${photo.storage_path}`);
      console.log(`      Créée le: ${new Date(photo.created_at).toLocaleString("fr-FR")}`);
      
      // Vérifier si l'URL est accessible
      if (photo.url) {
        try {
          const url = new URL(photo.url);
          console.log(`      ✅ URL valide: ${url.hostname}`);
        } catch {
          console.log(`      ❌ URL invalide`);
        }
      }
      console.log("");
    });
  });

  // 5. Vérifier dans le storage
  console.log("=".repeat(80));
  console.log("\n🔍 VÉRIFICATION DANS LE STORAGE\n");

  const { data: buckets } = await serviceClient.storage.listBuckets();
  const propertyPhotosBucket = buckets?.find((b) => b.id === "property-photos");

  if (propertyPhotosBucket) {
    console.log(`✅ Bucket trouvé: ${propertyPhotosBucket.name}`);
    console.log(`   Public: ${propertyPhotosBucket.public ? "Oui" : "Non"}\n`);

    // Lister les fichiers dans le bucket par propriété
    const propertyFolders = new Set<string>();
    photos.forEach((photo: any) => {
      if (photo.storage_path) {
        const pathParts = photo.storage_path.split("/");
        if (pathParts.length > 0) {
          propertyFolders.add(pathParts[0]);
        }
      }
    });

    console.log(`📁 ${propertyFolders.size} dossier(s) de propriété dans le storage\n`);

    for (const folder of propertyFolders) {
      const { data: files, error: listError } = await serviceClient.storage
        .from("property-photos")
        .list(folder, {
          limit: 100,
          offset: 0,
        });

      if (!listError && files && files.length > 0) {
        console.log(`   📁 Dossier ${folder}:`);
        files.forEach((file) => {
          const sizeKB = (file.metadata?.size || 0) / 1024;
          const sizeMB = sizeKB / 1024;
          const sizeStr = sizeMB > 1 ? `${sizeMB.toFixed(2)} MB` : `${sizeKB.toFixed(2)} KB`;
          console.log(`      ✅ ${file.name} (${sizeStr})`);
        });
        console.log("");
      } else if (listError) {
        console.log(`   ❌ Erreur lors de la lecture du dossier ${folder}: ${listError.message}\n`);
      } else {
        console.log(`   ⚠️  Dossier ${folder} vide\n`);
      }
    }
  } else {
    console.log("❌ Bucket property-photos non trouvé\n");
  }

  // 6. Résumé de la connexion
  console.log("=".repeat(80));
  console.log("\n📊 RÉSUMÉ DE LA CONNEXION\n");
  console.log(`   ✅ Propriétés connectées: ${totalConnected}`);
  console.log(`   ❌ Propriétés non connectées: ${totalDisconnected}`);
  console.log(`   📸 Total photos: ${photos.length}`);
  console.log(`   🏠 Propriétés avec photos: ${photosByProperty.size}\n`);

  // 7. Vérifier les propriétés sans photos
  console.log("=".repeat(80));
  console.log("\n🔍 PROPRIÉTÉS SANS PHOTOS\n");

  const { data: allProperties } = await serviceClient
    .from("properties")
    .select("id, adresse_complete, type, etat, owner_id")
    .order("created_at", { ascending: false });

  if (allProperties) {
    const propertiesWithPhotos = new Set(photos.map((p: any) => p.property_id));
    const propertiesWithoutPhotos = allProperties.filter(
      (prop: any) => !propertiesWithPhotos.has(prop.id)
    );

    if (propertiesWithoutPhotos.length > 0) {
      console.log(`⚠️  ${propertiesWithoutPhotos.length} propriété(s) sans photos:\n`);
      propertiesWithoutPhotos.forEach((prop: any) => {
        console.log(`   - ${prop.adresse_complete || "Adresse à compléter"}`);
        console.log(`     Type: ${prop.type}, État: ${prop.etat}`);
        console.log(`     ID: ${prop.id}\n`);
      });
    } else {
      console.log("✅ Toutes les propriétés ont au moins une photo\n");
    }
  }

  console.log("=".repeat(80));
  console.log("✅ Vérification terminée\n");
}

listPropertyPhotos().catch(console.error);

