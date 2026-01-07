# RAPPORT D'AUDIT TECHNIQUE COMPLET
## Application de Talok - Novembre 2025

---

## EXECUTIVE SUMMARY

L'application présente des **problèmes architecturaux critiques** qui causent les erreurs 404 et les dysfonctionnements signalés. Les problèmes principaux sont :

1. **Double structure de routes** : `/owner/` vs `/owner/` vs `/app/owner/`
2. **Configuration de routes incohérente** : `OWNER_ROUTES` pointe vers `/owner/*` mais les pages sont dans `/app/owner/*`
3. **Récursion RLS Supabase** : Politiques de sécurité qui causent des boucles infinies
4. **Doublons massifs** : Deux versions de chaque page owner et tenant

---

## 1. ARCHITECTURE & ROUTES

### 1.1 Structure actuelle des dossiers

```
app/
├── admin/               # ✅ Admin dashboard (fonctionne)
├── api/                 # ✅ API routes (184 fichiers)
├── app/                 # 🔴 NOUVELLE STRUCTURE PRINCIPALE
│   ├── owner/          # Pages owner avec _data/, layouts complets
│   │   ├── _data/      # Data fetching server-side
│   │   ├── dashboard/
│   │   ├── properties/
│   │   ├── contracts/
│   │   └── ...
│   ├── tenant/         # Pages tenant avec _data/, layouts complets
│   │   ├── _data/
│   │   └── ...
│   └── guarantor/      # Garant
├── owner/               # 🟡 ANCIENNE STRUCTURE (DOUBLON)
│   ├── _data/          # Moins complet que app/owner/_data
│   ├── dashboard/
│   ├── properties/
│   ├── billing/
│   └── inspections/
├── tenant/              # 🟡 ANCIENNE STRUCTURE (DOUBLON)
│   └── ...
└── ...
```

### 1.2 Tableau des routes et fichiers

| Route URL exposée | Fichier source | Type | Statut |
|-------------------|----------------|------|--------|
| `/owner/dashboard` | `app/owner/dashboard/page.tsx` | Page | ✅ Existe |
| `/owner/properties` | `app/owner/properties/page.tsx` | Page | ✅ Existe |
| `/owner/properties/new` | `app/owner/properties/new/page.tsx` | Page | ✅ Existe |
| `/owner/leases` | `app/owner/leases/page.tsx` | Page | ✅ Existe |
| `/owner/money` | `app/owner/money/page.tsx` | Page | ✅ Existe |
| `/owner/documents` | `app/owner/documents/page.tsx` | Page | ✅ Existe |
| `/owner/dashboard` | `app/owner/dashboard/page.tsx` | Page | ⚠️ DOUBLON |
| `/owner/properties` | `app/owner/properties/page.tsx` | Page | ⚠️ DOUBLON |
| `/owner/inspections` | `app/owner/inspections/page.tsx` | Page | ⚠️ Unique ici |
| `/owner/billing` | `app/owner/billing/page.tsx` | Page | ⚠️ Unique ici |

### 1.3 Problème critique : Configuration des routes

**Fichier** : `lib/config/owner-routes.ts`

```typescript
// CONFIGURATION ACTUELLE (INCORRECTE)
export const OWNER_ROUTES = {
  dashboard: { path: "/owner", ... },           // Pointe vers /owner
  properties: { path: "/owner/properties", ... }, // Pointe vers /owner/properties
  contracts: { path: "/owner/leases", ... },    // Pointe vers /owner/leases
  money: { path: "/owner/finances", ... },      // Pointe vers /owner/finances
  ...
};
```

**Problème** : Le middleware redirige `/owner/*` vers `/owner/*`, mais :
- Les liens utilisent `/owner/*` (via `OWNER_ROUTES`)
- Les pages sont dans `/app/owner/*`
- Cela crée des **redirections en cascade** ou des **404**

### 1.4 Flux de redirection actuel (problématique)

```
1. Utilisateur clique sur "Mes biens"
2. Lien : href="/owner/properties" (depuis OWNER_ROUTES)
3. Middleware intercepte et redirige vers "/owner/properties"
4. Next.js cherche : app/owner/properties/page.tsx
5. ✅ La page existe mais le chemin du dossier est app/owner (double "app")
```

---

## 2. FLUX CRITIQUE : OWNER & PROPRIÉTÉS

### 2.1 Parcours de création de propriété

