#!/usr/bin/env npx ts-node
/**
 * Script de diagnostic pour l'Assistant IA
 * Vérifie la configuration et les tables nécessaires
 */

import { createClient } from "@supabase/supabase-js";

async function checkConfig() {
  console.log("🔍 Vérification de la configuration de l'Assistant IA...\n");
  
  let hasErrors = false;
  
  // 1. Vérifier OPENAI_API_KEY
  console.log("1️⃣ Vérification OPENAI_API_KEY...");
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log("   ❌ OPENAI_API_KEY non définie");
    console.log("   💡 Ajoutez dans .env.local: OPENAI_API_KEY=sk-votre-cle-openai");
    hasErrors = true;
  } else if (!openaiKey.startsWith("sk-")) {
    console.log("   ❌ OPENAI_API_KEY invalide (doit commencer par 'sk-')");
    hasErrors = true;
  } else {
    console.log("   ✅ OPENAI_API_KEY configurée");
  }
  
  // 2. Vérifier Supabase
  console.log("\n2️⃣ Vérification Supabase...");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    console.log("   ❌ NEXT_PUBLIC_SUPABASE_URL non définie");
    hasErrors = true;
  } else {
    console.log("   ✅ NEXT_PUBLIC_SUPABASE_URL configurée");
  }
  
  if (!supabaseKey) {
    console.log("   ❌ Clé Supabase non définie");
    hasErrors = true;
  } else {
    console.log("   ✅ Clé Supabase configurée");
  }
  
  // 3. Vérifier les tables
  if (supabaseUrl && supabaseKey) {
    console.log("\n3️⃣ Vérification des tables de l'assistant...");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Vérifier assistant_threads
    const { error: threadsError } = await supabase
      .from("assistant_threads")
      .select("id")
      .limit(1);
    
    if (threadsError) {
      if (threadsError.message.includes("does not exist")) {
        console.log("   ❌ Table 'assistant_threads' n'existe pas");
        console.log("   💡 Appliquez la migration: 20251206800000_assistant_ai_tables.sql");
        hasErrors = true;
      } else {
        console.log("   ⚠️ Erreur table 'assistant_threads':", threadsError.message);
      }
    } else {
      console.log("   ✅ Table 'assistant_threads' existe");
    }
    
    // Vérifier assistant_messages
    const { error: messagesError } = await supabase
      .from("assistant_messages")
      .select("id")
      .limit(1);
    
    if (messagesError) {
      if (messagesError.message.includes("does not exist")) {
        console.log("   ❌ Table 'assistant_messages' n'existe pas");
        hasErrors = true;
      } else {
        console.log("   ⚠️ Erreur table 'assistant_messages':", messagesError.message);
      }
    } else {
      console.log("   ✅ Table 'assistant_messages' existe");
    }
  }
  
  // Résumé
  console.log("\n" + "=".repeat(50));
  if (hasErrors) {
    console.log("❌ Configuration incomplète. Corrigez les erreurs ci-dessus.");
    console.log("\n📝 Actions requises:");
    console.log("1. Configurez OPENAI_API_KEY dans .env.local");
    console.log("2. Appliquez la migration SQL dans Supabase");
    console.log("\n📄 Migration à appliquer:");
    console.log("   supabase/migrations/20251206800000_assistant_ai_tables.sql");
  } else {
    console.log("✅ Configuration complète ! L'assistant devrait fonctionner.");
  }
}

checkConfig().catch(console.error);

