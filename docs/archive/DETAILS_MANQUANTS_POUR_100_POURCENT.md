# 🔍 Détails de ce qui manque pour atteindre 100% - Compte Propriétaire

**Date :** 2025-01-18

Ce document liste **exactement** ce qui manque dans chaque module pour atteindre 100% d'implémentation.

---

## 1. 🔐 Auth & Inscription : 95% → 100%

### ❌ Manquant (5%)

**OAuth (Connexion sociale)**
- ❌ Connexion Google (`/auth/signin` avec Google)
- ❌ Connexion GitHub (`/auth/signin` avec GitHub)
- ❌ Connexion Facebook (optionnel)
- ❌ Connexion Apple (optionnel)

**Note :** Mentionné dans `.cursorrules` comme "OAuth plus tard" - non critique pour MVP

**Code concerné :**
- `app/auth/signin/page.tsx` - Pas de boutons OAuth
- Configuration Supabase Auth - Providers OAuth non configurés

**Pour atteindre 100% :**
1. Configurer les providers OAuth dans Supabase Dashboard
2. Ajouter les boutons OAuth dans la page de connexion
3. Gérer les callbacks OAuth

---

## 2. 🏠 Logements & Baux : 85% → 100%

### ❌ Manquant (15%)

#### A. Propriétés

**1. Médias des propriétés non chargés**
- ❌ La fonction `fetchPropertyMedia()` existe mais n'est **jamais appelée** dans `GET /api/properties`
- ❌ Les propriétés retournées n'incluent pas les photos de couverture
- ❌ Pas de compteur de documents par propriété

**Code concerné :**
```typescript
// app/api/properties/route.ts ligne 255-336
async function fetchPropertyMedia(...) {
  // Cette fonction existe mais n'est JAMAIS utilisée !
}
```

**2. Pagination**
- ❌ Pas de pagination dans `GET /api/properties`
- ❌ Limite fixe de 100 propriétés pour owners
- ❌ Pas de paramètres `page`, `limit`, `offset`

**3. Recherche avancée**
- ❌ Recherche uniquement par adresse (basique)
- ❌ Pas de recherche par code postal, ville, type, surface, etc.
- ❌ Pas de filtres combinés

**4. Export/Import**
- ❌ Pas d'export CSV/Excel des propriétés
- ❌ Pas d'import en masse

#### B. Baux

**1. UI Colocation incomplète**
- ⚠️ Routes API existent (`/api/leases/[id]/roommates`, `/api/leases/[id]/payment-shares`)
- ❌ Pas de page UI propriétaire pour gérer les colocataires
- ❌ Pas de visualisation du split des paiements

**2. Signature électronique**
- ⚠️ Routes API existent (`/api/leases/[id]/sign`, `/api/signatures/sessions`)
- ❌ Intégration Yousign non configurée (mock seulement)
- ❌ Pas de UI pour suivre les signatures en temps réel

**3. Génération automatique de baux**
- ❌ Pas de templates de baux
- ❌ Pas de génération PDF automatique
- ❌ Pas de prévisualisation avant signature

**4. Indexation automatique**
- ❌ Pas de calcul automatique de l'indexation des loyers
- ❌ Pas d'alertes pour indexation due

**Pour atteindre 100% :**
1. Appeler `fetchPropertyMedia()` dans `GET /api/properties` et enrichir les résultats
2. Ajouter pagination avec `page`, `limit`, `offset`
3. Implémenter recherche avancée avec filtres combinés
4. Créer UI colocation pour propriétaires
5. Intégrer Yousign pour signatures
6. Ajouter génération PDF automatique des baux

---

## 3. 📊 Dashboard Propriétaire : 95% → 100%

### ❌ Manquant (5%)

**1. Calcul de performance**
```typescript
// app/api/owner/dashboard/route.ts ligne 453
performance: null, // TODO: Calculer si prix d'achat renseigné
```
- ❌ Pas de calcul ROI (Retour sur Investissement)
- ❌ Pas de calcul rendement locatif
- ❌ Colonne `prix_achat` manquante dans la table `properties`

**2. Vérification DPE expirant**
```typescript
// app/api/owner/dashboard/route.ts ligne 426
// TODO: Vérifier les dates d'expiration DPE si colonne existe
```
- ❌ Pas de vérification des dates d'expiration DPE
- ❌ Colonne `dpe_date_expiration` manquante dans `properties`
- ❌ Pas d'alertes pour DPE expirant

