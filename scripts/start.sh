#!/bin/bash

# Script de démarrage automatique de l'application

echo "🚀 Démarrage de l'application Talok"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo ""
    echo "Veuillez installer Node.js d'abord :"
    echo "  1. Allez sur https://nodejs.org/"
    echo "  2. Téléchargez la version LTS pour macOS"
    echo "  3. Installez le fichier .pkg"
    echo "  4. Redémarrez votre terminal"
    echo ""
    echo "Ou consultez INSTALL_NODE.md pour plus d'options"
    exit 1
fi

echo "✅ Node.js $(node --version) détecté"
echo "✅ npm $(npm --version) détecté"
echo ""

# Vérifier les dépendances
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        exit 1
    fi
    
    echo "✅ Dépendances installées"
    echo ""
fi

# Vérifier .env.local
if [ ! -f .env.local ]; then
    echo "⚠️  Fichier .env.local manquant"
    echo "📝 Création du fichier .env.local..."
    cp env.example .env.local
    echo "✅ Fichier .env.local créé"
    echo ""
    echo "⚠️  IMPORTANT : Éditez .env.local et ajoutez vos clés Supabase :"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo ""
    read -p "Appuyez sur Entrée pour continuer (vous pourrez configurer Supabase plus tard)..."
    echo ""
fi

# Vérifier la configuration Supabase
source .env.local 2>/dev/null
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "⚠️  Variables Supabase non configurées"
    echo "   L'application peut ne pas fonctionner correctement"
    echo "   Configurez .env.local avec vos clés Supabase"
    echo ""
fi

# Lancer l'application
echo "🌟 Lancement de l'application..."
echo ""
echo "📍 L'application sera accessible sur : http://localhost:3000"
echo "🛑 Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

npm run dev

