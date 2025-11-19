# ⚡ Démarrer l'application - Guide rapide

## 🎯 Installation de Node.js (une seule fois)

**Node.js n'est pas installé sur votre système.**

### Solution la plus simple (5 minutes) :

1. **Ouvrez votre navigateur** : https://nodejs.org/
2. **Téléchargez la version LTS** pour macOS
3. **Installez le fichier `.pkg`** téléchargé
4. **Redémarrez votre terminal**

### Vérifier l'installation :

```bash
node --version
npm --version
```

✅ Si vous voyez des numéros de version, Node.js est installé !

---

## 🚀 Démarrer l'application

Une fois Node.js installé, vous avez **3 options** :

### Option 1 : Script automatique (recommandé)

```bash
npm run start-app
```

Ce script va :
- ✅ Vérifier Node.js
- ✅ Installer les dépendances si nécessaire
- ✅ Créer `.env.local` si nécessaire
- ✅ Lancer l'application

### Option 2 : Commandes manuelles

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer Supabase (si pas déjà fait)
cp env.example .env.local
# Éditez .env.local avec vos clés Supabase

# 3. Lancer l'application
npm run dev
```

### Option 3 : Script bash direct

```bash
bash scripts/start.sh
```

---

## 📍 Accéder à l'application

Une fois lancée, l'application sera accessible sur :

**http://localhost:3000**

---

## ⚙️ Configuration Supabase (première fois)

Si vous n'avez pas encore configuré Supabase :

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Récupérez vos clés dans **Settings > API**
3. Éditez `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Appliquez les migrations (voir `INSTALLATION.md`)

---

## 📚 Documentation complète

- **`INSTALL_NODE.md`** - Guide détaillé d'installation de Node.js
- **`QUICK_START.md`** - Guide de démarrage rapide
- **`INSTALLATION.md`** - Guide d'installation complet
- **`GETTING_STARTED.md`** - Tous les détails

---

## ❓ Problèmes courants

### "command not found: npm"
→ Node.js n'est pas installé. Suivez les étapes ci-dessus.

### "Port 3000 already in use"
→ Un autre processus utilise le port 3000. Arrêtez-le ou utilisez un autre port :
```bash
PORT=3001 npm run dev
```

### Erreur de connexion Supabase
→ Vérifiez que `.env.local` contient les bonnes clés Supabase.

---

## ✅ Checklist

- [ ] Node.js installé (`node --version` fonctionne)
- [ ] Dépendances installées (`npm install` exécuté)
- [ ] `.env.local` configuré avec les clés Supabase
- [ ] Migrations Supabase appliquées
- [ ] Application lancée (`npm run dev`)
- [ ] Application accessible sur http://localhost:3000

---

**🎉 Une fois tout configuré, l'application est prête à l'emploi !**

