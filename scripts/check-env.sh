#!/bin/bash

echo "🔍 VÉRIFICATION DE L'ENVIRONNEMENT"
echo ""

# 1. Vérifier .env.local
echo "1️⃣ Variables d'environnement:"
if [ -f .env.local ]; then
  echo "  ✅ .env.local existe"
  grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && echo "  ✅ NEXT_PUBLIC_SUPABASE_URL défini" || echo "  ❌ NEXT_PUBLIC_SUPABASE_URL manquant"
  grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local && echo "  ✅ SUPABASE_SERVICE_ROLE_KEY défini" || echo "  ❌ SUPABASE_SERVICE_ROLE_KEY manquant"
  
  # Extraire l'URL pour vérifier le projet
  SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  if [ ! -z "$SUPABASE_URL" ]; then
    echo "  📋 URL Supabase: $SUPABASE_URL"
  fi
else
  echo "  ❌ .env.local n'existe pas"
fi

# 2. Vérifier project_ref
echo ""
echo "2️⃣ Project Ref:"
if [ -f supabase/config.toml ]; then
  PROJECT_REF=$(grep -E "^project_id\s*=" supabase/config.toml | head -1 | sed 's/.*"\(.*\)".*/\1/' | tr -d ' ')
  if [ ! -z "$PROJECT_REF" ]; then
    echo "  📋 Project Ref trouvé: $PROJECT_REF"
    echo "  📋 Attendu: poeijjosocmqlhgsacud"
    if [ "$PROJECT_REF" = "poeijjosocmqlhgsacud" ]; then
      echo "  ✅ Project Ref correspond"
    else
      echo "  ⚠️ Project Ref différent"
    fi
  else
    echo "  ⚠️ Project Ref non trouvé dans config.toml"
  fi
else
  echo "  ⚠️ supabase/config.toml non trouvé"
fi

# 3. Vérifier migrations
echo ""
echo "3️⃣ Migrations:"
if [ -f "supabase/migrations/202502180003_ensure_user_profile_id_works.sql" ]; then
  echo "  ✅ Migration 202502180003 trouvée"
else
  echo "  ❌ Migration 202502180003 manquante"
fi

if [ -f "supabase/migrations/202502180002_fix_rls_conflicts_final.sql" ]; then
  echo "  ✅ Migration 202502180002 trouvée"
else
  echo "  ⚠️ Migration 202502180002 manquante"
fi

# 4. Vérifier Supabase CLI
echo ""
echo "4️⃣ Supabase CLI:"
if command -v supabase &> /dev/null; then
  echo "  ✅ Supabase CLI installé: $(supabase --version)"
else
  echo "  ❌ Supabase CLI non installé"
fi

echo ""
echo "✅ Vérification terminée"
echo ""
echo "📋 PROCHAINES ÉTAPES:"
echo "  1. Si migrations manquantes: vérifier le dossier supabase/migrations/"
echo "  2. Si project_ref différent: exécuter 'supabase link --project-ref poeijjosocmqlhgsacud'"
echo "  3. Appliquer les migrations: 'supabase db push'"
echo "  4. Vérifier le diagnostic: http://localhost:3000/api/debug/properties"
