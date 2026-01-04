# Rapport Complet - Flux de Données et Utilisation

**Projet** : Gestion-Immo
**Date** : 4 janvier 2026
**Version** : 1.0

---

## Table des Matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Architecture Générale](#2-architecture-générale)
3. [Modèles de Données](#3-modèles-de-données)
4. [Sources et Configuration](#4-sources-et-configuration)
5. [Flux de Données Détaillés](#5-flux-de-données-détaillés)
6. [Gestion d'État](#6-gestion-détat)
7. [Sécurité des Données](#7-sécurité-des-données)
8. [Points d'Intégration Externes](#8-points-dintégration-externes)
9. [Cartographie des Fichiers Clés](#9-cartographie-des-fichiers-clés)
10. [Métriques et Indicateurs](#10-métriques-et-indicateurs)
11. [Recommandations](#11-recommandations)

---

## 1. Résumé Exécutif

### Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 14.x |
| Base de données | Supabase PostgreSQL | - |
| État client | Zustand | 5.0.8 |
| Cache serveur | TanStack React Query | 5.90.x |
| Validation | Zod | 3.25.x |
| Auth | Supabase Auth (OAuth2/JWT) | - |
| Runtime | Node.js | 20+ |

### Points Forts Identifiés

- ✅ Architecture multi-couche bien définie
- ✅ Type-safety complet (TypeScript + types auto-générés)
- ✅ Sécurité multi-niveaux (Auth + RBAC + RLS)
- ✅ Optimistic updates pour UX réactive
- ✅ Cache hybride (mémoire + localStorage)
- ✅ Audit logging intégré

### Points d'Attention

- ⚠️ 67+ routes API à maintenir
- ⚠️ Complexité du schéma (30+ tables)
- ⚠️ Dépendance forte à Supabase

---

## 2. Architecture Générale

### Diagramme de Flux Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR (CLIENT)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │ React Components │───▶│ Zustand Stores   │    │ React Query   │ │
│  │ (UI Layer)       │    │ (Local State)    │    │ (Server State)│ │
│  └────────┬─────────┘    └──────────────────┘    └───────┬───────┘ │
│           │                                               │         │
│           └───────────────────┬───────────────────────────┘         │
│                               ▼                                     │
│                    ┌──────────────────────┐                         │
│                    │ ApiClient            │                         │
│                    │ - Bearer token       │                         │
│                    │ - 20s timeout        │                         │
│                    │ - Retry logic        │                         │
│                    └──────────┬───────────┘                         │
└───────────────────────────────┼─────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER (Edge + Node)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Middleware (Edge Runtime)                                    │   │
│  │ - Cookie presence check                                      │   │
│  │ - Protected route detection                                  │   │
│  │ - Legacy redirects                                           │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
│                                 ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ API Route Handlers (/api/*)                                  │   │
│  │ 1. Authentication (getAuthenticatedUser)                     │   │
│  │ 2. Validation (Zod schemas)                                  │   │
│  │ 3. Authorization (RBAC checks)                               │   │
│  │ 4. Business logic                                            │   │
│  │ 5. Audit logging                                             │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
│                                 ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Supabase Clients                                             │   │
│  │ - User client (via cookies, respects RLS)                    │   │
│  │ - Service client (bypass RLS, admin ops)                     │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE / POSTGRESQL                           │
├─────────────────────────────────────────────────────────────────────┤
│  - Row-Level Security (RLS) policies                                │
│  - Multi-tenant data isolation                                      │
│  - Triggers & functions (PL/pgSQL)                                  │
│  - Storage buckets (documents, photos)                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Couches Applicatives

| Couche | Responsabilité | Fichiers Principaux |
|--------|----------------|---------------------|
| **Présentation** | UI, interactions utilisateur | `/app/**/page.tsx`, `/components/**` |
| **État Client** | Gestion état local | `/features/*/stores/*.ts` |
| **Cache Serveur** | Synchronisation données serveur | Hooks React Query |
| **Transport** | Communication HTTP | `/lib/api-client.ts` |
| **Middleware** | Protection routes, redirections | `/middleware.ts` |
| **API** | Endpoints REST | `/app/api/**/route.ts` |
| **Services** | Logique métier | `/features/*/services/*.ts` |
| **Persistance** | Base de données | Supabase + RLS |

---

## 3. Modèles de Données

### 3.1 Schéma Entités Principal

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    profiles     │       │   properties    │       │     rooms       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──┐   │ id (PK)         │◀──────│ id (PK)         │
│ user_id (FK)    │   │   │ owner_id (FK)───┼───────│ property_id(FK) │
│ role            │   │   │ type            │       │ type_piece      │
│ prenom          │   │   │ adresse_complete│       │ surface_m2      │
│ nom             │   │   │ code_postal     │       │ label_affiche   │
│ telephone       │   │   │ ville           │       └─────────────────┘
│ avatar_url      │   │   │ surface         │
│ date_naissance  │   │   │ nb_pieces       │       ┌─────────────────┐
└─────────────────┘   │   │ loyer_base      │       │     photos      │
                      │   │ charges         │       ├─────────────────┤
┌─────────────────┐   │   │ etat            │◀──────│ id (PK)         │
│  owner_profiles │   │   └─────────────────┘       │ property_id(FK) │
├─────────────────┤   │           │                 │ room_id (FK)    │
│ profile_id (FK)─┼───┘           │                 │ url             │
│ siret           │               │                 │ is_main         │
│ tva             │               ▼                 │ tag             │
│ iban            │   ┌─────────────────┐           └─────────────────┘
│ usage_strategie │   │     leases      │
└─────────────────┘   ├─────────────────┤
                      │ id (PK)         │
┌─────────────────┐   │ property_id(FK) │     ┌─────────────────┐
│ tenant_profiles │   │ unit_id (FK)    │     │ lease_signers   │
├─────────────────┤   │ type_bail       │     ├─────────────────┤
│ profile_id (FK)─┼───│ loyer           │◀────│ id (PK)         │
│ situation_pro   │   │ charges         │     │ lease_id (FK)   │
│ revenus         │   │ depot_garantie  │     │ profile_id (FK) │
│ nb_adultes      │   │ date_debut      │     │ role            │
│ nb_enfants      │   │ date_fin        │     │ signature_status│
└─────────────────┘   │ statut          │     └─────────────────┘
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐     ┌─────────────────┐
                      │    invoices     │     │    payments     │
                      ├─────────────────┤     ├─────────────────┤
                      │ id (PK)         │◀────│ id (PK)         │
                      │ lease_id (FK)   │     │ invoice_id (FK) │
                      │ owner_id (FK)   │     │ montant         │
                      │ tenant_id (FK)  │     │ moyen           │
                      │ periode         │     │ provider_ref    │
                      │ montant_total   │     │ statut          │
                      │ statut          │     └─────────────────┘
                      └─────────────────┘
```

### 3.2 Tables par Domaine Métier

#### Authentification & Profils
| Table | Description | Champs Clés |
|-------|-------------|-------------|
| `profiles` | Profil utilisateur principal | id, user_id, role, prenom, nom |
| `owner_profiles` | Extension propriétaire | siret, tva, iban, usage_strategie |
| `tenant_profiles` | Extension locataire | situation_pro, revenus, nb_adultes |
| `provider_profiles` | Extension prestataire | type_services, certifications |
| `guarantor_profiles` | Extension garant | relation, engagement_status |

#### Gestion Immobilière
| Table | Description | Champs Clés |
|-------|-------------|-------------|
| `properties` | Biens immobiliers | owner_id, type, adresse, loyer, etat |
| `rooms` | Pièces d'un bien | property_id, type_piece, surface |
| `photos` | Photos des biens | property_id, room_id, url, is_main |
| `units` | Unités (colocation) | property_id, nom, capacite_max |

#### Contrats & Finances
| Table | Description | Champs Clés |
|-------|-------------|-------------|
| `leases` | Baux de location | property_id, type_bail, loyer, statut |
| `lease_signers` | Signataires du bail | lease_id, profile_id, signature_status |
| `invoices` | Factures/quittances | lease_id, periode, montant_total, statut |
| `payments` | Paiements reçus | invoice_id, montant, moyen, statut |
| `charges` | Charges récurrentes | property_id, type, montant, periodicite |

#### Gestion Courante
| Table | Description | Champs Clés |
|-------|-------------|-------------|
| `tickets` | Tickets de support | property_id, titre, priorite, statut |
| `work_orders` | Ordres d'intervention | ticket_id, provider_id, cout, statut |
| `documents` | Documents stockés | type, owner_id, storage_path |
| `notifications` | Notifications utilisateur | user_id, type, read_at |

#### Copropriété
| Table | Description | Champs Clés |
|-------|-------------|-------------|
| `copro_sites` | Sites de copropriété | name, siret, syndic_type |
| `copro_buildings` | Bâtiments | site_id, building_type, floors |
| `copro_units` | Lots | building_id, unit_type, tantieme |
| `copro_charges` | Charges copro | site_id, type, montant_total |
| `copro_assemblies` | AG | site_id, date, type, status |

### 3.3 Types TypeScript Principaux

**Fichier source** : `/lib/supabase/database.types.ts`

```typescript
// Types auto-générés depuis Supabase
type UserRole = "admin" | "owner" | "tenant" | "provider" | "guarantor"
type LeaseStatus = "draft" | "pending_signature" | "active" | "terminated"
type PropertyStatus = "draft" | "pending" | "published" | "rejected" | "archived"
type InvoiceStatus = "draft" | "sent" | "paid" | "late"
type TicketPriority = "basse" | "normale" | "haute"

interface Profile {
  id: string
  user_id: string
  role: UserRole
  prenom: string | null
  nom: string | null
  telephone: string | null
  avatar_url: string | null
  date_naissance: string | null
  created_at: string
  updated_at: string
}

interface Property {
  id: string
  owner_id: string
  type: string
  adresse_complete: string
  code_postal: string
  ville: string
  surface: number
  nb_pieces: number
  loyer_base: number
  charges_mensuelles: number
  etat: PropertyStatus
}

interface Lease {
  id: string
  property_id: string | null
  unit_id: string | null
  type_bail: string
  loyer: number
  charges_forfaitaires: number
  depot_de_garantie: number
  date_debut: string
  date_fin: string | null
  statut: LeaseStatus
}
```

---

## 4. Sources et Configuration

### 4.1 Configuration Supabase

#### Fichiers de Configuration

| Fichier | Rôle |
|---------|------|
| `/lib/supabase/config.ts` | Validation et cache des variables d'environnement |
| `/lib/supabase/client.ts` | Client navigateur (singleton) |
| `/lib/supabase/server.ts` | Client serveur (async, cookies) |
| `/lib/supabase/service-client.ts` | Client admin (bypass RLS) |
| `/lib/supabase/database.types.ts` | Types TypeScript auto-générés |
| `/lib/supabase/typed-client.ts` | Types clients typés |

#### Client Navigateur (`/lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from "@supabase/ssr"
import { Database } from "./database.types"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### Client Serveur (`/lib/supabase/server.ts`)

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => { /* ... */ }
      }
    }
  )
}
```

### 4.2 Variables d'Environnement

#### Variables Publiques (Client)
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
NEXT_PUBLIC_SENTRY_DSN=[sentry-dsn]
```

#### Variables Privées (Serveur)
```env
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
RESEND_API_KEY=[resend-key]
TWILIO_ACCOUNT_SID=[twilio-sid]
TWILIO_AUTH_TOKEN=[twilio-token]
YOUSIGN_API_KEY=[yousign-key]
```

### 4.3 Migrations Supabase

**Emplacement** : `/supabase/migrations/`

| Migration | Contenu |
|-----------|---------|
| `20240101000000_initial_schema.sql` | Tables core (profiles, properties, leases) |
| `20240101000001_rls_policies.sql` | Politiques Row-Level Security |
| `20240101000002_functions.sql` | Fonctions PL/pgSQL (triggers, helpers) |
| `20240101000003_storage_bucket.sql` | Buckets stockage (documents, photos) |
| `20240101000007_admin_architecture.sql` | Tables admin, audit_log |
| `20240101000009_tenant_advanced.sql` | Tables métier avancées |

---

## 5. Flux de Données Détaillés

### 5.1 ApiClient - Couche Transport

**Fichier** : `/lib/api-client.ts`

Le `ApiClient` est le point d'entrée unique pour toutes les communications HTTP :

```typescript
export class ApiClient {
  // Configuration
  private API_BASE = '/api'
  private TIMEOUT = 20000  // 20 secondes

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    // 1. Récupérer la session Supabase
    const { data: { session } } = await supabase.auth.getSession()

    // 2. Gérer les erreurs de refresh token
    if (sessionError?.includes('refresh_token')) {
      await supabase.auth.signOut()
      redirect('/auth/signin?error=session_expired')
    }

    // 3. Attacher le Bearer token
    headers.set('Authorization', `Bearer ${session.access_token}`)

    // 4. Exécuter avec timeout
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 20000)

    // 5. Gérer les erreurs HTTP
    if (!response.ok) {
      // 404 → ResourceNotFoundError
      // 400 → Validation error
      // 504 → Timeout error
    }

    return response.json()
  }

  // Méthodes publiques
  get<T>(endpoint: string): Promise<T>
  post<T>(endpoint: string, data?: any): Promise<T>
  put<T>(endpoint: string, data?: any): Promise<T>
  patch<T>(endpoint: string, data?: any): Promise<T>
  delete<T>(endpoint: string): Promise<T>
  uploadFile<T>(endpoint: string, formData: FormData): Promise<T>
}
```

### 5.2 Middleware - Protection des Routes

**Fichier** : `/middleware.ts`

```typescript
// Routes publiques (pas de vérification)
const publicRoutes = [
  "/", "/auth/signin", "/auth/signup", "/pricing", "/blog", "/legal"
]

// Routes protégées (nécessitent authentification)
const protectedPaths = [
  "/tenant", "/owner", "/provider", "/admin",
  "/copro", "/messages", "/settings"
]

export function middleware(request: NextRequest) {
  // 1. Laisser passer assets et routes publiques
  if (isPublic(pathname)) return NextResponse.next()

  // 2. Vérifier présence cookie auth
  const hasAuthCookie = cookies.some(c =>
    c.name.includes("auth-token") || c.name.startsWith("sb-")
  )

  // 3. Rediriger si non authentifié
  if (isProtected && !hasAuthCookie) {
    return NextResponse.redirect("/auth/signin?redirect=" + pathname)
  }
}
```

### 5.3 Exemple de Flux Complet : Lecture d'une Propriété

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. COMPOSANT UI                                                     │
│    const { data: property } = useProperty(propertyId)               │
│    └── React Query hook avec queryKey: ["property", id]             │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. API CLIENT                                                       │
│    apiClient.get<Property>(`/properties/${id}`)                     │
│    └── Attache Bearer token automatiquement                         │
│    └── Timeout 20s, retry logic                                     │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ GET /api/properties/[id]
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ROUTE HANDLER (/app/api/properties/[id]/route.ts)                │
│    a) Validation: propertyIdSchema.parse(params.id)                 │
│    b) Auth: const { user, profile } = await getAuthenticatedUser()  │
│    c) Permission: canViewProperty(profile, propertyId)              │
│    d) Query: supabase.from("properties").select("*").eq("id", id)   │
│    e) Return: NextResponse.json({ property })                       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. SUPABASE + RLS                                                   │
│    - Vérifie RLS policy: auth.uid() = owner_id OR role = 'admin'    │
│    - Exécute la requête SQL                                         │
│    - Retourne les données                                           │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. RETOUR AU CLIENT                                                 │
│    - React Query met en cache (staleTime: 30s)                      │
│    - Composant re-render avec property                              │
│    - Zustand store optionnellement mis à jour                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Exemple de Flux Mutation : Création de Propriété

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. WIZARD STORE (Zustand)                                           │
│    usePropertyWizardStore.initializeDraft('appartement')            │
│    └── syncStatus = 'saving'                                        │
│    └── Optimistic update local                                      │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MUTATION                                                         │
│    useMutation({                                                    │
│      mutationFn: () => apiClient.post("/properties/init", data),    │
│      onSuccess: (result) => {                                       │
│        setPropertyId(result.id)                                     │
│        syncStatus = 'saved'                                         │
│      },                                                             │
│      onError: () => {                                               │
│        syncStatus = 'error'                                         │
│        rollback()                                                   │
│      }                                                              │
│    })                                                               │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ POST /api/properties/init
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ROUTE HANDLER                                                    │
│    a) Validation: propertyCreateSchema.parse(body)                  │
│    b) Auth check: requireRole(profile, ['owner', 'admin'])          │
│    c) Insert: supabase.from("properties").insert({                  │
│         owner_id: profile.id,                                       │
│         type: 'appartement',                                        │
│         etat: 'draft'                                               │
│       })                                                            │
│    d) Audit: logAction('property.created', propertyId)              │
│    e) Return: { propertyId, status: 'draft' }                       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. INVALIDATION CACHE                                               │
│    queryClient.invalidateQueries(['properties'])                    │
│    └── Force refresh de la liste                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.5 Routes API - Cartographie Complète

