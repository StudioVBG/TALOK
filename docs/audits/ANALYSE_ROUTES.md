# 📊 Analyse Complète des Routes - Talok

## 🔑 Rôles Identifiés
1. **OWNER** (Propriétaire) - `/owner/*`
2. **TENANT** (Locataire) - `/tenant/*`
3. **PROVIDER** (Prestataire) - `/provider/*`
4. **ADMIN** (Administrateur) - `/admin/*`
5. **SYNDIC** (Syndic copropriété) - `/syndic/*`
6. **GUARANTOR** (Garant) - `/guarantor/*`
7. **COPRO** (Copropriétaire) - `/copro/*`

---

## 🏠 PROPRIÉTAIRE (OWNER) - 35 pages

### Pages Principales
| Route | Description | API Utilisée | Statut |
|-------|-------------|--------------|--------|
| `/owner/dashboard` | Tableau de bord | `GET /api/owner/dashboard` | ⚠️ À vérifier |
| `/owner/properties` | Liste des biens | `GET /api/owner/properties` | ✅ OK |
| `/owner/properties/[id]` | Détail d'un bien | `fetchPropertyDetails()` | ✅ CORRIGÉ |
| `/owner/properties/[id]/edit` | Édition d'un bien | `PATCH /api/properties/[id]` | ✅ OK |
| `/owner/properties/new` | Créer un bien | `POST /api/properties/init` | ✅ OK |
| `/owner/leases` | Liste des baux | `GET /api/leases` | ⚠️ À vérifier |
| `/owner/leases/[id]` | Détail d'un bail | `GET /api/leases/[id]` | ⚠️ À vérifier |
| `/owner/leases/new` | Créer un bail | `POST /api/leases` | ⚠️ À vérifier |
| `/owner/tenants` | Liste des locataires | Direct Supabase | ⚠️ À vérifier |
| `/owner/tickets` | Liste des tickets | `GET /api/tickets` | ⚠️ RLS Issue |
| `/owner/tickets/[id]` | Détail ticket | `GET /api/tickets/[id]` | ❌ 403 Error |
| `/owner/tickets/new` | Nouveau ticket | `POST /api/tickets` | ✅ OK |
| `/owner/money` | Finances | `GET /api/invoices` | ⚠️ À vérifier |
| `/owner/documents` | Documents | `useDocuments()` hook | ⚠️ À vérifier |
| `/owner/inspections` | États des lieux | `GET /api/edl` | ⚠️ À vérifier |
| `/owner/end-of-lease` | Fin de bail | `GET /api/end-of-lease` | ❌ Function missing |
| `/owner/providers` | Prestataires | `GET /api/providers/search` | ⚠️ À vérifier |
| `/owner/profile` | Profil | `GET /api/me/profile` | ⚠️ À vérifier |

### APIs Owner Dédiées
```
/api/owner/dashboard     → GET dashboard data
/api/owner/properties    → GET owner properties (with media)
```

---

## 🏢 LOCATAIRE (TENANT) - 20 pages

### Pages Principales
| Route | Description | API Utilisée | Statut |
|-------|-------------|--------------|--------|
| `/tenant/dashboard` | Tableau de bord | `fetchTenantLease()` | ✅ CORRIGÉ |
| `/tenant/lease` | Mon bail | `fetchTenantLease()` | ✅ CORRIGÉ |
| `/tenant/payments` | Paiements | `GET /api/invoices` | ⚠️ À vérifier |
| `/tenant/documents` | Documents | `useDocuments()` hook | ⚠️ RLS Issue |
| `/tenant/requests` | Mes demandes | `GET /api/tickets` | ⚠️ À vérifier |
| `/tenant/requests/new` | Nouvelle demande | `POST /api/tickets` | ⚠️ À vérifier |
| `/tenant/meters` | Relevés compteurs | `GET /api/meters/readings` | ⚠️ À vérifier |
| `/tenant/colocation` | Colocation | Direct Supabase | ⚠️ À vérifier |
| `/tenant/identity` | Identité | `GET /api/tenant/identity` | ⚠️ À vérifier |
| `/tenant/signatures` | Signatures | `GET /api/tenant/pending-signatures` | ⚠️ À vérifier |
| `/tenant/settings` | Paramètres | `GET /api/me/profile` | ⚠️ À vérifier |

