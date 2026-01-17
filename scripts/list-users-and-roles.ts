#!/usr/bin/env tsx
/**
 * Script pour lister tous les utilisateurs et leurs rôles
 * Usage: tsx scripts/list-users-and-roles.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listUsersAndRoles() {
  console.log("\n🔍 Liste de tous les utilisateurs et leurs rôles\n");

  try {
    // 1. Récupérer tous les utilisateurs
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error("❌ Erreur:", usersError);
      return;
    }

    console.log(`📊 Total d'utilisateurs: ${users.users.length}\n`);

    // 2. Pour chaque utilisateur, récupérer le profil
    for (const user of users.users) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const role = profile?.role || "❌ Pas de profil";
      const roleBadge = role === "admin" ? "🔴 ADMIN" : role === "owner" ? "🟢 OWNER" : role === "tenant" ? "🔵 TENANT" : role === "provider" ? "🟡 PROVIDER" : "⚪ " + role;

      console.log(`${roleBadge} ${user.email}`);
      console.log(`   ID: ${user.id}`);
      if (profile) {
        console.log(`   Nom: ${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Non renseigné");
        console.log(`   Profil ID: ${profile.id}`);
      }
      console.log(`   Email confirmé: ${user.email_confirmed_at ? "✅ Oui" : "❌ Non"}`);
      console.log(`   Dernière connexion: ${user.last_sign_in_at || "Jamais"}`);
      console.log("");
    }

    // 3. Résumé par rôle
    const { data: profiles } = await supabase
      .from("profiles")
      .select("role");

    const roleCounts = (profiles || []).reduce((acc: Record<string, number>, p: any) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {});

    console.log("📊 Résumé par rôle:");
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role}: ${count}`);
    });

    console.log("\n✅ Liste terminée\n");
  } catch (error: unknown) {
    console.error("❌ Erreur:", error);
  }
}

listUsersAndRoles();





