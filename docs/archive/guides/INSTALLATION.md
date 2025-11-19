# 📦 Guide d'installation complète

## ✅ Checklist d'installation

### Étape 1 : Prérequis système

- [ ] Node.js 18+ installé (`node --version`)
- [ ] npm installé (`npm --version`)
- [ ] Git installé (optionnel)

### Étape 2 : Installation du projet

```bash
# Cloner le projet (si depuis Git)
git clone <url-du-repo>
cd "Gestion locative"

# Installer les dépendances
npm install

# OU utiliser le script automatique
npm run setup
```

### Étape 3 : Configuration Supabase

- [ ] Compte Supabase créé
- [ ] Projet Supabase créé
- [ ] Variables d'environnement configurées (`.env.local`)
- [ ] Migrations appliquées
- [ ] Bucket Storage "documents" créé
- [ ] Types TypeScript générés

### Étape 4 : Vérification

```bash
# Vérifier la configuration
npm run check-env

# Lancer le serveur
npm run dev
```

- [ ] Serveur démarre sans erreur
- [ ] Page d'accueil accessible
- [ ] Inscription fonctionne
- [ ] Connexion fonctionne

## 📋 Détails par étape

### 1. Installation des dépendances

```bash
npm install
```

**Durée estimée** : 2-5 minutes

**Dépendances installées** :
- Next.js 14
- React 18
- TypeScript
- Supabase
- Tailwind CSS
- shadcn/ui
- Zod
- Et 20+ autres packages

### 2. Configuration Supabase

#### 2.1 Créer un projet

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte (gratuit)
3. Cliquez sur "New Project"
4. Remplissez :
   - Nom du projet
   - Mot de passe de la base de données
   - Région (choisissez la plus proche)
5. Attendez la création (2-3 minutes)

#### 2.2 Récupérer les clés

1. Dans votre projet Supabase
2. Allez dans **Settings** > **API**
3. Copiez :
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public** key

#### 2.3 Configurer `.env.local`

```bash
cp env.example .env.local
```

Éditez `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2.4 Appliquer les migrations

**Méthode 1 : Interface web (recommandée pour débuter)**

1. Dans Supabase, allez dans **SQL Editor**
2. Créez une nouvelle requête
3. Copiez-collez le contenu de chaque fichier dans l'ordre :
   - `supabase/migrations/20240101000000_initial_schema.sql`
   - `supabase/migrations/20240101000001_rls_policies.sql`
   - `supabase/migrations/20240101000002_functions.sql`
   - `supabase/migrations/20240101000003_storage_bucket.sql`
4. Exécutez chaque requête (bouton "Run")

**Méthode 2 : Supabase CLI**

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter (trouvez votre project-ref dans Settings > General)
supabase link --project-ref xxxxxx

# Appliquer les migrations
supabase db push
```

#### 2.5 Configurer le Storage

1. Dans Supabase, allez dans **Storage**
2. Si le bucket "documents" n'existe pas, créez-le :
   - Nom : `documents`
   - Public : Non (les RLS gèrent l'accès)
3. Les politiques RLS sont déjà dans la migration

#### 2.6 Générer les types TypeScript

**Méthode 1 : Supabase CLI**

```bash
supabase gen types typescript --project-id votre-project-id > lib/supabase/types.ts
```

**Méthode 2 : Interface web**

1. Dans Supabase, allez dans **Settings** > **API**
2. Section "TypeScript types"
3. Copiez le code généré
4. Collez dans `lib/supabase/types.ts`

### 3. Créer le premier utilisateur admin

1. Lancez l'application : `npm run dev`
2. Allez sur [http://localhost:3000/auth/signup](http://localhost:3000/auth/signup)
3. Créez un compte avec le rôle "admin"
4. Dans Supabase SQL Editor, exécutez :

```sql
-- Trouver votre user_id
SELECT id, email FROM auth.users;

-- Mettre à jour le rôle (remplacez 'votre-email@example.com')
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'votre-email@example.com'
);
```

### 4. Vérification finale

```bash
# Vérifier la configuration
npm run check-env

# Lancer le serveur
npm run dev
```

**Tests à effectuer** :

1. ✅ Page d'accueil : [http://localhost:3000](http://localhost:3000)
2. ✅ Inscription : [http://localhost:3000/auth/signup](http://localhost:3000/auth/signup)
3. ✅ Connexion : [http://localhost:3000/auth/signin](http://localhost:3000/auth/signin)
4. ✅ Dashboard : [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
5. ✅ Navigation fonctionne selon le rôle

## 🔧 Configuration des services externes (optionnel)

### Stripe (Paiements)

1. Créez un compte sur [stripe.com](https://stripe.com)
2. Récupérez vos clés API (mode test)
3. Ajoutez dans `.env.local` :

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

4. Installez Stripe :

```bash
npm install stripe @stripe/stripe-js
```

### Resend (Emails)

1. Créez un compte sur [resend.com](https://resend.com)
2. Récupérez votre clé API
3. Ajoutez dans `.env.local` :

```env
RESEND_API_KEY=re_...
```

4. Installez Resend :

```bash
npm install resend
```

## 🐛 Dépannage

### Erreur "Cannot find module"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erreur de connexion Supabase

- Vérifiez que `.env.local` existe
- Vérifiez que les variables commencent par `NEXT_PUBLIC_`
- Redémarrez le serveur : `npm run dev`

### Erreur RLS (Row Level Security)

- Vérifiez que la migration `20240101000001_rls_policies.sql` est appliquée
- Vérifiez dans Supabase > Authentication > Policies

### Erreur Storage

- Vérifiez que le bucket "documents" existe
- Vérifiez que la migration `20240101000003_storage_bucket.sql` est appliquée

### Port 3000 déjà utilisé

```bash
# Utiliser un autre port
PORT=3001 npm run dev
```

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

## ✅ Installation terminée !

Une fois toutes les étapes complétées, vous pouvez :

- Consulter `QUICK_START.md` pour un rappel rapide
- Consulter `GETTING_STARTED.md` pour plus de détails
- Consulter `IMPLEMENTATION.md` pour les fonctionnalités avancées
- Commencer à développer !

