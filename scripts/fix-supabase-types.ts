#!/usr/bin/env tsx
/**
 * Script pour corriger automatiquement les problèmes de typage Supabase
 * Remplace les occurrences de `supabase.from()` par `supabaseClient.from()`
 * après avoir ajouté `const supabaseClient = getTypedSupabaseClient(supabase);`
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

const files = glob.sync("app/api/**/*.ts");

for (const file of files) {
  let content = readFileSync(file, "utf-8");
  let modified = false;

  // Vérifier si le fichier utilise supabase.from() ou supabase.auth
  if (!content.includes("supabase.from") && !content.includes("supabase.auth") && !content.includes("supabase.storage")) {
    continue;
  }

  // Vérifier si getTypedSupabaseClient est déjà importé
  const hasImport = content.includes("getTypedSupabaseClient");
  const hasHelperImport = content.includes("@/lib/helpers/supabase-client");

  // Ajouter l'import si nécessaire
  if (!hasHelperImport && (content.includes("supabase.from") || content.includes("supabase.auth") || content.includes("supabase.storage"))) {
    // Trouver la dernière ligne d'import
    const importLines = content.split("\n").filter((line) => line.trim().startsWith("import"));
    const lastImportIndex = content.split("\n").findLastIndex((line) => line.trim().startsWith("import"));

    if (lastImportIndex >= 0) {
      const lines = content.split("\n");
      lines.splice(lastImportIndex + 1, 0, 'import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";');
      content = lines.join("\n");
      modified = true;
    }
  }

  // Remplacer les patterns courants
  const patterns = [
    // Pattern 1: const supabase = await createClient(); puis utilisation directe
    {
      find: /(const supabase = await createClient\(\);)\s*(const \{[\s\S]*?data: \{ user \},[\s\S]*?\} = await supabase\.auth\.getUser\(\);)/,
      replace: (match: string, p1: string, p2: string) => {
        return `${p1}\n    const supabaseClient = getTypedSupabaseClient(supabase);\n    ${p2.replace(/supabase\.auth/g, "supabaseClient.auth")}`;
      },
    },
    // Pattern 2: const { user, error, supabase } = await getAuthenticatedUser(); puis utilisation directe
    {
      find: /(const \{ user, error.*supabase \} = await getAuthenticatedUser\([^)]+\);)\s*(if \(error[\s\S]{0,200}?)(const \{ data: profile \} = await supabase\.from\("profiles"\))/,
      replace: (match: string, p1: string, p2: string, p3: string) => {
        return `${p1}\n    const supabaseClient = getTypedSupabaseClient(supabase);\n    ${p2}${p3.replace(/supabase\.from/g, "supabaseClient.from")}`;
      },
    },
  ];

  for (const pattern of patterns) {
    if (pattern.find.test(content)) {
      content = content.replace(pattern.find, pattern.replace as any);
      modified = true;
    }
  }

  // Remplacer toutes les occurrences de supabase.from par supabaseClient.from
  // mais seulement si supabaseClient est défini
  if (content.includes("const supabaseClient") || content.includes("getTypedSupabaseClient")) {
    const newContent = content.replace(/await supabase\.from\(/g, "await supabaseClient.from(");
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }

    const newContent2 = content.replace(/await supabase\.storage\./g, "await supabaseClient.storage.");
    if (newContent2 !== content) {
      content = newContent2;
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(file, content, "utf-8");
    console.log(`✓ Fixed: ${file}`);
  }
}

console.log("Done!");

