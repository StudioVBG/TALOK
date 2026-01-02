# 📊 CARTOGRAPHIE COMPLÈTE - FLUX "AJOUT DE LOGEMENT"

## 🎯 OBJECTIF
Identifier tous les fichiers, routes et composants liés à l'ajout de logement pour détecter les doublons, redondances et incohérences.

---

## 📂 ÉTAPE 1 — CARTOGRAPHIE COMPLÈTE

### 📋 TABLEAU SYNTHÉTIQUE DES FICHIERS

| Fichier | Rôle | Route associée | Doublon/Redondant ? | Notes |
|---------|------|----------------|---------------------|-------|
| **PAGES / ROUTES FRONTEND** |
| `app/owner/properties/new/page.tsx` | Page d'ajout (Owner) | `/owner/properties/new` | ⚠️ **DOUBLON** | Utilise `PropertyWizardV3`, rôle `owner` uniquement |
| `app/properties/new/page.tsx` | Page d'ajout (Admin/Owner) | `/properties/new` | ⚠️ **DOUBLON** | Utilise `PropertyWizardV3`, rôles `admin` et `owner` |
| `app/properties/new-v3/` | Dossier vide | N/A | ✅ **À SUPPRIMER** | Dossier vide, probablement ancienne version |
| `app/properties/[id]/edit/page.tsx` | Page d'édition | `/properties/[id]/edit` | ⚠️ **INCOHÉRENT** | Utilise `PropertyWizardV3` mais route `/properties` au lieu de `/owner/properties` |
| `app/owner/properties/[id]/page.tsx` | Page détail | `/owner/properties/[id]` | ✅ **OK** | Route canonique pour détail |
| `app/properties/[id]/page.tsx` | Page détail (legacy) | `/properties/[id]` | ⚠️ **DOUBLON** | Route alternative, utilisée dans certains liens |
| `app/owner/properties/page.tsx` | Liste des biens | `/owner/properties` | ✅ **OK** | Route canonique pour liste |
| `app/properties/page.tsx` | Liste (legacy) | `/properties` | ⚠️ **DOUBLON** | Route alternative |
| **COMPOSANTS WIZARD** |
| `features/properties/components/v3/property-wizard-v3.tsx` | Wizard principal | N/A | ✅ **RÉFÉRENCE** | Composant principal utilisé par toutes les pages |
| `features/properties/components/v3/property-type-selection.tsx` | Étape 1 : Sélection type | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/address-step.tsx` | Étape 2 : Adresse | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/dynamic-step.tsx` | Étape générique | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/equipments-info-step.tsx` | Étape équipements | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/conditions-step.tsx` | Étape conditions | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/rooms-photos-step.tsx` | Étape pièces/photos | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/recap-step.tsx` | Étape récapitulatif | N/A | ✅ **OK** | Sous-composant du wizard |
| `features/properties/components/v3/dynamic-field.tsx` | Champ dynamique | N/A | ✅ **OK** | Utilitaire pour les champs |
| **SERVICES / HOOKS** |
| `features/properties/services/properties.service.ts` | Service API | N/A | ✅ **RÉFÉRENCE** | Service centralisé pour toutes les opérations |
| `app/owner/properties/_actions.ts` | Server Actions | N/A | ⚠️ **À VÉRIFIER** | Possible doublon avec service |
| **API ROUTES BACKEND** |
| `app/api/properties/route.ts` | POST: Création | `POST /api/properties` | ✅ **RÉFÉRENCE** | Crée draft ou propriété complète |
| `app/api/properties/[id]/route.ts` | GET/PUT: Détail/Update | `GET/PUT /api/properties/[id]` | ✅ **OK** | Route canonique |
| `app/api/properties/[id]/submit/route.ts` | POST: Soumission finale | `POST /api/properties/[id]/submit` | ✅ **OK** | Finalise le draft |
| `app/api/properties/[id]/rooms/route.ts` | Gestion pièces | `GET/POST /api/properties/[id]/rooms` | ✅ **OK** | API pour pièces |
| `app/api/properties/[id]/photos/route.ts` | Gestion photos | `GET/POST /api/properties/[id]/photos` | ✅ **OK** | API pour photos |
| `app/api/properties/[id]/photos/upload-url/route.ts` | Upload photos | `POST /api/properties/[id]/photos/upload-url` | ✅ **OK** | Génère URL d'upload |
| `app/api/properties/[id]/features/bulk/route.ts` | Équipements bulk | `POST /api/properties/[id]/features/bulk` | ✅ **OK** | Ajout équipements en masse |

---

## 🔍 ANALYSE DES DOUBLONS ET INCOHÉRENCES

### ❌ DOUBLONS CRITIQUES IDENTIFIÉS

#### 1. **Routes d'ajout dupliquées**
- ✅ **CANONIQUE** : `/owner/properties/new` (Owner uniquement)
- ❌ **DOUBLON** : `/properties/new` (Admin + Owner)
- **Impact** : Confusion sur quelle route utiliser, maintenance dupliquée

#### 2. **Routes de liste dupliquées**
- ✅ **CANONIQUE** : `/owner/properties` (Owner)
- ❌ **DOUBLON** : `/properties` (Legacy, utilisé dans certains liens)

