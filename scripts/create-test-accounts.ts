#!/usr/bin/env npx tsx
/**
 * Script pour créer des comptes de test complets
 * Exécution : npx tsx scripts/create-test-accounts.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

interface TestAccount {
  email: string;
  password: string;
  role: "admin" | "owner" | "tenant" | "provider";
  prenom: string;
  nom: string;
  telephone?: string;
  ownerType?: "particulier" | "societe";
  siret?: string;
  raisonSociale?: string;
}

const testAccounts: TestAccount[] = [
  // Agence / Conciergerie (Propriétaire Société)
  {
    email: "agence@test.com",
    password: "Agence123!",
    role: "owner",
    prenom: "Marie",
    nom: "Dupont",
    telephone: "0601020304",
    ownerType: "societe",
    siret: "12345678901234",
    raisonSociale: "Talok Plus SARL",
  },
  // Propriétaire Particulier
  {
    email: "proprio@test.com",
    password: "Proprio123!",
    role: "owner",
    prenom: "Jean",
    nom: "Martin",
    telephone: "0611223344",
    ownerType: "particulier",
  },
  // Locataire 1
  {
    email: "locataire1@test.com",
    password: "Locataire123!",
    role: "tenant",
    prenom: "Sophie",
    nom: "Bernard",
    telephone: "0622334455",
  },
  // Locataire 2 (pour colocation)
  {
    email: "locataire2@test.com",
    password: "Locataire123!",
    role: "tenant",
    prenom: "Lucas",
    nom: "Petit",
    telephone: "0633445566",
  },
  // Locataire 3 (pour colocation)
  {
    email: "locataire3@test.com",
    password: "Locataire123!",
    role: "tenant",
    prenom: "Emma",
    nom: "Durand",
    telephone: "0644556677",
  },
  // Prestataire Plombier
  {
    email: "plombier@test.com",
    password: "Plombier123!",
    role: "provider",
    prenom: "Pierre",
    nom: "Lefebvre",
    telephone: "0655667788",
  },
  // Prestataire Électricien
  {
    email: "electricien@test.com",
    password: "Electricien123!",
    role: "provider",
    prenom: "Marc",
    nom: "Moreau",
    telephone: "0666778899",
  },
];

async function createAccount(account: TestAccount): Promise<boolean> {
  const { email, password, role, prenom, nom, telephone, ownerType, siret, raisonSociale } = account;

  try {
    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === email);

    if (existingUser) {
      console.log(`  ⚠️  ${email} existe déjà, mise à jour du mot de passe...`);
      await supabase.auth.admin.updateUserById(existingUser.id, { password });
      return true;
    }

    // Créer l'utilisateur
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError) {
      console.error(`  ❌ Erreur création ${email}:`, userError.message);
      return false;
    }

    if (!newUser.user) {
      console.error(`  ❌ Échec création ${email}`);
      return false;
    }

    // Créer ou mettre à jour le profil
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", newUser.user.id)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: newUser.user.id,
        role,
        prenom,
        nom,
        telephone,
      });

      if (profileError) {
        console.error(`  ❌ Erreur profil ${email}:`, profileError.message);
        return false;
      }
    }

    // Récupérer le profile_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", newUser.user.id)
      .single();

    if (!profile) {
      console.error(`  ❌ Profil non trouvé pour ${email}`);
      return false;
    }

    // Créer le profil spécialisé selon le rôle
    if (role === "owner" && ownerType) {
      const { error: ownerError } = await supabase.from("owner_profiles").upsert({
        profile_id: profile.id,
        type: ownerType,
        siret: siret || null,
        raison_sociale: raisonSociale || null,
      });

      if (ownerError) {
        console.error(`  ❌ Erreur owner_profile ${email}:`, ownerError.message);
      }
    }

    if (role === "tenant") {
      const { error: tenantError } = await supabase.from("tenant_profiles").upsert({
        profile_id: profile.id,
        situation_pro: "CDI",
        revenus_mensuels: 2500,
        nb_adultes: 1,
        nb_enfants: 0,
      });

      if (tenantError && !tenantError.message.includes("duplicate")) {
        console.error(`  ❌ Erreur tenant_profile ${email}:`, tenantError.message);
      }
    }

    if (role === "provider") {
      const { error: providerError } = await supabase.from("provider_profiles").upsert({
        profile_id: profile.id,
        type_services: email.includes("plombier") 
          ? ["plomberie", "chauffage"]
          : ["electricite", "domotique"],
        zones_intervention: "Île-de-France",
        certifications: "RGE, Qualibat",
      });

      if (providerError && !providerError.message.includes("duplicate")) {
        console.error(`  ❌ Erreur provider_profile ${email}:`, providerError.message);
      }
    }

    console.log(`  ✅ ${email} créé avec succès`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ Exception ${email}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("\n🚀 Création des comptes de test\n");
  console.log("=".repeat(60));

  let created = 0;
  let failed = 0;

  for (const account of testAccounts) {
    const emoji = account.role === "owner" ? "🏠" : 
                  account.role === "tenant" ? "👤" : 
                  account.role === "provider" ? "🔧" : "👑";
    
    console.log(`\n${emoji} ${account.prenom} ${account.nom} (${account.role})`);
    
    const success = await createAccount(account);
    if (success) {
      created++;
    } else {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 Résultat : ${created} créés, ${failed} échecs\n`);

  console.log("📋 Récapitulatif des comptes de test :\n");
  console.log("┌─────────────────────────────────┬────────────────────┬───────────┐");
  console.log("│ Email                           │ Mot de passe       │ Rôle      │");
  console.log("├─────────────────────────────────┼────────────────────┼───────────┤");
  
  for (const account of testAccounts) {
    const email = account.email.padEnd(31);
    const pwd = account.password.padEnd(18);
    const role = (account.ownerType === "societe" ? "owner/agence" : account.role).padEnd(9);
    console.log(`│ ${email} │ ${pwd} │ ${role} │`);
  }
  
  console.log("└─────────────────────────────────┴────────────────────┴───────────┘");
  
  console.log("\n✨ Utilisez ces comptes pour tester l'application !\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erreur fatale:", error);
    process.exit(1);
  });

