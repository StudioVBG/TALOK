#!/usr/bin/env npx tsx
/**
 * Script pour créer les données de test (biens, baux, etc.)
 * À exécuter APRÈS create-complete-test-accounts.ts
 * 
 * Exécution : npx tsx scripts/create-test-data.ts
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

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

async function getProfileByEmail(email: string): Promise<{ id: string; user_id: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("email", email)
    .single();

  if (error || !data) {
    console.error(`  ⚠️  Profil non trouvé pour ${email}`);
    return null;
  }
  return data;
}

function generateUniqueCode(): string {
  return "TEST-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("📦 CRÉATION DES DONNÉES DE TEST");
  console.log("=".repeat(70) + "\n");

  // Récupérer les profils des comptes de test
  const ownerParticulier = await getProfileByEmail("proprio.particulier@test.lokatif.fr");
  const ownerSociete = await getProfileByEmail("proprio.societe@test.lokatif.fr");
  const locataire = await getProfileByEmail("locataire@test.lokatif.fr");
  const locataire2 = await getProfileByEmail("locataire2@test.lokatif.fr");
  const colocataire = await getProfileByEmail("colocataire@test.lokatif.fr");
  const plombier = await getProfileByEmail("plombier@test.lokatif.fr");

  if (!ownerParticulier) {
    console.error("❌ Propriétaire particulier non trouvé. Exécutez d'abord create-complete-test-accounts.ts");
    process.exit(1);
  }

  // ==========================================================================
  // 1. CRÉER LES BIENS IMMOBILIERS
  // ==========================================================================
  console.log("🏠 Création des biens immobiliers...\n");

  // Bien 1: Appartement Paris (propriétaire particulier)
  const { data: property1, error: p1Error } = await supabase
    .from("properties")
    .upsert({
      owner_id: ownerParticulier.id,
      type: "appartement",
      adresse_complete: "15 rue de la Paix, 75001 Paris",
      ville: "Paris",
      code_postal: "75001",
      departement: "75",
      surface: 65,
      nb_pieces: 3,
      etage: 3,
      ascenseur: true,
      energie: "C",
      ges: "B",
      unique_code: generateUniqueCode(),
    }, { onConflict: "id", ignoreDuplicates: false })
    .select("id")
    .single();

  if (p1Error) {
    console.error("  ❌ Bien 1:", p1Error.message);
  } else {
    console.log("  ✅ Bien 1 créé: Appartement 3 pièces - 15 rue de la Paix, Paris");
  }

  // Bien 2: Maison Boulogne (propriétaire particulier)
  const { data: property2, error: p2Error } = await supabase
    .from("properties")
    .upsert({
      owner_id: ownerParticulier.id,
      type: "maison",
      adresse_complete: "8 avenue Victor Hugo, 92100 Boulogne-Billancourt",
      ville: "Boulogne-Billancourt",
      code_postal: "92100",
      departement: "92",
      surface: 120,
      nb_pieces: 5,
      energie: "D",
      ges: "C",
      unique_code: generateUniqueCode(),
    }, { onConflict: "id", ignoreDuplicates: false })
    .select("id")
    .single();

  if (p2Error) {
    console.error("  ❌ Bien 2:", p2Error.message);
  } else {
    console.log("  ✅ Bien 2 créé: Maison 5 pièces - 8 avenue Victor Hugo, Boulogne");
  }

  // Bien 3: Appartement Haussmann (propriétaire société)
  let property3Data = null;
  if (ownerSociete) {
    const { data: property3, error: p3Error } = await supabase
      .from("properties")
      .upsert({
        owner_id: ownerSociete.id,
        type: "appartement",
        adresse_complete: "25 boulevard Haussmann, 75009 Paris",
        ville: "Paris",
        code_postal: "75009",
        departement: "75",
        surface: 85,
        nb_pieces: 4,
        etage: 5,
        ascenseur: true,
        energie: "B",
        ges: "A",
        unique_code: generateUniqueCode(),
      }, { onConflict: "id", ignoreDuplicates: false })
      .select("id")
      .single();

    if (p3Error) {
      console.error("  ❌ Bien 3:", p3Error.message);
    } else {
      console.log("  ✅ Bien 3 créé: Appartement 4 pièces - 25 boulevard Haussmann, Paris");
      property3Data = property3;
    }
  }

  // Bien 4: Colocation (propriétaire société)
  let property4Data = null;
  if (ownerSociete) {
    const { data: property4, error: p4Error } = await supabase
      .from("properties")
      .upsert({
        owner_id: ownerSociete.id,
        type: "colocation",
        adresse_complete: "12 rue de Rivoli, 75004 Paris",
        ville: "Paris",
        code_postal: "75004",
        departement: "75",
        surface: 150,
        nb_pieces: 6,
        etage: 2,
        ascenseur: true,
        energie: "C",
        ges: "B",
        unique_code: generateUniqueCode(),
      }, { onConflict: "id", ignoreDuplicates: false })
      .select("id")
      .single();

    if (p4Error) {
      console.error("  ❌ Bien 4:", p4Error.message);
    } else {
      console.log("  ✅ Bien 4 créé: Colocation 6 pièces - 12 rue de Rivoli, Paris");
      property4Data = property4;
    }
  }

  // ==========================================================================
  // 2. CRÉER LES BAUX
  // ==========================================================================
  console.log("\n📄 Création des baux...\n");

  // Bail 1: ACTIF (appartement Paris + locataire)
  if (property1?.id && locataire) {
    const { data: lease1, error: l1Error } = await supabase
      .from("leases")
      .insert({
        property_id: property1.id,
        type_bail: "meuble",
        loyer: 1200,
        charges_forfaitaires: 150,
        depot_de_garantie: 1200,
        date_debut: "2024-01-01",
        statut: "active",
      })
      .select("id")
      .single();

    if (l1Error) {
      console.error("  ❌ Bail 1:", l1Error.message);
    } else {
      console.log("  ✅ Bail 1 créé: Meublé ACTIF - 1350€/mois");

      // Ajouter les signataires
      if (lease1?.id) {
        // Propriétaire signataire (signé)
        await supabase.from("lease_signers").insert({
          lease_id: lease1.id,
          profile_id: ownerParticulier.id,
          role: "proprietaire",
          signature_status: "signed",
          signed_at: new Date("2023-12-15").toISOString(),
        });

        // Locataire signataire (signé)
        await supabase.from("lease_signers").insert({
          lease_id: lease1.id,
          profile_id: locataire.id,
          role: "locataire_principal",
          signature_status: "signed",
          signed_at: new Date("2023-12-20").toISOString(),
        });

        console.log("    → Signataires ajoutés (tous signés)");
      }
    }
  }

  // Bail 2: EN ATTENTE DE SIGNATURE PROPRIÉTAIRE
  if (property2?.id && locataire2) {
    const { data: lease2, error: l2Error } = await supabase
      .from("leases")
      .insert({
        property_id: property2.id,
        type_bail: "nu",
        loyer: 2200,
        charges_forfaitaires: 200,
        depot_de_garantie: 2200,
        date_debut: "2025-02-01",
        statut: "pending_signature",
      })
      .select("id")
      .single();

    if (l2Error) {
      console.error("  ❌ Bail 2:", l2Error.message);
    } else {
      console.log("  ✅ Bail 2 créé: Nu EN ATTENTE - 2400€/mois");

      if (lease2?.id) {
        // Propriétaire: EN ATTENTE de signature
        await supabase.from("lease_signers").insert({
          lease_id: lease2.id,
          profile_id: ownerParticulier.id,
          role: "proprietaire",
          signature_status: "pending",
        });

        // Locataire: a déjà signé
        await supabase.from("lease_signers").insert({
          lease_id: lease2.id,
          profile_id: locataire2.id,
          role: "locataire_principal",
          signature_status: "signed",
          signed_at: new Date().toISOString(),
        });

        console.log("    → 🔔 PROPRIÉTAIRE DOIT SIGNER (locataire a signé)");
      }
    }
  }

  // Bail 3: BROUILLON (appartement Haussmann)
  if (property3Data?.id && ownerSociete) {
    const { data: lease3, error: l3Error } = await supabase
      .from("leases")
      .insert({
        property_id: property3Data.id,
        type_bail: "nu",
        loyer: 1800,
        charges_forfaitaires: 180,
        depot_de_garantie: 1800,
        date_debut: "2025-03-01",
        statut: "draft",
      })
      .select("id")
      .single();

    if (l3Error) {
      console.error("  ❌ Bail 3:", l3Error.message);
    } else {
      console.log("  ✅ Bail 3 créé: Nu BROUILLON - 1980€/mois");

      if (lease3?.id) {
        await supabase.from("lease_signers").insert({
          lease_id: lease3.id,
          profile_id: ownerSociete.id,
          role: "proprietaire",
          signature_status: "pending",
        });
        console.log("    → En cours de préparation");
      }
    }
  }

  // Bail 4: COLOCATION (3 colocataires)
  if (property4Data?.id && ownerSociete && locataire && colocataire) {
    const { data: lease4, error: l4Error } = await supabase
      .from("leases")
      .insert({
        property_id: property4Data.id,
        type_bail: "colocation",
        loyer: 2400,
        charges_forfaitaires: 300,
        depot_de_garantie: 2400,
        date_debut: "2024-06-01",
        statut: "active",
      })
      .select("id")
      .single();

    if (l4Error) {
      console.error("  ❌ Bail 4:", l4Error.message);
    } else {
      console.log("  ✅ Bail 4 créé: Colocation ACTIVE - 2700€/mois");

      if (lease4?.id) {
        // Propriétaire signataire
        await supabase.from("lease_signers").insert({
          lease_id: lease4.id,
          profile_id: ownerSociete.id,
          role: "proprietaire",
          signature_status: "signed",
          signed_at: new Date("2024-05-15").toISOString(),
        });

        // Colocataire 1
        await supabase.from("lease_signers").insert({
          lease_id: lease4.id,
          profile_id: locataire.id,
          role: "colocataire",
          signature_status: "signed",
          signed_at: new Date("2024-05-20").toISOString(),
        });

        // Colocataire 2
        await supabase.from("lease_signers").insert({
          lease_id: lease4.id,
          profile_id: colocataire.id,
          role: "colocataire",
          signature_status: "signed",
          signed_at: new Date("2024-05-22").toISOString(),
        });

        console.log("    → 3 signataires (tous signés)");
      }
    }
  }

  // ==========================================================================
  // 3. CRÉER DES TICKETS DE MAINTENANCE
  // ==========================================================================
  console.log("\n🔧 Création des tickets de maintenance...\n");

  if (property1?.id && locataire) {
    // Ticket 1: Ouvert
    const { error: t1Error } = await supabase.from("tickets").insert({
      property_id: property1.id,
      created_by_profile_id: locataire.id,
      titre: "Fuite sous l'évier de la cuisine",
      description: "Il y a une petite fuite sous l'évier de la cuisine. L'eau s'accumule dans le meuble.",
      priorite: "normale",
      statut: "open",
    });

    if (!t1Error) {
      console.log("  ✅ Ticket 1 créé: Fuite évier (OUVERT)");
    }

    // Ticket 2: En cours avec intervention
    const { data: ticket2, error: t2Error } = await supabase
      .from("tickets")
      .insert({
        property_id: property1.id,
        created_by_profile_id: locataire.id,
        titre: "Prise électrique défectueuse dans le salon",
        description: "La prise électrique près de la fenêtre ne fonctionne plus depuis hier.",
        priorite: "haute",
        statut: "in_progress",
      })
      .select("id")
      .single();

    if (!t2Error && ticket2?.id && plombier) {
      console.log("  ✅ Ticket 2 créé: Prise électrique (EN COURS)");

      // Créer une intervention
      await supabase.from("work_orders").insert({
        ticket_id: ticket2.id,
        provider_id: plombier.id,
        date_intervention_prevue: "2025-01-15",
        cout_estime: 150,
        statut: "scheduled",
      });
      console.log("    → Intervention planifiée pour le 15/01/2025");
    }

    // Ticket 3: Résolu
    const { error: t3Error } = await supabase.from("tickets").insert({
      property_id: property1.id,
      created_by_profile_id: locataire.id,
      titre: "Volet roulant bloqué",
      description: "Le volet roulant de la chambre ne descend plus complètement.",
      priorite: "basse",
      statut: "resolved",
    });

    if (!t3Error) {
      console.log("  ✅ Ticket 3 créé: Volet roulant (RÉSOLU)");
    }
  }

  // ==========================================================================
  // 4. CRÉER DES FACTURES
  // ==========================================================================
  console.log("\n💰 Création des factures...\n");

  // Récupérer le bail actif pour créer des factures
  const { data: activeLease } = await supabase
    .from("leases")
    .select("id, property_id")
    .eq("statut", "active")
    .limit(1)
    .single();

  if (activeLease && locataire && ownerParticulier) {
    // Facture payée (mois dernier)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthPeriode = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    const { error: f1Error } = await supabase.from("invoices").insert({
      lease_id: activeLease.id,
      owner_id: ownerParticulier.id,
      tenant_id: locataire.id,
      periode: lastMonthPeriode,
      montant_total: 1350,
      montant_loyer: 1200,
      montant_charges: 150,
      statut: "paid",
    });

    if (!f1Error) {
      console.log(`  ✅ Facture ${lastMonthPeriode} créée (PAYÉE)`);
    }

    // Facture en attente (mois en cours)
    const currentMonth = new Date();
    const currentPeriode = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

    const { error: f2Error } = await supabase.from("invoices").insert({
      lease_id: activeLease.id,
      owner_id: ownerParticulier.id,
      tenant_id: locataire.id,
      periode: currentPeriode,
      montant_total: 1350,
      montant_loyer: 1200,
      montant_charges: 150,
      statut: "sent",
    });

    if (!f2Error) {
      console.log(`  ✅ Facture ${currentPeriode} créée (ENVOYÉE)`);
    }

    // Facture en retard (2 mois avant)
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const oldPeriode = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

    const { error: f3Error } = await supabase.from("invoices").insert({
      lease_id: activeLease.id,
      owner_id: ownerParticulier.id,
      tenant_id: locataire.id,
      periode: oldPeriode,
      montant_total: 1350,
      montant_loyer: 1200,
      montant_charges: 150,
      statut: "late",
    });

    if (!f3Error) {
      console.log(`  ✅ Facture ${oldPeriode} créée (EN RETARD)`);
    }
  }

  // ==========================================================================
  // RÉSUMÉ
  // ==========================================================================
  console.log("\n" + "=".repeat(70));
  console.log("✅ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS");
  console.log("=".repeat(70));
  console.log("\n📊 Récapitulatif :");
  console.log("  • 4 biens immobiliers");
  console.log("  • 4 baux (1 actif, 1 en attente signature, 1 brouillon, 1 colocation)");
  console.log("  • 3 tickets de maintenance");
  console.log("  • 3 factures (payée, envoyée, en retard)");
  console.log("\n🔔 Pour tester la signature :");
  console.log("  → Connectez-vous avec proprio.particulier@test.lokatif.fr");
  console.log("  → Allez dans Baux & locataires");
  console.log("  → Vous verrez un bail en attente de VOTRE signature\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });




















