**Emplacement** : `/app/api/`

#### Authentification
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/2fa/enable` | POST | Activer 2FA |
| `/api/auth/2fa/verify` | POST | Vérifier code 2FA |
| `/api/auth/2fa/disable` | POST | Désactiver 2FA |

#### Propriétés
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/properties` | GET | Liste des propriétés |
| `/api/properties/init` | POST | Créer brouillon |
| `/api/properties/[id]` | GET/PUT/DELETE | CRUD propriété |
| `/api/properties/[id]/photos` | GET/POST | Gestion photos |
| `/api/properties/[id]/rooms` | GET/POST | Gestion pièces |
| `/api/properties/[id]/heating` | GET/PUT | Chauffage |
| `/api/owner/properties` | GET | Props du propriétaire |

#### Baux
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/leases` | GET/POST | Liste et création |
| `/api/leases/[id]` | GET/PUT/DELETE | CRUD bail |
| `/api/leases/[id]/signers` | GET/POST | Signataires |
| `/api/leases/[id]/sign` | POST | Signer le bail |

#### Facturation
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/invoices` | GET/POST | Factures |
| `/api/invoices/[id]` | GET/PUT | Détail facture |
| `/api/invoices/[id]/payments` | GET/POST | Paiements |
| `/api/invoices/[id]/preview` | GET | Aperçu PDF |

