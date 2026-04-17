#!/usr/bin/env npx tsx
/**
 * Script complet pour créer tous les comptes de test
 * Tous les rôles avec données complètes pour tester l'UI
 * 
 * Mot de passe unique : Test12345!2025
 * 
 * Exécution : npx tsx scripts/create-complete-test-accounts.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  console.error("   Vérifiez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// =============================================================================
// CONFIGURATION DES COMPTES
// =============================================================================

const PASSWORD = "Test12345!2025";

interface TestAccount {
  email: string;
  role: string;
  prenom: string;
  nom: string;
  telephone: string;
  description: string;
  // Données spécifiques au rôle
  ownerType?: "particulier" | "societe";
  siret?: string;
  raisonSociale?: string;
  providerServices?: string[];
  tenantData?: {
    situation_pro: string;
    revenus_mensuels: number;
    nb_adultes: number;
    nb_enfants: number;
  };
}

const testAccounts: TestAccount[] = [
  // ========== ADMIN ==========
  {
    email: "support@talok.fr",
    role: "admin",
    prenom: "Thomas",
    nom: "Admin",
    telephone: "0600000001",
    description: "Super administrateur - Accès complet",
  },

  // ========== PROPRIÉTAIRES ==========
  {
    email: "proprio.particulier@test.lokatif.fr",
    role: "owner",
    prenom: "Jean",
    nom: "Dupont",
    telephone: "0600000002",
    description: "Propriétaire particulier - 2 biens",
    ownerType: "particulier",
  },
  {
    email: "proprio.societe@test.lokatif.fr",
    role: "owner",
    prenom: "Marie",
    nom: "Martin",
    telephone: "0600000003",
    description: "Propriétaire société (SCI) - 3 biens",
    ownerType: "societe",
    siret: "12345678901234",
    raisonSociale: "SCI Les Tilleuls",
  },

  // ========== AGENCE ==========
  {
    email: "agence@test.lokatif.fr",
    role: "agency",
    prenom: "Sophie",
    nom: "Leroy",
    telephone: "0600000004",
    description: "Agence immobilière - Mandats de gestion",
  },

  // ========== LOCATAIRES ==========
  {
    email: "locataire@test.lokatif.fr",
    role: "tenant",
    prenom: "Lucas",
    nom: "Bernard",
    telephone: "0600000005",
    description: "Locataire standard - Bail actif",
    tenantData: {
      situation_pro: "CDI",
      revenus_mensuels: 2800,
      nb_adultes: 1,
      nb_enfants: 0,
    },
  },
  {
    email: "colocataire@test.lokatif.fr",
    role: "tenant",
    prenom: "Emma",
    nom: "Petit",
    telephone: "0600000006",
    description: "Colocataire - Bail colocation",
    tenantData: {
      situation_pro: "CDI",
      revenus_mensuels: 2200,
      nb_adultes: 1,
      nb_enfants: 0,
    },
  },
  {
    email: "locataire2@test.lokatif.fr",
    role: "tenant",
    prenom: "Pierre",
    nom: "Durand",
    telephone: "0600000012",
    description: "Locataire 2 - Pour signature en attente",
    tenantData: {
      situation_pro: "CDD",
      revenus_mensuels: 2000,
      nb_adultes: 2,
      nb_enfants: 1,
    },
  },

  // ========== GARANT ==========
  {
    email: "garant@test.lokatif.fr",
    role: "guarantor",
    prenom: "Philippe",
    nom: "Moreau",
    telephone: "0600000007",
    description: "Garant - Lié à un locataire",
  },

  // ========== PRESTATAIRES ==========
  {
    email: "plombier@test.lokatif.fr",
    role: "provider",
    prenom: "Marc",
    nom: "Lefebvre",
    telephone: "0600000008",
    description: "Prestataire plomberie/chauffage",
    providerServices: ["plomberie", "chauffage"],
  },
  {
    email: "electricien@test.lokatif.fr",
    role: "provider",
    prenom: "Antoine",
    nom: "Rousseau",
    telephone: "0600000009",
    description: "Prestataire électricité/domotique",
    providerServices: ["electricite", "domotique"],
  },

  // ========== SYNDIC ==========
  {
    email: "syndic@test.lokatif.fr",
    role: "syndic",
    prenom: "Claire",
    nom: "Girard",
    telephone: "0600000010",
    description: "Syndic copropriété - Sites et AG",
  },

  // ========== COPROPRIÉTAIRE ==========
  {
    email: "coproprietaire@test.lokatif.fr",
    role: "coproprietaire",
    prenom: "François",
    nom: "Blanc",
    telephone: "0600000011",
    description: "Copropriétaire - Lot et charges",
  },
];

// =============================================================================
// FONCTIONS DE CRÉATION
// =============================================================================

async function createUser(account: TestAccount): Promise<string | null> {
  const { email } = account;

  try {
    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === email);

    if (existingUser) {
      console.log(`  ⚠️  ${email} existe déjà - Mise à jour du mot de passe`);
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: PASSWORD,
        email_confirm: true,
      });
      return existingUser.id;
    }

    // Créer l'utilisateur avec email confirmé
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true, // Important: confirme l'email automatiquement
    });

    if (userError) {
      console.error(`  ❌ Erreur création user ${email}:`, userError.message);
      return null;
    }

    if (!newUser.user) {
      console.error(`  ❌ Échec création user ${email}`);
      return null;
    }

    return newUser.user.id;
  } catch (error: unknown) {
    console.error(`  ❌ Exception création user ${email}:`, error.message);
    return null;
  }
}

async function createProfile(userId: string, account: TestAccount): Promise<string | null> {
  const { email, role, prenom, nom, telephone } = account;

  try {
    // Vérifier si le profil existe déjà
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (existingProfile) {
      // Mettre à jour le profil existant
      await supabase
        .from("profiles")
        .update({ role, prenom, nom, telephone, email })
        .eq("id", existingProfile.id);
      return existingProfile.id;
    }

    // Créer le profil
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        role,
        prenom,
        nom,
        telephone,
        email,
      })
      .select("id")
      .single();

    if (profileError) {
      console.error(`  ❌ Erreur profil ${email}:`, profileError.message);
      return null;
    }

    return newProfile?.id || null;
  } catch (error: unknown) {
    console.error(`  ❌ Exception profil ${email}:`, error.message);
    return null;
  }
}

async function createOwnerProfile(profileId: string, account: TestAccount): Promise<void> {
  if (account.role !== "owner" || !account.ownerType) return;

  try {
    await supabase.from("owner_profiles").upsert({
      profile_id: profileId,
      type: account.ownerType,
      siret: account.siret || null,
      raison_sociale: account.raisonSociale || null,
      iban: "FR7630006000011234567890189",
      adresse_facturation: "15 rue de la Paix, 75001 Paris",
    });
  } catch (error: unknown) {
    console.error(`  ⚠️  Erreur owner_profile:`, error.message);
  }
}

async function createTenantProfile(profileId: string, account: TestAccount): Promise<void> {
  if (account.role !== "tenant" || !account.tenantData) return;

  try {
    await supabase.from("tenant_profiles").upsert({
      profile_id: profileId,
      situation_pro: account.tenantData.situation_pro,
      revenus_mensuels: account.tenantData.revenus_mensuels,
      nb_adultes: account.tenantData.nb_adultes,
      nb_enfants: account.tenantData.nb_enfants,
      garant_required: account.tenantData.revenus_mensuels < 2500,
    });
  } catch (error: unknown) {
    console.error(`  ⚠️  Erreur tenant_profile:`, error.message);
  }
}

async function createProviderProfile(profileId: string, account: TestAccount): Promise<void> {
  if (account.role !== "provider" || !account.providerServices) return;

  try {
    await supabase.from("provider_profiles").upsert({
      profile_id: profileId,
      type_services: account.providerServices,
      zones_intervention: "Île-de-France, Martinique, Guadeloupe",
      certifications: "RGE, Qualibat",
      status: "approved",
      verification_status: "verified",
      available_for_emergency: true,
      hourly_rate: 45,
      travel_fee: 25,
    });
  } catch (error: unknown) {
    console.error(`  ⚠️  Erreur provider_profile:`, error.message);
  }
}

async function createAgencyProfile(profileId: string, account: TestAccount): Promise<void> {
  if (account.role !== "agency") return;

  try {
    // Vérifier si la table existe
    const { error: checkError } = await supabase
      .from("agency_profiles")
      .select("id")
      .limit(1);

    if (checkError && checkError.code === "42P01") {
      console.log(`  ⚠️  Table agency_profiles n'existe pas encore`);
      return;
    }

    await supabase.from("agency_profiles").upsert({
      profile_id: profileId,
      raison_sociale: "Agence Immo Plus",
      forme_juridique: "SARL",
      siret: "98765432109876",
      numero_carte_pro: "CPI 7501 2023 000 012 345",
      carte_pro_delivree_par: "CCI Paris",
      garantie_financiere_montant: 110000,
      garantie_financiere_organisme: "Galian",
      assurance_rcp_numero: "AXA-12345678",
      taux_commission_gestion: 8.0,
      taux_commission_location: 100,
    });
  } catch (error: unknown) {
    console.error(`  ⚠️  Erreur agency_profile:`, error.message);
  }
}

async function createGuarantorProfile(profileId: string, account: TestAccount): Promise<void> {
  if (account.role !== "guarantor") return;

  try {
    // Vérifier si la table existe
    const { error: checkError } = await supabase
      .from("guarantor_profiles")
      .select("id")
      .limit(1);

    if (checkError && checkError.code === "42P01") {
      console.log(`  ⚠️  Table guarantor_profiles n'existe pas encore`);
      return;
    }

    await supabase.from("guarantor_profiles").upsert({
      profile_id: profileId,
      type_garant: "personne_physique",
      revenus_mensuels: 5000,
      situation_professionnelle: "CDI",
      employeur: "Société Générale",
      lien_avec_locataire: "parent",
    });
  } catch (error: unknown) {
    console.error(`  ⚠️  Erreur guarantor_profile:`, error.message);
  }
}

async function createAccount(account: TestAccount): Promise<boolean> {
  try {
    // 1. Créer l'utilisateur auth
    const userId = await createUser(account);
    if (!userId) return false;

    // 2. Créer le profil de base
    const profileId = await createProfile(userId, account);
    if (!profileId) return false;

    // 3. Créer le profil spécialisé selon le rôle
    switch (account.role) {
      case "owner":
        await createOwnerProfile(profileId, account);
        break;
      case "tenant":
        await createTenantProfile(profileId, account);
        break;
      case "provider":
        await createProviderProfile(profileId, account);
        break;
      case "agency":
        await createAgencyProfile(profileId, account);
        break;
      case "guarantor":
        await createGuarantorProfile(profileId, account);
        break;
      // admin, syndic, coproprietaire n'ont pas de profil spécialisé pour l'instant
    }

    console.log(`  ✅ Compte créé avec succès`);
    return true;
  } catch (error: unknown) {
    console.error(`  ❌ Erreur:`, error.message);
    return false;
  }
}

// =============================================================================
// CRÉATION DES DONNÉES DE TEST
// =============================================================================

interface CreatedAccounts {
  [email: string]: { userId: string; profileId: string };
}

async function createTestData(accounts: CreatedAccounts): Promise<void> {
  console.log("\n📦 Création des données de test...\n");

  // Récupérer les IDs des profils créés
  const ownerParticulier = accounts["proprio.particulier@test.lokatif.fr"];
  const ownerSociete = accounts["proprio.societe@test.lokatif.fr"];
  const locataire = accounts["locataire@test.lokatif.fr"];
  const locataire2 = accounts["locataire2@test.lokatif.fr"];
  const colocataire = accounts["colocataire@test.lokatif.fr"];

  if (!ownerParticulier || !locataire) {
    console.log("  ⚠️  Propriétaire ou locataire manquant, données de test non créées");
    return;
  }

  try {
    // ========== CRÉER DES PROPRIÉTÉS ==========
    console.log("  🏠 Création des biens immobiliers...");

    // Bien 1: Appartement du propriétaire particulier
    const { data: property1, error: prop1Error } = await supabase
      .from("properties")
      .upsert({
        owner_id: ownerParticulier.profileId,
        type: "appartement",
        adresse_complete: "15 rue de la Paix, 75001 Paris",
        ville: "Paris",
        code_postal: "75001",
        surface: 65,
        nb_pieces: 3,
        etage: 3,
        ascenseur: true,
        meuble: true,
        dpe_classe_energie: "C",
        dpe_classe_climat: "B",
        loyer_reference: 1200,
        unique_code: "PROP-TEST-001",
      }, { onConflict: "unique_code" })
      .select("id")
      .single();

    if (prop1Error) {
      console.error("    ❌ Erreur création bien 1:", prop1Error.message);
    } else {
      console.log("    ✅ Bien 1 créé (Appartement Paris)");
    }

    // Bien 2: Maison du propriétaire particulier
    const { data: property2, error: prop2Error } = await supabase
      .from("properties")
      .upsert({
        owner_id: ownerParticulier.profileId,
        type: "maison",
        adresse_complete: "8 avenue Victor Hugo, 92100 Boulogne",
        ville: "Boulogne-Billancourt",
        code_postal: "92100",
        surface: 120,
        nb_pieces: 5,
        jardin: true,
        parking: true,
        dpe_classe_energie: "D",
        dpe_classe_climat: "C",
        loyer_reference: 2200,
        unique_code: "PROP-TEST-002",
      }, { onConflict: "unique_code" })
      .select("id")
      .single();

    if (prop2Error) {
      console.error("    ❌ Erreur création bien 2:", prop2Error.message);
    } else {
      console.log("    ✅ Bien 2 créé (Maison Boulogne)");
    }

    // Bien 3: Appartement de la société
    const { data: property3, error: prop3Error } = await supabase
      .from("properties")
      .upsert({
        owner_id: ownerSociete?.profileId || ownerParticulier.profileId,
        type: "appartement",
        adresse_complete: "25 boulevard Haussmann, 75009 Paris",
        ville: "Paris",
        code_postal: "75009",
        surface: 85,
        nb_pieces: 4,
        etage: 5,
        ascenseur: true,
        meuble: false,
        dpe_classe_energie: "B",
        dpe_classe_climat: "A",
        loyer_reference: 1800,
        unique_code: "PROP-TEST-003",
      }, { onConflict: "unique_code" })
      .select("id")
      .single();

    if (prop3Error) {
      console.error("    ❌ Erreur création bien 3:", prop3Error.message);
    } else {
      console.log("    ✅ Bien 3 créé (Appartement Haussmann)");
    }

    // ========== CRÉER DES BAUX ==========
    console.log("\n  📄 Création des baux...");

    if (property1?.id) {
      // Bail 1: Actif
      const { data: lease1, error: lease1Error } = await supabase
        .from("leases")
        .upsert({
          property_id: property1.id,
          type_bail: "meuble",
          loyer: 1200,
          charges_forfaitaires: 150,
          depot_de_garantie: 1200,
          date_debut: "2024-01-01",
          statut: "active",
        }, { onConflict: "property_id,date_debut" })
        .select("id")
        .single();

      if (lease1Error) {
        console.error("    ❌ Erreur création bail 1:", lease1Error.message);
      } else {
        console.log("    ✅ Bail 1 créé (Actif - Meublé)");

        // Ajouter les signataires
        if (lease1?.id) {
          // Propriétaire signataire
          await supabase.from("lease_signers").upsert({
            lease_id: lease1.id,
            profile_id: ownerParticulier.profileId,
            role: "proprietaire",
            signature_status: "signed",
            signed_at: new Date().toISOString(),
          }, { onConflict: "lease_id,profile_id,role" });

          // Locataire signataire
          await supabase.from("lease_signers").upsert({
            lease_id: lease1.id,
            profile_id: locataire.profileId,
            role: "locataire_principal",
            signature_status: "signed",
            signed_at: new Date().toISOString(),
          }, { onConflict: "lease_id,profile_id,role" });

          console.log("    ✅ Signataires ajoutés au bail 1");
        }
      }
    }

    if (property2?.id && locataire2) {
      // Bail 2: En attente de signature propriétaire
      const { data: lease2, error: lease2Error } = await supabase
        .from("leases")
        .upsert({
          property_id: property2.id,
          type_bail: "nu",
          loyer: 2200,
          charges_forfaitaires: 200,
          depot_de_garantie: 2200,
          date_debut: "2025-01-01",
          statut: "pending_signature",
        }, { onConflict: "property_id,date_debut" })
        .select("id")
        .single();

      if (lease2Error) {
        console.error("    ❌ Erreur création bail 2:", lease2Error.message);
      } else {
        console.log("    ✅ Bail 2 créé (En attente de signature)");

        if (lease2?.id) {
          // Propriétaire: EN ATTENTE de signature
          await supabase.from("lease_signers").upsert({
            lease_id: lease2.id,
            profile_id: ownerParticulier.profileId,
            role: "proprietaire",
            signature_status: "pending",
          }, { onConflict: "lease_id,profile_id,role" });

          // Locataire: a déjà signé
          await supabase.from("lease_signers").upsert({
            lease_id: lease2.id,
            profile_id: locataire2.profileId,
            role: "locataire_principal",
            signature_status: "signed",
            signed_at: new Date().toISOString(),
          }, { onConflict: "lease_id,profile_id,role" });

          console.log("    ✅ Signataires ajoutés au bail 2 (propriétaire doit signer)");
        }
      }
    }

    console.log("\n  ✅ Données de test créées avec succès !");

  } catch (error: unknown) {
    console.error("  ❌ Erreur création données:", error.message);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 CRÉATION DES COMPTES DE TEST COMPLETS");
  console.log("=".repeat(70));
  console.log(`\n🔑 Mot de passe unique : ${PASSWORD}\n`);

  const createdAccounts: CreatedAccounts = {};
  let created = 0;
  let failed = 0;

  for (const account of testAccounts) {
    const roleEmoji: Record<string, string> = {
      admin: "👑",
      owner: "🏠",
      tenant: "👤",
      provider: "🔧",
      agency: "🏢",
      guarantor: "🛡️",
      syndic: "🏛️",
      coproprietaire: "🏘️",
    };

    console.log(`\n${roleEmoji[account.role] || "📌"} ${account.prenom} ${account.nom}`);
    console.log(`   Email: ${account.email}`);
    console.log(`   Rôle: ${account.role}`);
    console.log(`   ${account.description}`);

    const success = await createAccount(account);

    if (success) {
      created++;
      // Récupérer les IDs pour les données de test
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("email", account.email)
        .single();

      if (profile) {
        createdAccounts[account.email] = {
          userId: profile.user_id,
          profileId: profile.id,
        };
      }
    } else {
      failed++;
    }
  }

  // Créer les données de test associées
  await createTestData(createdAccounts);

  // =========================================================================
  // RÉSUMÉ
  // =========================================================================
  console.log("\n" + "=".repeat(70));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(70));
  console.log(`\n✅ Comptes créés : ${created}`);
  console.log(`❌ Échecs : ${failed}`);

  console.log("\n" + "─".repeat(70));
  console.log("📋 LISTE DES COMPTES DE TEST");
  console.log("─".repeat(70));
  console.log("\n🔑 Mot de passe pour TOUS les comptes : Test12345!2025\n");

  console.log("┌────────────────────────────────────────┬───────────────┬─────────────────────────┐");
  console.log("│ Email                                  │ Rôle          │ Description             │");
  console.log("├────────────────────────────────────────┼───────────────┼─────────────────────────┤");

  for (const account of testAccounts) {
    const email = account.email.padEnd(38);
    const role = account.role.padEnd(13);
    const desc = account.description.slice(0, 23).padEnd(23);
    console.log(`│ ${email} │ ${role} │ ${desc} │`);
  }

  console.log("└────────────────────────────────────────┴───────────────┴─────────────────────────┘");

  console.log("\n✨ Tous les comptes sont prêts ! Connectez-vous avec n'importe quel email ci-dessus.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
















































