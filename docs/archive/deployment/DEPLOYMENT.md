# 🚀 Guide de déploiement sur Vercel

Ce guide vous explique comment déployer l'application sur Vercel via GitHub.

## 📋 Prérequis

- Un compte GitHub
- Un compte Vercel (gratuit)
- Un projet Supabase configuré

## 🔧 Étape 1 : Préparer le dépôt GitHub

### 1.1 Créer un nouveau dépôt sur GitHub

1. Aller sur https://github.com/new
2. Nommer le dépôt (ex: `gestion-locative`)
3. **Ne pas** initialiser avec README, .gitignore ou licence (déjà présents)
4. Cliquer sur "Create repository"

### 1.2 Initialiser Git et pousser le code

```bash
# Initialiser Git
git init

# Ajouter tous les fichiers
git add .

# Créer le commit initial
git commit -m "Initial commit - Projet gestion locative"

# Ajouter le remote GitHub (remplacer VOTRE_USERNAME)
git remote add origin https://github.com/VOTRE_USERNAME/gestion-locative.git

# Renommer la branche principale en main
git branch -M main

# Pousser vers GitHub
git push -u origin main
```

## 🔐 Étape 2 : Configurer les variables d'environnement

### 2.1 Créer un fichier .env.example

Créez un fichier `.env.example` à la racine avec ce contenu :

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2.2 Variables à configurer dans Vercel

Dans Vercel, vous devrez ajouter ces variables dans **Settings → Environment Variables** :

| Variable | Description | Environnements |
|----------|-------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | URL de votre application Vercel | Production uniquement |

## 🚀 Étape 3 : Déployer sur Vercel

### 3.1 Se connecter à Vercel

1. Aller sur https://vercel.com
2. Cliquer sur "Sign Up" ou "Log In"
3. Choisir "Continue with GitHub"

### 3.2 Importer le projet

1. Cliquer sur "Add New..." → "Project"
2. Sélectionner "Import Git Repository"
3. Choisir votre dépôt `gestion-locative`
4. Cliquer sur "Import"

### 3.3 Configurer le projet

Vercel détecte automatiquement Next.js. Vérifiez ces paramètres :

- **Framework Preset** : Next.js ✅
- **Root Directory** : `./` ✅
- **Build Command** : `npm run build` ✅
- **Output Directory** : `.next` ✅
- **Install Command** : `npm install` ✅

### 3.4 Ajouter les variables d'environnement

1. Dans la section "Environment Variables", ajouter chaque variable :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (à remplir après le premier déploiement avec l'URL Vercel)

2. Sélectionner les environnements : **Production**, **Preview**, **Development**

3. Cliquer sur "Deploy"

## 🔄 Étape 4 : Configurer Supabase pour la production

### 4.1 Ajouter l'URL de production dans Supabase

1. Aller sur https://app.supabase.com
2. Sélectionner votre projet
3. Aller dans **Settings → Authentication → URL Configuration**
4. Ajouter dans **Site URL** : `https://votre-projet.vercel.app`
5. Ajouter dans **Redirect URLs** : `https://votre-projet.vercel.app/**`

### 4.2 Mettre à jour NEXT_PUBLIC_APP_URL dans Vercel

1. Retourner dans Vercel → Settings → Environment Variables
2. Modifier `NEXT_PUBLIC_APP_URL` avec l'URL de production Vercel
3. Redéployer le projet

## ✅ Vérification

Après le déploiement :

1. ✅ Vérifier que le build passe sans erreur
2. ✅ Tester l'authentification (connexion/déconnexion)
3. ✅ Tester la création d'un logement
4. ✅ Vérifier les logs dans Vercel en cas d'erreur

## 🔄 Déploiements automatiques

Vercel déploie automatiquement :
- **Production** : À chaque push sur `main`
- **Preview** : À chaque pull request

## 📝 Commandes Git utiles

```bash
# Vérifier le statut
git status

# Ajouter tous les fichiers modifiés
git add .

# Créer un commit
git commit -m "Description des changements"

# Pousser vers GitHub (déclenche automatiquement un déploiement)
git push origin main
```

## 🐛 Résolution de problèmes

### Erreur de build

- Vérifier les logs dans Vercel → Deployments → [votre déploiement] → Build Logs
- S'assurer que toutes les dépendances sont dans `package.json`
- Vérifier que TypeScript compile sans erreur : `npm run build`

### Variables d'environnement non trouvées

- Vérifier que les variables sont bien ajoutées dans Vercel
- Vérifier qu'elles sont sélectionnées pour le bon environnement
- Redéployer après modification

### Erreurs Supabase

- Vérifier que l'URL de production est dans les Redirect URLs Supabase
- Vérifier que les clés API sont correctes
- Vérifier les logs Supabase dans le dashboard

### Erreurs d'authentification

- Vérifier que `NEXT_PUBLIC_APP_URL` correspond à l'URL Vercel
- Vérifier que les Redirect URLs sont configurées dans Supabase
- Vérifier les cookies et sessions dans les DevTools

## 📚 Ressources

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Supabase](https://supabase.com/docs)

