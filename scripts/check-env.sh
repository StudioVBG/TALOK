#!/bin/bash

# Script de vérification des variables d'environnement
# Usage: npm run check-env

set -e

echo "🔍 Vérification des variables d'environnement..."
echo ""

# Charger les variables depuis .env.local si elles existent
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Variables obligatoires
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

# Variables optionnelles
OPTIONAL_VARS=(
  "NEXT_PUBLIC_APP_URL"
)

has_errors=false

echo "📋 Variables OBLIGATOIRES:"
echo ""

for var in "${REQUIRED_VARS[@]}"; do
  value="${!var}"
  
  if [ -z "$value" ]; then
    echo "  ❌ $var: Variable manquante"
    has_errors=true
  else
    # Masquer la valeur pour la sécurité
    if [ ${#value} -gt 20 ]; then
      masked="${value:0:10}...${value: -10}"
    else
      masked="$value"
    fi
    
    # Vérification spéciale pour NEXT_PUBLIC_SUPABASE_URL
    if [ "$var" = "NEXT_PUBLIC_SUPABASE_URL" ]; then
      if [[ "$value" == *"supabase.com/dashboard"* ]]; then
        echo "  ❌ $var: ERREUR - L'URL pointe vers le dashboard Supabase"
        echo "     Utilisez: https://xxxxx.supabase.co"
        has_errors=true
      elif [[ "$value" != *".supabase.co"* ]]; then
        echo "  ❌ $var: Format invalide (doit se terminer par .supabase.co)"
        has_errors=true
      else
        echo "  ✅ $var: $masked"
      fi
    else
      echo "  ✅ $var: $masked"
    fi
  fi
done

echo ""
echo "📋 Variables OPTIONNELLES:"
echo ""

for var in "${OPTIONAL_VARS[@]}"; do
  value="${!var}"
  
  if [ -z "$value" ]; then
    echo "  ⚪ $var: Non définie (optionnel)"
  else
    echo "  ✅ $var: Définie"
  fi
done

echo ""
echo "============================================================"

if [ "$has_errors" = true ]; then
  echo "❌ ERREURS DÉTECTÉES"
  echo ""
  echo "Corrigez les erreurs ci-dessus avant de déployer."
  exit 1
else
  echo "✅ Toutes les variables sont correctement configurées !"
  echo ""
  exit 0
fi
