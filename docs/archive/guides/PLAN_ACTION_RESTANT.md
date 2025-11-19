# 📋 PLAN D'ACTION - TÂCHES RESTANTES

**Date** : Novembre 2025  
**Statut Application** : 🟢 Fonctionnellement complet, optimisations nécessaires

---

## 🚨 PRIORITÉ 1 - CRITIQUE (À faire immédiatement)

### 1. Résoudre le timeout `/api/properties` ⚠️ CRITIQUE

**Problème** : L'endpoint timeout encore après 300s malgré toutes les optimisations.

**Actions immédiates** :
- [ ] **Analyser les logs Vercel** pour identifier le point de blocage exact
- [ ] **Tester l'endpoint `/api/properties/test`** pour vérifier si le problème vient de notre code ou de Vercel/Supabase
- [ ] **Vérifier les index Supabase** sur `properties.owner_id` et `properties.created_at`
- [ ] **Implémenter la pagination côté serveur** pour éviter de charger toutes les propriétés d'un coup
- [ ] **Considérer un cache Redis** pour les propriétés fréquemment consultées

**Fichiers concernés** :
- `app/api/properties/route.ts` (ligne 339-364 : TODO réactiver fetchPropertyMedia)

**Estimation** : 2-4 heures

---

### 2. Implémenter la page `/arrears` (Impayés)

**Problème** : Lien cassé dans le dashboard owner (`app/app/owner/page.tsx` ligne 502).

**Actions** :
- [ ] Créer la page `/app/arrears/page.tsx`
- [ ] Créer le composant `ArrearsList` dans `features/billing/components/`
- [ ] Créer le service `arrears.service.ts` dans `features/billing/services/`
- [ ] Créer l'endpoint API `GET /api/arrears` pour récupérer les factures impayées
- [ ] Ajouter les filtres (par bail, par période, par montant)
- [ ] Ajouter les actions (relance, paiement partiel, plan de paiement)

**Fichiers à créer** :
- `app/arrears/page.tsx`
- `features/billing/components/arrears-list.tsx`
- `features/billing/services/arrears.service.ts`
- `app/api/arrears/route.ts`

**Estimation** : 4-6 heures

---

### 3. Réactiver `fetchPropertyMedia` avec optimisations

**Problème** : Désactivé temporairement pour éviter les timeouts (ligne 339-364 de `app/api/properties/route.ts`).

**Actions** :
- [ ] Implémenter la pagination pour les médias
- [ ] Limiter à 5 photos par propriété maximum
- [ ] Utiliser des URLs signées avec expiration courte
- [ ] Ajouter un cache côté client avec React Query
- [ ] Charger les médias de manière lazy (seulement quand visible)

**Fichiers concernés** :
- `app/api/properties/route.ts` (fonction `fetchPropertyMedia`)

**Estimation** : 3-4 heures

---

## 🔴 PRIORITÉ 2 - IMPORTANT (À faire cette semaine)

### 4. Améliorer les tests (Couverture 15% → 50%)

#### Tests unitaires manquants

- [ ] **Tests de validation Zod** pour toutes les entrées utilisateur
  - Fichiers : `lib/validations/*.ts`
  - Estimation : 6-8 heures

- [ ] **Tests de calcul financier** (factures, split paiements)
  - Fichiers : `features/billing/services/*.ts`
  - Estimation : 4-6 heures

- [ ] **Tests des helpers** (formatCurrency, formatDate, etc.)
  - Fichiers : `lib/helpers/*.ts`
  - Estimation : 2-3 heures

- [ ] **Tests des hooks React** (useAuth, useProfile, useProperties)
  - Fichiers : `lib/hooks/*.ts`
  - Estimation : 4-6 heures

#### Tests E2E manquants

- [ ] **Tests E2E des baux** (création → signature → activation)
  - Fichier : `tests/e2e/leases.spec.ts`
  - Estimation : 6-8 heures

- [ ] **Tests E2E des paiements** avec Stripe (mode test)
  - Fichier : `tests/e2e/payments-stripe.spec.ts`
  - Estimation : 4-6 heures

- [ ] **Tests E2E des tickets** (création, assignation, résolution)
  - Fichier : `tests/e2e/tickets.spec.ts`
  - Estimation : 4-6 heures