#### 3. **Routes de détail dupliquées**
- ✅ **CANONIQUE** : `/owner/properties/[id]` (Owner)
- ❌ **DOUBLON** : `/properties/[id]` (Legacy, utilisé dans certains liens)

#### 4. **Route d'édition incohérente**
- ⚠️ **INCOHÉRENT** : `/properties/[id]/edit` (devrait être `/owner/properties/[id]/edit`)

### ⚠️ INCOHÉRENCES DÉTECTÉES

1. **Permissions différentes** :
   - `/owner/properties/new` : `allowedRoles={["owner"]}`
   - `/properties/new` : `allowedRoles={["admin", "owner"]}`

2. **Wrappers différents** :
   - `/owner/properties/new` : Wrapper simple avec Suspense
   - `/properties/new` : Wrapper avec vérification `canManageProperties` + redirection

3. **Liens de navigation incohérents** :
   - Certains fichiers utilisent `/owner/properties/new`
   - D'autres utilisent `/properties/new`
   - Certains utilisent `/properties/[id]` au lieu de `/owner/properties/[id]`

---

## 📏 ÉTAPE 2 — ROUTES DE RÉFÉRENCE PROPOSÉES

### ✅ SCHÉMA CANONIQUE RECOMMANDÉ

#### **Frontend Routes**
```
✅ Liste des logements :     /owner/properties
✅ Ajout (wizard) :          /owner/properties/new
✅ Détail :                  /owner/properties/[propertyId]
✅ Édition :                 /owner/properties/[propertyId]/edit
```

#### **Backend API Routes**
```
✅ Création logement :       POST /api/properties
✅ Mise à jour logement :    PUT/PATCH /api/properties/[propertyId]
✅ Chargement détaillé :     GET /api/properties/[propertyId]
✅ Soumission finale :       POST /api/properties/[propertyId]/submit
✅ Gestion pièces :          GET/POST /api/properties/[propertyId]/rooms
✅ Gestion photos :          GET/POST /api/properties/[propertyId]/photos
```

### 🔄 REDIRECTIONS NÉCESSAIRES

| Route Legacy | Route Canonique | Action |
|-------------|-----------------|--------|
| `/properties/new` | `/owner/properties/new` | Rediriger (301) |
| `/properties` | `/owner/properties` | Rediriger (301) |
| `/properties/[id]` | `/owner/properties/[id]` | Rediriger (301) |
| `/properties/[id]/edit` | `/owner/properties/[id]/edit` | Rediriger (301) |

---

## 🧹 ÉTAPE 3 — PLAN DE NETTOYAGE

### 📁 FICHIERS À SUPPRIMER

1. ✅ `app/properties/new/page.tsx` → **SUPPRIMER** (doublon)
2. ✅ `app/properties/new-v3/` → **SUPPRIMER** (dossier vide)
3. ⚠️ `app/properties/[id]/edit/page.tsx` → **DÉPLACER** vers `/owner/properties/[id]/edit/page.tsx`

### 📝 FICHIERS À MODIFIER

#### **1. Créer redirections**
- Créer `app/properties/new/page.tsx` → Redirection vers `/owner/properties/new`
- Créer `app/properties/page.tsx` → Redirection vers `/owner/properties`
- Créer `app/properties/[id]/page.tsx` → Redirection vers `/owner/properties/[id]`
- Créer `app/properties/[id]/edit/page.tsx` → Redirection vers `/owner/properties/[id]/edit`

#### **2. Mettre à jour les liens**
- `app/owner/dashboard/DashboardPageClient.tsx` : Vérifier liens
- `app/owner/properties/PropertiesPageClient.tsx` : Vérifier liens
- Tous les fichiers avec `href="/properties"` → Remplacer par `/owner/properties`

#### **3. Unifier les permissions**
- Garder uniquement `allowedRoles={["owner"]}` pour `/owner/properties/new`
- Les admins peuvent accéder via une route séparée si nécessaire (`/app/admin/properties/new`)

---

## 🧩 ÉTAPE 4 — ARCHITECTURE PROPRE PROPOSÉE

### ✅ ARCHITECTURE FINALE

```
📦 Flux Ajout de Logement
├── 🎯 Page unique : /owner/properties/new
│   └── PropertyWizardV3 (composant principal)
│       ├── Step 1: PropertyTypeSelection
│       ├── Step 2: AddressStep (via DynamicStep)
│       ├── Step 3: EquipmentsInfoStep (via DynamicStep)
│       ├── Step 4: ConditionsStep (via DynamicStep)
│       ├── Step 5: RoomsPhotosStep
│       └── Step 6: RecapStep
│
├── 🔧 Service unique : PropertiesService
│   ├── createDraftProperty() → POST /api/properties
│   ├── updatePropertyGeneral() → PATCH /api/properties/[id]
│   ├── submitProperty() → POST /api/properties/[id]/submit
│   └── ... autres méthodes
│
└── 🌐 API Routes uniques
    ├── POST /api/properties (création draft/complet)
    ├── GET/PUT/PATCH /api/properties/[id] (détail/update)
    └── POST /api/properties/[id]/submit (finalisation)
```

