# 🚀 Plan de Développement - Talok

## ✅ Phase 1 : Infrastructure & Déploiement (TERMINÉE)

### 1.1 Validation et Sécurité
- [x] Validation automatique de l'URL Supabase dans `client.ts`
- [x] Validation automatique de l'URL Supabase dans `server.ts`
- [x] Validation automatique de l'URL Supabase dans `typed-client.ts`
- [x] Validation automatique de l'URL Supabase dans `middleware.ts`

### 1.2 Scripts et Outils
- [x] Script bash `check-env.sh` pour vérifier les variables d'environnement
- [x] Script TypeScript `check-env.ts` (alternative)
- [x] Commande `npm run check-env` fonctionnelle

### 1.3 Documentation
- [x] `DEPLOYMENT_GUIDE.md` : Guide complet de déploiement
- [x] `FIX_SUPABASE_URL.md` : Guide pour corriger l'URL Supabase
- [x] `VERCEL_ENV_SETUP.md` : Configuration des variables Vercel
- [x] `STATUS_DEPLOYMENT.md` : État actuel du déploiement
- [x] `RESUME_ACTIONS.md` : Résumé des actions effectuées
- [x] `PLAN_DEVELOPPEMENT.md` : Ce document

## 🔄 Phase 2 : Améliorations Wizard V3 (EN COURS)

### 2.1 Corrections des TODOs
- [ ] Remplacer l'icône `CarIcon` par une icône appropriée pour lave-linge
- [ ] Intégrer une API de géolocalisation (Geoapify, Algolia Places, Google Places)
- [ ] Migrer `RoomPayload` vers `RoomTypeV3` pour les types de pièces
- [ ] Migrer `PhotoUploadRequest` vers `PhotoTagV3` pour les tags de photos
- [ ] Utiliser le bon type depuis `PropertyUpdate` dans `property-card.tsx`

### 2.2 Améliorations UX
- [ ] Améliorer les animations et transitions dans le wizard
- [ ] Ajouter des validations en temps réel pour chaque étape
- [ ] Implémenter l'auto-save avec indicateur visuel
- [ ] Ajouter des messages d'aide contextuels pour chaque champ

## 📋 Phase 3 : Fiche Propriété V2.5 (À FAIRE)

### 3.1 Structure de Base
- [ ] Créer le composant `PropertyDetailV2` avec layout dashboard-like
- [ ] Implémenter le header avec titre, badges, et actions rapides
- [ ] Créer le bloc résumé avec informations clés (loyer, charges, dépôt)

### 3.2 Tabs Principales
- [ ] **Tab "Gestion & contrat"** :
  - Liste des baux avec statuts
  - Liste des locataires
  - Gestion des loyers et charges
  - Documents associés
  - Montants éditables (loyer_hc, charges_mensuelles, depot_garantie)

- [ ] **Tab "Pièces & photos"** :
  - Liste des rooms à gauche avec badges ✅/⚠️ selon présence de photos
  - Galerie de la pièce sélectionnée à droite
  - Bloc "Photos non classées" pour associer les photos du wizard
  - Suggestion d'ajouter une photo lors de l'ajout d'une pièce

- [ ] **Tab "Annonce & expérience locataire"** :
  - Card "Identité de l'annonce" (titre + tagline)
  - Card "Description" (3 textes)
  - Card "Couchages" (via beds par chambre)
  - Card "Séjour & accès"
  - Card "Règlement intérieur"
  - Card "Sécurité"
  - Card "Quartier & environnement"
  - Indicateur de complétion d'annonce (score + checklist)

### 3.3 Fonctionnalités
- [ ] Édition inline des champs éditables
- [ ] Upload de photos par pièce
- [ ] Gestion des couchages par chambre
- [ ] Calcul automatique du score de complétion

## 🔐 Phase 4 : Mode de Location & Baux (À FAIRE)

### 4.1 Logique Backend
- [ ] Implémenter la vérification des baux actifs dans `PATCH /api/properties/:id`
- [ ] Retourner l'erreur `400 active_lease_blocking` si un bail actif existe
- [ ] Créer la fonction `hasActiveLeaseForProperty(propertyId)`

### 4.2 UI/UX
- [ ] Ajouter un champ éditable `mode_location` dans l'UI annonce
- [ ] Afficher un texte d'explication pour le changement de mode
- [ ] Créer une modal d'erreur si `active_lease_blocking` :
  - Afficher le nom du locataire
  - Afficher le type de bail
  - Afficher les dates
  - Boutons : "Voir le bail en cours" et "Créer une fin de bail / préavis"