### APIs Tenant Dédiées
```
/api/tenant/identity/upload        → Upload CNI
/api/tenant/pending-signatures     → Get pending signatures
/api/tenant/signature-link         → Get signature link
```

---

## 🔧 PRESTATAIRE (PROVIDER) - 15 pages

### Pages Principales
| Route | Description | API Utilisée | Statut |
|-------|-------------|--------------|--------|
| `/provider/dashboard` | Tableau de bord | `GET /api/provider/dashboard` | ⚠️ À vérifier |
| `/provider/jobs` | Missions | `GET /api/work-orders` | ⚠️ À vérifier |
| `/provider/quotes` | Devis | `GET /api/provider/quotes` | ⚠️ À vérifier |
| `/provider/quotes/new` | Nouveau devis | `POST /api/provider/quotes` | ⚠️ À vérifier |
| `/provider/invoices` | Factures | `GET /api/provider/invoices` | ⚠️ À vérifier |
| `/provider/calendar` | Calendrier | Direct Supabase | ⚠️ À vérifier |
| `/provider/portfolio` | Portfolio | `GET /api/provider/portfolio` | ⚠️ À vérifier |
| `/provider/compliance` | Conformité | `GET /api/provider/compliance/status` | ⚠️ À vérifier |
| `/provider/reviews` | Avis | Direct Supabase | ⚠️ À vérifier |

### APIs Provider Dédiées
```
/api/provider/dashboard            → GET dashboard stats
/api/provider/quotes               → CRUD devis
/api/provider/invoices             → CRUD factures
/api/provider/jobs/[id]/status     → Update job status
/api/provider/compliance/*         → Documents conformité
/api/provider/portfolio            → Portfolio photos
```

---

## 👑 ADMIN - 15 pages

### Pages Principales
| Route | Description | API Utilisée | Statut |
|-------|-------------|--------------|--------|
| `/admin/dashboard` | Dashboard admin | `GET /api/admin/overview` | ⚠️ À vérifier |
| `/admin/properties` | Tous les biens | `GET /api/admin/properties` | ⚠️ À vérifier |
| `/admin/properties/[id]` | Détail bien | `GET /api/admin/properties/[id]` | ⚠️ À vérifier |
| `/admin/people` | Annuaire | `GET /api/admin/people/*` | ⚠️ À vérifier |
| `/admin/tenants` | Locataires | `GET /api/admin/people/tenants` | ⚠️ À vérifier |
| `/admin/plans` | Plans tarifaires | `GET /api/admin/plans` | ⚠️ À vérifier |
| `/admin/integrations` | Intégrations | `GET /api/admin/integrations/*` | ⚠️ À vérifier |
| `/admin/moderation` | Modération | `GET /api/admin/moderation/*` | ⚠️ À vérifier |
| `/admin/compliance` | Conformité | `GET /api/admin/compliance/*` | ⚠️ À vérifier |
| `/admin/blog` | Blog | Direct Supabase | ⚠️ À vérifier |

### APIs Admin Dédiées (60+)
```
/api/admin/overview                → Stats globales
/api/admin/properties/*            → Gestion propriétés
/api/admin/people/owners/*         → Gestion propriétaires
/api/admin/people/tenants/*        → Gestion locataires
/api/admin/people/vendors/*        → Gestion prestataires
/api/admin/plans/*                 → Gestion plans
/api/admin/subscriptions/*         → Gestion abonnements
/api/admin/integrations/*          → Gestion intégrations
/api/admin/compliance/*            → Vérification conformité
/api/admin/moderation/*            → Modération contenu
/api/admin/api-keys/*              → Gestion clés API
/api/admin/api-costs               → Coûts API
```

---

## 🏛️ SYNDIC - 12 pages

### Pages Principales
| Route | Description | API Utilisée |
|-------|-------------|--------------|
| `/syndic/dashboard` | Dashboard | `GET /api/syndic/dashboard` |
| `/syndic/sites` | Copropriétés | `GET /api/copro/sites` |
| `/syndic/assemblies` | AG | `GET /api/copro/assemblies` |
| `/syndic/invites` | Invitations | `GET /api/copro/invites` |

