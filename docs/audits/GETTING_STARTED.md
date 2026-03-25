# 🚀 Guide de démarrage - Talok

## Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** (version 18 ou supérieure) : [Télécharger Node.js](https://nodejs.org/)
- **npm** (inclus avec Node.js)
- **Git** (optionnel, pour le versioning)

## Étape 1 : Installation des dépendances

```bash
npm install
```

Cette commande installera toutes les dépendances listées dans `package.json` :
- Next.js 14
- React 18
- TypeScript
- Supabase
- Tailwind CSS
- shadcn/ui
- Et toutes les autres dépendances

## Étape 2 : Configuration Supabase

### 2.1 Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte (gratuit)
3. Créez un nouveau projet
4. Notez votre **Project URL** et votre **anon key**

### 2.2 Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp env.example .env.local
```

Éditez `.env.local` et remplissez :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key_ici
```

### 2.3 Installer Supabase CLI (optionnel mais recommandé)

```bash
npm install -g supabase
```

### 2.4 Appliquer les migrations

**Option A : Via Supabase CLI (recommandé)**

```bash
# Se connecter à votre projet
supabase link --project-ref votre-project-ref

# Appliquer les migrations
supabase db push
```

**Option B : Via l'interface Supabase**

1. Allez dans votre projet Supabase
2. Ouvrez l'éditeur SQL
3. Copiez-collez le contenu de chaque fichier de migration dans l'ordre :
   - `supabase/migrations/20240101000000_initial_schema.sql`
   - `supabase/migrations/20240101000001_rls_policies.sql`
   - `supabase/migrations/20240101000002_functions.sql`
   - `supabase/migrations/20240101000003_storage_bucket.sql`

### 2.5 Configurer le Storage

1. Dans Supabase, allez dans **Storage**
2. Créez un bucket nommé `documents`
3. Configurez les politiques RLS (déjà dans la migration)

### 2.6 Générer les types TypeScript

```bash
# Avec Supabase CLI
supabase gen types typescript --project-id votre-project-id > lib/supabase/types.ts
```

Ou manuellement via l'interface Supabase :
1. Allez dans **Settings** > **API**
2. Copiez les types générés dans `lib/supabase/types.ts`

## Étape 3 : Lancer le serveur de développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Étape 4 : Configuration des services externes (optionnel)

### 4.1 Stripe (Paiements en ligne)

1. Créez un compte sur [stripe.com](https://stripe.com)
2. Récupérez vos clés API (mode test pour commencer)
3. Ajoutez dans `.env.local` :

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

4. Installez Stripe :

```bash
npm install stripe @stripe/stripe-js
```

5. Mettez à jour `/app/api/payments/create-intent/route.ts` avec le code Stripe réel

### 4.2 Emails (Resend recommandé)

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

5. Mettez à jour `/app/api/emails/send/route.ts` avec le code Resend réel

## Étape 5 : Créer le premier utilisateur admin

1. Inscrivez-vous via `/auth/signup` avec le rôle "admin"
2. Connectez-vous à Supabase
3. Dans l'éditeur SQL, exécutez :

```sql
-- Mettre à jour le rôle du premier utilisateur en admin
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
```

## Vérification

Après l'installation, vérifiez que :

- ✅ Le serveur démarre sans erreur : `npm run dev`
- ✅ Vous pouvez accéder à `/auth/signup`
- ✅ Vous pouvez créer un compte
- ✅ Les migrations sont appliquées (vérifier dans Supabase)
- ✅ Le bucket Storage "documents" existe

## Commandes utiles

```bash
# Développement
npm run dev              # Lancer le serveur de dev
npm run build            # Build de production
npm run start            # Lancer en production
npm run lint             # Vérifier le code
npm run type-check       # Vérifier les types TypeScript

# Tests
npm run test             # Tests unitaires (Vitest)
npm run test:e2e         # Tests E2E (Playwright)

# Supabase
supabase db push         # Appliquer les migrations
supabase gen types typescript --project-id <id>  # Générer les types
```

## Dépannage

### Erreur "Cannot find module"
→ Exécutez `npm install`

### Erreur de connexion Supabase
→ Vérifiez vos variables d'environnement dans `.env.local`

### Erreur RLS
→ Vérifiez que les migrations RLS sont appliquées

### Erreur Storage
→ Vérifiez que le bucket "documents" existe dans Supabase

## Support

Pour toute question, consultez :
- La documentation Supabase : https://supabase.com/docs
- La documentation Next.js : https://nextjs.org/docs
- Le fichier `.cursorrules` pour les guidelines du projet

