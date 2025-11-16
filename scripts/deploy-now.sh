#!/bin/bash

# Script interactif pour déployer sur GitHub et Vercel
# Ce script guide l'utilisateur étape par étape

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 DÉPLOIEMENT SUR GITHUB ET VERCEL                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que Git est initialisé
if [ ! -d ".git" ]; then
    echo "❌ Erreur: Git n'est pas initialisé"
    exit 1
fi

# Demander le nom d'utilisateur GitHub
echo "📝 Informations nécessaires:"
echo ""
read -p "Votre nom d'utilisateur GitHub: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ Le nom d'utilisateur GitHub est requis"
    exit 1
fi

REPO_NAME="gestion-locative"
GITHUB_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "📋 Configuration:"
echo "   • Dépôt GitHub: ${GITHUB_URL}"
echo "   • Nom du dépôt: ${REPO_NAME}"
echo ""

# Vérifier si un remote existe déjà
if git remote get-url origin > /dev/null 2>&1; then
    CURRENT_REMOTE=$(git remote get-url origin)
    echo "⚠️  Un remote 'origin' existe déjà: ${CURRENT_REMOTE}"
    read -p "Voulez-vous le remplacer? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote remove origin
        echo "✅ Remote supprimé"
    else
        echo "❌ Opération annulée"
        exit 1
    fi
fi

# Ajouter le remote GitHub
echo ""
echo "📦 Configuration du remote GitHub..."
git remote add origin "$GITHUB_URL"
echo "✅ Remote ajouté: ${GITHUB_URL}"

# Vérifier la branche
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔄 Renommage de la branche '${CURRENT_BRANCH}' en 'main'..."
    git branch -M main
fi

echo ""
echo "✅ Configuration Git terminée!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROCHAINES ÉTAPES:"
echo ""
echo "1️⃣  CRÉEZ LE DÉPÔT SUR GITHUB:"
echo "   → Ouvrez: https://github.com/new"
echo "   → Nom du dépôt: ${REPO_NAME}"
echo "   → ⚠️  IMPORTANT: Ne PAS cocher 'Initialize this repository'"
echo "   → Cliquez sur 'Create repository'"
echo ""
read -p "Appuyez sur Entrée une fois le dépôt créé sur GitHub... " -r
echo ""

# Vérifier si on peut pousser
echo "🚀 Tentative de push vers GitHub..."
if git push -u origin main 2>&1; then
    echo ""
    echo "✅ Code poussé vers GitHub avec succès!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "2️⃣  DÉPLOYEZ SUR VERCEL:"
    echo "   → Ouvrez: https://vercel.com/new"
    echo "   → Connectez-vous avec GitHub"
    echo "   → Sélectionnez le dépôt: ${REPO_NAME}"
    echo "   → Ajoutez les variables d'environnement:"
    echo "      • NEXT_PUBLIC_SUPABASE_URL"
    echo "      • NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "      • SUPABASE_SERVICE_ROLE_KEY"
    echo "      • NEXT_PUBLIC_APP_URL (après le 1er déploiement)"
    echo "   → Cliquez sur 'Deploy'"
    echo ""
    echo "📖 Pour plus de détails, consultez:"
    echo "   • QUICK_DEPLOY.md"
    echo "   • GITHUB_DEPLOYMENT.md"
    echo ""
else
    echo ""
    echo "⚠️  Le push a échoué. Raisons possibles:"
    echo "   • Le dépôt GitHub n'existe pas encore"
    echo "   • Vous n'avez pas les permissions"
    echo "   • Problème d'authentification GitHub"
    echo ""
    echo "💡 Solutions:"
    echo "   1. Vérifiez que le dépôt existe: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
    echo "   2. Configurez l'authentification GitHub:"
    echo "      git config --global credential.helper store"
    echo "   3. Ou utilisez un token d'accès personnel"
    echo ""
fi

