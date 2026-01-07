#!/bin/bash

# Script de configuration automatique du projet Talok

echo "🚀 Configuration du projet Talok"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) détecté"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé."
    exit 1
fi

echo "✅ npm $(npm --version) détecté"
echo ""

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
fi

echo "✅ Dépendances installées"
echo ""

# Créer .env.local si il n'existe pas
if [ ! -f .env.local ]; then
    echo "📝 Création du fichier .env.local..."
    cp env.example .env.local
    echo "✅ Fichier .env.local créé"
    echo "⚠️  N'oubliez pas de remplir vos variables d'environnement Supabase !"
else
    echo "✅ Fichier .env.local existe déjà"
fi

echo ""
echo "🎉 Configuration terminée !"
echo ""
echo "Prochaines étapes :"
echo "1. Configurez vos variables d'environnement dans .env.local"
echo "2. Créez un projet Supabase et appliquez les migrations"
echo "3. Lancez le serveur : npm run dev"
echo ""
echo "Consultez GETTING_STARTED.md pour plus de détails."

