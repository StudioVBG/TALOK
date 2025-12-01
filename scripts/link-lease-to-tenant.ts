/**
 * Lie un bail au profil du locataire
 * Usage: npx tsx scripts/link-lease-to-tenant.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const TENANT_PROFILE_ID = "7a1f85cb-b27c-4882-9b9a-42f520dce88b";
const TENANT_EMAIL = "volberg.thomas@hotmail.fr";

async function linkLease() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Lister tous les baux (colonnes de base uniquement)
  console.log("📄 Liste des baux existants...\n");
  
  const { data: leases, error } = await supabase
    .from("leases")
    .select("id, statut, property_id, type_bail, loyer")
    .limit(10);

  if (error) {
    console.error("❌ Erreur:", error.message);
    return;
  }

  if (!leases || leases.length === 0) {
    console.log("ℹ️ Aucun bail trouvé");
    return;
  }

  console.log("Baux trouvés:");
  for (const lease of leases) {
    const shortId = lease.id.substring(0, 8);
    console.log("  - " + shortId + "... | " + (lease.type_bail || "N/A") + " | " + lease.loyer + "€ | Statut: " + lease.statut);
  }

  // Trouver un bail à lier (priorité: draft/pending_signature)
  let leaseToLink = leases.find(l => l.statut === "draft" || l.statut === "pending_signature");
  
  if (!leaseToLink) {
    leaseToLink = leases[0];
  }

  const leaseShortId = leaseToLink.id.substring(0, 8);
  const profileShortId = TENANT_PROFILE_ID.substring(0, 8);
  console.log("\n🔗 Liaison du bail " + leaseShortId + "... au profil " + profileShortId + "...");

  // Mettre à jour le statut du bail
  const { error: updateError } = await supabase
    .from("leases")
    .update({
      statut: "pending_signature",
    })
    .eq("id", leaseToLink.id);

  if (updateError) {
    console.error("❌ Erreur mise à jour bail:", updateError.message);
  } else {
    console.log("✅ Statut bail mis à jour");
  }

  // Vérifier si le signataire existe déjà
  const { data: existingSigner } = await supabase
    .from("lease_signers")
    .select("id")
    .eq("lease_id", leaseToLink.id)
    .eq("profile_id", TENANT_PROFILE_ID)
    .single();

  if (!existingSigner) {
    // Ajouter le locataire comme signataire
    const { error: signerError } = await supabase
      .from("lease_signers")
      .insert({
        lease_id: leaseToLink.id,
        profile_id: TENANT_PROFILE_ID,
        role: "locataire_principal",
        signature_status: "pending",
      });

    if (signerError) {
      console.error("❌ Erreur ajout signataire:", signerError.message);
    } else {
      console.log("✅ Signataire ajouté (locataire_principal)");
    }
  } else {
    console.log("✅ Signataire déjà existant");
  }

  // Lister tous les signataires de ce bail
  const { data: allSigners } = await supabase
    .from("lease_signers")
    .select("id, profile_id, role, signature_status")
    .eq("lease_id", leaseToLink.id);

  console.log("\n📝 Signataires du bail:");
  if (allSigners) {
    for (const signer of allSigners) {
      console.log("  - " + signer.role + " | " + signer.signature_status + " | Profile: " + signer.profile_id.substring(0, 8) + "...");
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ BAIL LIÉ AU LOCATAIRE !");
  console.log("═══════════════════════════════════════════");
  console.log("📄 Bail ID:", leaseToLink.id);
  console.log("👤 Profile ID:", TENANT_PROFILE_ID);
  console.log("📧 Email:", TENANT_EMAIL);
  console.log("");
  console.log("🔗 URL de signature: http://localhost:3000/signature/" + leaseToLink.id);
  console.log("🔗 Dashboard tenant: http://localhost:3000/app/tenant");
  console.log("═══════════════════════════════════════════");
}

linkLease();