**3. Calculs LCD incomplets**
```typescript
// app/api/owner/dashboard/route.ts ligne 336
nights_sold: 0, // TODO: Calculer depuis les réservations si table existe
```
- ❌ Pas de table `reservations` pour LCD
- ❌ Pas de calcul des nuits vendues
- ❌ Pas de calcul du taux d'occupation réel

**4. Export des données**
- ❌ Pas d'export PDF du dashboard
- ❌ Pas d'export Excel des KPIs

**Pour atteindre 100% :**
1. Ajouter colonne `prix_achat` dans `properties`
2. Implémenter calcul ROI et rendement
3. Ajouter colonne `dpe_date_expiration` et vérification
4. Créer table `reservations` pour LCD
5. Implémenter calculs LCD complets

---

## 4. 💰 Facturation : 80% → 100%

### ❌ Manquant (20%)

**1. Intégration Stripe incomplète**
```typescript
// app/api/payments/create-intent/route.ts ligne 22-31
// TODO: Intégrer Stripe
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// const paymentIntent = await stripe.paymentIntents.create({...});
```
- ❌ Stripe non intégré (mock seulement)
- ❌ Pas de gestion des webhooks Stripe
- ❌ Pas de remboursements
- ❌ Pas de gestion des échecs de paiement

**2. Export PDF**
```typescript
// app/api/invoices/[id]/export/route.ts existe mais...
```
- ⚠️ Route existe mais implémentation incomplète
- ❌ Pas de génération PDF automatique des factures
- ❌ Pas de templates personnalisables

**3. Relances automatiques**
```typescript
// app/api/invoices/[id]/remind/route.ts existe mais...
```
- ⚠️ Route existe mais emails non envoyés
- ❌ Pas de templates d'emails de relance
- ❌ Pas de planification automatique des relances

**4. Pagination**
- ❌ Pas de pagination dans `GET /api/invoices`
- ❌ Limite implicite seulement

**5. Rapports financiers**
- ❌ Pas de rapports annuels
- ❌ Pas d'export comptable (FEC, etc.)
- ❌ Pas de calculs fiscaux automatiques

**6. Gestion des charges**
- ⚠️ Routes API existent (`/api/charges`)
- ❌ Pas de UI propriétaire pour gérer les charges
- ❌ Pas de répartition automatique des charges

**Pour atteindre 100% :**
1. Intégrer Stripe complètement (Payment Intents, Webhooks)
2. Implémenter génération PDF avec templates
3. Configurer emails de relance automatiques
4. Ajouter pagination
5. Créer UI gestion charges
6. Implémenter rapports financiers

---

## 5. 🎫 Tickets : 75% → 100%

### ❌ Manquant (25%)

**1. Work Orders UI**
- ⚠️ Routes API existent (`GET/POST/PUT/DELETE /api/work-orders`)
- ❌ Pas de page UI propriétaire pour gérer les interventions
- ❌ Pas de visualisation des devis prestataires
- ❌ Pas d'assignation de prestataires depuis l'UI

**2. Assignation prestataires**
```typescript
// app/api/tickets/[id]/quotes/route.ts existe mais...
```
- ⚠️ Routes API existent pour devis
- ❌ Pas de UI pour comparer les devis
- ❌ Pas de UI pour approuver/rejeter les devis
- ❌ Pas de notification aux prestataires

**3. Notifications temps réel**
- ❌ Pas d'abonnements Supabase Realtime pour tickets
- ❌ Pas de notifications push
- ❌ Pas de notifications email automatiques

**4. Pièces jointes**
- ⚠️ Upload possible mais limité
- ❌ Pas de galerie de photos dans les tickets
- ❌ Pas de prévisualisation des fichiers
- ❌ Limite de taille non gérée

**5. Historique et suivi**
- ❌ Pas de timeline complète des actions
- ❌ Pas de logs détaillés
- ❌ Pas de statistiques de résolution

**Pour atteindre 100% :**
1. Créer page UI work orders pour propriétaires
2. Créer UI comparaison et approbation devis
3. Implémenter Realtime pour notifications
4. Améliorer gestion pièces jointes
5. Ajouter historique détaillé

---

## 6. 📄 Documents : 80% → 100%

### ❌ Manquant (20%)

**1. EDL UI complète**
- ⚠️ Routes API existent (`GET/POST/PUT /api/edl/[id]`)
- ❌ Pas de page UI propriétaire pour créer un EDL
- ❌ Pas de formulaire structuré par sections
- ❌ Pas de photos intégrées dans EDL

