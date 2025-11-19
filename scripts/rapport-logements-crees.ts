/**
 * Script pour générer un rapport détaillé des logements créés
 * Usage: npx tsx scripts/rapport-logements-crees.ts
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

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface PropertyDetails {
  id: string;
  owner_id: string;
  type: string;
  type_bien?: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  surface: number;
  nb_pieces: number;
  loyer_hc: number;
  etat: string;
  created_at: string;
  nombre_unites?: number;
  nombre_pieces?: number;
  nombre_photos?: number;
  nombre_baux?: number;
}

async function generateReport() {
  console.log("📊 RAPPORT DÉTAILLÉ DES LOGEMENTS CRÉÉS\n");
  console.log("=".repeat(80));

  // 1. Vue d'ensemble
  console.log("\n1️⃣ VUE D'ENSEMBLE\n");
  const { data: overview, error: overviewError } = await serviceClient
    .from("properties")
    .select("id, created_at", { count: "exact" });

  if (overviewError) {
    console.error("❌ Erreur:", overviewError);
    return;
  }

  const total = overview?.length || 0;
  const dates = overview?.map((p) => new Date(p.created_at)).sort((a, b) => a.getTime() - b.getTime());
  const premier = dates?.[0];
  const dernier = dates?.[dates.length - 1];

  console.log(`   Total logements: ${total}`);
  console.log(`   Premier logement: ${premier?.toLocaleString("fr-FR") || "N/A"}`);
  console.log(`   Dernier logement: ${dernier?.toLocaleString("fr-FR") || "N/A"}`);

  // 2. Liste complète avec détails
  console.log("\n2️⃣ LISTE COMPLÈTE DES LOGEMENTS\n");
  const { data: properties, error: propertiesError } = await serviceClient
    .from("properties")
    .select(`
      id,
      owner_id,
      type,
      type_bien,
      usage_principal,
      adresse_complete,
      code_postal,
      ville,
      departement,
      surface,
      nb_pieces,
      nb_chambres,
      etage,
      ascenseur,
      energie,
      ges,
      loyer_hc,
      loyer_base,
      charges_mensuelles,
      depot_garantie,
      zone_encadrement,
      encadrement_loyers,
      unique_code,
      etat,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (propertiesError) {
    console.error("❌ Erreur:", propertiesError);
    return;
  }

  // Enrichir avec les données liées
  const enrichedProperties = await Promise.all(
    (properties || []).map(async (p) => {
      // Compter les unités
      const { count: unitesCount } = await serviceClient
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("property_id", p.id);

      // Compter les pièces
      const { count: piecesCount } = await serviceClient
        .from("rooms")
        .select("*", { count: "exact", head: true })
        .eq("property_id", p.id);

      // Compter les photos
      const { count: photosCount } = await serviceClient
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("property_id", p.id)
        .eq("collection", "property_media");

      // Compter les baux actifs
      const { count: bauxCount } = await serviceClient
        .from("leases")
        .select("*", { count: "exact", head: true })
        .eq("property_id", p.id)
        .eq("statut", "active");

      // Récupérer le propriétaire
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("prenom, nom, email")
        .eq("id", p.owner_id)
        .single();

      return {
        ...p,
        nombre_unites: unitesCount || 0,
        nombre_pieces: piecesCount || 0,
        nombre_photos: photosCount || 0,
        nombre_baux: bauxCount || 0,
        proprietaire: profile ? `${profile.prenom || ""} ${profile.nom || ""}`.trim() || profile.email : "N/A",
      };
    })
  );

  // Afficher le tableau
  console.log("   ID".padEnd(40) + " | Type".padEnd(15) + " | Adresse".padEnd(40) + " | État".padEnd(10) + " | Créé le");
  console.log("-".repeat(150));

  enrichedProperties.forEach((p) => {
    const id = p.id.substring(0, 36) + "...";
    const type = (p.type_bien || p.type || "N/A").substring(0, 13);
    const adresse = (p.adresse_complete || "N/A").substring(0, 38);
    const etat = (p.etat || "N/A").substring(0, 8);
    const date = new Date(p.created_at).toLocaleDateString("fr-FR");
    console.log(`   ${id.padEnd(38)} | ${type.padEnd(13)} | ${adresse.padEnd(38)} | ${etat.padEnd(8)} | ${date}`);
  });

  // 3. Répartition par type
  console.log("\n3️⃣ RÉPARTITION PAR TYPE DE BIEN\n");
  const typeCounts = new Map<string, number>();
  enrichedProperties.forEach((p) => {
    const type = p.type_bien || p.type || "non_defini";
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  });

  Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const pourcentage = ((count / total) * 100).toFixed(1);
      console.log(`   ${type.padEnd(20)} : ${count.toString().padStart(3)} (${pourcentage}%)`);
    });

  // 4. Répartition par état
  console.log("\n4️⃣ RÉPARTITION PAR ÉTAT\n");
  const etatCounts = new Map<string, number>();
  enrichedProperties.forEach((p) => {
    const etat = p.etat || "non_defini";
    etatCounts.set(etat, (etatCounts.get(etat) || 0) + 1);
  });

  Array.from(etatCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([etat, count]) => {
      const pourcentage = ((count / total) * 100).toFixed(1);
      console.log(`   ${etat.padEnd(20)} : ${count.toString().padStart(3)} (${pourcentage}%)`);
    });

  // 5. Répartition par propriétaire
  console.log("\n5️⃣ RÉPARTITION PAR PROPRIÉTAIRE\n");
  const ownerCounts = new Map<string, { count: number; nom: string }>();
  enrichedProperties.forEach((p) => {
    const ownerId = p.owner_id;
    const current = ownerCounts.get(ownerId) || { count: 0, nom: p.proprietaire || "N/A" };
    current.count++;
    ownerCounts.set(ownerId, current);
  });

  Array.from(ownerCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([ownerId, data]) => {
      console.log(`   ${data.nom.padEnd(30)} : ${data.count.toString().padStart(3)} logement(s)`);
    });

  // 6. Statistiques financières
  console.log("\n6️⃣ STATISTIQUES FINANCIÈRES\n");
  const avecLoyer = enrichedProperties.filter((p) => p.loyer_hc && p.loyer_hc > 0);
  if (avecLoyer.length > 0) {
    const loyerMoyen = avecLoyer.reduce((sum, p) => sum + (p.loyer_hc || 0), 0) / avecLoyer.length;
    const loyerMin = Math.min(...avecLoyer.map((p) => p.loyer_hc || 0));
    const loyerMax = Math.max(...avecLoyer.map((p) => p.loyer_hc || 0));
    const chargesMoyennes =
      avecLoyer.reduce((sum, p) => sum + (p.charges_mensuelles || 0), 0) / avecLoyer.length;
    const depotMoyen = avecLoyer.reduce((sum, p) => sum + (p.depot_garantie || 0), 0) / avecLoyer.length;
    const revenusPotentiels = avecLoyer.reduce((sum, p) => sum + (p.loyer_hc || 0), 0);

    console.log(`   Loyer moyen: ${loyerMoyen.toFixed(2)} €`);
    console.log(`   Loyer min: ${loyerMin.toFixed(2)} €`);
    console.log(`   Loyer max: ${loyerMax.toFixed(2)} €`);
    console.log(`   Charges moyennes: ${chargesMoyennes.toFixed(2)} €`);
    console.log(`   Dépôt moyen: ${depotMoyen.toFixed(2)} €`);
    console.log(`   Revenus potentiels mensuels: ${revenusPotentiels.toFixed(2)} €`);
  } else {
    console.log("   Aucun logement avec loyer défini");
  }

  // 7. Détails complets par logement
  console.log("\n7️⃣ DÉTAILS COMPLETS PAR LOGEMENT\n");
  enrichedProperties.forEach((p, index) => {
    console.log(`\n   ┌─ Logement ${index + 1}/${total}`);
    console.log(`   │ ID: ${p.id}`);
    console.log(`   │ Propriétaire: ${p.proprietaire} (${p.owner_id})`);
    console.log(`   │ Type: ${p.type_bien || p.type || "N/A"}`);
    console.log(`   │ Adresse: ${p.adresse_complete || "N/A"}`);
    console.log(`   │ ${p.code_postal || "N/A"} ${p.ville || "N/A"}`);
    console.log(`   │ Surface: ${p.surface || 0} m²`);
    console.log(`   │ Pièces: ${p.nb_pieces || 0} (${p.nb_chambres || 0} chambres)`);
    console.log(`   │ Loyer HC: ${p.loyer_hc || 0} €`);
    console.log(`   │ Charges: ${p.charges_mensuelles || 0} €`);
    console.log(`   │ Dépôt: ${p.depot_garantie || 0} €`);
    console.log(`   │ État: ${p.etat || "N/A"}`);
    console.log(`   │ Unités: ${p.nombre_unites}`);
    console.log(`   │ Pièces détaillées: ${p.nombre_pieces}`);
    console.log(`   │ Photos: ${p.nombre_photos}`);
    console.log(`   │ Baux actifs: ${p.nombre_baux}`);
    console.log(`   │ Créé le: ${new Date(p.created_at).toLocaleString("fr-FR")}`);
    console.log(`   └─ Code unique: ${p.unique_code || "N/A"}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("✅ Rapport terminé\n");
}

generateReport().catch(console.error);

