#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_KEYS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "API_KEY_MASTER_KEY"
)

echo "🔍 Vérification des variables d'environnement (shell courant)"
echo "Projet : ${PROJECT_ROOT}"
echo ""

missing=0

mask() {
  local value="$1"
  local length=${#value}
  if [ "$length" -le 8 ]; then
    printf "%s" "$value"
    return
  fi
  local prefix=${value:0:4}
  local suffix=${value: -4}
  printf "%s...%s" "$prefix" "$suffix"
}

for key in "${REQUIRED_KEYS[@]}"; do
  value="${!key-}"
  if [ -z "$value" ]; then
    echo "❌ ${key} est manquant dans l'environnement shell"
    missing=1
  else
    echo "✅ ${key} = $(mask "$value")"
  fi
done

echo ""
if command -v vercel >/dev/null 2>&1; then
  echo "ℹ️  Rappel : synchronisez vos variables sur Vercel si nécessaire"
  echo "    vercel env ls | grep -E '(SUPABASE|API_KEY_MASTER_KEY)'"
else
  echo "⚠️  Vercel CLI non installé. Impossible de vérifier l'environnement distant."
fi

echo ""
if [ "$missing" -ne 0 ]; then
  echo "❌ Des variables manquent. Exportez-les ou ajoutez-les à votre shell (ex: direnv, zshrc)."
else
  echo "✅ Toutes les variables obligatoires sont présentes."
fi

exit "$missing"