- [ ] **Tests E2E de la colocation** (ajout colocataires, split paiements)
  - Fichier : `tests/e2e/colocation.spec.ts`
  - Estimation : 6-8 heures

**Total estimation tests** : 36-51 heures

---

### 5. Finaliser l'intégration Stripe

**Problème** : Service préparé mais non configuré.

**Actions** :
- [ ] Configurer les variables d'environnement Stripe sur Vercel
- [ ] Tester les paiements en mode test
- [ ] Implémenter les webhooks Stripe (`/api/webhooks/payments`)
- [ ] Gérer les échecs de paiement
- [ ] Implémenter les remboursements
- [ ] Ajouter les tests E2E (voir priorité 2.4)

**Fichiers concernés** :
- `lib/services/stripe.service.ts` (déjà créé)
- `app/api/payments/create-intent/route.ts`
- `app/api/payments/confirm/route.ts`
- `app/api/webhooks/payments/route.ts`

**Estimation** : 8-12 heures

---

### 6. Implémenter les notifications email

**Problème** : Service préparé mais non configuré.

**Actions** :
- [ ] Configurer un service d'email (SendGrid, Resend, etc.)
- [ ] Créer les templates d'emails (facture, relance, invitation, etc.)
- [ ] Implémenter l'envoi d'emails dans les événements critiques
- [ ] Ajouter la gestion des préférences de notification
- [ ] Tester l'envoi d'emails

**Fichiers concernés** :
- `features/notifications/services/email.service.ts` (déjà créé)
- `app/api/emails/send/route.ts` (déjà créé)

**Estimation** : 6-8 heures

---

### 7. Documenter les endpoints API

**Problème** : 140 endpoints API non documentés.

**Actions** :
- [ ] Créer un fichier `docs/api-reference.md`
- [ ] Documenter chaque endpoint (méthode, URL, paramètres, réponse, exemples)
- [ ] Ajouter des exemples de requêtes (curl, JavaScript)
- [ ] Documenter les codes d'erreur
- [ ] Créer un fichier OpenAPI/Swagger (optionnel mais recommandé)

**Estimation** : 12-16 heures

---

## 🟡 PRIORITÉ 3 - MOYEN TERME (1-2 mois)

### 8. Optimiser les performances

#### 8.1 Pagination côté serveur
- [ ] Implémenter la pagination pour toutes les listes (properties, leases, invoices, tickets)
- [ ] Ajouter les paramètres `page` et `limit` aux endpoints API
- [ ] Implémenter la pagination infinie côté client avec React Query

#### 8.2 Cache avec React Query
- [ ] Configurer React Query avec des stratégies de cache appropriées
- [ ] Ajouter la préfetch des données fréquemment consultées
- [ ] Implémenter l'invalidation intelligente du cache

#### 8.3 Optimisation des requêtes Supabase
- [ ] Analyser les requêtes lentes avec `EXPLAIN ANALYZE`
- [ ] Ajouter des index manquants
- [ ] Optimiser les requêtes avec des jointures complexes

**Estimation totale** : 16-24 heures

---

### 9. Améliorer l'OCR pour les dossiers locatifs

**Problème** : Structure prête mais OCR non implémenté.

**Actions** :
- [ ] Intégrer Google Vision API ou AWS Textract
- [ ] Implémenter l'extraction de données depuis les pièces d'identité
- [ ] Implémenter l'extraction de données depuis les justificatifs de revenus
- [ ] Ajouter la validation et la correction manuelle
- [ ] Améliorer la confiance des extractions

**Fichiers concernés** :
- `supabase/functions/analyze-documents/index.ts` (déjà créé, à compléter)
- `app/api/applications/[id]/analyze/route.ts`

**Estimation** : 12-16 heures

---

### 10. Implémenter les Edge Functions manquantes

**Fonctions à créer** :
- [ ] `analyze-meter-photo` - OCR pour photos de compteurs
- [ ] `generate-pdf` - Génération PDF (baux, quittances, EDL)
- [ ] `recalculate-splits` - Recalcul des splits après paiement
- [ ] `send-notifications` - Envoi emails/SMS asynchrone
- [ ] `sync-enedis-grdf` - Sync relevés automatiques (optionnel)