## 🧪 Phase 5 : Process QA / Admin (À FAIRE)

### 5.1 Page Admin Process & QA
- [ ] Créer la route `/admin/process-tests`
- [ ] Implémenter la liste des scénarios de test :
  - `create_fast_T2_habitation`
  - `create_detailed_T3_habitation`
  - `create_parking`
  - `submit_without_photos`
  - `switch_mode_location_with_active_lease`

### 5.2 Fonctionnalités de Test
- [ ] Afficher les étapes de chaque scénario
- [ ] Lancer les appels API (en environnement de test)
- [ ] Afficher un résultat vert/rouge pour chaque test
- [ ] Logger la réponse complète
- [ ] Permettre de relancer les tests individuellement

## 🎨 Phase 6 : Améliorations UI/UX SOTA 2025 (EN COURS)

### 6.1 Design System
- [x] Créer `lib/design-system/animations.ts` avec variants Framer Motion
- [x] Créer `lib/design-system/design-tokens.ts` avec classes Tailwind réutilisables
- [x] Intégrer les animations dans les composants du wizard
- [ ] Créer un Storybook pour documenter les composants

### 6.2 Composants Réutilisables
- [x] Créer `lib/design-system/wizard-components.tsx` avec composants unifiés
- [ ] Créer des composants pour les cards Bento Box
- [ ] Créer des composants pour les animations de chargement
- [ ] Créer des composants pour les micro-interactions

### 6.3 Thème et Accessibilité
- [ ] Implémenter le dark mode complet
- [ ] Améliorer les contrastes pour l'accessibilité
- [ ] Ajouter des animations réduites pour les préférences utilisateur
- [ ] Tester avec des lecteurs d'écran

## 📊 Phase 7 : Tests et Qualité (À FAIRE)

### 7.1 Tests Unitaires
- [ ] Tests pour la validation des propriétés (Zod schemas)
- [ ] Tests pour la logique de changement de `mode_location`
- [ ] Tests pour la génération de factures
- [ ] Tests pour les changements de statut de bail

### 7.2 Tests E2E
- [ ] Test du wizard mode rapide
- [ ] Test du wizard mode avancé
- [ ] Test de la soumission d'une propriété
- [ ] Test du changement de mode de location avec bail actif

### 7.3 Tests de Performance
- [ ] Optimiser les requêtes Supabase
- [ ] Implémenter la pagination pour les listes
- [ ] Optimiser les images avec Next.js Image
- [ ] Mesurer et optimiser le Core Web Vitals

## 🔄 Phase 8 : Intégrations Futures (PLANIFIÉ)

### 8.1 Paiements
- [ ] Intégrer Stripe pour les paiements en ligne
- [ ] Créer les webhooks Stripe
- [ ] Implémenter la gestion des remboursements

### 8.2 Signatures
- [ ] Intégrer Yousign ou DocuSign pour les signatures électroniques
- [ ] Créer les workflows de signature pour les baux
- [ ] Gérer les notifications de signature

### 8.3 Notifications
- [ ] Implémenter les notifications push
- [ ] Créer les templates d'emails
- [ ] Ajouter les notifications SMS (optionnel)

## 📈 Phase 9 : Analytics et Reporting (PLANIFIÉ)

### 9.1 Dashboard Propriétaire
- [ ] Ajouter des graphiques de revenus
- [ ] Créer des rapports de performance
- [ ] Implémenter des alertes personnalisées

### 9.2 Dashboard Admin
- [ ] Créer des analytics globaux
- [ ] Implémenter la gestion des coûts API
- [ ] Ajouter des rapports de modération

## 🎯 Priorités Actuelles

1. **URGENT** : Corriger les variables d'environnement sur Vercel et redéployer
2. **HAUTE** : Finaliser la fiche propriété V2.5 avec toutes les tabs
3. **MOYENNE** : Implémenter la logique `mode_location` avec vérification des baux
4. **MOYENNE** : Corriger les TODOs du wizard V3
5. **BASSE** : Créer la page Admin Process & QA

## 📝 Notes

- Tous les fichiers de documentation sont dans la racine du projet
- Les scripts sont dans `scripts/`
- Le design system est dans `lib/design-system/`
- Les composants du wizard V3 sont dans `features/properties/components/v3/`

---

**Dernière mise à jour** : $(date +"%Y-%m-%d %H:%M:%S")

