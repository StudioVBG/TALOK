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

load_from_env_file() {
  local key="$1"

  if [ ! -f "$ENV_FILE" ]; then
    return
  fi

  awk -F= -v target="$key" '
    $0 ~ "^[[:space:]]*" target "=" {
      sub(/^[^=]*=/, "", $0)
      print $0
      exit
    }
  ' "$ENV_FILE"
}

echo "🔍 Vérification des variables d'environnement (shell + .env.local si présent)"
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
    value="$(load_from_env_file "$key")"
  fi
  if [ -z "$value" ]; then
    echo "❌ ${key} est manquant dans l'environnement shell et .env.local"
    missing=1
  elif [[ "$value" == your_* || "$value" == *xxxxx* || "$value" == "votre-cle-de-32-caracteres-minimum" || "$value" == "your_anon_key_here" || "$value" == "your_service_role_key_here" ]]; then
    echo "⚠️  ${key} est encore un placeholder: $(mask "$value")"
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
  echo "❌ Des variables manquent ou sont encore des placeholders. Mettez à jour .env.local ou votre shell."
else
  echo "✅ Toutes les variables obligatoires sont présentes."
fi

exit "$missing"

