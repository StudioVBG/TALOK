#!/bin/bash

# Script de test de connexion Supabase
# Usage: ./scripts/test-connection.sh

echo "🔍 Test de connexion Supabase"
echo ""

# Vérifier les variables d'environnement
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL n'est pas définie"
  echo "   Chargez votre fichier .env.local ou définissez la variable"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY n'est pas définie"
  exit 1
fi

echo "✅ Variables d'environnement trouvées"
echo "   URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Vérifier que l'URL n'est pas celle du dashboard
if [[ "$NEXT_PUBLIC_SUPABASE_URL" == *"supabase.com/dashboard"* ]]; then
  echo "❌ ERREUR: L'URL pointe vers le dashboard au lieu de l'API"
  echo "   Utilisez: https://xxxxx.supabase.co"
  exit 1
fi

# Vérifier le format de l'URL
if [[ ! "$NEXT_PUBLIC_SUPABASE_URL" == *".supabase.co"* ]]; then
  echo "❌ Format d'URL invalide"
  echo "   Doit se terminer par .supabase.co"
  exit 1
fi

echo "✅ Configuration Supabase valide"
echo ""
echo "📋 Pour tester la connexion:"
echo "1. Ouvrez http://localhost:3000/auth/signin"
echo "2. Ouvrez la console (F12)"
echo "3. Tentez de vous connecter"
echo "4. Regardez les logs [SignIn] et [AuthService]"
echo ""
echo "💡 Si vous voyez une erreur 400:"
echo "   - Vérifiez votre email et mot de passe"
echo "   - Vérifiez que votre email est confirmé"
echo "   - Vérifiez que votre profil existe dans Supabase"
echo ""

