# 🚀 Instructions pour déployer sur Vercel via GitHub

## ✅ Ce qui a été fait

- ✅ Dépôt Git initialisé
- ✅ Commit initial créé avec tous les fichiers
- ✅ Fichier `vercel.json` créé
- ✅ Fichier `DEPLOYMENT.md` créé avec guide complet

## 📋 Prochaines étapes

### 1. Créer le dépôt GitHub

1. Aller sur https://github.com/new
2. Nommer le dépôt : `gestion-locative` (ou un autre nom)
3. **Ne pas** cocher "Initialize this repository with README"
4. Cliquer sur "Create repository"

### 2. Connecter le dépôt local à GitHub

**Remplacez `VOTRE_USERNAME` par votre nom d'utilisateur GitHub :**

```bash
# Ajouter le remote GitHub
git remote add origin https://github.com/VOTRE_USERNAME/gestion-locative.git

# Renommer la branche en main (si nécessaire)
git branch -M main

# Pousser le code vers GitHub
git push -u origin main
```

### 3. Configurer Vercel

1. **Se connecter à Vercel** : https://vercel.com
   - Cliquer sur "Sign Up" ou "Log In"
   - Choisir "Continue with GitHub"

2. **Importer le projet** :
   - Cliquer sur "Add New..." → "Project"
   - Sélectionner "Import Git Repository"
   - Choisir votre dépôt `gestion-locative`
   - Cliquer sur "Import"

3. **Configurer le projet** :
   - Framework Preset : **Next.js** (détecté automatiquement)
   - Root Directory : `./`
   - Build Command : `npm run build`
   - Output Directory : `.next`
   - Install Command : `npm install`

### 4. Ajouter les variables d'environnement dans Vercel

Dans **Settings → Environment Variables**, ajouter :

| Variable | Valeur | Environnements |
|----------|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Votre URL Supabase | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé anonyme | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Votre clé service role | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://votre-projet.vercel.app` | Production uniquement |

**⚠️ Important** : Pour `NEXT_PUBLIC_APP_URL`, vous devrez d'abord déployer une première fois pour obtenir l'URL Vercel, puis mettre à jour cette variable et redéployer.

### 5. Déployer

1. Cliquer sur **"Deploy"** dans Vercel
2. Attendre la fin du build
3. Vérifier que tout fonctionne

### 6. Configurer Supabase pour la production

1. Aller sur https://app.supabase.com
2. Sélectionner votre projet
3. **Settings → Authentication → URL Configuration** :
   - **Site URL** : `https://votre-projet.vercel.app`
   - **Redirect URLs** : Ajouter `https://votre-projet.vercel.app/**`

### 7. Mettre à jour NEXT_PUBLIC_APP_URL

1. Retourner dans Vercel → **Settings → Environment Variables**
2. Modifier `NEXT_PUBLIC_APP_URL` avec l'URL de production Vercel
3. **Redéployer** le projet

## 🔄 Déploiements automatiques

Après la configuration initiale :
- **Production** : Déploie automatiquement à chaque push sur `main`
- **Preview** : Crée un déploiement de prévisualisation pour chaque pull request

## 📝 Commandes Git utiles

```bash
# Vérifier le statut
git status

# Ajouter les fichiers modifiés
git add .

# Créer un commit
git commit -m "Description des changements"

# Pousser vers GitHub (déclenche automatiquement un déploiement)
git push origin main
```

## 🐛 En cas de problème

Consultez le fichier `DEPLOYMENT.md` pour un guide détaillé et la résolution de problèmes.