```
[Utilisateur] → [Page /owner/properties/new] 
      ↓
[PropertyWizardV3] → POST /api/properties (type_bien)
      ↓
[API creates draft] → INSERT properties (owner_id, unique_code, ...)
      ↓
[Redirect to /owner/properties/:id]
      ↓
[Page détail pour compléter]
```

### 2.2 Fichiers impliqués dans le flux

| Étape | Fichier | Rôle |
|-------|---------|------|
| Page création | `app/owner/properties/new/page.tsx` | Point d'entrée |
| Wizard V3 | `features/properties/components/v3/property-wizard-v3.tsx` | Interface stepper |
| API POST | `app/api/properties/route.ts` | Création en DB |
| Hook fetch | `lib/hooks/use-properties.ts` | Récupération via React Query |
| API GET | `app/api/owner/properties/route.ts` | Liste propriétés owner |
| Service | `features/properties/services/properties.service.ts` | Abstraction API |

### 2.3 Points de rupture identifiés

| # | Point | Problème | Impact |
|---|-------|----------|--------|
| 1 | `OWNER_ROUTES.properties.path` | Pointe vers `/owner/properties` au lieu de `/owner/properties` | Redirection | 
| 2 | RLS `lease_signers` | Récursion infinie | Erreur 500 sur documents |
| 3 | `owner_id` validation | Le profil utilise `profile.id`, la propriété utilise `owner_id` | Potentiel mismatch |
| 4 | Wizard V3/V4 | Deux versions coexistent (`v3/`, `v4/`) | Confusion, maintenance |

### 2.4 Schéma de données simplifié

```sql
profiles (
  id UUID PK,
  user_id UUID FK → auth.users,
  role ENUM('owner', 'tenant', 'admin', 'provider'),
  prenom, nom, telephone...
)

properties (
  id UUID PK,
  owner_id UUID FK → profiles.id,  -- ⚠️ Pas profiles.user_id !
  unique_code VARCHAR UNIQUE,
  type_bien VARCHAR,
  adresse_complete, ville, code_postal...
  etat ENUM('draft', 'en_attente', 'actif', 'rejete')
)

leases (
  id UUID PK,
  property_id UUID FK → properties.id,
  statut ENUM('draft', 'pending_signature', 'active', 'terminated')
)

lease_signers (
  id UUID PK,
  lease_id UUID FK → leases.id,
  profile_id UUID FK → profiles.id,
  role ENUM('proprietaire', 'locataire_principal', 'colocataire', 'garant')
)
```

---

## 3. DOUBLONS & FACTORISATION

### 3.1 Pages dupliquées

| Type | Fichiers | Problème | Action recommandée |
|------|----------|----------|-------------------|
| Dashboard Owner | `app/owner/dashboard/DashboardClient.tsx` + `app/owner/dashboard/DashboardClient.tsx` | 2 versions différentes | Supprimer `app/owner/` |
| Properties Owner | `app/owner/properties/PropertiesClient.tsx` + `app/owner/properties/page.tsx` | Logique dupliquée | Supprimer `app/owner/` |
| Layout Owner | `app/owner/layout.tsx` + `app/owner/layout.tsx` | Props différentes | Unifier vers `app/app/` |
| Data fetching | `app/owner/_data/` + `app/owner/_data/` | 2 implémentations | Supprimer `app/owner/_data/` |

### 3.2 Composants Wizard dupliqués

| Composant | Fichiers | Différence |
|-----------|----------|------------|
| Wizard V3 | `features/properties/components/v3/property-wizard-v3.tsx` | Version principale |
| Wizard V4 | `features/properties/components/v4/PropertyWizardV4.tsx` | En développement, vide |
| New Property Steps | `app/owner/property/new/_steps/*` | 8 composants d'étapes |
| V3 Steps | `features/properties/components/v3/*` | Steps différents |

### 3.3 Hooks et services dupliqués

| Catégorie | Fichiers | Problème |
|-----------|----------|----------|
| Properties fetch | `use-properties.ts` + `PropertiesService` | Double abstraction |
| API client | `lib/api-client.ts` + `apiClient` dans services | OK, mais vérifier usage |
| Auth | `use-auth.ts` + `authService` | Pattern cohérent |

### 3.4 Recommandations de factorisation

