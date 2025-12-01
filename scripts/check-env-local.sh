#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.local"
REQUIRED_KEYS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "API_KEY_MASTER_KEY"
)

echo "🔍 Vérification des variables dans .env.local"
echo "Fichier : ${ENV_FILE}"
echo ""

if [ ! -f "${ENV_FILE}" ]; then
  echo "❌ .env.local introuvable. Créez-le avec 'cp env.example .env.local'."
  exit 1
fi

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

missing=0

for key in "${REQUIRED_KEYS[@]}"; do
  value=$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" | tail -n 1 | cut -d '=' -f2-)
  value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")

  if [ -z "$value" ]; then
    echo "❌ ${key} manquant dans .env.local"
    missing=1
  else
    echo "✅ ${key} = $(mask "$value")"
  fi
done

echo ""
if [ "$missing" -ne 0 ]; then
  echo "❌ Complétez les variables manquantes dans .env.local puis relancez le script."
else
  echo "✅ Toutes les variables critiques sont définies dans .env.local."
fi

exit "$missing"

