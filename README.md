# 🏠 Talok

Application SaaS de gestion locative pour la France et les DROM.

> **📖 Guide de démarrage rapide** : Consultez [QUICK_START.md](./QUICK_START.md) pour commencer en 3 étapes !

## Stack technique

- **Frontend** : Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend** : Supabase (PostgreSQL, Auth, RLS, Storage)
- **Tests** : Vitest (unitaires), Playwright (E2E)

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer les variables d'environnement :
```bash
cp env.example .env.local
```

Remplir les valeurs dans `.env.local` :
- `NEXT_PUBLIC_SUPABASE_URL` : URL de votre projet Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Clé anonyme de votre projet Supabase

3. Configurer Supabase :

```bash
# Installer Supabase CLI (si pas déjà fait)
npm install -g supabase

# Se connecter à votre projet
supabase link --project-ref your-project-ref

# Appliquer les migrations
supabase db push
```

4. Lancer le serveur de développement :

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Structure du projet

```
/app              # Routes et pages Next.js
  /auth           # Pages d'authentification
  /dashboard      # Tableau de bord
/features         # Logique métier par domaine
  /auth           # Services et composants d'authentification
  /properties     # Gestion des logements
  /leases         # Gestion des baux
  /billing        # Facturation et paiements
  /tickets        # Tickets de maintenance
/components       # Composants UI réutilisables
  /ui             # Composants shadcn/ui
  /layout         # Composants de layout (Navbar, etc.)
/lib              # Utilitaires, clients, validations
  /supabase       # Client Supabase (client/server)
  /types          # Types TypeScript du domaine
  /validations    # Schémas Zod
  /hooks          # Hooks React personnalisés (useAuth, useProfile)
  /helpers        # Helpers (format, permissions)
/supabase
  /migrations     # Migrations SQL
/tests
  /unit           # Tests unitaires (Vitest)
  /e2e            # Tests end-to-end (Playwright)
```

## Fonctionnalités implémentées

### ✅ Authentification
- Inscription multi-rôles (Propriétaire, Locataire, Prestataire, Admin)
- Connexion par email/mot de passe
- Magic links (prêt)
- Gestion de session avec Supabase Auth
- Protection des routes avec `ProtectedRoute`
- Hooks React : `useAuth`, `useProfile`

### ✅ Gestion des propriétés
- CRUD complet pour les logements
- Codes uniques pour chaque propriété
- Gestion des unités (colocation)
- Filtrage et recherche

### ✅ Gestion des baux
- Création et édition de baux
- Signature multi-parties (propriétaire, locataires, garants)
- Activation automatique quand tous ont signé
- Gestion des statuts (brouillon, en attente, actif, terminé)

### ✅ Facturation et paiements
- Génération automatique de factures mensuelles
- Suivi des paiements
- Calcul automatique des montants
- Statuts de factures (brouillon, envoyée, payée, en retard)
- Service Stripe préparé (nécessite configuration)

### ✅ Tickets de maintenance
- Création de tickets par locataires et propriétaires
- Gestion des priorités (basse, normale, haute)
- Suivi des statuts (ouvert, en cours, résolu, fermé)
- Association aux propriétés et baux

### ✅ Documents
- Upload de documents vers Supabase Storage
- Types de documents variés (bail, EDL, quittances, etc.)
- Téléchargement sécurisé avec URLs signées
- Organisation par propriété et bail

### ✅ Profils spécialisés
- Profils propriétaires (particulier/société, SIRET, IBAN)
- Profils locataires (situation pro, revenus, composition familiale)
- Profils prestataires (types de services, certifications, zones)

### ✅ Blog / Centre d'aide
- Articles de blog publics
- Gestion admin (création, édition, publication)
- Système de tags
- Recherche dans les articles

### ✅ Dashboard Admin
- KPI et statistiques globales
- Vue d'ensemble des utilisateurs, propriétés, baux, factures
- Activité récente
- Statistiques par statut et type

### ✅ Rapports
- Génération de rapports pour propriétaires
- Export CSV et JSON
- Filtrage par période
- Statistiques détaillées

### ✅ Notifications (structure prête)
- Service d'emails préparé
- Templates pour factures, paiements, tickets
- Intégration avec API d'email (à configurer)