#### Support
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/tickets` | GET/POST | Tickets support |
| `/api/tickets/[id]` | GET/PUT | Détail ticket |
| `/api/tickets/[id]/work-orders` | POST | Créer intervention |

#### Webhooks Externes
| Endpoint | Description |
|----------|-------------|
| `/api/webhooks/stripe` | Événements Stripe |
| `/api/webhooks/yousign` | Signatures YouSign |
| `/api/webhooks/resend` | Emails Resend |

---

## 6. Gestion d'État

### 6.1 Architecture État

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GESTION D'ÉTAT                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ZUSTAND (État Local)                                         │   │
│  │ - Forms en cours (wizard)                                    │   │
│  │ - UI state (modals, tabs)                                    │   │
│  │ - Draft data (non persisté)                                  │   │
│  │ - Persist middleware (localStorage)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ REACT QUERY (État Serveur)                                   │   │
│  │ - Données fetchées (properties, leases, invoices)            │   │
│  │ - Cache intelligent (staleTime, gcTime)                      │   │
│  │ - Mutations avec optimistic updates                          │   │
│  │ - Invalidation automatique                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ CACHE HYBRIDE                                                │   │
│  │ - L1: Mémoire (5 min TTL)                                    │   │
│  │ - L2: localStorage (24h TTL)                                 │   │
│  │ - Clés préfixées: "gestion-immo:"                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Zustand Store Exemple

**Fichier** : `/features/properties/stores/wizard-store.ts`

```typescript
interface WizardState {
  // État
  propertyId: string | null
  currentStep: WizardStep
  mode: 'create' | 'edit'
  syncStatus: 'idle' | 'saving' | 'saved' | 'error'
  formData: Partial<Property>
  rooms: Room[]
  photos: Photo[]
  pendingPhotoUrls: string[]

