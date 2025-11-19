# ⚡ Démarrage rapide

## Installation en 3 étapes

### 1️⃣ Installer les dépendances

```bash
npm install
```

Ou utilisez le script automatique :

```bash
npm run setup
```

### 2️⃣ Configurer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Copiez `env.example` vers `.env.local`
3. Remplissez vos clés Supabase dans `.env.local`
4. Appliquez les migrations (voir ci-dessous)

### 3️⃣ Lancer l'application

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## Appliquer les migrations Supabase

### Option A : Via l'interface web (plus simple)

1. Allez dans votre projet Supabase
2. Ouvrez **SQL Editor**
3. Exécutez chaque fichier dans l'ordre :
   - `supabase/migrations/20240101000000_initial_schema.sql`
   - `supabase/migrations/20240101000001_rls_policies.sql`
   - `supabase/migrations/20240101000002_functions.sql`
   - `supabase/migrations/20240101000003_storage_bucket.sql`

### Option B : Via Supabase CLI

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase link --project-ref votre-project-ref

# Appliquer les migrations
supabase db push
```

## Créer le premier admin

1. Inscrivez-vous via `/auth/signup`
2. Dans Supabase SQL Editor, exécutez :

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
```

## Vérifier la configuration

```bash
npm run check-env
```

## Commandes disponibles

```bash
npm run dev          # Développement
npm run build        # Build production
npm run start        # Production
npm run lint         # Linter
npm run type-check   # Vérifier TypeScript
npm run test         # Tests unitaires
npm run test:e2e     # Tests E2E
```

## Structure du projet

```
✅ 50+ fichiers créés
✅ 15 tables en base de données
✅ 30+ routes disponibles
✅ 20+ composants React
✅ 15+ services métier
✅ 4 migrations SQL
✅ 100% TypeScript
✅ RLS configuré
```

## Documentation complète

- `GETTING_STARTED.md` - Guide détaillé
- `IMPLEMENTATION.md` - Guide pour Stripe, emails, etc.
- `PROJET_COMPLET.md` - Vue d'ensemble
- `README.md` - Documentation principale
- `.cursorrules` - Guidelines de développement

## Besoin d'aide ?

Consultez `GETTING_STARTED.md` pour un guide complet avec toutes les étapes détaillées.

