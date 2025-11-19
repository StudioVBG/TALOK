# 🔧 PATCH COMPLET FINAL - Création Propriété Visible

**Date** : 2025-02-18  
**Objectif** : Assurer que les biens créés sont visibles immédiatement, même si les photos échouent

---

## 📋 PROBLÈMES IDENTIFIÉS ET CORRIGÉS

### Problème 1 : Activation automatique supprimée ✅

**Fichier** : `app/app/owner/property/new/_steps/SummaryStep.tsx`

**Avant** :
```typescript
// Activer le bien si pas déjà publié
if (!draft.is_published && !finalPayload.etat) {
  finalPayload.etat = "active"; // ❌ Problème
}
```

**Après** :
```typescript
// ✅ IMPORTANT: Ne PAS activer automatiquement - garder le bien en "draft"
// Le bien reste en "draft" et sera visible dans la liste "Mes biens"
// if (!draft.is_published && !finalPayload.etat) {
//   finalPayload.etat = "active"; // ❌ SUPPRIMÉ
// }
```

**Résultat** : Le bien reste en `draft` et est visible (car `fetchProperties` ne filtre plus sur `etat`)

---

### Problème 2 : Gestion d'erreur photos améliorée ✅

**Fichier** : `app/app/owner/property/new/_steps/SummaryStep.tsx`

**Changements** :
1. Variable `photoUploadErrors` déclarée au bon scope
2. Tracking des erreurs avec `uploadUrlsResults`
3. Message toast adapté selon les erreurs
4. Le bien est créé même si toutes les photos échouent

**Code** :
```typescript
let photoUploadErrors = false;
let uploadUrlsResults: PromiseSettledResult<any>[] = [];

// ... upload des photos ...

// Vérifier les erreurs
if (uploadUrls.length === 0) {
  photoUploadErrors = true;
} else {
  photoUploadErrors = uploadUrlsResults.some(r => r.status === "rejected");
}

// Message adapté
toast({
  title: "Bien créé avec succès",
  description: hasErrors 
    ? "Votre bien a été créé et est maintenant visible dans vos biens. Certaines photos peuvent nécessiter des ajustements..."
    : "Votre bien a été créé et est maintenant visible dans vos biens.",
});
```

---

### Problème 3 : Cache invalidation après PATCH ✅

**Fichier** : `app/api/properties/[id]/route.ts`

**Changement** : Ajout de `revalidateTag` et `revalidatePath` après chaque PATCH

**Code** :
```typescript
// ✅ INVALIDER LE CACHE: Après chaque mise à jour
const { revalidateTag, revalidatePath } = await import("next/cache");
revalidateTag("owner:properties");
revalidateTag("admin:properties");
revalidatePath("/app/owner/properties");
revalidatePath("/app/owner/dashboard");
revalidatePath("/app/owner");
```

**Résultat** : Le cache Next.js est invalidé après chaque mise à jour, garantissant que les nouvelles données sont visibles

---

### Problème 4 : Attributs name/id manquants ✅

**Fichiers corrigés** :
- `app/app/owner/property/new/_steps/PublishStep.tsx`
- `app/app/owner/property/new/_steps/PhotosStep.tsx`
- `app/app/owner/property/new/_steps/DetailsStep.tsx`

**Champs corrigés** :
- Input radio `visibility-public` : `id`, `name="visibility"`, `value="public"`
- Input radio `visibility-private` : `id`, `name="visibility"`, `value="private"`
- Input date `available-from` : `id`, `name="available-from"`
- Input file `property-photos-upload` : `id`, `name="property-photos"`
- Input `surface` : `id`, `name="surface"`
- Input `rooms_count` : `id`, `name="rooms_count"`
- Input `floor` : `id`, `name="floor"`
- Select `dpe_classe_energie` : `id`, `name="dpe_classe_energie"`
- Select `dpe_classe_climat` : `id`, `name="dpe_classe_climat"`
- Input `dpe_consommation` : `id`, `name="dpe_consommation"`
- Input `dpe_emissions` : `id`, `name="dpe_emissions"`
- Input `permis_louer_numero` : `id`, `name="permis_louer_numero"`
- Input `permis_louer_date` : `id`, `name="permis_louer_date"`

---

## ✅ VÉRIFICATIONS FINALES

### 1. INSERT utilise `owner_id = profile.id` ✅

**Fichier** : `app/api/properties/route.ts` (POST)

```typescript
const property = await createDraftProperty({
  payload: draftPayload.data,
  profileId: profile.id, // ✅ owner_id = profile.id
  serviceClient,
});
```

### 2. SELECT utilise `owner_id = profile.id` ✅

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

```typescript
const { data: directData } = await serviceClient
  .from("properties")
  .select("...")
  .eq("owner_id", ownerId) // ✅ owner_id = profile.id (passé depuis OwnerLayout)
  // ✅ PAS DE FILTRE SUR etat/status
```

### 3. Alignement complet ✅

- ✅ INSERT : `owner_id = profile.id`
- ✅ SELECT : `owner_id = ownerId` (où `ownerId = profile.id`)
- ✅ Pas de filtre sur `etat/status` dans SELECT
- ✅ Le bien reste en `draft` après création
- ✅ Cache invalidé après POST et PATCH

---

## 🎯 FLUX FINAL ATTENDU

### 1. Création du bien

```
POST /api/properties
  ↓ Crée property avec owner_id = profile.id, etat = "draft"
  ↓ Crée unit par défaut
  ↓ revalidateTag("owner:properties")
  ↓ revalidatePath("/app/owner/properties")
  ↓ Retourne { property_id, unit_id }
```

### 2. Mise à jour des détails

```
PATCH /api/properties/[id]
  ↓ Met à jour adresse, surface, etc.
  ↓ revalidateTag("owner:properties")
  ↓ revalidatePath("/app/owner/properties")
```

### 3. Upload des photos (NON-BLOQUANT)

```
POST /api/properties/[id]/photos/upload-url
  ↓ Si erreur 400 : catch → continue
  ↓ Le bien reste créé et visible
```

### 4. Affichage dans la liste

```
OwnerLayout
  ↓ getCachedProperties(profile.id)
  ↓ fetchProperties(ownerId = profile.id)
  ↓ serviceClient.from("properties").eq("owner_id", ownerId)
  ↓ ✅ Trouve le bien (même en draft)
  ↓ OwnerDataProvider reçoit properties[]
  ↓ PropertiesPageClient affiche la liste
```

---

## 📊 RÉSULTAT ATTENDU

Après création d'un bien :

1. ✅ Le bien est créé en base avec `owner_id = profile.id`, `etat = "draft"`
2. ✅ Les détails sont mis à jour via PATCH
3. ✅ Les photos sont uploadées (ou ignorées si erreur)
4. ✅ Le cache Next.js est invalidé
5. ✅ Le bien apparaît dans `/app/owner/properties`
6. ✅ `OwnerDataProvider` reçoit `propertiesCount > 0`

---

## 🧪 TESTS À EFFECTUER

1. **Créer un bien avec photos valides** → Doit apparaître dans la liste
2. **Créer un bien avec photos invalides** → Doit apparaître quand même
3. **Créer un bien sans photos** → Doit apparaître quand même
4. **Vérifier les logs serveur** → Doit montrer `[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées`
5. **Vérifier Lighthouse a11y** → Plus d'erreur "form field without id/name"

---

**Toutes les corrections sont appliquées. Le flux devrait maintenant fonctionner correctement.**

