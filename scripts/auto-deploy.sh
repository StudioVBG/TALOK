#!/bin/bash

# Script de déploiement automatique complet
# Ce script fait TOUT automatiquement une fois GitHub CLI configuré

set -e

REPO_NAME="gestion-locative"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 DÉPLOIEMENT AUTOMATIQUE COMPLET                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que GitHub CLI est installé
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI n'est pas installé"
    echo "Installation..."
    brew install gh
fi

# Vérifier l'authentification
if ! gh auth status &> /dev/null; then
    echo "🔐 Authentification GitHub requise"
    echo ""
    echo "1. Une fenêtre de navigateur va s'ouvrir"
    echo "2. Connectez-vous à GitHub"
    echo "3. Autorisez GitHub CLI"
    echo ""
    read -p "Appuyez sur Entrée pour démarrer l'authentification... " -r
    echo ""
    gh auth login --web
fi

# Récupérer le nom d'utilisateur GitHub
GITHUB_USERNAME=$(gh api user --jq .login)
echo "✅ Authentifié en tant que: ${GITHUB_USERNAME}"
echo ""

# Vérifier si le dépôt existe déjà
if gh repo view "${GITHUB_USERNAME}/${REPO_NAME}" &> /dev/null; then
    echo "⚠️  Le dépôt ${REPO_NAME} existe déjà sur GitHub"
    read -p "Voulez-vous continuer et pousser le code? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Opération annulée"
        exit 1
    fi
else
    echo "📦 Création du dépôt GitHub..."
    gh repo create "${REPO_NAME}" --public --source=. --remote=origin --push
    echo "✅ Dépôt créé et code poussé!"
    exit 0
fi

# Si le dépôt existe, configurer le remote et pousser
echo "📦 Configuration du remote Git..."
if git remote get-url origin &> /dev/null; then
    git remote set-url origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
else
    git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
fi

echo "🚀 Push du code vers GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "✅ Code déployé sur GitHub avec succès!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROCHAINE ÉTAPE: Déployez sur Netlify"
echo ""
echo "1. Allez sur: https://app.netlify.com/start"
echo "2. Connectez-vous avec GitHub"
echo "3. Sélectionnez le dépôt: ${REPO_NAME}"
echo "4. Ajoutez les variables d'environnement dans 'Site settings' > 'Environment variables'"
echo "5. Cliquez sur 'Deploy site'"
echo ""
echo "🔗 Dépôt GitHub: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"

