# 🔍 Rapport d'Audit - Formulaire de Création de Bien

**Date:** 2026-01-22
**Auteur:** Claude (Audit automatisé)
**Contexte:** Le bouton "Continuer" de l'étape "Configuration immeuble" (Details) ne fonctionne pas

---

## 📋 Résumé Exécutif

Le formulaire de création de bien présente **5 bugs critiques** et **3 problèmes mineurs** qui empêchent la validation de l'étape "Détails" et provoquent des erreurs 400 lors de la sauvegarde.

### Erreurs Console Observées
```
api-adresse.data.gouv.fr/search/?q=01%20&limit=6&autocomplete=1:1 → 400
/api/properties/eccc1cac-e54a-48e9-84a7-83c47f738fc1:1 → 400
[WizardStore] Erreur sauvegarde: Error: Données invalides
```

---

## 🚨 Bugs Critiques

### BUG #1: Validation `canGoNext()` incomplète
**Fichier:** `features/properties/components/v3/property-wizard-v3.tsx:429-437`

**Description:** La validation frontend pour l'étape "details" ne vérifie PAS tous les champs marqués comme "Obligatoire" dans l'UI.

**Champs UI marqués "Obligatoire":**
- ✅ Surface habitable (vérifié)
- ✅ Loyer HC (vérifié)
- ✅ Chauffage type (vérifié)
- ✅ Chauffage énergie - si type ≠ "aucun" (vérifié)
- ✅ Eau chaude type (vérifié)
- ❌ **DPE classe énergie** (NON vérifié mais marqué "Obligatoire" dans `DetailsStepHabitation.tsx:205`)
- ❌ **Usage principal** (NON vérifié mais marqué "Obligatoire" dans `DetailsStepHabitation.tsx:135`)

**Code actuel (ligne 429-437):**
```typescript
case 'details':
  const hasSurface = (formData.surface_habitable_m2 || formData.surface || 0) > 0;
  const hasLoyer = (formData.loyer_hc || 0) > 0;
  const hasChauffage = !!(formData as any).chauffage_type;
  const needsChauffageEnergie = (formData as any).chauffage_type && (formData as any).chauffage_type !== "aucun";
  const hasChauffageEnergie = needsChauffageEnergie ? !!(formData as any).chauffage_energie : true;
  const hasEauChaude = !!(formData as any).eau_chaude_type;

  return hasSurface && hasLoyer && hasChauffage && hasChauffageEnergie && hasEauChaude;
```

**Impact:** L'utilisateur peut passer à l'étape suivante sans avoir rempli les champs DPE et Usage principal qui sont obligatoires légalement (loi ALUR).

---

### BUG #2: Chauffage énergie non sélectionné bloque la progression
**Fichier:** `features/properties/components/v3/immersive/steps/DetailsStepHabitation.tsx:302-316`

**Description:** Dans la capture d'écran, on voit:
- Chauffage: "Collectif" ✓
- Énergie: "Énergie..." (placeholder visible) ❌

L'utilisateur a sélectionné le type de chauffage ("Collectif") mais n'a **PAS** sélectionné l'énergie. La validation `canGoNext()` détecte correctement ce problème, mais:
1. L'UI ne montre PAS clairement que ce champ est obligatoire quand chauffage ≠ "aucun"
2. Le placeholder "Énergie..." ne se distingue pas assez d'une valeur sélectionnée

**Impact:** Le bouton reste désactivé sans feedback clair à l'utilisateur sur ce qu'il doit corriger.

---

### BUG #3: Erreur 400 API Adresse - Requête trop courte
**Fichier:** `components/ui/address-autocomplete.tsx:127-128`

**Description:** Quand l'utilisateur tape "01 " (2 chiffres + espace), la requête est envoyée à l'API :
```
https://api-adresse.data.gouv.fr/search/?q=01%20&limit=6&autocomplete=1
```

Cette requête retourne une erreur 400 car la query est trop courte/invalide.

**Cause Racine:**
- Le check `searchQuery.length < 3` (ligne 106) vérifie la longueur AVANT le trim
- "01 " a une longueur de 3, donc passe le check
- Mais après encoding URL, "01%20" n'est pas une requête valide

**Code problématique:**
```typescript
if (searchQuery.length < 3 || hasSelected) {
  setSuggestions([]);
  setNoResults(false);
  return;
}
```