---

## 🤝 GARANT (GUARANTOR) - 6 pages

### Pages Principales
| Route | Description | API Utilisée |
|-------|-------------|--------------|
| `/guarantor/dashboard` | Dashboard | `GET /api/guarantors/dashboard` |
| `/guarantor/documents` | Documents | `GET /api/guarantors/documents` |
| `/guarantor/profile` | Profil | `GET /api/guarantors/me` |

---

## 🔓 PAGES PUBLIQUES

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/signin` | Connexion |
| `/auth/signup` | Inscription |
| `/auth/forgot-password` | Mot de passe oublié |
| `/auth/reset-password` | Réinitialisation MDP |
| `/auth/verify-email` | Vérification email |
| `/pricing` | Tarifs |
| `/blog` | Blog public |
| `/legal/terms` | CGU |
| `/legal/privacy` | Politique vie privée |
| `/signature/[token]` | Signature bail |
| `/invite/[token]` | Invitation locataire |
| `/properties/share/[token]` | Partage propriété |
| `/rejoindre-logement` | Rejoindre un logement |

---

## ❌ PROBLÈMES DÉTECTÉS

### 1. **fetchPropertyDetails** - ✅ CORRIGÉ
- **Problème**: SELECT explicite avec colonnes inexistantes (`visite_virtuelle_url`)
- **Solution**: Remplacé par `SELECT *`

### 2. **Notifications** - ✅ CORRIGÉ  
- **Problème**: Colonne `recipient_id` vs `user_id`
- **Solution**: Hook modifié pour utiliser `user_id`

### 3. **WebSocket CSP** - ✅ CORRIGÉ
- **Problème**: `wss://` bloqué par CSP
- **Solution**: Ajouté `wss://*.supabase.co` dans CSP

### 4. **Tickets RLS** - ❌ À CORRIGER
- **Problème**: 403 Forbidden sur `/api/tickets/[id]`
- **Cause**: Politique RLS trop restrictive
- **Solution**: Réviser les policies RLS sur `tickets`

### 5. **End of Lease** - ❌ À CORRIGER
- **Problème**: Function `get_owner_lease_end_processes` manquante
- **Solution**: Créer la fonction PostgreSQL

### 6. **Documents Tenant** - ⚠️ À VÉRIFIER
- **Problème**: RLS recursion potentielle
- **Solution**: Vérifier les policies sur `documents`

---

## 📋 RECOMMANDATIONS

### Priorité Haute
1. ✅ Corriger `fetchPropertyDetails` - FAIT
2. ❌ Corriger RLS sur `tickets`
3. ❌ Créer fonction `get_owner_lease_end_processes`
4. ⚠️ Vérifier toutes les routes tenant

### Priorité Moyenne
1. ⚠️ Auditer toutes les routes provider
2. ⚠️ Auditer toutes les routes admin
3. ⚠️ Vérifier les hooks documents

### Priorité Basse
1. Optimiser les requêtes avec SELECT explicites (quand stable)
2. Ajouter des logs de monitoring
3. Documenter les APIs

---

## 🔄 FLUX DE DONNÉES CRITIQUES

### Création Propriété
```
1. POST /api/properties/init → Crée draft avec owner_id
2. PATCH /api/properties/[id] → Mise à jour progressive
3. POST /api/properties/[id]/photos/upload-url → Upload photos
4. GET /api/owner/properties → Liste avec médias
5. GET fetchPropertyDetails() → Détail complet
```

### Signature Bail
```
1. POST /api/leases → Crée bail draft
2. POST /api/leases/[id]/initiate-signature → Génère tokens
3. GET /signature/[token] → Page signature locataire
4. POST /api/signature/[token]/profile → Sauvegarde profil
5. POST /api/signature/[token]/sign-with-pad → Signature
6. POST /api/leases/[id]/sign → Signature owner
7. POST /api/leases/[id]/activate → Activation bail
```

### Paiement Loyer
```
1. GET /api/invoices → Liste factures
2. POST /api/payments/create-intent → Stripe PaymentIntent
3. POST /api/payments/confirm → Confirmation paiement
4. POST /api/leases/[id]/receipts → Génération quittance
```

---

*Généré le: $(date)*