  // Actions
  reset(): void
  initializeDraft(type: PropertyType): Promise<void>
  loadProperty(id: string): Promise<void>
  updateFormData(updates: Partial<Property>): void
  addRoom(room: Partial<Room>): void
  updateRoom(id: string, updates: Partial<Room>): void
  removeRoom(id: string): void
  setPhotos(photos: Photo[]): void
  setStep(step: WizardStep): void
  nextStep(): void
  prevStep(): void
}

const usePropertyWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      propertyId: null,
      currentStep: 'type',
      syncStatus: 'idle',
      formData: {},
      rooms: [],
      photos: [],

      updateFormData: (updates) => {
        set((state) => ({
          formData: { ...state.formData, ...updates },
          syncStatus: 'saving'
        }))
        // Sync to server in background
        debouncedSync(get().propertyId, updates)
      },

      // ... autres actions
    }),
    { name: "property-wizard" }
  )
)
```

### 6.3 React Query Configuration

```typescript
// Configuration globale
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // Données fraîches pendant 30s
      gcTime: 5 * 60_000,       // Cache gardé 5 min
      retry: (count, error) => {
        if (isAuthError(error)) return false
        return count < 1
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    }
  }
})

// Exemple de hook
function useProperties() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['properties', profile?.id],
    queryFn: () => apiClient.get('/owner/properties'),
    enabled: !!profile,
  })
}

