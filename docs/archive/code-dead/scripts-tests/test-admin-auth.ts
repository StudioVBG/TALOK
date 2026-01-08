#!/usr/bin/env tsx
/**
 * Script pour tester l'authentification admin via l'API
 * Usage: tsx scripts/test-admin-auth.ts <email> <password>
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

async function testAdminAuth(email: string, password: string) {
  console.log(`\n🔍 Test d'authentification pour: ${email}\n`);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // 1. Se connecter
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("❌ Erreur d'authentification:", authError.message);
      return;
    }

    if (!authData.session) {
      console.error("❌ Aucune session créée");
      return;
    }

    console.log("✅ Authentification réussie");
    console.log("   User ID:", authData.user.id);
    console.log("   Email:", authData.user.email);
    console.log("   Access Token:", authData.session.access_token.substring(0, 20) + "...");

    // 2. Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", authData.user.id)
      .single();

    if (profileError) {
      console.error("❌ Erreur lors de la récupération du profil:", profileError.message);
      return;
    }

    console.log("✅ Profil récupéré");
    console.log("   Profile ID:", profile.id);
    console.log("   Role:", profile.role);

    if (profile.role !== "admin") {
      console.warn(`⚠️  Le rôle n'est pas 'admin' (rôle actuel: ${profile.role})`);
      return;
    }

    // 3. Tester l'accès à l'API avec le token
    console.log("\n🔍 Test de l'accès à l'API /api/admin/providers/pending...\n");

    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${apiUrl}/api/admin/providers/pending?status=pending&page=1&limit=20`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authData.session.access_token}`,
      },
    });

    console.log("   Status:", response.status);
    console.log("   Status Text:", response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Erreur API:", errorData);
      return;
    }

    const data = await response.json();
    console.log("✅ API accessible");
    console.log("   Nombre de prestataires:", data.items?.length || 0);
    console.log("   Total:", data.total || 0);

    // 4. Tester avec les cookies (simulation)
    console.log("\n🔍 Test avec les cookies (simulation)...\n");

    // Extraire les cookies de la session Supabase
    const cookies = authData.session;
    console.log("   Cookies de session disponibles");
    console.log("   Access Token présent:", !!cookies.access_token);
    console.log("   Refresh Token présent:", !!cookies.refresh_token);

    console.log("\n✅ Tous les tests sont passés avec succès!\n");
  } catch (error: any) {
    console.error("❌ Erreur inattendue:", error.message);
  }
}

const emailArg = process.argv[2];
const passwordArg = process.argv[3];

if (!emailArg || !passwordArg) {
  console.error("Usage: tsx scripts/test-admin-auth.ts <email> <password>");
  console.error("Exemple: tsx scripts/test-admin-auth.ts support@talok.fr votre_mot_de_passe");
  process.exit(1);
}

testAdminAuth(emailArg, passwordArg);





