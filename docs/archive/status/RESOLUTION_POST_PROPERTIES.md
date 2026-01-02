# ✅ Résolution : Erreur 500 sur POST /api/properties

## 🔍 Problème Identifié

**Erreur :** `Could not find the 'charges_mensuelles' column of 'properties' in the schema cache`
**Code :** `PGRST204`

**Cause :** Le payload d'insertion dans `createDraftProperty` utilisait des colonnes qui n'existent pas dans la table `properties`.

## ✅ Corrections Appliquées

### 1. Payload Corrigé dans `createDraftProperty`

**Avant :**
```typescript
const insertPayload = {
  owner_id: profileId,
  type_bien: payload.type_bien,  // ❌ Colonne n'existe pas
  type: payload.type_bien,
  usage_principal: payload.usage_principal ?? "habitation",  // ❌ Colonne n'existe pas
  loyer_base: 0,  // ❌ Colonne n'existe pas
  charges_mensuelles: 0,  // ❌ Colonne n'existe pas
  depot_garantie: 0,  // ❌ Colonne n'existe pas
  zone_encadrement: false,  // ❌ Colonne n'existe pas
  // ...
};
```

**Après :**
```typescript
const insertPayload = {
  owner_id: profileId,
  type: payload.type_bien,  // ✅ Utiliser 'type' (colonne existante)
  adresse_complete: "Adresse à compléter",
  code_postal: "00000",
  ville: "Ville à préciser",
  departement: "00",
  surface: 0,
  nb_pieces: 0,
  nb_chambres: 0,
  ascenseur: false,
  energie: null,
  ges: null,
  loyer_hc: 0,  // ✅ Colonne existante
  encadrement_loyers: false,  // ✅ Colonne existante
  unique_code: uniqueCode,
  etat: "draft",
  // ✅ Colonnes supprimées car elles n'existent pas :
  // - type_bien (utiliser 'type' à la place)
  // - usage_principal
  // - loyer_base
  // - charges_mensuelles
  // - depot_garantie
  // - zone_encadrement
};
```

### 2. Utilisation de `insertPropertyRecord`

La fonction `insertPropertyRecord` gère automatiquement les colonnes manquantes en les supprimant du payload si elles causent une erreur.

**Avant :**
```typescript
const { data, error } = await serviceClient
  .from("properties")
  .insert(insertPayload)
  .select("id, owner_id, type_bien, etat")
  .single();
```

**Après :**
```typescript
const result = await insertPropertyRecord(serviceClient, insertPayload);
const data = result.data;
```

### 3. Liste des Colonnes Optionnelles Mise à Jour

```typescript
const OPTIONAL_COLUMNS = [
  "charges_mensuelles",
  "loyer_base",
  "depot_garantie",
  "zone_encadrement",
  "usage_principal",
  "type_bien", // Utiliser 'type' à la place
  "commercial_previous_activity",
  "complement_justification",
  "complement_loyer",
] as const;
```

### 4. Corrections des SELECT

Tous les `SELECT` ont été corrigés pour utiliser `type` au lieu de `type_bien` :
- `createDraftProperty` : `select("id, owner_id, type, etat")`
- Handler POST (draft) : logs utilisent `property.type`
- Handler POST (full) : `select("id, owner_id, type, etat")`

## 🧪 Tests Effectués

### Test 1 : Endpoint de Diagnostic
**URL :** `GET /api/properties/test-insert`
**Résultat :** ✅ `success: true`
**Propriété créée :**
```json
{
  "id": "57f730e4-d01b-4014-a6cc-4ca1ef79bbdb",
  "owner_id": "3b9280bc-061b-4880-a5e1-57d3f7ab06e5",
  "type": "appartement",
  "etat": "draft",
  "unique_code": "PROP-BRUD-D1D1"
}
```

## 📋 Fichiers Modifiés

1. ✅ `app/api/properties/route.ts`
   - Payload corrigé dans `createDraftProperty`
   - Utilisation de `insertPropertyRecord`
   - SELECT corrigés
   - Logs corrigés

2. ✅ `app/api/properties/test-insert/route.ts`
   - Endpoint de test créé et corrigé

## 🎯 Prochaines Étapes

1. **Tester la création d'un bien via le wizard**
   - Aller sur `/owner/property/new`
   - Sélectionner un type de bien
   - Vérifier que le draft est créé sans erreur

2. **Vérifier l'affichage**
   - Aller sur `/owner/properties`
   - Vérifier que le nouveau bien apparaît dans la liste

3. **Nettoyer les endpoints de test** (optionnel)
   - Supprimer `/api/properties/test-insert` et `/api/properties/test-create` une fois tout validé

---

**Date :** 2025-11-19
**Status :** ✅ Problème résolu, prêt pour tests finaux

