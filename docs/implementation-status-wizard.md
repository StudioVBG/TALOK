# Statut d'implémentation : Flux "Ajouter un bien (Propriétaire)" SOTA 2025

## ✅ Complété

### Documentation
- ✅ Documentation complète créée dans `docs/property-wizard-flow-sota2025.md`
- ✅ Spécifications détaillées pour toutes les étapes (1-9)
- ✅ Validations Zod documentées
- ✅ Routes API documentées
- ✅ Événements analytics documentés

### Routes API créées
- ✅ `POST /api/listings/publish` - Publier une annonce avec validation lint
- ✅ `POST /api/listings/unpublish` - Dépublier une annonce
- ✅ `POST /api/units/[unitId]/code` - Générer un code unique non réattribuable
- ✅ `POST /api/properties/[id]/features/bulk` - Ajouter des équipements en masse

### Événements Analytics
- ✅ Helper créé : `lib/helpers/analytics-events.ts`
- ✅ Événements définis pour toutes les étapes du wizard
- ✅ Intégration dans `PropertyTypeSelection` (étape 1)
  - `TYPE_STEP_VIEW` au montage
  - `TYPE_SELECTED` lors de la sélection

### Composants existants vérifiés
- ✅ `property-wizard-v3.tsx` - Orchestrateur principal
- ✅ `property-type-selection.tsx` - Étape 1 avec analytics intégrés
- ✅ `wizard-layout.tsx` - Layout réutilisable SOTA 2025
- ✅ `dynamic-step.tsx` - Étapes génériques
- ✅ `rooms-photos-step.tsx` - Étapes 4-5 (complet)
- ✅ `recap-step.tsx` - Étape 8

## 🔄 En cours / À compléter

### Intégration des événements analytics
- ⏳ Intégrer les événements dans les autres étapes :
  - Étape 2 (Adresse) : `PROP_ADDRESS_SUBMITTED`, `PROP_GEOCODED_OK/FAIL`
  - Étape 3 (Détails) : `UNIT_DETAILS_SAVED`
  - Étape 4 (Pièces) : `ROOMS_SET`
  - Étape 5 (Photos) : `PHOTOS_UPLOADED`
  - Étape 6 (Équipements) : `FEATURES_SAVED`
  - Étape 7 (Publication) : `LISTING_PUBLISH_CLICKED`, `LISTING_PUBLISHED/LINT_FAILED`
  - Étape 8 (Activation) : `PROPERTY_ACTIVATED`, `CODE_GENERATED`

### Routes API à vérifier/améliorer
- ⏳ Vérifier que `POST /api/properties` crée bien le draft avec `status: "draft"`
- ⏳ Vérifier que `POST /api/properties/[id]/units` crée l'unité par défaut si nécessaire
- ⏳ Vérifier que `PATCH /api/properties/[id]` peut mettre à jour le `status` à `"active"`

### Validations Zod
- ⏳ Vérifier que toutes les validations Zod sont alignées avec la documentation
- ⏳ Ajouter les validations manquantes pour les nouvelles routes API

### Tests
- ⏳ Tester le flux complet en mode RAPIDE (≤4 étapes)
- ⏳ Tester le flux complet en mode COMPLET (8 étapes)
- ⏳ Vérifier les événements analytics dans la table `outbox`
- ⏳ Vérifier les validations de lint pour la publication

## 📋 Prochaines étapes recommandées

1. **Intégrer les événements analytics** dans toutes les étapes restantes
2. **Tester les routes API** créées avec des requêtes réelles
3. **Vérifier les validations Zod** pour chaque étape
4. **Ajouter des tests E2E** avec Playwright pour le flux complet
5. **Optimiser les performances** du wizard (lazy loading, code splitting)

## 📝 Notes

- Toutes les routes API créées utilisent le `serviceRoleKey` pour éviter les problèmes RLS
- Les événements analytics sont émis de manière non-bloquante (ne bloquent pas le flux utilisateur)
- Le système d'événements utilise la table `outbox` de Supabase pour l'event bus
- Les validations Zod sont alignées avec les schémas existants dans `lib/validations/property-v3.ts`

