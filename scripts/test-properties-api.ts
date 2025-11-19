/**
 * Script de test pour vérifier que l'API /api/properties fonctionne correctement
 * 
 * Usage: npx tsx scripts/test-properties-api.ts
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function testPropertiesAPI() {
  console.log("🧪 Test de l'API /api/properties\n");
  console.log(`URL: ${API_URL}/api/properties\n`);

  try {
    // Note: Ce script nécessite une authentification réelle
    // Pour un test complet, il faudrait utiliser un token d'authentification
    
    const response = await fetch(`${API_URL}/api/properties`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Ajouter ici un token d'authentification si disponible
      },
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Erreur:", errorData);
      return;
    }

    const data = await response.json();
    
    console.log("✅ Réponse reçue:");
    console.log(`   - propertiesCount: ${data.propertiesCount ?? "N/A"}`);
    console.log(`   - properties.length: ${data.properties?.length ?? 0}`);
    console.log(`   - leasesCount: ${data.leasesCount ?? "N/A"}`);
    console.log(`   - Format correct: ${data.properties && Array.isArray(data.properties) ? "✅" : "❌"}`);
    
    if (data.properties && data.properties.length > 0) {
      console.log("\n📋 Première propriété:");
      const firstProperty = data.properties[0];
      console.log(`   - ID: ${firstProperty.id}`);
      console.log(`   - Adresse: ${firstProperty.adresse_complete || "N/A"}`);
      console.log(`   - Type: ${firstProperty.type || "N/A"}`);
      console.log(`   - Status: ${firstProperty.status || "N/A"}`);
      console.log(`   - Monthly Rent: ${firstProperty.monthlyRent || 0}`);
    }

    console.log("\n✅ Test terminé avec succès!");
  } catch (error: any) {
    console.error("❌ Erreur lors du test:", error.message);
    console.error(error);
  }
}

testPropertiesAPI();