**2. Génération PDF automatique**
- ❌ Pas de génération PDF des quittances
- ❌ Pas de génération PDF des baux
- ❌ Pas de génération PDF des EDL
- ❌ Pas de templates personnalisables

**3. OCR pour documents**
- ❌ Pas d'extraction automatique de données depuis factures
- ❌ Pas de reconnaissance de texte dans images
- ❌ Pas d'intégration Google Vision / AWS Textract

**4. Prévisualisation**
- ⚠️ URLs signées existent mais limitées
- ❌ Pas de prévisualisation PDF dans le navigateur
- ❌ Pas de prévisualisation images optimisée
- ❌ Pas de viewer de documents intégré

**5. Organisation avancée**
- ❌ Pas de dossiers/tags pour documents
- ❌ Pas de recherche full-text
- ❌ Pas de versioning des documents

**6. Signature électronique documents**
- ❌ Pas de signature électronique des quittances
- ❌ Pas de signature électronique des EDL
- ❌ Intégration Yousign manquante

**Pour atteindre 100% :**
1. Créer UI complète pour EDL avec formulaire structuré
2. Implémenter génération PDF avec templates
3. Intégrer OCR (Google Vision ou AWS Textract)
4. Améliorer prévisualisation (PDF.js, etc.)
5. Ajouter organisation avancée (tags, dossiers)
6. Intégrer signature électronique pour documents

---

## 📊 Résumé par Module

| Module | Manquant pour 100% | Priorité |
|--------|---------------------|----------|
| **Auth** | OAuth (Google, GitHub) | Basse |
| **Propriétés** | Médias, Pagination, Recherche avancée | Haute |
| **Baux** | UI Colocation, Yousign, Génération PDF | Haute |
| **Dashboard** | Performance ROI, DPE expiration, LCD réservations | Moyenne |
| **Facturation** | Stripe complet, PDF, Relances auto, UI Charges | Haute |
| **Tickets** | Work Orders UI, Prestataires UI, Realtime | Moyenne |
| **Documents** | EDL UI, PDF auto, OCR, Prévisualisation | Moyenne |

---

## 🎯 Plan d'Action pour Atteindre 100%

### Phase 1 - Critiques (Pour fonctionnalité de base)
1. ✅ Appeler `fetchPropertyMedia()` dans GET /api/properties
2. ✅ Ajouter pagination propriétés et factures
3. ✅ Créer UI gestion charges
4. ✅ Créer UI work orders

### Phase 2 - Importantes (Pour expérience utilisateur)
5. ⚠️ Intégrer Stripe complètement
6. ⚠️ Créer UI EDL complète
7. ⚠️ Implémenter génération PDF
8. ⚠️ Créer UI colocation propriétaires

### Phase 3 - Améliorations (Pour fonctionnalités avancées)
9. ⚠️ Intégrer Yousign
10. ⚠️ Implémenter OCR
11. ⚠️ Ajouter Realtime notifications
12. ⚠️ Calculer ROI et performance

---

## 💡 Notes Importantes

**Pourquoi pas 100% maintenant ?**
- Certaines fonctionnalités nécessitent des **intégrations externes** (Stripe, Yousign) qui nécessitent des clés API et configuration
- Certaines fonctionnalités nécessitent des **migrations de base de données** (colonnes manquantes)
- Certaines fonctionnalités nécessitent des **composants UI** qui n'existent pas encore
- Certaines fonctionnalités sont **optionnelles** pour un MVP (OAuth, OCR)

**Ce qui fonctionne déjà :**
- ✅ Toutes les fonctionnalités **core** sont implémentées
- ✅ L'application est **fonctionnelle** pour les cas d'usage principaux
- ✅ L'architecture est **solide** et extensible

**Estimation pour atteindre 100% :**
- **Phase 1 (Critiques)** : 2-3 semaines
- **Phase 2 (Importantes)** : 4-6 semaines
- **Phase 3 (Améliorations)** : 6-8 semaines

**Total estimé :** 12-17 semaines de développement

---

**Conclusion :** Les modules sont à 75-95% car ils manquent principalement :
1. **Intégrations externes** (Stripe, Yousign)
2. **Composants UI** pour certaines fonctionnalités avancées
3. **Fonctionnalités optionnelles** (OAuth, OCR)
4. **Optimisations** (pagination, recherche avancée)

L'application est **fonctionnelle** pour les cas d'usage principaux, mais nécessite ces améliorations pour une expérience complète.

