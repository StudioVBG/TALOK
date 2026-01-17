/**
 * Script pour créer un compte locataire
 * Usage: tsx scripts/create-tenant.ts <email> <password>
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  console.error("   Assurez-vous que NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définies dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTenant(email: string, password: string) {
  console.log(`\n👤 Création du compte locataire: ${email}\n`);

  try {
    // 1. Vérifier si l'utilisateur existe déjà
    console.log("1️⃣ Vérification de l'existence du compte...");
    const { data: users } = await supabase.auth.admin.listUsers();
    const existingUser = users?.users.find((u) => u.email === email);

    if (existingUser) {
      console.log("⚠️  Un compte existe déjà avec cet email");
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Email confirmé: ${existingUser.email_confirmed_at ? "Oui" : "Non"}`);

      // Vérifier si le profil existe
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", existingUser.id)
        .single();

      if (profile) {
        console.log(`   Rôle actuel: ${profile.role}`);
        if (profile.role !== "tenant") {
          console.log("\n2️⃣ Mise à jour du rôle vers 'tenant'...");
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ role: "tenant" })
            .eq("user_id", existingUser.id);

          if (updateError) {
            console.error("❌ Erreur lors de la mise à jour du rôle:", updateError);
            return;
          }
          console.log("✅ Rôle mis à jour vers 'tenant'");
        } else {
          console.log("✅ Le compte est déjà un locataire");
        }
      } else {
        console.log("\n2️⃣ Création du profil tenant...");
        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: existingUser.id,
          role: "tenant",
          prenom: "",
          nom: "",
        });

        if (profileError) {
          console.error("❌ Erreur lors de la création du profil:", profileError);
          return;
        }
        console.log("✅ Profil tenant créé");
      }

      // Mettre à jour le mot de passe si nécessaire
      console.log("\n3️⃣ Mise à jour du mot de passe...");
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );

      if (passwordError) {
        console.error("❌ Erreur lors de la mise à jour du mot de passe:", passwordError);
        return;
      }
      console.log("✅ Mot de passe mis à jour");

      // Confirmer l'email si ce n'est pas déjà fait
      if (!existingUser.email_confirmed_at) {
        console.log("\n4️⃣ Confirmation de l'email...");
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          { email_confirm: true }
        );

        if (confirmError) {
          console.error("❌ Erreur lors de la confirmation de l'email:", confirmError);
          return;
        }
        console.log("✅ Email confirmé");
      } else {
        console.log("\n4️⃣ Email déjà confirmé");
      }

      console.log("\n✅ Compte locataire prêt !");
      console.log(`\n📋 Informations de connexion:`);
      console.log(`   Email: ${email}`);
      console.log(`   Mot de passe: ${password}`);
      console.log(`   Rôle: tenant`);
      return;
    }

    // 2. Créer l'utilisateur
    console.log("2️⃣ Création de l'utilisateur...");
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmer l'email automatiquement
    });

    if (createError) {
      console.error("❌ Erreur lors de la création de l'utilisateur:", createError);
      return;
    }

    if (!newUser.user) {
      console.error("❌ Échec de la création de l'utilisateur");
      return;
    }

    console.log("✅ Utilisateur créé");
    console.log(`   ID: ${newUser.user.id}`);

    // 3. Créer le profil tenant
    console.log("\n3️⃣ Création du profil tenant...");
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: newUser.user.id,
      role: "tenant",
      prenom: "",
      nom: "",
    });

    if (profileError) {
      console.error("❌ Erreur lors de la création du profil:", profileError);
      // Nettoyer l'utilisateur créé
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return;
    }

    console.log("✅ Profil tenant créé");

    console.log("\n✅ Compte locataire créé avec succès !");
    console.log(`\n📋 Informations de connexion:`);
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe: ${password}`);
    console.log(`   Rôle: tenant`);
    console.log(`\n💡 Vous pouvez maintenant vous connecter avec ces identifiants.`);
  } catch (error: unknown) {
    console.error("❌ Erreur inattendue:", error);
  }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("❌ Usage: tsx scripts/create-tenant.ts <email> <password>");
  console.error("\nExemple:");
  console.error('  tsx scripts/create-tenant.ts garybissol@yahoo.fr "Test12345!2025"');
  process.exit(1);
}

createTenant(email, password).then(() => {
  process.exit(0);
});

