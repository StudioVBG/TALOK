# 📦 Installation de Node.js - Guide macOS

## ⚠️ Problème détecté

Node.js n'est pas installé sur votre système. Voici comment l'installer sur macOS :

## 🎯 Solution la plus simple (recommandée)

### Option 1 : Téléchargement direct (5 minutes)

1. **Ouvrez votre navigateur** et allez sur : **https://nodejs.org/**
2. **Téléchargez la version LTS** (Long Term Support) pour macOS
3. **Ouvrez le fichier `.pkg`** téléchargé
4. **Suivez l'assistant d'installation** (cliquez sur "Continuer" jusqu'à la fin)
5. **Redémarrez votre terminal** ou ouvrez un nouveau terminal
6. **Vérifiez l'installation** :
   ```bash
   node --version
   npm --version
   ```

✅ **C'est tout !** Node.js sera installé et prêt à l'emploi.

---

## 🔧 Solutions alternatives

### Option 2 : Via Homebrew (si vous avez Homebrew)

Si vous avez Homebrew installé :

```bash
brew install node@18
```

### Option 3 : Via nvm (nécessite les outils Xcode)

Si vous avez les outils de développement Xcode installés :

```bash
# Installer nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Recharger le terminal
source ~/.zshrc

# Installer Node.js 18
nvm install 18
nvm use 18
```

**Note** : Si vous n'avez pas les outils Xcode, installez-les d'abord :
```bash
xcode-select --install
```

---

## ✅ Après l'installation de Node.js

Une fois Node.js installé, revenez dans ce dossier et exécutez :

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement (si pas déjà fait)
cp env.example .env.local
# Éditez .env.local avec vos clés Supabase

# 3. Lancer l'application
npm run dev
```

L'application sera accessible sur : **http://localhost:3000**

---

## 🚀 Script automatique

Une fois Node.js installé, vous pouvez utiliser le script de démarrage automatique :

```bash
npm run setup
```

Ce script va :
- ✅ Vérifier que Node.js est installé
- ✅ Installer toutes les dépendances
- ✅ Créer le fichier `.env.local` si nécessaire
- ✅ Vérifier la configuration

---

## ❓ Besoin d'aide ?

- Consultez `QUICK_START.md` pour un guide rapide
- Consultez `INSTALLATION.md` pour un guide complet
- Consultez `GETTING_STARTED.md` pour tous les détails