**Estimation** : 20-30 heures

---

### 11. Ajouter Realtime Supabase

**Fonctionnalités** :
- [ ] Chat messages en temps réel
- [ ] Statut paiements (vue publique)
- [ ] Tickets (mises à jour)
- [ ] Notifications push

**Estimation** : 8-12 heures

---

## 🟢 PRIORITÉ 4 - LONG TERME (3-6 mois)

### 12. Améliorer la sécurité

- [ ] Audit de sécurité complet
- [ ] Tests de pénétration
- [ ] Amélioration des politiques RLS
- [ ] Implémenter 2FA (structure prête dans `IMPLEMENTATION_COMPLETE_FINAL.md`)
- [ ] Chiffrage des clés API (structure prête)

**Estimation** : 20-30 heures

---

### 13. Monitoring et observabilité

- [ ] Intégrer Sentry pour le monitoring d'erreurs
- [ ] Ajouter des métriques de performance (Vercel Analytics)
- [ ] Implémenter des alertes pour les erreurs critiques
- [ ] Dashboard de monitoring

**Estimation** : 8-12 heures

---

### 14. PWA & Mode Offline

- [ ] Service Worker
- [ ] Cache des brouillons (EDL, tickets, pièces)
- [ ] Reprise d'upload après reconnexion
- [ ] Mode offline basique

**Estimation** : 16-24 heures

---

### 15. Application mobile (React Native)

- [ ] Créer le projet React Native
- [ ] Implémenter les fonctionnalités principales
- [ ] Notifications push natives
- [ ] Publication sur App Store et Google Play

**Estimation** : 80-120 heures

---

## 📊 RÉSUMÉ DES PRIORITÉS

### Priorité 1 (Critique) - 9-14 heures
1. ✅ Résoudre timeout `/api/properties` (2-4h)
2. ✅ Implémenter page `/arrears` (4-6h)
3. ✅ Réactiver fetchPropertyMedia (3-4h)

### Priorité 2 (Important) - 62-87 heures
4. ✅ Améliorer les tests (36-51h)
5. ✅ Finaliser Stripe (8-12h)
6. ✅ Notifications email (6-8h)
7. ✅ Documentation API (12-16h)

### Priorité 3 (Moyen terme) - 56-82 heures
8. ✅ Optimiser performances (16-24h)
9. ✅ Améliorer OCR (12-16h)
10. ✅ Edge Functions (20-30h)
11. ✅ Realtime (8-12h)

### Priorité 4 (Long terme) - 124-186 heures
12. ✅ Sécurité (20-30h)
13. ✅ Monitoring (8-12h)
14. ✅ PWA (16-24h)
15. ✅ Mobile (80-120h)

**TOTAL ESTIMÉ** : 251-369 heures (~6-9 mois à temps plein)

---

## 🎯 RECOMMANDATIONS IMMÉDIATES

### Cette semaine
1. **Résoudre le timeout `/api/properties`** (bloque l'utilisation)
2. **Implémenter `/arrears`** (fonctionnalité manquante visible)
3. **Ajouter 3-5 tests E2E critiques** (baux, paiements)

### Ce mois
1. **Finaliser Stripe** (nécessaire pour les paiements)
2. **Implémenter les notifications email** (améliore l'UX)
3. **Documenter les 20 endpoints API les plus utilisés**

### Ce trimestre
1. **Augmenter la couverture de tests à 50%+**
2. **Optimiser les performances** (pagination, cache)
3. **Améliorer l'OCR** (facilite les dossiers locatifs)

---

## ✅ CHECKLIST RAPIDE

### À faire aujourd'hui
- [ ] Analyser les logs Vercel pour le timeout
- [ ] Tester `/api/properties/test`
- [ ] Créer la structure de base pour `/arrears`

### À faire cette semaine
- [ ] Implémenter `/arrears` complètement
- [ ] Réactiver `fetchPropertyMedia` avec optimisations
- [ ] Ajouter 2-3 tests E2E critiques

### À faire ce mois
- [ ] Finaliser Stripe
- [ ] Notifications email
- [ ] Documentation API (au moins les endpoints critiques)

---

**Dernière mise à jour** : Novembre 2025  
**Prochaine révision** : Après résolution du timeout `/api/properties`

