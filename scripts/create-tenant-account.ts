/**
 * Crée un compte locataire et le lie à un bail
 * Usage: npx tsx scripts/create-tenant-account.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Charger .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const TENANT_EMAIL = "volberg.thomas@hotmail.fr";
const TENANT_PASSWORD = "Test12345!2025";

async function createTenantAccount() {
  console.log("🏠 Création du compte locataire...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Variables Supabase manquantes");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Vérifier si l'utilisateur existe déjà
  console.log("📧 Email:", TENANT_EMAIL);
  
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === TENANT_EMAIL);

  let userId: string;

  if (existingUser) {
    console.log("⚠️ L'utilisateur existe déjà, mise à jour du mot de passe...");
    userId = existingUser.id;
    
    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: TENANT_PASSWORD,
      email_confirm: true,
    });
    
    if (updateError) {
      console.error("❌ Erreur mise à jour:", updateError.message);
    } else {
      console.log("✅ Mot de passe mis à jour");
    }
  } else {
    // Créer le nouvel utilisateur
    console.log("📝 Création du nouvel utilisateur...");
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: TENANT_EMAIL,
      password: TENANT_PASSWORD,
      email_confirm: true, // Confirmer l'email automatiquement
      user_metadata: {
        role: "tenant",
        first_name: "Thomas",
        last_name: "Volberg",
      },
    });

    if (createError) {
      console.error("❌ Erreur création:", createError.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log("✅ Utilisateur créé avec ID:", userId);
  }

  // 2. Vérifier/Créer le profil
  console.log("\n📋 Vérification du profil...");
  
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", userId)
    .single();

  let profileId: string;

  if (existingProfile) {
    console.log("⚠️ Profil existant, mise à jour du rôle...");
    profileId = existingProfile.id;
    
    // S'assurer que le rôle est "tenant"
    if (existingProfile.role !== "tenant") {
      await supabase
        .from("profiles")
        .update({ role: "tenant" })
        .eq("id", profileId);
      console.log("✅ Rôle mis à jour vers 'tenant'");
    }
  } else {
    // Créer le profil
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        role: "tenant",
        first_name: "Thomas",
        last_name: "Volberg",
      })
      .select()
      .single();

    if (profileError) {
      console.error("❌ Erreur création profil:", profileError.message);
      process.exit(1);
    }

    profileId = newProfile.id;
    console.log("✅ Profil créé avec ID:", profileId);
  }

  // 3. Vérifier/Créer le profil tenant spécialisé
  console.log("\n👤 Vérification du profil tenant...");
  
  const { data: existingTenantProfile } = await supabase
    .from("tenant_profiles")
    .select("id")
    .eq("profile_id", profileId)
    .single();

  if (!existingTenantProfile) {
    const { error: tenantProfileError } = await supabase
      .from("tenant_profiles")
      .insert({
        profile_id: profileId,
        situation_pro: null,
        revenus_mensuels: null,
        nb_adultes: 1,
        nb_enfants: 0,
        garant_required: false,
      });

    if (tenantProfileError) {
      console.log("⚠️ Profil tenant non créé (table peut ne pas exister):", tenantProfileError.message);
    } else {
      console.log("✅ Profil tenant créé");
    }
  } else {
    console.log("✅ Profil tenant existe déjà");
  }

  // 4. Chercher un bail en attente pour ce locataire
  console.log("\n📄 Recherche de baux en attente...");
  
  const { data: pendingLeases, error: leasesError } = await supabase
    .from("leases")
    .select(`
      id,
      status,
      tenant_email_pending,
      tenant_name_pending,
      property_id,
      properties (
        id,
        address,
        city
      )
    `)
    .or(`tenant_email_pending.eq.${TENANT_EMAIL},status.eq.pending_signature`)
    .limit(5);

  if (leasesError) {
    console.log("⚠️ Erreur recherche baux:", leasesError.message);
  }

  if (pendingLeases && pendingLeases.length > 0) {
    console.log(`✅ ${pendingLeases.length} bail(s) trouvé(s):`);
    
    for (const lease of pendingLeases) {
      console.log(`   - Bail ${lease.id.substring(0, 8)}... pour ${(lease.properties as any)?.address || "N/A"}`);
      
      // Lier le bail au profil tenant
      const { error: updateLeaseError } = await supabase
        .from("leases")
        .update({
          tenant_profile_id: profileId,
          status: "pending_signature",
        })
        .eq("id", lease.id);

      if (updateLeaseError) {
        console.log(`   ⚠️ Erreur liaison: ${updateLeaseError.message}`);
      } else {
        console.log(`   ✅ Bail lié au profil tenant`);
      }

      // Vérifier/créer l'entrée lease_signers
      const { data: existingSigner } = await supabase
        .from("lease_signers")
        .select("id")
        .eq("lease_id", lease.id)
        .eq("profile_id", profileId)
        .single();

      if (!existingSigner) {
        const { error: signerError } = await supabase
          .from("lease_signers")
          .insert({
            lease_id: lease.id,
            profile_id: profileId,
            role: "locataire_principal",
            signature_status: "pending",
          });

        if (signerError) {
          console.log(`   ⚠️ Erreur ajout signataire: ${signerError.message}`);
        } else {
          console.log(`   ✅ Signataire ajouté`);
        }
      }
    }
  } else {
    console.log("ℹ️ Aucun bail en attente trouvé pour cet email");
    
    // Lister tous les baux disponibles
    const { data: allLeases } = await supabase
      .from("leases")
      .select("id, status, tenant_email_pending")
      .limit(10);
    
    if (allLeases && allLeases.length > 0) {
      console.log("\n📋 Baux existants dans la base:");
      allLeases.forEach(l => {
        console.log(`   - ${l.id.substring(0, 8)}... | Status: ${l.status} | Email: ${l.tenant_email_pending || "N/A"}`);
      });
    }
  }

  // 5. Résumé
  console.log("\n═══════════════════════════════════════════");
  console.log("✅ COMPTE LOCATAIRE CONFIGURÉ !");
  console.log("═══════════════════════════════════════════");
  console.log("📧 Email:", TENANT_EMAIL);
  console.log("🔑 Mot de passe:", TENANT_PASSWORD);
  console.log("👤 Profile ID:", profileId);
  console.log("🆔 User ID:", userId);
  console.log("");
  console.log("🔗 Connexion: http://localhost:3000/sign-in");
  console.log("═══════════════════════════════════════════");
}

createTenantAccount().catch(console.error);

