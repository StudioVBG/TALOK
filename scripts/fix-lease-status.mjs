/**
 * Script pour corriger le statut du bail signé
 * Usage: node scripts/fix-lease-status.mjs
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
  console.log("=== Vérification du bail ===\n");
  
  // 1. Vérifier le bail
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id, statut, type_bail, date_debut")
    .eq("id", LEASE_ID)
    .single();
  
  if (leaseError) {
    console.error("❌ Erreur bail:", leaseError.message);
    return;
  }
  
  console.log("📄 Bail actuel:");
  console.log(`   ID: ${lease.id}`);
  console.log(`   Statut: ${lease.statut}`);
  console.log(`   Type: ${lease.type_bail}`);
  console.log(`   Date début: ${lease.date_debut}`);
  
  // 2. Vérifier les signataires
  const { data: signers, error: signersError } = await supabase
    .from("lease_signers")
    .select("role, signature_status, signed_at, profile_id")
    .eq("lease_id", LEASE_ID);
  
  if (signersError) {
    console.error("❌ Erreur signataires:", signersError.message);
    return;
  }
  
  console.log("\n👥 Signataires:");
  for (const signer of signers || []) {
    const status = signer.signature_status === "signed" ? "✅" : "⏳";
    console.log(`   ${status} ${signer.role}: ${signer.signature_status} (${signer.signed_at || "non signé"})`);
  }
  
  // 3. Vérifier si tous ont signé
  const allSigned = signers && signers.length > 0 && 
    signers.every((s) => s.signature_status === "signed");
  
  console.log(`\n📊 Tous ont signé: ${allSigned ? "OUI" : "NON"}`);
  
  // 4. Corriger le statut si nécessaire
  if (allSigned && lease.statut !== "fully_signed" && lease.statut !== "active") {
    console.log("\n🔧 Correction du statut vers 'fully_signed'...");
    
    const { error: updateError } = await supabase
      .from("leases")
      .update({ statut: "fully_signed" })
      .eq("id", LEASE_ID);
    
    if (updateError) {
      console.error("❌ Erreur mise à jour:", updateError.message);
      
      // Vérifier si c'est un problème de contrainte
      if (updateError.message.includes("check constraint")) {
        console.log("\n⚠️ Le statut 'fully_signed' n'existe pas encore dans la contrainte.");
        console.log("   Veuillez appliquer la migration: 20251228000000_edl_before_activation.sql");
      }
    } else {
      console.log("✅ Statut corrigé avec succès!");
    }
  } else if (lease.statut === "fully_signed") {
    console.log("\n✅ Le bail est déjà en statut 'fully_signed'");
  } else if (lease.statut === "active") {
    console.log("\n✅ Le bail est déjà actif");
  } else {
    console.log("\n⚠️ Pas de correction - signatures manquantes ou statut incompatible");
  }
}

main().catch(console.error);














