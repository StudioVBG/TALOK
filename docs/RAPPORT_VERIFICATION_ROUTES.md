# Rapport de Vérification des Routes et Actions des Boutons

## ✅ Résumé exécutif

Toutes les routes principales du Compte Propriétaire ont été vérifiées et corrigées. Les actions des boutons pointent maintenant vers les bonnes routes.

## 🔍 Routes vérifiées et corrigées

### Routes principales ✅
| Route | Status | Action |
|-------|--------|--------|
| `/app/owner/dashboard` | ✅ OK | Aucune action |
| `/app/owner/properties` | ✅ OK | Aucune action |
| `/app/owner/properties/new` | ✅ OK | Utilisée par tous les boutons "Ajouter un bien" |
| `/app/owner/properties/[id]` | ✅ OK | Aucune action |
| `/app/owner/properties/[id]/edit` | ✅ OK | Aucune action |
| `/app/owner/contracts` | ✅ OK | Aucune action |
| `/app/owner/contracts/[id]` | ✅ OK | Aucune action |
| `/app/owner/money` | ✅ OK | Aucune action |
| `/app/owner/documents` | ✅ OK | Aucune action |
| `/app/owner/documents/upload` | ✅ CRÉÉ | Nouvelle page créée |
| `/app/owner/support` | ✅ OK | Aucune action |
| `/app/owner/profile` | ✅ OK | Aucune action |

### Routes externes ✅
| Route | Status | Usage |
|-------|--------|-------|
| `/leases/new` | ✅ OK | Création de bail (accepte `propertyId` ou `property_id`) |
| `/invoices/[id]` | ✅ OK | Détail d'une facture |

### Routes redirigées ✅
| Route | Redirection | Status |
|-------|-------------|--------|
| `/app/owner/property/new` | → `/app/owner/properties/new` | ✅ Corrigé |

## 🔧 Corrections appliquées

### 1. Redirection de l'ancien wizard
**Fichier :** `app/app/owner/property/new/page.tsx`
**Problème :** Route obsolète qui créait de la confusion
**Solution :** Redirection vers `/app/owner/properties/new`
**Status :** ✅ Corrigé

### 2. Page d'upload de documents
**Fichier créé :** `app/app/owner/documents/upload/page.tsx`
**Problème :** Les boutons pointaient vers une API route au lieu d'une page
**Solution :** Création d'une page complète avec formulaire d'upload
**Status :** ✅ Créé

### 3. Liens d'upload de documents
**Fichier :** `app/app/owner/documents/OwnerDocumentsClient.tsx`
**Problème :** 2 occurrences pointaient vers `/documents/upload` (API route)
**Solution :** Correction vers `/app/owner/documents/upload` (page)
**Status :** ✅ Corrigé (2 occurrences)

### 4. Bouton de téléchargement de document
**Fichier :** `app/app/owner/documents/OwnerDocumentsClient.tsx`
**Problème :** Lien vers `/documents/${doc.id}` (route non vérifiée)
**Solution :** Bouton avec action onClick qui ouvre `storage_path`
**Status :** ✅ Corrigé (TODO ajouté pour implémentation complète)

## 📋 Vérification des actions des boutons

### Dashboard
- ✅ "Ajouter un bien" → `/app/owner/properties/new` (utilise `OWNER_ROUTES.properties.path`)
- ✅ "Demander de l'aide" → `/app/owner/support` (utilise `OWNER_ROUTES.support.path`)

### Properties
- ✅ "Ajouter un bien" → `/app/owner/properties/new`
- ✅ "Voir la fiche" → `/app/owner/properties/[id]`
- ✅ "Créer un bail" → `/leases/new?propertyId=...` ou `/leases/new?property_id=...`
- ✅ "Voir le bail" → `/app/owner/contracts/[id]`
- ✅ "Voir les baux" → `/app/owner/contracts?property_id=...`
- ✅ "Voir les loyers" → `/app/owner/money?property_id=...`
- ✅ "Voir les documents" → `/app/owner/documents?property_id=...`

### Contracts
- ✅ "Créer un bail" → `/leases/new`
- ✅ "Voir" → `/app/owner/contracts/[id]`
- ✅ "Voir les loyers" → `/app/owner/money?lease_id=...`
- ✅ "Voir les documents" → `/app/owner/documents?lease_id=...`

### Money
- ✅ "Marquer payé" → `/invoices/[id]`
- ✅ "Voir mes baux" → `/app/owner/contracts`

### Documents
- ✅ "Téléverser un document" → `/app/owner/documents/upload` (2 occurrences corrigées)
- ✅ "Télécharger" → Action onClick (ouvre `storage_path`)

## ⚠️ Points d'attention

### 1. Téléchargement de documents
**Status :** Implémentation temporaire
**Action actuelle :** Le bouton ouvre `storage_path` dans un nouvel onglet
**Recommandation :** Créer une route API `/api/documents/[id]/download` avec authentification

### 2. Marquer facture comme payée
**Status :** ✅ Fonctionne
**Route :** `/invoices/[id]`
**Note :** La page existe et permet de marquer comme payé

### 3. Utilisation des constantes OWNER_ROUTES
**Status :** Partiellement appliqué
**Recommandation :** Utiliser `OWNER_ROUTES` partout au lieu de chaînes hardcodées
**Exemple :**
```tsx
// ✅ Bon (dashboard)
<Link href={`${OWNER_ROUTES.properties.path}/new`}>

// ⚠️ À améliorer (properties)
<Link href="/app/owner/properties/new">
```

## 🎯 Recommandations d'amélioration

### 1. Utiliser les constantes OWNER_ROUTES partout
Créer un helper pour les routes avec query params :
```tsx
// lib/owner/routes.ts
export const getOwnerRoute = {
  properties: {
    list: () => OWNER_ROUTES.properties.path,
    new: () => `${OWNER_ROUTES.properties.path}/new`,
    detail: (id: string) => `${OWNER_ROUTES.properties.path}/${id}`,
    edit: (id: string) => `${OWNER_ROUTES.properties.path}/${id}/edit`,
  },
  contracts: {
    list: () => OWNER_ROUTES.contracts.path,
    detail: (id: string) => `${OWNER_ROUTES.contracts.path}/${id}`,
  },
  // ...
};
```

### 2. Implémenter le téléchargement de documents sécurisé
Créer une route API :
```tsx
// app/api/documents/[id]/download/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  // Vérifier les permissions
  // Retourner le fichier avec les bons headers
}
```

### 3. Standardiser les query params
Utiliser toujours `property_id` (avec underscore) au lieu de `propertyId` (camelCase) pour la cohérence.

## ✅ Validation finale

- ✅ Toutes les routes principales fonctionnent
- ✅ Toutes les routes de création fonctionnent
- ✅ Toutes les routes de détail fonctionnent
- ✅ Toutes les routes avec filtres fonctionnent
- ✅ Tous les boutons pointent vers les bonnes routes
- ✅ Aucune erreur de linting

## 📚 Fichiers modifiés

1. `app/app/owner/property/new/page.tsx` - Redirection vers nouvelle route
2. `app/app/owner/documents/upload/page.tsx` - Nouvelle page créée
3. `app/app/owner/documents/OwnerDocumentsClient.tsx` - Corrections des liens et bouton téléchargement

## 📝 Documentation créée

- `docs/VERIFICATION_ROUTES_BOUTONS.md` - Guide de vérification
- `docs/CORRECTIONS_ROUTES_BOUTONS.md` - Détails des corrections
- `docs/RAPPORT_VERIFICATION_ROUTES.md` - Ce rapport

