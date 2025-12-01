#!/bin/bash

# Script pour exporter avec un token d'accès personnel
# Usage: ./export-with-token.sh VOTRE_TOKEN

set -e

TOKEN=$1

if [ -z "$TOKEN" ]; then
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║     🔐 EXPORT AVEC TOKEN                                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Usage: ./export-with-token.sh VOTRE_TOKEN_GITHUB"
    echo ""
    echo "Pour obtenir un token:"
    echo "1. https://github.com/settings/tokens"
    echo "2. Generate new token (classic)"
    echo "3. Scope: repo"
    echo "4. Copiez le token"
    echo ""
    exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 EXPORT VERS GITHUB AVEC TOKEN                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Configurer le remote avec le token
REPO_URL="https://${TOKEN}@github.com/StudioVBG/Gestion-Immo.git"

# Vérifier que le remote est configuré
if git remote get-url origin &> /dev/null; then
    git remote set-url origin "$REPO_URL"
else
    git remote add origin "$REPO_URL"
fi

# S'assurer que la branche s'appelle main
git branch -M main

echo "📊 Statut du dépôt:"
echo "   • Remote: https://github.com/StudioVBG/Gestion-Immo.git"
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
    echo "4. Ajoutez les variables d'environnement:"
    echo "   • NEXT_PUBLIC_SUPABASE_URL"
    echo "   • NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   • SUPABASE_SERVICE_ROLE_KEY"
    echo "   • NEXT_PUBLIC_APP_URL (après le 1er déploiement)"
    echo "5. Cliquez sur 'Deploy'"
    echo ""
    
    # Réinitialiser le remote sans le token pour la sécurité
    git remote set-url origin "https://github.com/StudioVBG/Gestion-Immo.git"
    echo "🔒 Remote réinitialisé (token retiré pour sécurité)"
else
    echo ""
    echo "❌ Le push a échoué"
    echo "Vérifiez que le token est valide et a les permissions 'repo'"
    exit 1
fi

