#!/bin/bash

# Script simple pour exporter le projet sur GitHub
# Usage: ./export-github.sh

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 EXPORT VERS GITHUB                                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que le remote est configuré
if ! git remote get-url origin &> /dev/null; then
    echo "📦 Configuration du remote GitHub..."
    git remote add origin https://github.com/StudioVBG/Gestion-Immo.git
fi

# S'assurer que la branche s'appelle main
git branch -M main

echo "📊 Statut du dépôt:"
echo "   • Remote: $(git remote get-url origin)"
echo "   • Branche: $(git branch --show-current)"
echo "   • Commits: $(git rev-list --count HEAD)"
echo "   • Fichiers: $(git ls-files | wc -l | xargs)"
echo ""

echo "🚀 Push vers GitHub..."
if git push -u origin main; then
    echo ""
    echo "✅ Projet exporté sur GitHub avec succès!"
    echo ""
    echo "🔗 Dépôt: https://github.com/StudioVBG/Gestion-Immo"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 PROCHAINE ÉTAPE: Déployez sur Vercel"
    echo ""
    echo "1. Allez sur: https://vercel.com/new"
    echo "2. Connectez-vous avec GitHub"
    echo "3. Sélectionnez: Gestion-Immo"
    echo "4. Ajoutez les variables d'environnement"
    echo "5. Cliquez sur 'Deploy'"
    echo ""
else
    echo ""
    echo "❌ Le push a échoué. Raison: Authentification requise"
    echo ""
    echo "📋 AUTHENTIFIEZ-VOUS D'ABORD:"
    echo ""
    echo "MÉTHODE 1: GitHub CLI (recommandé)"
    echo "   gh auth login --web"
    echo "   Puis relancez: ./export-github.sh"
    echo ""
    echo "MÉTHODE 2: Token d'accès personnel"
    echo "   1. Créez un token: https://github.com/settings/tokens"
    echo "   2. Scope: repo"
    echo "   3. Exécutez: git push -u origin main"
    echo "   4. Username: StudioVBG"
    echo "   5. Password: votre token"
    echo ""
    exit 1
fi