```
P1 - CRITIQUE (faire maintenant) :
  ├── Supprimer /owner/* (garder uniquement /app/owner/*)
  ├── Mettre à jour OWNER_ROUTES vers /owner/*
  └── Supprimer doublons _data/

P2 - IMPORTANT (après P1) :
  ├── Unifier PropertyWizard (garder V3 ou migrer vers V4)
  ├── Déplacer inspections et billing vers /app/owner/
  └── Centraliser les types Property

P3 - AMÉLIORATION :
  ├── Créer un hook useOwnerData() centralisé
  └── Simplifier les services
```

---

## 4. ERREURS POTENTIELLES (404 / 400 / 500)

### 4.1 Erreurs 404 identifiées

| Route | Cause | Fichier concerné | Solution |
|-------|-------|------------------|----------|
| `/owner/properties` | Double "app" dans path | Next.js routing | ⚠️ Vérifier structure |
| `/owner/properties` | Redirigé mais ancien lien | `OWNER_ROUTES` | Mettre à jour config |
| `/owner/leases` | Route inexistante | Middleware redirect | Ajouter page ou redirect |
| `/owner/finances` | Route inexistante | Middleware redirect | Ajouter page ou redirect |

### 4.2 Erreurs 500 identifiées

| Erreur | Cause | Fichier | Solution |
|--------|-------|---------|----------|
| `infinite recursion detected in policy for relation "lease_signers"` | RLS Supabase | `fetchDocuments.ts` | ✅ Corrigé - requêtes séparées |
| `infinite recursion detected in policy for relation "leases"` | RLS Supabase | `fetchInvoices.ts` | ✅ Corrigé |
| `TreePalm not exported` | Import invalide | `LaunchStep.tsx` | ✅ Corrigé |

### 4.3 Erreurs de configuration

| Type | Fichier | Problème |
|------|---------|----------|
| Routes config | `lib/config/owner-routes.ts` | Paths sans `/app/` prefix |
| Middleware redirects | `middleware.ts` | Redirections circulaires possibles |
| Layout props | `OwnerAppLayout` | Reçoit `profile` ou `profileId` selon la source |

### 4.4 Erreurs potentielles non encore manifestées

| Risque | Fichier | Condition de déclenchement |
|--------|---------|---------------------------|
| `owner_id` mismatch | API properties | Si `profile.id` != `owner_id` en base |
| Missing `bank_connections` table | `connected-accounts-list.tsx` | Open Banking feature |
| Session expirée non gérée | `api-client.ts` | Token refresh échoue |

---

## 5. DONNÉES & SUPABASE

### 5.1 Problèmes RLS identifiés

**Table `lease_signers`** :
- Politique RLS qui référence `leases` qui référence `lease_signers` → récursion

**Table `tenant_profiles`** :
- Politique qui vérifie `profiles` qui vérifie `tenant_profiles` → récursion

### 5.2 Solutions appliquées

1. **fetchDocuments.ts** : Utilise service_role client pour bypass RLS
2. **fetchInvoices.ts** : Requêtes séparées sans jointures profondes
3. **Migrations** : `fix_rls_recursion.sql`, `fix_leases_rls_infinite_recursion.sql`

### 5.3 Schéma owner_id

```
auth.users.id → profiles.user_id (1:1)
profiles.id → properties.owner_id (1:N)
profiles.id → lease_signers.profile_id (1:N)
```

⚠️ **Attention** : `owner_id` est `profiles.id`, PAS `auth.users.id`

### 5.4 Tables manquantes ou optionnelles

| Table | Utilisée par | Statut |
|-------|--------------|--------|
| `bank_connections` | Open Banking | ❌ Non créée |
| `outbox` | Event sourcing | ⚠️ Optionnelle |
| `audit_log` | Audit trail | ⚠️ Optionnelle |
| `notifications` | Push notifs | ✅ Créée |

---

## 6. UX/UI & STRUCTURE DES PAGES

### 6.1 Page Dashboard Owner

**Fichier** : `app/owner/dashboard/DashboardClient.tsx`

| Problème | Impact | Solution |
|----------|--------|----------|
| Transformation data commentée | KPIs à 0 | ✅ Corrigé |
| Deux versions coexistent | Confusion | Supprimer ancienne |

### 6.2 Page Création de bien (Wizard)

**Fichier** : `features/properties/components/v3/property-wizard-v3.tsx`

