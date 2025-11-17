#!/bin/bash
# ⚡ COMMANDES EXACTES POUR DÉPLOYER MAINTENANT
# Copiez-collez ces commandes une par une dans votre terminal

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 1: Créez d'abord le dépôt sur GitHub
# → https://github.com/new
# → Nom: gestion-locative
# → ⚠️  Ne PAS initialiser avec README
# ═══════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 2: Remplacez VOTRE_USERNAME par votre nom d'utilisateur GitHub
# ═══════════════════════════════════════════════════════════════

GITHUB_USERNAME="VOTRE_USERNAME"  # ⬅️ MODIFIEZ ICI

# Connecter le dépôt local à GitHub
git remote add origin https://github.com/${GITHUB_USERNAME}/gestion-locative.git

# S'assurer que la branche s'appelle 'main'
git branch -M main

# Pousser le code vers GitHub
git push -u origin main

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 3: Déployez sur Vercel
# → https://vercel.com/new
# → Sélectionnez le dépôt gestion-locative
# → Ajoutez les variables d'environnement
# → Cliquez sur "Deploy"
# ═══════════════════════════════════════════════════════════════

echo ""
echo "✅ Code poussé vers GitHub!"
echo "📋 Prochaine étape: Déployez sur https://vercel.com/new"

