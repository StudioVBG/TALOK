# 📊 Analyse d'Intégrité des Données

**Date:** $(date)  
**Status:** 🔄 En cours

---

## 🎯 OBJECTIF

Vérifier l'intégrité des relations entre entités (clés étrangères, contraintes, transactions).

---

## 📋 RELATIONS IDENTIFIÉES

### Relations Principales

#### 1. Profiles & Auth
- `profiles.user_id` → `auth.users(id)` ON DELETE CASCADE ✅
- `profiles.id` → référencé par `owner_profiles`, `tenant_profiles`, `provider_profiles` ✅

#### 2. Properties
- `properties.owner_id` → `profiles(id)` ✅
- `properties.id` → référencé par `leases`, `units`, `documents`, `tickets`, `invitations` ✅

#### 3. Leases
- `leases.property_id` → `properties(id)` ✅
- `leases.unit_id` → `units(id)` (optionnel) ✅
- `leases.id` → référencé par `lease_signers`, `invoices`, `roommates`, `payment_shares` ✅

#### 4. Lease Signers
- `lease_signers.lease_id` → `leases(id)` ON DELETE CASCADE ✅
- `lease_signers.profile_id` → `profiles(id)` ✅

#### 5. Invoices & Payments
- `invoices.lease_id` → `leases(id)` ✅
- `invoices.owner_id` → `profiles(id)` ✅
- `invoices.tenant_id` → `profiles(id)` ✅
- `payments.invoice_id` → `invoices(id)` ✅

#### 6. Tickets & Work Orders
- `tickets.property_id` → `properties(id)` ✅
- `tickets.lease_id` → `leases(id)` (optionnel) ✅
- `work_orders.ticket_id` → `tickets(id)` ON DELETE CASCADE ✅
- `work_orders.provider_id` → `profiles(id)` ✅

#### 7. Documents
- `documents.owner_id` → `profiles(id)` ON DELETE CASCADE ✅
- `documents.tenant_id` → `profiles(id)` ON DELETE CASCADE ✅
- `documents.property_id` → `properties(id)` ON DELETE CASCADE ✅
- `documents.lease_id` → `leases(id)` ON DELETE CASCADE ✅

#### 8. Colocation (Roommates)
- `roommates.lease_id` → `leases(id)` ON DELETE CASCADE ✅
- `roommates.user_id` → `auth.users(id)` ON DELETE CASCADE ✅
- `roommates.profile_id` → `profiles(id)` ✅

#### 9. Payment Shares
- `payment_shares.invoice_id` → `invoices(id)` ✅
- `payment_shares.roommate_id` → `roommates(id)` ✅

---

## ✅ VÉRIFICATIONS À EFFECTUER

### 1. Contraintes de Clés Étrangères
- [ ] Vérifier que toutes les FK sont définies avec les bonnes règles (CASCADE, SET NULL, RESTRICT)
- [ ] Vérifier les index sur les colonnes FK pour les performances
- [ ] Vérifier les contraintes UNIQUE nécessaires

### 2. Transactions
- [ ] Vérifier que les opérations critiques utilisent des transactions
- [ ] Vérifier la gestion des rollbacks en cas d'erreur
- [ ] Vérifier l'isolation des transactions

### 3. Intégrité des Données
- [ ] Vérifier qu'il n'y a pas d'orphelins (enregistrements sans FK valide)
- [ ] Vérifier les contraintes CHECK sur les colonnes enum
- [ ] Vérifier les contraintes NOT NULL sur les colonnes critiques

### 4. RLS (Row Level Security)
- [ ] Vérifier que toutes les tables ont des politiques RLS appropriées
- [ ] Vérifier que les politiques respectent les relations FK
- [ ] Vérifier qu'il n'y a pas de récursion dans les politiques RLS

---

## 🔍 POINTS D'ATTENTION

### Relations Optionnelles
- `leases.unit_id` peut être NULL (pour propriétés non-colocation) ✅
- `tickets.lease_id` peut être NULL (ticket général sur la propriété) ✅
- `documents.lease_id` peut être NULL (document général) ✅

### Suppression en Cascade
- Suppression d'un `profile` → supprime `owner_profiles`, `tenant_profiles`, `provider_profiles` ✅
- Suppression d'une `property` → supprime `leases`, `documents`, `tickets` (via FK) ✅
- Suppression d'un `lease` → supprime `lease_signers`, `roommates`, `payment_shares` ✅
- Suppression d'un `ticket` → supprime `work_orders` ✅

### Relations Circulaires Potentielles
- `profiles` → `properties` → `leases` → `lease_signers` → `profiles` (via profile_id)
  - ⚠️ Attention aux politiques RLS récursives

---

## 📝 RECOMMANDATIONS

### 1. Transactions
- Utiliser des transactions pour les opérations multi-tables
- Exemple: Création d'un bail avec signataires, création d'une facture avec paiements

### 2. Validation
- Valider les FK avant insertion (vérifier que l'ID existe)
- Valider les contraintes métier (ex: un bail doit avoir au moins un propriétaire et un locataire)

### 3. Tests d'Intégrité
- Créer des tests pour vérifier les contraintes FK
- Créer des tests pour vérifier les suppressions en cascade
- Créer des tests pour vérifier les transactions

---

**Prochaine étape:** Vérifier les contraintes FK en base de données et créer des tests d'intégrité