// Exemple de mutation avec optimistic update
function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => apiClient.post('/properties', data),
    onMutate: async (newProperty) => {
      await queryClient.cancelQueries(['properties'])
      const previous = queryClient.getQueryData(['properties'])
      queryClient.setQueryData(['properties'], (old) => [...old, newProperty])
      return { previous }
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['properties'], context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['properties'])
    }
  })
}
```

### 6.4 Hooks Métier Disponibles

| Hook | Description | Query Key |
|------|-------------|-----------|
| `useAuth()` | Utilisateur et profil courant | - |
| `useProperties()` | Propriétés du propriétaire | `['properties', userId]` |
| `useProperty(id)` | Détail d'une propriété | `['property', id]` |
| `useLeases()` | Baux de l'utilisateur | `['leases', userId]` |
| `useLease(id)` | Détail d'un bail | `['lease', id]` |
| `useInvoices()` | Factures | `['invoices', userId]` |
| `useTickets()` | Tickets support | `['tickets', userId]` |
| `useDocuments()` | Documents | `['documents', userId]` |
| `useNotifications()` | Notifications | `['notifications']` |

---

## 7. Sécurité des Données

### 7.1 Architecture de Sécurité Multi-Couche

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SÉCURITÉ MULTI-NIVEAUX                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NIVEAU 1: TRANSPORT                                                │
│  └── HTTPS obligatoire                                              │
│  └── Headers sécurisés (CSP, X-Frame-Options)                       │
│                                                                     │
│  NIVEAU 2: AUTHENTIFICATION                                         │
│  └── Supabase Auth (OAuth2 + JWT)                                   │
│  └── Cookies httpOnly                                               │
│  └── 2FA optionnel                                                  │
│  └── Refresh token rotation                                         │
│                                                                     │
│  NIVEAU 3: AUTORISATION (RBAC)                                      │
│  └── Rôles: admin, owner, tenant, provider, guarantor               │
│  └── Vérification dans chaque route API                             │
│  └── Middleware Edge pour routes protégées                          │
│                                                                     │
│  NIVEAU 4: ROW-LEVEL SECURITY (RLS)                                 │
│  └── Policies Supabase par table                                    │
│  └── Isolation multi-tenant                                         │
│  └── Bypass uniquement via service role                             │
│                                                                     │
│  NIVEAU 5: VALIDATION                                               │
│  └── Zod schemas (client + serveur)                                 │
│  └── Sanitization des entrées                                       │
│  └── Contraintes PostgreSQL                                         │
│                                                                     │
│  NIVEAU 6: AUDIT                                                    │
│  └── Table audit_log                                                │
│  └── Triggers PostgreSQL                                            │
│  └── Traçabilité complète                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Authentification Supabase

```typescript
// Hook d'authentification
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Récupérer l'utilisateur depuis le JWT
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchProfile(user.id)
    })

    // Écouter les changements d'état
    const { subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    signOut: () => supabase.auth.signOut()
  }
}
```

### 7.3 RBAC - Contrôle d'Accès par Rôle

**Fichier** : `/lib/helpers/permissions.ts`

```typescript
type UserRole = "admin" | "owner" | "tenant" | "provider" | "guarantor"

