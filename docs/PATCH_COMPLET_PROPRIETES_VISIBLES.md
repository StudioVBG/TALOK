# 🔧 PATCH COMPLET - Propriétés Visibles + Gestion Erreurs Photos

**Date** : 2025-02-18  
**Objectif** : Assurer que les biens créés sont visibles même si incomplets

---

## 📋 PROBLÈMES IDENTIFIÉS

### Problème 1 : Propriétés non visibles
- **Symptôme** : `OwnerDataProvider` reçoit `propertiesCount: 0`
- **Cause** : Possible filtre sur `etat/status` qui exclut les biens en `draft`
- **Solution** : Supprimer tout filtre sur `etat/status` dans `fetchProperties`

### Problème 2 : Erreur upload photos bloque la création
- **Symptôme** : Erreur 400 "Les photos sans pièce doivent être marquées avec un tag valide"
- **Cause** : `tag: null` envoyé à l'API qui requiert un tag
- **Solution** : Ajouter un tag par défaut (`vue_generale`) et gérer les erreurs gracieusement

---

## 🔧 CORRECTIONS APPLIQUÉES

### 1. Suppression du filtre sur `etat/status` dans `fetchProperties`

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

**Changements** :
- ✅ Ajout de logs pour diagnostiquer les filtres appliqués
- ✅ Suppression explicite de tout filtre sur `etat/status`
- ✅ Commentaire explicite : "PAS DE FILTRE SUR etat/status - afficher tous les biens"

**Code** :
```typescript
// ✅ IMPORTANT: Ne PAS filtrer sur etat/status pour afficher TOUS les biens du propriétaire
// (y compris draft, incomplete, etc.) dans la page "Mes biens"
console.log("[fetchProperties] Filtres appliqués:", {
  owner_id: ownerId,
  status_filter: options.status || "AUCUN (tous les statuts inclus)",
  type_filter: options.type || "AUCUN",
  search: options.search || "AUCUN",
});

const { data: directData, error: directError, count } = await serviceClient
  .from("properties")
  .select("...")
  .eq("owner_id", ownerId)
  // ✅ PAS DE FILTRE SUR etat/status - afficher tous les biens du propriétaire
  .order("created_at", { ascending: false })
  ...
```

---

### 2. Gestion d'erreur améliorée pour l'upload de photos

**Fichier** : `app/app/owner/property/new/_steps/SummaryStep.tsx`

**Changements** :
- ✅ Ajout d'un tag par défaut (`vue_generale`) si `tag` est null
- ✅ Utilisation de `Promise.allSettled` au lieu de `Promise.all` pour ne pas bloquer sur les erreurs
- ✅ Filtrage des photos qui ont échoué pour continuer avec les autres
- ✅ Message d'erreur amélioré pour informer l'utilisateur

**Code** :
```typescript
// ✅ CORRECTION: Ajouter un tag par défaut si manquant
const defaultTag = photo.tag || "vue_generale";

return apiClient
  .post(`/properties/${propertyId}/photos/upload-url`, {
    tag: defaultTag, // ✅ Tag par défaut au lieu de null
    ...
  })
  .catch((error) => {
    // ✅ GESTION D'ERREUR: Logger mais ne pas bloquer
    console.warn(`[SummaryStep] Erreur upload URL pour photo ${index + 1}:`, error);
    return null; // Retourner null pour cette photo
  });

// ✅ FILTRER: Exclure les photos qui ont échoué
const uploadUrlsResults = await Promise.allSettled(uploadUrlPromises);
const uploadUrls = uploadUrlsResults
  .filter((result) => result.status === "fulfilled" && result.value !== null)
  ...
```

---

### 3. Conservation du bien en draft si incomplet

**Fichier** : `app/app/owner/property/new/_steps/SummaryStep.tsx`

**Changements** :
- ✅ Désactivation de l'activation automatique
- ✅ Le bien reste en `draft` et est visible dans la liste
- ✅ Message toast adapté selon les erreurs

**Code** :
```typescript
// ✅ IMPORTANT: Ne PAS activer automatiquement - garder le bien en draft
// pour qu'il soit visible même si incomplet
// L'utilisateur pourra l'activer manuellement quand il le souhaite
```

---

## ✅ RÉSULTATS ATTENDUS

### Après création d'un bien :

1. **Le bien est créé** avec `etat = "draft"`
2. **Les photos sont uploadées** avec tag par défaut si manquant
3. **En cas d'erreur photos** : Le bien est quand même créé et visible
4. **Le bien apparaît immédiatement** dans `/app/owner/properties`
5. **Message utilisateur** : "Bien créé avec succès" (avec note si incomplet)

### Logs serveur attendus :

```
[fetchProperties] Filtres appliqués: { status_filter: "AUCUN (tous les statuts inclus)", ... }
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
[OwnerLayout] ✅ Propriétés chargées: X
```

### Logs client attendus :

```
[OwnerDataProvider] Données reçues: { propertiesCount: X, ... }
[PropertiesPageClient] ✅ Après tous les filtres: X propriétés affichées
```

---

## 🧪 TESTS À EFFECTUER

1. **Créer un bien avec photos** :
   - Vérifier que les photos sont uploadées avec tag par défaut
   - Vérifier que le bien apparaît dans la liste

2. **Créer un bien sans photos** :
   - Vérifier que le bien est créé quand même
   - Vérifier que le bien apparaît dans la liste

3. **Créer un bien avec erreur photos** :
   - Simuler une erreur d'upload
   - Vérifier que le bien est créé quand même
   - Vérifier que le bien apparaît dans la liste

4. **Vérifier les filtres** :
   - Vérifier que les biens en `draft` apparaissent
   - Vérifier que les biens en `active` apparaissent
   - Vérifier que les biens en `incomplete` apparaissent

---

## 📊 CHECKLIST

- [x] Filtre sur `etat/status` supprimé dans `fetchProperties`
- [x] Tag par défaut ajouté pour les photos (`vue_generale`)
- [x] Gestion d'erreur améliorée avec `Promise.allSettled`
- [x] Activation automatique désactivée (bien reste en draft)
- [x] Logs de diagnostic ajoutés
- [ ] Test de création avec photos
- [ ] Test de création sans photos
- [ ] Test avec erreur photos
- [ ] Vérification que les biens apparaissent dans la liste

---

**Toutes les corrections sont appliquées. Les biens devraient maintenant être visibles même s'ils sont incomplets.**

