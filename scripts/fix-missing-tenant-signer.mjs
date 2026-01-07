/**
 * Script pour ajouter le locataire manquant au bail
 * Usage: node scripts/fix-missing-tenant-signer.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const LEASE_ID = "bb79e040-9fdf-4365-a4a5-6090d417ae97";

async function main() {
  console.log("=== Diagnostic et correction du bail ===\n");
  
  // 1. Vérifier le bail
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id, statut, type_bail, date_debut, property_id")
    .eq("id", LEASE_ID)
    .single();
  
  if (leaseError) {
    console.error("❌ Erreur bail:", leaseError.message);
    return;
  }
  
  console.log("📄 Bail:");
  console.log(`   ID: ${lease.id}`);
  console.log(`   Statut: ${lease.statut}`);
  console.log(`   Type: ${lease.type_bail}`);
  
  // 2. Vérifier les signataires actuels
  const { data: signers, error: signersError } = await supabase
    .from("lease_signers")
    .select("id, role, signature_status, signed_at, profile_id, invited_email, invited_name")
    .eq("lease_id", LEASE_ID);
  
  if (signersError) {
    console.error("❌ Erreur signataires:", signersError.message);
    return;
  }
  
  console.log("\n👥 Signataires actuels:");
  if (!signers || signers.length === 0) {
    console.log("   Aucun signataire trouvé!");
  } else {
    for (const signer of signers) {
      const status = signer.signature_status === "signed" ? "✅" : "⏳";
      console.log(`   ${status} ${signer.role}: ${signer.signature_status}`);
      console.log(`      Profile ID: ${signer.profile_id || 'NULL'}`);
      console.log(`      Email invité: ${signer.invited_email || 'NULL'}`);
    }
  }
  
  // 3. Vérifier s'il y a un locataire
  const hasTenant = signers?.some(s => 
    s.role === 'locataire_principal' || 
    s.role === 'colocataire' ||
    s.role === 'locataire'
  );
  
  if (hasTenant) {
    console.log("\n✅ Un locataire existe déjà dans les signataires");
    return;
  }
  
  console.log("\n⚠️ Aucun locataire trouvé! Ajout en cours...");
  
  // 4. Chercher si un locataire est lié à la propriété via d'autres tables
  // Par exemple, chercher dans roommates ou invitations
  const { data: property } = await supabase
    .from("properties")
    .select("id, adresse_complete")
    .eq("id", lease.property_id)
    .single();
    
  console.log(`\n🏠 Propriété: ${property?.adresse_complete}`);
  
  // 5. Ajouter un locataire placeholder avec email d'invitation
  // Utilisons un email générique qui devra être corrigé
  const { data: newSigner, error: insertError } = await supabase
    .from("lease_signers")
    .insert({
      lease_id: LEASE_ID,
      profile_id: null,
      invited_email: "locataire@a-definir.com", // Email placeholder
      invited_name: "Locataire à définir",
      role: "locataire_principal",
      signature_status: "pending",
    })
    .select()
    .single();
  
  if (insertError) {
    console.error("❌ Erreur ajout locataire:", insertError.message);
    
    // Si erreur de contrainte, afficher les détails
    if (insertError.message.includes("violates")) {
      console.log("\n💡 Vérifiez les contraintes de la table lease_signers");
      console.log("   Il faut peut-être appliquer la migration pour rendre profile_id nullable");
    }
    return;
  }
  
  console.log("\n✅ Locataire placeholder ajouté!");
  console.log(`   ID: ${newSigner.id}`);
  console.log(`   Rôle: ${newSigner.role}`);
  console.log(`   Email: ${newSigner.invited_email}`);
  
  console.log("\n⚠️ IMPORTANT: Mettez à jour l'email du locataire dans Supabase ou via l'interface!");
  console.log(`   UPDATE lease_signers SET invited_email = 'vrai_email@example.com', invited_name = 'Vrai Nom' WHERE id = '${newSigner.id}';`);
}

main().catch(console.error);