// Permissions par rôle
const rolePermissions = {
  admin: ['*'],  // Tout
  owner: ['properties:*', 'leases:*', 'invoices:*', 'tickets:*'],
  tenant: ['properties:read', 'leases:read', 'invoices:read', 'tickets:create'],
  provider: ['work_orders:*', 'tickets:read'],
  guarantor: ['leases:read', 'engagements:*']
}

// Helpers
export function canAccessAdmin(role: UserRole): boolean {
  return role === "admin"
}

export function canManageProperties(role: UserRole): boolean {
  return role === "admin" || role === "owner"
}

export function canViewProperty(role: UserRole, isOwner: boolean, isLeaseTenant: boolean): boolean {
  if (role === "admin") return true
  if (role === "owner" && isOwner) return true
  if (role === "tenant" && isLeaseTenant) return true
  return false
}
```

### 7.4 RLS Policies Supabase

```sql
-- Properties: Propriétaire peut voir ses biens
CREATE POLICY "owner_can_view_own_properties"
ON properties FOR SELECT
USING (
  auth.uid() = owner_id
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin'
);

-- Leases: Locataire peut voir ses baux actifs
CREATE POLICY "tenant_can_view_active_leases"
ON leases FOR SELECT
USING (
  auth.uid() IN (
    SELECT p.user_id FROM lease_signers ls
    JOIN profiles p ON p.id = ls.profile_id
    WHERE ls.lease_id = leases.id
  )
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin'
);

-- Invoices: Seules les parties concernées
CREATE POLICY "invoice_access"
ON invoices FOR SELECT
USING (
  auth.uid() IN (owner_id, tenant_id)
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin'
);

