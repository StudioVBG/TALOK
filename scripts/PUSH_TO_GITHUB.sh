#!/bin/bash

# Script pour pousser le code vers GitHub
# Gère automatiquement l'authentification

set -e

REPO_URL="https://github.com/StudioVBG/Gestion-Immo.git"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 PUSH VERS GITHUB                                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que le remote est configuré
if ! git remote get-url origin &> /dev/null; then
    echo "📦 Configuration du remote GitHub..."
    git remote add origin "$REPO_URL"
fi

# S'assurer que la branche s'appelle main
git branch -M main

echo "🚀 Tentative de push vers GitHub..."
echo ""

# Essayer de pousser
if git push -u origin main 2>&1; then
    echo ""
    echo "✅ Code poussé vers GitHub avec succès!"
    echo ""
    echo "🔗 Dépôt: https://github.com/StudioVBG/Gestion-Immo"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 PROCHAINE ÉTAPE: Déployez sur Vercel"
    echo ""
    echo "1. Allez sur: https://vercel.com/new"
    echo "2. Connectez-vous avec GitHub"
    echo "3. Sélectionnez le dépôt: Gestion-Immo"
    echo "4. Ajoutez les variables d'environnement:"
    echo "   • NEXT_PUBLIC_SUPABASE_URL"
    echo "   • NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   • SUPABASE_SERVICE_ROLE_KEY"
    echo "   • NEXT_PUBLIC_APP_URL (après le 1er déploiement)"
    echo "5. Cliquez sur 'Deploy'"
    echo ""
else
    echo ""
    echo "⚠️  Le push nécessite une authentification"
    echo ""
    echo "📋 OPTIONS D'AUTHENTIFICATION:"
    echo ""
    echo "OPTION 1: GitHub CLI (recommandé)"
    echo "   gh auth login --web"
    echo "   Puis relancez: ./PUSH_TO_GITHUB.sh"
    echo ""
    echo "OPTION 2: Token d'accès personnel"
    echo "   1. Créez un token: https://github.com/settings/tokens"
    echo "   2. Scope: repo"
    echo "   3. Exécutez: git push -u origin main"
    echo "   4. Username: StudioVBG"
    echo "   5. Password: collez votre token"
    echo ""
    echo "OPTION 3: SSH"
    echo "   git remote set-url origin git@github.com:StudioVBG/Gestion-Immo.git"
    echo "   git push -u origin main"
    echo ""
    exit 1
fi

