#!/bin/bash

# Script de déploiement immédiat
# Fait le maximum possible automatiquement

set -e

REPO_NAME="gestion-locative"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 DÉPLOIEMENT IMMÉDIAT                                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier si GitHub CLI est authentifié
if gh auth status &> /dev/null; then
    echo "✅ GitHub CLI authentifié"
    GITHUB_USERNAME=$(gh api user --jq .login)
    echo "   Utilisateur: ${GITHUB_USERNAME}"
    echo ""
    
    # Vérifier si le dépôt existe
    if gh repo view "${GITHUB_USERNAME}/${REPO_NAME}" &> /dev/null; then
        echo "⚠️  Le dépôt existe déjà"
        echo "📦 Configuration du remote et push..."
        if git remote get-url origin &> /dev/null; then
            git remote set-url origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
        else
            git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
        fi
        git branch -M main
        git push -u origin main
        echo ""
        echo "✅ Code déployé sur GitHub!"
    else
        echo "📦 Création du dépôt et déploiement..."
        gh repo create "${REPO_NAME}" --public --source=. --remote=origin --push
        echo ""
        echo "✅ Dépôt créé et code déployé!"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🎯 PROCHAINE ÉTAPE: Déployez sur Vercel"
    echo ""
    echo "1. Allez sur: https://vercel.com/new"
    echo "2. Connectez-vous avec GitHub"
    echo "3. Sélectionnez: ${REPO_NAME}"
    echo "4. Ajoutez les variables d'environnement"
    echo "5. Cliquez sur 'Deploy'"
    echo ""
    echo "🔗 Dépôt: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
    
else
    echo "❌ GitHub CLI n'est pas authentifié"
    echo ""
    echo "📋 OPTION 1: Authentification rapide (recommandé)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Exécutez: gh auth login --web"
    echo "Puis relancez ce script: ./DEPLOY_NOW.sh"
    echo ""
    echo "📋 OPTION 2: Méthode manuelle"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Créez le dépôt: https://github.com/new"
    echo "   → Nom: ${REPO_NAME}"
    echo "   → ⚠️  Ne PAS initialiser avec README"
    echo ""
    echo "2. Donnez votre username GitHub et j'exécuterai:"
    echo "   git remote add origin https://github.com/VOTRE_USERNAME/${REPO_NAME}.git"
    echo "   git push -u origin main"
    echo ""
    exit 1
fi

