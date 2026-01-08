# Vérification des Routes et Actions des Boutons - Compte Propriétaire

## 🔍 Routes vérifiées

### ✅ Routes principales (OK)
- `/owner/dashboard` ✅
- `/owner/properties` ✅
- `/owner/properties/[id]` ✅
- `/owner/properties/[id]/edit` ✅
- `/owner/leases` ✅
- `/owner/leases/[id]` ✅
- `/owner/money` ✅
- `/owner/documents` ✅
- `/owner/support` ✅
- `/owner/profile` ✅

### ⚠️ Routes à vérifier/corriger

#### 1. Création d'un bien
**Routes existantes :**
- `/owner/properties/new` ✅ (utilise PropertyWizardV3 - RECOMMANDÉ)
- `/owner/property/new` ⚠️ (ancien wizard - à supprimer ou rediriger)

**Boutons pointent vers :** `/owner/properties/new` ✅ (CORRECT)

**Action recommandée :** Rediriger `/owner/property/new` vers `/owner/properties/new`

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
- Créer une page `/owner/documents/upload/page.tsx` OU
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
**Fichier :** `app/owner/property/new/page.tsx`
**Action :** Rediriger vers `/owner/properties/new`

### 2. Corriger les routes d'upload de documents
**Fichiers concernés :**
- `app/owner/documents/OwnerDocumentsClient.tsx` (2 occurrences)
**Action :** Créer une page `/owner/documents/upload/page.tsx` ou utiliser un modal

### 3. Vérifier la route de détail de document
**Action :** Vérifier si `/documents/[id]` existe, sinon créer ou rediriger

## 🎯 Routes recommandées à utiliser

Utiliser les constantes de `lib/config/owner-routes.ts` pour garantir la cohérence :

```tsx
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

// Au lieu de :
<Link href="/owner/properties/new">

// Utiliser :
<Link href={`${OWNER_ROUTES.properties.path}/new`}>
```

## ✅ Routes validées et fonctionnelles

- ✅ `/owner/dashboard`
- ✅ `/owner/properties`
- ✅ `/owner/properties/new`
- ✅ `/owner/properties/[id]`
- ✅ `/owner/properties/[id]/edit`
- ✅ `/owner/leases`
- ✅ `/owner/leases/[id]`
- ✅ `/owner/money`
- ✅ `/owner/documents`
- ✅ `/owner/support`
- ✅ `/leases/new` (avec query params)
- ✅ `/invoices/[id]`

