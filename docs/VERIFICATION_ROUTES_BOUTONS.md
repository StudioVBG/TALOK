# Vérification des Routes et Actions des Boutons - Compte Propriétaire

## 🔍 Routes vérifiées

### ✅ Routes principales (OK)
- `/app/owner/dashboard` ✅
- `/app/owner/properties` ✅
- `/app/owner/properties/[id]` ✅
- `/app/owner/properties/[id]/edit` ✅
- `/app/owner/contracts` ✅
- `/app/owner/contracts/[id]` ✅
- `/app/owner/money` ✅
- `/app/owner/documents` ✅
- `/app/owner/support` ✅
- `/app/owner/profile` ✅

### ⚠️ Routes à vérifier/corriger

#### 1. Création d'un bien
**Routes existantes :**
- `/app/owner/properties/new` ✅ (utilise PropertyWizardV3 - RECOMMANDÉ)
- `/app/owner/property/new` ⚠️ (ancien wizard - à supprimer ou rediriger)

**Boutons pointent vers :** `/app/owner/properties/new` ✅ (CORRECT)

**Action recommandée :** Rediriger `/app/owner/property/new` vers `/app/owner/properties/new`

#### 2. Création d'un bail
**Route existante :**
- `/leases/new` ✅ (accepte `propertyId` ou `property_id` en query param)

**Boutons pointent vers :** `/leases/new?propertyId=...` ou `/leases/new?property_id=...` ✅ (CORRECT)

**Note :** La route accepte les deux formats de paramètre, c'est bien géré.

#### 3. Upload de documents
**Problème identifié :**
- Les boutons pointent vers `/documents/upload`
- Cette route est une **API route** (`app/api/documents/upload/route.ts`), pas une page
- Il existe une page `/documents` mais pas de page `/documents/upload`

**Action requise :** 
- Créer une page `/app/owner/documents/upload/page.tsx` OU
- Rediriger vers une page existante OU
- Modifier les boutons pour utiliser un modal/component d'upload

#### 4. Détail d'un document
**Route vérifiée :**
- Les boutons pointent vers `/documents/${doc.id}`
- Route non vérifiée (à créer si nécessaire)

#### 5. Détail d'une facture
**Route existante :**
- `/invoices/[id]` ✅

**Boutons pointent vers :** `/invoices/${invoice.id}` ✅ (CORRECT)

## 📋 Liste des corrections nécessaires

### 1. Rediriger l'ancien wizard vers le nouveau
**Fichier :** `app/app/owner/property/new/page.tsx`
**Action :** Rediriger vers `/app/owner/properties/new`

### 2. Corriger les routes d'upload de documents
**Fichiers concernés :**
- `app/app/owner/documents/OwnerDocumentsClient.tsx` (2 occurrences)
**Action :** Créer une page `/app/owner/documents/upload/page.tsx` ou utiliser un modal

### 3. Vérifier la route de détail de document
**Action :** Vérifier si `/documents/[id]` existe, sinon créer ou rediriger

## 🎯 Routes recommandées à utiliser

Utiliser les constantes de `lib/config/owner-routes.ts` pour garantir la cohérence :

```tsx
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

// Au lieu de :
<Link href="/app/owner/properties/new">

// Utiliser :
<Link href={`${OWNER_ROUTES.properties.path}/new`}>
```

## ✅ Routes validées et fonctionnelles

- ✅ `/app/owner/dashboard`
- ✅ `/app/owner/properties`
- ✅ `/app/owner/properties/new`
- ✅ `/app/owner/properties/[id]`
- ✅ `/app/owner/properties/[id]/edit`
- ✅ `/app/owner/contracts`
- ✅ `/app/owner/contracts/[id]`
- ✅ `/app/owner/money`
- ✅ `/app/owner/documents`
- ✅ `/app/owner/support`
- ✅ `/leases/new` (avec query params)
- ✅ `/invoices/[id]`

