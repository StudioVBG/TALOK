# 🚀 Quick Start - Ajout de logement amélioré

## ⚡ Démarrage rapide (5 minutes)

### 1. Appliquer la migration Supabase

**Dans Supabase Dashboard** :
1. Ouvrir **SQL Editor**
2. Copier-coller le contenu de :
   ```
   supabase/migrations/202502150000_property_photos_storage_policies.sql
   ```
3. Cliquer sur **Run**
4. Vérifier le message de succès

### 2. Vérifier les policies Storage

**Dans Supabase Dashboard** :
1. Aller dans **Storage** > **Buckets** > **property-photos**
2. Cliquer sur **Policies**
3. Vérifier que 4 policies sont présentes :
   - ✅ Owners can upload property photos
   - ✅ Users can view accessible property photos
   - ✅ Owners can update property photos
   - ✅ Owners can delete property photos

### 3. Démarrer l'application

```bash
npm run dev
```

### 4. Tester le flux

**Ouvrir dans le navigateur** :

**Mode FAST** :
```
http://localhost:3000/app/owner/properties/new?mode=fast
```

**Mode FULL** :
```
http://localhost:3000/app/owner/properties/new?mode=full
```

### 5. Vérifications visuelles

✅ **Badge mode** : Doit afficher "Mode rapide" ou "Mode complet"  
✅ **Animations** : Transitions fluides entre étapes (200-250ms)  
✅ **Micro-copies** : Messages contextuels sous le bouton "Suivant"  
✅ **Barre de progression** : Affichage correct du pourcentage  
✅ **Auto-save** : Badge "Brouillon sauvegardé automatiquement" après sélection du type

---

## 🧪 Tests automatisés

### Script bash
```bash
./scripts/test-add-property-flow.sh
```

### Tests E2E Playwright
```bash
npm run test:e2e -- tests/e2e/add-property-flow.spec.ts
```

---

## 🐛 Dépannage rapide

### Problème : Badge mode ne s'affiche pas
**Solution** : Vérifier que l'URL contient `?mode=fast` ou `?mode=full`

### Problème : Erreur "bucket property-photos does not exist"
**Solution** : Appliquer d'abord la migration `202502141000_property_rooms_photos.sql`

### Problème : Animations pas fluides
**Solution** : Vérifier que Framer Motion est installé (`npm list framer-motion`)

### Problème : useSearchParams error
**Solution** : Vérifier que le composant est wrappé dans `<Suspense>`

---

## 📊 Checklist de validation

- [ ] Migration appliquée dans Supabase
- [ ] 4 policies Storage visibles
- [ ] Mode FAST fonctionne (`?mode=fast`)
- [ ] Mode FULL fonctionne (`?mode=full`)
- [ ] Badge mode visible
- [ ] Animations fluides (200-250ms)
- [ ] Micro-copies visibles
- [ ] Auto-save fonctionne
- [ ] Navigation Précédent/Suivant fonctionne
- [ ] Barre de progression correcte

---

## 🎯 Fonctionnalités disponibles

### Mode FAST (≤4 étapes)
- Sélection type de bien
- Adresse
- Détails essentiels
- Photos simples
- Récapitulatif

### Mode FULL (6-8 étapes)
- Sélection type de bien
- Adresse complète
- Détails complets
- Pièces détaillées
- Photos par pièce
- Équipements
- Conditions de location
- Récapitulatif

### Animations
- Transitions entre étapes : 200-250ms
- Micro-interactions boutons : Spring physics
- Barre de progression animée
- Badge mode avec animation

### Micro-copies
- "Parfait, on passe à l'adresse 🏠"
- "Super ! Maintenant les détails du logement 📐"
- "Encore 2 étapes !" (mode FAST)
- "Tout est prêt ! Soumettez votre logement 🎉"

---

## 📚 Documentation complète

- **Rapport détaillé** : `docs/reports/add-property-debug-report.md`
- **Guide d'application** : `GUIDE_APPLICATION_MIGRATION.md`
- **Résumé implémentation** : `IMPLEMENTATION_SUMMARY.md`

---

**Prêt à utiliser ! 🎉**

