# Guide d'application des améliorations - Ajout de logement

## 🚀 Application rapide

### 1. Appliquer la migration Supabase

#### Option A : Via Supabase Dashboard
1. Ouvrir votre projet Supabase Dashboard
2. Aller dans **SQL Editor**
3. Copier le contenu de `supabase/migrations/202502150000_property_photos_storage_policies.sql`
4. Exécuter la requête
5. Vérifier que les 4 policies sont créées dans **Storage** > **Policies**

#### Option B : Via Supabase CLI
```bash
# Si vous utilisez Supabase CLI localement
supabase migration up

# Ou appliquer une migration spécifique
supabase db push
```

### 2. Vérifier les policies Storage

Dans Supabase Dashboard :
1. Aller dans **Storage** > **Buckets** > **property-photos**
2. Vérifier que les policies suivantes existent :
   - ✅ "Owners can upload property photos" (INSERT)
   - ✅ "Users can view accessible property photos" (SELECT)
   - ✅ "Owners can update property photos" (UPDATE)
   - ✅ "Owners can delete property photos" (DELETE)

### 3. Tester le flux

#### Mode FAST
```
http://localhost:3000/app/owner/properties/new?mode=fast
```
- Badge "Mode rapide" visible
- ≤4 étapes affichées
- Micro-copies adaptées

#### Mode FULL
```
http://localhost:3000/app/owner/properties/new
ou
http://localhost:3000/app/owner/properties/new?mode=full
```
- Badge "Mode complet" visible
- Toutes les étapes selon le type de bien

### 4. Exécuter les tests

#### Test bash
```bash
./scripts/test-add-property-flow.sh
```

#### Test E2E Playwright
```bash
npm run test:e2e -- tests/e2e/add-property-flow.spec.ts
```

## ✅ Checklist de vérification

- [ ] Migration appliquée dans Supabase
- [ ] Policies Storage créées et visibles
- [ ] Mode FAST fonctionne (`?mode=fast`)
- [ ] Mode FULL fonctionne (`?mode=full` ou par défaut)
- [ ] Animations fluides (200-250ms)
- [ ] Micro-copies visibles sous les boutons
- [ ] Badge mode visible (rapide/complet)
- [ ] Auto-save fonctionne
- [ ] Upload de photos fonctionne

## 🐛 Dépannage

### Erreur : "bucket property-photos does not exist"
**Solution** : Le bucket doit être créé avant d'appliquer les policies. Vérifiez que la migration `202502141000_property_rooms_photos.sql` a été appliquée.

### Erreur : "policy already exists"
**Solution** : Les policies existent déjà. C'est normal si vous réappliquez la migration.

### Mode FAST/FULL ne fonctionne pas
**Solution** : Vérifiez que le composant `PropertyWizardV3` est bien wrappé dans `<Suspense>` dans les pages.

### Animations pas fluides
**Solution** : Vérifiez que Framer Motion est installé (`npm list framer-motion`).

## 📚 Documentation

- Rapport détaillé : `docs/reports/add-property-debug-report.md`
- Migration SQL : `supabase/migrations/202502150000_property_photos_storage_policies.sql`
- Script de test : `scripts/test-add-property-flow.sh`
- Tests E2E : `tests/e2e/add-property-flow.spec.ts`

## 🎯 Prochaines étapes

1. ✅ Appliquer la migration
2. ✅ Tester le flux complet
3. ⏳ Ajouter validation inline améliorée (optionnel)
4. ⏳ Créer composant StepFrame réutilisable (optionnel)
5. ⏳ Ajouter analytics pour suivre l'utilisation FAST vs FULL