### ✅ Interface utilisateur
- Page d'accueil
- Pages de connexion et d'inscription
- Tableaux de bord par rôle
- Navigation avec Navbar
- Composants UI (Button, Card, Input, Toast, etc.)

### ✅ Base de données
- Schéma complet avec 15 tables
- Row Level Security (RLS) configuré
- Fonctions et triggers SQL
- Indexes pour les performances
- Bucket Storage pour les documents

### ✅ Utilitaires
- Helpers de formatage (devise, dates, etc.)
- Helpers de permissions par rôle
- Services d'authentification
- Validation avec Zod

## Rôles

- **ADMIN** : Supervision globale, modération, analytics
- **PROPRIETAIRE** : Gestion des logements, baux, locataires, factures
- **LOCATAIRE** : Gestion du profil, baux, paiements, tickets
- **PRESTATAIRE** : Gestion des interventions, devis, factures

## Migrations

Les migrations SQL sont dans `/supabase/migrations`. Pour créer une nouvelle migration :

```bash
supabase migration new nom_de_la_migration
```

## Tests

```bash
# Tests unitaires
npm run test

# Tests E2E
npm run test:e2e
```

## Routes disponibles

### Publiques
- `/` - Page d'accueil
- `/blog` - Centre d'aide (articles publiés)
- `/blog/[slug]` - Article individuel

### Authentification
- `/auth/signin` - Connexion
- `/auth/signup` - Inscription

### Utilisateur
- `/dashboard` - Tableau de bord
- `/profile` - Mon profil

### Propriétés (Propriétaires/Admin)
- `/properties` - Liste des logements
- `/properties/new` - Nouveau logement
- `/properties/[id]` - Détails (avec baux, tickets, documents)
- `/properties/[id]/edit` - Édition

### Baux (Tous les rôles)
- `/leases` - Liste des baux
- `/leases/new` - Nouveau bail
- `/leases/[id]` - Détails (avec factures, documents)
- `/leases/[id]/edit` - Édition

### Factures (Propriétaires/Locataires)
- `/invoices` - Liste des factures
- `/invoices/[id]` - Détails d'une facture

### Tickets (Tous les rôles)
- `/tickets` - Liste des tickets
- `/tickets/new` - Nouveau ticket
- `/tickets/[id]` - Détails d'un ticket

### Documents (Tous les rôles)
- `/documents` - Liste des documents

### Admin
- `/admin/dashboard` - Dashboard Admin avec KPI
- `/admin/blog` - Gestion du blog
- `/admin/blog/new` - Nouvel article
- `/admin/blog/[id]/edit` - Édition article
- `/admin/reports` - Rapports et exports

## Développement

### Ajouter une nouvelle fonctionnalité

1. Créer les types dans `/lib/types`
2. Créer les schémas Zod dans `/lib/validations`
3. Créer les migrations SQL si nécessaire
4. Créer les services dans `/features/[domain]/services`
5. Créer les composants dans `/features/[domain]/components`
6. Créer les pages dans `/app/[route]`

### Hooks disponibles

- `useAuth()` - Gestion de l'authentification et du profil utilisateur
- `useProfile()` - Récupération du profil spécialisé (owner, tenant, provider)

### Helpers disponibles

- `formatCurrency()` - Formatage des montants en EUR
- `formatDate()` - Formatage des dates en français
- `formatFullName()` - Formatage du nom complet
- `canAccessAdmin()`, `canManageProperties()`, etc. - Vérification des permissions

## Déploiement

Le projet est prêt pour être déployé sur Vercel ou toute autre plateforme compatible Next.js.

### Variables d'environnement requises

**Obligatoires :**
- `NEXT_PUBLIC_SUPABASE_URL` - URL de votre projet Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clé anonyme Supabase

**Optionnelles (pour fonctionnalités avancées) :**
- `STRIPE_SECRET_KEY` - Pour les paiements en ligne
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Clé publique Stripe
- `RESEND_API_KEY` - Pour l'envoi d'emails (ou autre service)
- `SUPABASE_SERVICE_ROLE_KEY` - Pour les opérations admin côté serveur

## Documentation

Voir le fichier `.cursorrules` pour les guidelines de développement et l'architecture du projet.