### ✅ PRINCIPES

1. **Un seul point d'entrée** : `/owner/properties/new`
2. **Un seul composant wizard** : `PropertyWizardV3`
3. **Un seul service** : `PropertiesService`
4. **Routes API cohérentes** : Toutes sous `/api/properties`

---

## 🔗 ÉTAPE 5 — COHÉRENCE DES APPELS API

### ✅ APPELS API ACTUELS (VALIDÉS)

| Action | Méthode | Endpoint | Payload | Table DB |
|--------|---------|----------|---------|----------|
| Créer draft | POST | `/api/properties` | `{type_bien, usage_principal}` | `properties` |
| Mettre à jour général | PATCH | `/api/properties/[id]` | `PropertyGeneralUpdatePayload` | `properties` |
| Soumettre final | POST | `/api/properties/[id]/submit` | `{}` | `properties` (update `etat`) |
| Créer pièce | POST | `/api/properties/[id]/rooms` | `RoomPayload` | `rooms` |
| Upload photo | POST | `/api/properties/[id]/photos/upload-url` | `PhotoUploadRequest` | `photos` |

### ✅ VALIDATION

- ✅ Noms de champs cohérents entre frontend et backend
- ✅ Types TypeScript alignés
- ✅ Gestion d'erreurs présente (toasts, messages clairs)
- ⚠️ **À AMÉLIORER** : Messages d'erreur plus détaillés côté UI

---

## 📑 ÉTAPE 6 — PLAN D'ACTION PAR ÉTAPES

### 🎯 PHASE 1 : NETTOYAGE DES ROUTES (Priorité HAUTE)

**Actions** :
1. ✅ Supprimer `app/properties/new/page.tsx`
2. ✅ Supprimer `app/properties/new-v3/` (dossier vide)
3. ✅ Créer redirections pour routes legacy
4. ✅ Mettre à jour tous les liens internes

**Fichiers à modifier** :
- `app/properties/new/page.tsx` → Redirection
- `app/properties/page.tsx` → Redirection
- `app/properties/[id]/page.tsx` → Redirection
- `app/properties/[id]/edit/page.tsx` → Redirection
- Tous les fichiers avec liens `/properties/*`

**Impact** : Aucun (redirections transparentes)

**Vérification** :
```bash
npm run lint
npm run build
# Tester les redirections manuellement
```

---

### 🎯 PHASE 2 : UNIFICATION DES PERMISSIONS (Priorité MOYENNE)

**Actions** :
1. ✅ Garder uniquement `/owner/properties/new` pour les owners
2. ✅ Créer `/app/admin/properties/new` si nécessaire pour les admins
3. ✅ Unifier les vérifications de permissions

**Fichiers à modifier** :
- `app/owner/properties/new/page.tsx` → Vérifier permissions
- Créer `app/app/admin/properties/new/page.tsx` si nécessaire

**Impact** : Minimal (ajout route admin si nécessaire)

---

### 🎯 PHASE 3 : VÉRIFICATION DES SERVICES (Priorité BASSE)

**Actions** :
1. ✅ Vérifier `app/owner/properties/_actions.ts`
2. ✅ S'assurer qu'il n'y a pas de duplication avec `PropertiesService`
3. ✅ Fusionner ou supprimer si doublon

**Fichiers à vérifier** :
- `app/owner/properties/_actions.ts`
- `features/properties/services/properties.service.ts`

**Impact** : Minimal (optimisation)

---

## ✅ RÉSUMÉ EXÉCUTIF

### 📊 STATISTIQUES

- **Routes d'ajout** : 2 (1 canonique + 1 doublon)
- **Routes de liste** : 2 (1 canonique + 1 legacy)
- **Routes de détail** : 2 (1 canonique + 1 legacy)
- **Composants wizard** : 1 principal + 7 sous-composants (✅ OK)
- **Services** : 1 principal (✅ OK)
- **API Routes** : Cohérentes (✅ OK)

### 🎯 ACTIONS PRIORITAIRES

1. ✅ **SUPPRIMER** `/properties/new` (doublon)
2. ✅ **CRÉER** redirections pour routes legacy
3. ✅ **METTRE À JOUR** tous les liens internes
4. ✅ **UNIFIER** les permissions

### 📈 RÉSULTAT ATTENDU

- ✅ **1 seule route** d'ajout : `/owner/properties/new`
- ✅ **1 seul composant** wizard : `PropertyWizardV3`
- ✅ **1 seul service** : `PropertiesService`
- ✅ **Routes API** cohérentes et documentées
- ✅ **Aucun doublon** fonctionnel

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ Valider cette cartographie avec l'équipe
2. ✅ Appliquer Phase 1 (nettoyage routes)
3. ✅ Tester les redirections
4. ✅ Appliquer Phase 2 (unification permissions)
5. ✅ Vérifier Phase 3 (services)

---

**Date de création** : 2025-01-XX
**Dernière mise à jour** : 2025-01-XX
**Statut** : ✅ Prêt pour implémentation