-- Documents: Accès restreint au propriétaire
CREATE POLICY "document_owner_access"
ON documents FOR ALL
USING (owner_id = auth.uid() OR tenant_id = auth.uid());
```

### 7.5 Validation Zod

**Fichier** : `/lib/validations/`

```typescript
// Validation profil
export const profileUpdateSchema = z.object({
  prenom: z.string().min(1).max(80).optional(),
  nom: z.string().min(1).max(80).optional(),
  telephone: z.string().regex(/^\+?[0-9]{9,15}$/).optional(),
  date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

// Validation propriété
export const propertySchema = z.object({
  type: z.enum(['appartement', 'maison', 'studio', 'local', 'parking']),
  adresse_complete: z.string().min(5).max(255),
  code_postal: z.string().regex(/^\d{5}$/),
  ville: z.string().min(1).max(100),
  surface: z.number().positive().max(10000),
  nb_pieces: z.number().int().min(1).max(50),
  loyer_base: z.number().positive().max(100000),
  charges_mensuelles: z.number().min(0).max(10000)
})

// Validation bail
export const leaseSchema = z.object({
  type_bail: z.enum(['nu', 'meuble', 'colocation', 'saisonnier', 'bail_mobilite']),
  loyer: z.number().positive(),
  charges_forfaitaires: z.number().min(0),
  depot_de_garantie: z.number().min(0),
  date_debut: z.string().datetime(),
  date_fin: z.string().datetime().optional()
})
```

### 7.6 Checklist Sécurité

| Aspect | Implémentation | Status |
|--------|----------------|--------|
| Authentification | Supabase Auth (OAuth2/JWT) | ✅ |
| Sessions | httpOnly cookies + refresh | ✅ |
| 2FA | TOTP optionnel | ✅ |
| RBAC | 5 rôles + permissions | ✅ |
| RLS | Policies par table | ✅ |
| Validation client | Zod + React Hook Form | ✅ |
| Validation serveur | Zod dans route handlers | ✅ |
| CSRF | Token validation | ✅ |
| XSS | React escape + CSP | ✅ |
| SQL Injection | Supabase paramétré | ✅ |
| Audit | Table audit_log + triggers | ✅ |
| Rate limiting | Basic in-memory | ⚠️ |
| Secrets | Env vars séparés | ✅ |

---

## 8. Points d'Intégration Externes

### 8.1 Services Tiers

| Service | Usage | Endpoint Webhook |
|---------|-------|------------------|
| **Stripe** | Paiements & abonnements | `/api/webhooks/stripe` |
| **Resend** | Emails transactionnels | `/api/webhooks/resend` |
| **Twilio** | SMS notifications | - |
| **YouSign** | Signature électronique | `/api/webhooks/yousign` |
| **Sentry** | Error tracking | - |
| **PostHog** | Analytics | - |
| **France Identité** | Vérification identité | - |

### 8.2 Flux Stripe - Paiements

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. LOCATAIRE INITIE PAIEMENT                                       │
│    Component: StripeCheckout                                        │
│    → POST /api/payments/create-intent { invoiceId, amount }         │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. API CRÉE PAYMENT INTENT                                          │
│    stripe.paymentIntents.create({                                   │
│      amount: 95000,  // 950€ en centimes                            │
│      currency: 'eur',                                               │
│      metadata: { invoiceId, tenantId, ownerId }                     │
│    })                                                               │
│    → Return { clientSecret }                                        │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. CLIENT CONFIRME PAIEMENT                                         │
│    stripe.confirmCardPayment(clientSecret, { card })                │
│    → Stripe traite le paiement                                      │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. WEBHOOK STRIPE                                                   │
│    POST /api/webhooks/stripe                                        │
│    Event: payment_intent.succeeded                                  │
│    → INSERT payments (invoice_id, montant, statut='succeeded')      │
│    → UPDATE invoices SET statut='paid'                              │
│    → NOTIFY owner "Paiement reçu"                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Flux YouSign - Signature Électronique

```
1. Propriétaire crée bail → POST /api/leases (statut='draft')
2. Ajoute signataires → POST /api/leases/{id}/signers
3. Initie signature → POST /api/yousign/procedures
   → YouSign crée procédure + envoie emails
4. Signataire signe → Interface YouSign
5. Webhook → POST /api/webhooks/yousign
   → UPDATE lease_signers SET signature_status='signed'
   → Si tous signés: UPDATE leases SET statut='active'
```

---

## 9. Cartographie des Fichiers Clés

### 9.1 Infrastructure

| Fichier | Rôle |
|---------|------|
| `/lib/supabase/client.ts` | Client Supabase navigateur |
| `/lib/supabase/server.ts` | Client Supabase serveur (SSR) |
| `/lib/supabase/service-client.ts` | Client admin (bypass RLS) |
| `/lib/supabase/database.types.ts` | Types auto-générés |
| `/lib/api-client.ts` | Client HTTP unifié |
| `/middleware.ts` | Protection routes Edge |

### 9.2 État & Cache

| Fichier | Rôle |
|---------|------|
| `/features/properties/stores/wizard-store.ts` | Store wizard propriété |
| `/lib/cache/client-cache.ts` | Cache hybride mémoire/localStorage |
| `/lib/hooks/use-auth.ts` | Hook authentification |
| `/lib/hooks/use-properties.ts` | Hook React Query propriétés |
| `/components/providers/query-provider.tsx` | Provider React Query |

### 9.3 Validation & Types

| Fichier | Rôle |
|---------|------|
| `/lib/types/index.ts` | Types métier principaux |
| `/lib/types/property-v3.ts` | Types propriété étendus |
| `/lib/validations/index.ts` | Schemas Zod |
| `/lib/api/schemas.ts` | Schemas API |

### 9.4 Sécurité

| Fichier | Rôle |
|---------|------|
| `/lib/helpers/auth-helper.ts` | Helpers authentification |
| `/lib/helpers/permissions.ts` | RBAC helpers |
| `/lib/security/csrf.ts` | Protection CSRF |
| `/lib/rbac.ts` | Mapping rôles → permissions |

### 9.5 Services Métier

| Fichier | Domaine |
|---------|---------|
| `/features/properties/services/properties.service.ts` | Propriétés |
| `/features/leases/services/leases.service.ts` | Baux |
| `/features/invoices/services/invoices.service.ts` | Factures |
| `/features/tickets/services/tickets.service.ts` | Support |
| `/features/documents/services/documents.service.ts` | Documents |

---

## 10. Métriques et Indicateurs

### 10.1 Volume de Code

| Catégorie | Nombre |
|-----------|--------|
| Routes API | 67+ endpoints |
| Tables Supabase | 30+ tables |
| Composants React | 200+ fichiers |
| Hooks personnalisés | 30+ hooks |
| Services métier | 20+ services |
| Schemas Zod | 150+ schemas |

### 10.2 Couverture Fonctionnelle

| Module | Complétude | Notes |
|--------|------------|-------|
| Authentification | 95% | 2FA, OAuth, refresh |
| Gestion propriétés | 90% | CRUD complet, wizard |
| Baux | 85% | Signature multi-parties |
| Facturation | 80% | Stripe intégré |
| Support tickets | 75% | Work orders |
| Copropriété | 70% | Module en développement |
| IA/Assistant | 60% | Tom assistant |

### 10.3 Performance

| Métrique | Valeur | Cible |
|----------|--------|-------|
| Timeout API | 20s | < 10s |
| Cache staleTime | 30s | OK |
| Retry count | 1 | OK |
| Bundle size | À mesurer | < 500KB |

---

## 11. Recommandations

### 11.1 Améliorations Prioritaires

1. **Rate Limiting Renforcé**
   - Implémenter rate limiting Redis/Upstash
   - Protéger endpoints sensibles (auth, payments)

2. **Monitoring & Observabilité**
   - Dashboard métriques API (latence, erreurs)
   - Alerting sur anomalies

3. **Tests E2E**
   - Couvrir flux critiques (paiement, signature)
   - CI/CD avec tests automatisés

4. **Documentation API**
   - OpenAPI/Swagger spec
   - Documentation développeur

### 11.2 Optimisations Suggérées

1. **Cache Serveur**
   - Implémenter cache Redis pour données fréquentes
   - Réduire appels Supabase

2. **Bundle Splitting**
   - Lazy loading modules lourds (PDF, signature)
   - Optimiser imports

3. **Real-time**
   - Implémenter Supabase Realtime pour notifications
   - WebSocket pour chat/messaging

### 11.3 Dette Technique Identifiée

| Item | Priorité | Effort |
|------|----------|--------|
| Tests unitaires services | Haute | Moyen |
| Refactor legacy redirects | Moyenne | Faible |
| Consolidation types v3 | Moyenne | Moyen |
| Rate limiting production | Haute | Moyen |

---

## Conclusion

Le projet **Gestion-Immo** présente une architecture solide et bien structurée pour une application de gestion immobilière. Les flux de données sont clairement définis avec une séparation nette des responsabilités entre les différentes couches.

**Points forts** :
- Architecture multi-couche claire
- Sécurité robuste (Auth + RBAC + RLS)
- Type-safety complète
- State management moderne (Zustand + React Query)

**Axes d'amélioration** :
- Renforcer le monitoring
- Améliorer la couverture de tests
- Optimiser les performances (cache, bundle)

---

*Rapport généré le 4 janvier 2026*