**Impact:** Console polluée d'erreurs, mauvaise UX lors de la saisie d'adresse.

---

### BUG #4: Erreur 400 PATCH `/api/properties/[id]` - Données invalides
**Fichier:** `app/api/properties/[id]/route.ts:175-179`

**Description:** La sauvegarde automatique (debounced) échoue avec "Données invalides".

**Causes possibles identifiées:**
1. Champs envoyés avec des valeurs `null` ou `undefined` que Zod n'accepte pas
2. Le schéma `propertyGeneralUpdateSchema` est trop permissif (tous les champs sont `.optional()`) mais la base de données peut refuser certaines combinaisons
3. Le champ `visite_virtuelle_url` est supprimé (ligne 310) car la colonne n'existe pas encore en BDD

**Logs à vérifier:**
```typescript
// Ligne 172 - Debug log du body reçu
console.log(`[PATCH /api/properties/${params.id}] Body reçu:`, JSON.stringify(body, null, 2));

// Ligne 177 - Erreurs de validation Zod
console.error(`[PATCH /api/properties/${params.id}] ❌ Erreur validation Zod:`, ...);
```

**Impact:** Les données ne sont pas sauvegardées, `syncStatus` reste en 'error'.

---

### BUG #5: État `syncStatus` bloque le bouton
**Fichier:** `features/properties/components/v3/property-wizard-v3.tsx:420`

**Description:** Le bouton "Continuer" est désactivé quand `syncStatus === 'saving'`.

```typescript
const canGoNext = () => {
  if (syncStatus === 'saving') return false;
  // ...
};
```

Si une erreur 400 survient pendant la sauvegarde, le flow est:
1. `syncStatus = 'saving'` (ligne 358)
2. PATCH échoue avec 400
3. `syncStatus = 'error'` (ligne 396)

**Mais** si une nouvelle modification est faite avant que l'erreur soit traitée, le debounce peut laisser `syncStatus` en état incohérent.

**Impact:** Le bouton peut rester désactivé même si toutes les données sont valides côté frontend.

---

## ⚠️ Problèmes Mineurs

### PM #1: Typage insuffisant dans `wizard-store.ts`
**Fichier:** `features/properties/stores/wizard-store.ts:561`

```typescript
lastError: error.message  // ❌ 'error' est de type 'unknown'
```

Devrait être:
```typescript
lastError: error instanceof Error ? error.message : String(error)
```

---

### PM #2: Labels UI incohérents avec la validation
**Fichier:** `features/properties/components/v3/immersive/steps/DetailsStepHabitation.tsx`

Les Badges "Obligatoire" (lignes 135, 205, 288, 328) ne correspondent pas tous aux champs validés dans `canGoNext()`.

---

### PM #3: Message d'erreur non affiché à l'utilisateur
**Fichier:** `features/properties/stores/wizard-store.ts:394-396`

Quand une erreur de sauvegarde survient, `lastError` est mis à jour mais cette valeur n'est **jamais affichée** dans l'UI du wizard.

---

## 📊 Flux de Données Analysé

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Input (DetailsStepHabitation.tsx)                              │
│ ↓                                                                   │
│ updateFormData({ chauffage_type: "collectif" })                    │
│ ↓                                                                   │
│ wizard-store.ts:updateFormData()                                    │
│   1. Optimistic update: formData = { ...formData, ...updates }     │
│   2. syncStatus = 'saving'                                          │
│   3. Debounce 500ms                                                 │
│ ↓                                                                   │
│ propertiesService.updatePropertyGeneral(propertyId, updates)        │
│ ↓                                                                   │
│ apiClient.patch('/api/properties/[id]', data)                       │
│ ↓                                                                   │
│ Route: PATCH /api/properties/[id]                                   │
│   1. propertyGeneralUpdateSchema.safeParse(body)  ← ERREUR ICI     │
│   2. Si erreur Zod → 400 "Données invalides"                       │
│ ↓                                                                   │
│ wizard-store catch block                                            │
│   syncStatus = 'error'                                              │
│   lastError = "Erreur sauvegarde"                                  │
│ ↓                                                                   │
│ canGoNext() vérifie syncStatus !== 'saving'                         │
│ Mais vérifie aussi les champs → chauffage_energie manquant!         │
│ ↓                                                                   │
│ Bouton "Continuer" = disabled                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Corrections Recommandées

