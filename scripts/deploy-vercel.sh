#!/bin/bash

# Script de déploiement automatique sur Vercel
# Usage: ./deploy-vercel.sh

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 DÉPLOIEMENT AUTOMATIQUE SUR VERCEL                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: package.json non trouvé"
    echo "Assurez-vous d'être dans le répertoire du projet"
    exit 1
fi

# Vérifier si Vercel CLI est disponible
if ! command -v vercel &> /dev/null && ! npx vercel --version &> /dev/null; then
    echo "📦 Installation de Vercel CLI..."
    npm install vercel --save-dev
fi

echo "📊 Statut du projet:"
echo "   • Dépôt Git: $(git remote get-url origin 2>/dev/null || echo 'Non configuré')"
echo "   • Branche: $(git branch --show-current)"
echo "   • Commits: $(git rev-list --count HEAD)"
echo ""

echo "🔐 Authentification Vercel..."
echo "   → Une fenêtre de navigateur va s'ouvrir"
echo "   → Connectez-vous à Vercel"
echo "   → Autorisez l'accès"
echo ""

# Utiliser npx pour éviter les problèmes de permissions
if npx vercel login; then
    echo ""
    echo "✅ Authentification réussie!"
    echo ""
    echo "🚀 Déploiement sur Vercel..."
    echo ""
    
    # Déployer avec les options par défaut
    # L'utilisateur devra répondre aux questions interactives
    npx vercel --yes
    
    echo ""
    echo "✅ Déploiement terminé!"
    echo ""
    echo "📋 PROCHAINES ÉTAPES:"
    echo ""
    echo "1. Allez sur: https://vercel.com/dashboard"
    echo "2. Sélectionnez votre projet: Gestion-Immo"
    echo "3. Allez dans Settings → Environment Variables"
    echo "4. Ajoutez les variables d'environnement:"
    echo "   • NEXT_PUBLIC_SUPABASE_URL"
    echo "   • NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   • SUPABASE_SERVICE_ROLE_KEY"
    echo "   • NEXT_PUBLIC_APP_URL"
    echo "5. Redéployez le projet"
    echo ""
else
    echo ""
    echo "❌ Authentification échouée"
    echo ""
    echo "📋 DÉPLOIEMENT MANUEL (recommandé):"
    echo ""
    echo "1. Allez sur: https://vercel.com/new"
    echo "2. Connectez-vous avec GitHub"
    echo "3. Sélectionnez: Gestion-Immo"
    echo "4. Configurez les variables d'environnement"
    echo "5. Cliquez 'Deploy'"
    echo ""
    exit 1
fi