| Problème | Impact | Solution |
|----------|--------|----------|
| V3 et V4 coexistent | Code mort | Choisir une version |
| Steps dupliqués dans 2 dossiers | Maintenance | Centraliser |
| Mode "location" vs "type" | UX confuse | Simplifier |

### 6.3 Layout incohérent

**Fichier** : `components/layout/owner-app-layout.tsx`

```typescript
// Reçoit des props différentes selon la source
interface OwnerAppLayoutProps {
  children: React.ReactNode;
  profile?: { ... } | null;  // Depuis app/owner/layout.tsx
  // OU
  profileId?: string;        // Depuis app/owner/layout.tsx
  ownerProfile?: ...;
}
```

**Solution** : Unifier les props en gardant uniquement `profile`

### 6.4 Navigation mobile

**Fichier** : `components/layout/owner-bottom-nav.tsx`

- Utilise `OWNER_ROUTES` qui pointe vers `/owner/*`
- Devrait utiliser `/owner/*`

---

## 7. ROADMAP DE REFACTOR PRIORISÉE

### P1 - BLOQUANT (Semaine 1)

| # | Action | Fichiers | Effort |
|---|--------|----------|--------|
| 1.1 | Mettre à jour `OWNER_ROUTES` vers `/owner/*` | `lib/config/owner-routes.ts` | 30min |
| 1.2 | Supprimer redirections obsolètes du middleware | `middleware.ts` | 30min |
| 1.3 | Supprimer `/owner/` (ancienne structure) | `app/owner/*` | 1h |
| 1.4 | Déplacer inspections/billing vers `/app/owner/` | Nouveaux fichiers | 2h |
| 1.5 | Vérifier tous les `href` pointant vers `/owner/` | Grep global | 1h |

### P2 - DETTE TECHNIQUE (Semaine 2)

| # | Action | Fichiers | Effort |
|---|--------|----------|--------|
| 2.1 | Supprimer doublons `_data/` | `app/owner/_data/*` | 1h |
| 2.2 | Unifier `OwnerAppLayout` props | Layout + pages | 2h |
| 2.3 | Choisir et supprimer Wizard V3 ou V4 | `features/properties/components/` | 3h |
| 2.4 | Créer table `bank_connections` ou supprimer feature | Migration SQL | 1h |
| 2.5 | Documenter le schema owner_id | README | 30min |

### P3 - AMÉLIORATIONS (Semaine 3+)

| # | Action | Fichiers | Effort |
|---|--------|----------|--------|
| 3.1 | Créer hook `useOwnerData()` centralisé | `lib/hooks/` | 2h |
| 3.2 | Optimiser RLS avec fonctions SECURITY DEFINER | Migrations SQL | 3h |
| 3.3 | Ajouter tests E2E pour flux critiques | `tests/` | 4h |
| 3.4 | Implémenter error boundaries sur toutes les pages | Composants | 2h |
| 3.5 | Mettre à jour la documentation | `docs/` | 2h |

---

## ANNEXES

### A. Commandes de diagnostic

```bash
# Trouver tous les liens vers /owner/
grep -r 'href="/owner/' app/ components/ features/ --include="*.tsx"

# Trouver les imports de OWNER_ROUTES
grep -r 'OWNER_ROUTES' app/ components/ --include="*.tsx"

# Lister les fichiers de page dupliqués
find app -name "page.tsx" | grep -E "(owner|tenant)" | sort
```

### B. Structure cible recommandée

```
app/
├── (auth)/             # Routes publiques auth
├── (dashboard)/        # Routes protégées
│   ├── admin/
│   ├── owner/          # Renommer app/owner → app/owner
│   │   ├── _data/
│   │   ├── dashboard/
│   │   ├── properties/
│   │   ├── contracts/
│   │   ├── money/
│   │   ├── documents/
│   │   ├── inspections/
│   │   └── support/
│   └── tenant/
└── api/
```

### C. Checklist de validation post-refactor

- [ ] `/owner/dashboard` charge sans erreur
- [ ] `/owner/properties` affiche la liste des biens
- [ ] Création de bien fonctionne et le bien apparaît dans la liste
- [ ] `/owner/documents` ne génère pas d'erreur RLS
- [ ] Navigation mobile fonctionne
- [ ] Aucun lien vers `/owner/` (sans `/app/` prefix)

---

*Rapport généré le 27 novembre 2025*
*Analysé par Assistant IA fullstack Next.js/Supabase*