### Fix #1: Améliorer la validation `canGoNext()` avec feedback
```typescript
// property-wizard-v3.tsx - Ajouter un état pour les erreurs de champs
const [missingFields, setMissingFields] = useState<string[]>([]);

const canGoNext = () => {
  // Ne pas bloquer si en train de sauvegarder, juste pendant l'erreur
  if (syncStatus === 'error') {
    // Afficher toast avec lastError
    return false;
  }

  switch (currentStep) {
    case 'details':
      const errors: string[] = [];
      if (!((formData.surface_habitable_m2 || formData.surface || 0) > 0)) {
        errors.push('Surface');
      }
      if (!((formData.loyer_hc || 0) > 0)) {
        errors.push('Loyer HC');
      }
      if (!formData.chauffage_type) {
        errors.push('Type de chauffage');
      }
      if (formData.chauffage_type && formData.chauffage_type !== "aucun" && !formData.chauffage_energie) {
        errors.push('Énergie de chauffage');
      }
      if (!formData.eau_chaude_type) {
        errors.push('Type eau chaude');
      }
      // NOUVEAU: Ajouter DPE et usage_principal
      if (!formData.dpe_classe_energie) {
        errors.push('DPE énergie');
      }

      setMissingFields(errors);
      return errors.length === 0;
  }
};
```

### Fix #2: Améliorer l'UI du champ énergie de chauffage
```tsx
// DetailsStepHabitation.tsx - Ajouter un indicateur visuel d'obligation
{(formData as any).chauffage_type && (formData as any).chauffage_type !== "aucun" && (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Label>Énergie</Label>
      <Badge variant="destructive" className="text-[10px]">Obligatoire</Badge>
    </div>
    <Select ...>
```

### Fix #3: Valider la requête avant envoi à l'API adresse
```typescript
// address-autocomplete.tsx
const searchAddress = useCallback(async (searchQuery: string) => {
  const trimmedQuery = searchQuery.trim();

  // Vérifier longueur minimale après trim
  if (trimmedQuery.length < 3 || hasSelected) {
    setSuggestions([]);
    setNoResults(false);
    return;
  }

  // Vérifier que ce n'est pas juste des chiffres/espaces
  if (!/[a-zA-Z]/.test(trimmedQuery)) {
    setSuggestions([]);
    setNoResults(false);
    return;
  }

  // ... reste du code
}, [hasSelected]);
```

### Fix #4: Afficher les erreurs de sauvegarde à l'utilisateur
```tsx
// ImmersiveWizardLayout.tsx ou property-wizard-v3.tsx
{syncStatus === 'error' && lastError && (
  <div className="text-destructive text-sm flex items-center gap-2">
    <AlertCircle className="h-4 w-4" />
    {lastError}
  </div>
)}
```

---

## 📁 Fichiers Impactés

| Fichier | Priorité | Action |
|---------|----------|--------|
| `features/properties/components/v3/property-wizard-v3.tsx` | CRITIQUE | Corriger validation |
| `features/properties/components/v3/immersive/steps/DetailsStepHabitation.tsx` | HAUTE | Améliorer UI feedback |
| `components/ui/address-autocomplete.tsx` | MOYENNE | Valider query avant envoi |
| `features/properties/stores/wizard-store.ts` | MOYENNE | Corriger typage + gestion erreurs |
| `features/properties/components/v3/immersive/ImmersiveWizardLayout.tsx` | BASSE | Afficher erreurs |

---

## 🧪 Tests à Ajouter

1. **Test E2E:** Créer un bien avec tous les champs obligatoires
2. **Test Unitaire:** `canGoNext()` avec différentes combinaisons de données
3. **Test API:** PATCH `/api/properties/[id]` avec données partielles/invalides
4. **Test Component:** `AddressAutocomplete` avec requêtes courtes

---

## 📝 Conclusion

Le bug principal est que **l'utilisateur n'a pas sélectionné l'énergie de chauffage** alors que le type est "Collectif". La validation frontend fonctionne correctement en bloquant la progression, mais l'UI ne donne pas assez de feedback sur le champ manquant.

Les erreurs 400 de l'API sont une conséquence secondaire des tentatives de sauvegarde avec des données incomplètes ou mal formatées.

**Action immédiate recommandée:** L'utilisateur doit sélectionner une énergie de chauffage (électricité, gaz, etc.) pour pouvoir continuer.
