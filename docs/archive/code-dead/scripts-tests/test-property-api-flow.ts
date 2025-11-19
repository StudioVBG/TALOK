/**
 * Script de test pour vérifier le flux complet via l'API HTTP :
 * 1. Création d'un draft (POST /api/properties)
 * 2. Auto-save (PATCH /api/properties/:id)
 * 3. Ajout de pièces (POST /api/properties/:id/rooms)
 * 
 * Ce script simule exactement ce que fait le frontend.
 * 
 * Usage: npx tsx scripts/test-property-api-flow.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Charger les variables d'environnement depuis .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

// Pour ce test, nous avons besoin d'un token d'authentification
// Pour simplifier, nous allons créer un utilisateur de test et obtenir son token
// Ou utiliser directement Supabase pour créer un token de test

async function testPropertyAPIFlow() {
  console.log("🧪 Test du flux de création d'un logement via API HTTP\n");

  // Note: Pour un test complet, nous aurions besoin d'un token d'authentification valide
  // Pour l'instant, nous allons tester les endpoints sans authentification pour voir les erreurs

  console.log("1️⃣ Test de création d'un draft (POST /api/properties)...");
  try {
    const draftResponse = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type_bien: "appartement",
      }),
    });

    const draftData = await draftResponse.json();
    console.log(`Status: ${draftResponse.status}`);
    console.log(`Response:`, JSON.stringify(draftData, null, 2));

    if (draftResponse.status === 201 && draftData.property?.id) {
      const propertyId = draftData.property.id;
      console.log(`✓ Draft créé avec succès: ${propertyId}\n`);

      console.log("2️⃣ Test de l'auto-save (PATCH /api/properties/:id)...");
      const updateResponse = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adresse_complete: "123 Rue de Test",
          code_postal: "75001",
          ville: "Paris",
          surface_habitable_m2: 50,
          nb_pieces: 2,
        }),
      });

      const updateData = await updateResponse.json();
      console.log(`Status: ${updateResponse.status}`);
      console.log(`Response:`, JSON.stringify(updateData, null, 2));

      if (updateResponse.status === 200) {
        console.log(`✓ Auto-save réussi\n`);

        console.log("3️⃣ Test de l'ajout de pièces (POST /api/properties/:id/rooms)...");
        const roomResponse = await fetch(`${API_BASE}/properties/${propertyId}/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type_piece: "sejour",
            label_affiche: "Salon",
            surface_m2: 25,
            chauffage_present: true,
            chauffage_type_emetteur: "radiateur",
            clim_presente: false,
          }),
        });

        const roomData = await roomResponse.json();
        console.log(`Status: ${roomResponse.status}`);
        console.log(`Response:`, JSON.stringify(roomData, null, 2));

        if (roomResponse.status === 201) {
          console.log(`✓ Pièce ajoutée avec succès\n`);
        } else {
          console.error(`❌ Erreur lors de l'ajout de pièce`);
        }
      } else {
        console.error(`❌ Erreur lors de l'auto-save`);
      }
    } else {
      console.error(`❌ Erreur lors de la création du draft`);
    }
  } catch (error: any) {
    console.error("❌ Erreur fatale:", error.message);
  }

  console.log("\n✅ Test terminé");
}

testPropertyAPIFlow().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});

