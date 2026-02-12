# Audit d'Intégrité de la Base de Données Talok

**Date** : 2026-02-12
**Scope** : Toutes les tables du schéma `public` (127+ tables, 226 migrations)
**Stack** : Supabase (PostgreSQL 15), Next.js 14+, TypeScript

---

## Table des Matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Phase 1 — Cartographie des Relations](#2-phase-1--cartographie-des-relations)
3. [Phase 2 — Détection des Orphelins](#3-phase-2--détection-des-orphelins)
4. [Phase 3 — Détection des Doublons](#4-phase-3--détection-des-doublons)
5. [Phase 4 — Plan de Nettoyage SAFE](#5-phase-4--plan-de-nettoyage-safe)
6. [Recommandations Structurelles](#6-recommandations-structurelles)

---

## 1. Résumé Exécutif

### Constats clés

| Métrique | Valeur |
|----------|--------|
| Tables dans le schéma `public` | **127+** |
| Relations FK formelles | **127** |
| Colonnes `*_id` sans FK formelle | **~40 estimées** |
| Points de contrôle orphelins | **65 vérifications** |
| Points de contrôle doublons | **16 vérifications** |
| Migration de nettoyage existante | `20260108500000_orphan_cleanup_sota2026.sql` |

### Sévérité des risques identifiés

| Sévérité | Description | Zones concernées |
|----------|-------------|------------------|
| **CRITICAL** | Données cassées, FK pointant vers des lignes supprimées | `lease_signers`, `invoices`, `payments`, `profiles` |
| **HIGH** | Entités sans parent logique, baux sans signataire | `leases`, `documents`, `edl`, `roommates`, `meters` |
| **MEDIUM** | FK implicites (pas de contrainte SQL), données détachées | `tickets`, `notifications`, `conversations` |
| **LOW** | Données obsolètes, doublons bénins | `notifications`, `otp_codes`, `photos` |

---

## 2. Phase 1 — Cartographie des Relations

### 2.1 Graphe de Dépendances Principal

```
auth.users
  └── profiles (user_id → auth.users.id, ON DELETE CASCADE)
        ├── owner_profiles (profile_id → profiles.id, ON DELETE CASCADE)
        ├── tenant_profiles (profile_id → profiles.id, ON DELETE CASCADE)
        ├── provider_profiles (profile_id → profiles.id, ON DELETE CASCADE)
        ├── properties (owner_id → profiles.id, ON DELETE CASCADE)
        │     ├── units (property_id → properties.id, ON DELETE CASCADE)
        │     ├── charges (property_id → properties.id, ON DELETE CASCADE)
        │     ├── photos (property_id → properties.id, ON DELETE CASCADE)
        │     ├── documents (property_id → properties.id, ON DELETE CASCADE)
        │     ├── tickets (property_id → properties.id, ON DELETE CASCADE)
        │     │     ├── work_orders (ticket_id → tickets.id, ON DELETE CASCADE)
        │     │     └── quotes (ticket_id → tickets.id, ON DELETE CASCADE)
        │     ├── visit_slots (property_id → properties.id)
        │     │     └── visit_bookings (slot_id → visit_slots.id)
        │     └── property_ownership (property_id → properties.id)
        ├── leases (property_id → properties.id, ON DELETE CASCADE)
        │     ├── lease_signers (lease_id → leases.id, ON DELETE CASCADE)
        │     ├── invoices (lease_id → leases.id, ON DELETE CASCADE)
        │     │     └── payments (invoice_id → invoices.id, ON DELETE CASCADE)
        │     ├── roommates (lease_id → leases.id, ON DELETE CASCADE)
        │     │     ├── payment_shares (roommate_id → roommates.id, ON DELETE CASCADE)
        │     │     └── deposit_shares (roommate_id → roommates.id)
        │     ├── edl (lease_id → leases.id, ON DELETE CASCADE)
        │     │     ├── edl_items (edl_id → edl.id, ON DELETE CASCADE)
        │     │     ├── edl_media (edl_id → edl.id, ON DELETE CASCADE)
        │     │     ├── edl_signatures (edl_id → edl.id, ON DELETE CASCADE)
        │     │     └── edl_meter_readings (edl_id → edl.id)
        │     ├── meters (lease_id → leases.id, ON DELETE CASCADE)
        │     │     └── meter_readings (meter_id → meters.id, ON DELETE CASCADE)
        │     ├── documents (lease_id → leases.id, ON DELETE CASCADE)
        │     ├── deposit_movements (lease_id → leases.id, ON DELETE CASCADE)
        │     ├── lease_end_processes (lease_id → leases.id)
        │     │     ├── edl_inspection_items (lease_end_process_id)
        │     │     └── renovation_items (lease_end_process_id)
        │     │           └── renovation_quotes (renovation_item_id)
        │     ├── signatures (lease_id → leases.id, SET NULL)
        │     ├── lease_indexations (lease_id → leases.id, CASCADE)
        │     └── insurance_policies (lease_id → leases.id, CASCADE)
        ├── legal_entities (owner_profile_id → profiles.id)
        │     ├── entity_associates (legal_entity_id → legal_entities.id)
        │     └── property_ownership (legal_entity_id → legal_entities.id)
        ├── organizations (owner_id → auth.users.id, CASCADE)
        │     ├── organization_members (organization_id → organizations.id, CASCADE)
        │     ├── organization_branding (organization_id → organizations.id, CASCADE)
        │     └── custom_domains (organization_id → organizations.id, CASCADE)
        ├── buildings (owner_id → profiles.id)
        │     └── building_units (building_id → buildings.id)
        ├── subscriptions (user_id → auth.users.id)
        ├── notifications (user_id → auth.users.id, CASCADE)
        ├── conversations (owner_id → profiles.id)
        │     └── messages (conversation_id → conversations.id)
        ├── unified_conversations (owner_id → profiles.id)
        │     ├── unified_messages (conversation_id → unified_conversations.id)
        │     └── conversation_participants (conversation_id → unified_conversations.id)
        └── signature_sessions (owner_id → profiles.id)
              ├── signature_participants (session_id → signature_sessions.id)
              │     └── signature_proofs (participant_id → signature_participants.id)
              └── signature_audit_log (session_id → signature_sessions.id)
```

### 2.2 FK Implicites Détectées (colonnes `*_id` SANS contrainte SQL)

Ces colonnes stockent des UUID mais n'ont **pas** de `FOREIGN KEY` formelle :

| Table | Colonne | Table cible attendue | Risque |
|-------|---------|---------------------|--------|
| `leases` | `tenant_id` | `profiles` | **HIGH** — ajouté tardivement, pas de FK |
| `leases` | `owner_id` | `profiles` | **HIGH** — ajouté tardivement, pas de FK |
| `tickets` | `assigned_provider_id` | `profiles` | MEDIUM |
| `tickets` | `owner_id` | `profiles` | MEDIUM |
| `documents` | `profile_id` | `profiles` | MEDIUM |
| `signature_sessions` | `entity_id` | `(polymorphe)` | LOW — par design |
| `work_orders` | `quote_id` | `quotes` | MEDIUM |
| `work_orders` | `property_id` | `properties` | MEDIUM |
| `building_units` | `current_lease_id` | `leases` | MEDIUM |
| `provider_invoices` | `work_order_id` | `work_orders` | MEDIUM |
| `edl_media` | `item_id` | `edl_items` | LOW — nullable par design |

### 2.3 Problèmes de `ON DELETE` Identifiés

| Relation | Action actuelle | Action recommandée | Raison |
|----------|----------------|-------------------|--------|
| `leases.property_id → properties` | CASCADE | CASCADE | OK |
| `leases.tenant_id → profiles` | **AUCUNE FK** | SET NULL | Le bail doit survivre si le tenant est supprimé |
| `leases.owner_id → profiles` | **AUCUNE FK** | SET NULL | Le bail doit survivre si le profil owner change |
| `documents.profile_id → profiles` | **AUCUNE FK** | SET NULL | Garder le document même si le profil est supprimé |
| `tickets.assigned_provider_id → profiles` | **AUCUNE FK** | SET NULL | Le ticket survit au prestataire |
| `building_units.current_lease_id → leases` | **AUCUNE FK** | SET NULL | Le lot survit au bail |

---

## 3. Phase 2 — Détection des Orphelins

### Utilisation

Après avoir appliqué la migration `20260212000000_audit_database_integrity.sql`, exécuter :

```sql
-- Vue d'ensemble complète
SELECT * FROM audit_orphan_records() WHERE orphan_count > 0 ORDER BY severity, source_table;

-- Tableau de bord consolidé (orphelins + doublons)
SELECT * FROM audit_integrity_dashboard ORDER BY severity, audit_type;
```

### 3.1 Vérifications CRITICAL (65 points de contrôle)

| # | Source → Cible | Description |
|---|---------------|-------------|
| 1 | `profiles.user_id → auth.users` | Profils sans compte auth |
| 2 | `properties.owner_id → profiles` | Propriétés sans propriétaire |
| 3 | `lease_signers.lease_id → leases` | Signataires sans bail |
| 4 | `invoices.lease_id → leases` | Factures sans bail |
| 5 | `invoices.owner_id → profiles` | Factures sans profil propriétaire |
| 6 | `invoices.tenant_id → profiles` | Factures sans profil locataire |
| 7 | `payments.invoice_id → invoices` | Paiements sans facture |
| 8 | `owner_profiles.profile_id → profiles` | Profils propriétaire sans profil de base |
| 9 | `tenant_profiles.profile_id → profiles` | Profils locataire sans profil de base |
| 10 | `provider_profiles.profile_id → profiles` | Profils prestataire sans profil de base |

### 3.2 Vérifications HIGH

| # | Source → Cible | Description |
|---|---------------|-------------|
| 11 | `leases.property_id → properties` | Baux sans propriété |
| 12 | `leases.unit_id → units` | Baux sans unité |
| 13 | `leases.tenant_id → profiles` | Baux avec tenant_id invalide (FK implicite) |
| 14 | `leases.owner_id → profiles` | Baux avec owner_id invalide (FK implicite) |
| 15 | `leases (no_signers)` | Baux actifs sans signataire |
| 16 | `lease_signers.profile_id → profiles` | Signataires avec profil supprimé |
| 17 | `documents.lease_id → leases` | Documents avec bail supprimé |
| 18 | `edl.lease_id → leases` | EDL avec bail supprimé |
| 19 | `roommates.lease_id → leases` | Colocataires avec bail supprimé |
| 20 | `meters.lease_id → leases` | Compteurs avec bail supprimé |
| 21 | `deposit_movements.lease_id → leases` | Mouvements de dépôt orphelins |
| 22 | `tickets.property_id → properties` | Tickets sans propriété |
| 23 | `work_orders.ticket_id → tickets` | Ordres de travail sans ticket |
| 24 | `charges.property_id → properties` | Charges sans propriété |
| 25 | `legal_entities.owner_profile_id → profiles` | Entités légales sans propriétaire |
| 26 | `entity_associates.legal_entity_id → legal_entities` | Associés sans entité |
| 27 | `property_ownership.property_id → properties` | Détentions sans bien |
| 28 | `lease_end_processes.lease_id → leases` | Processus de fin sans bail |
| 29 | `signature_participants.session_id → signature_sessions` | Participants sans session |
| 30 | `payment_shares.roommate_id → roommates` | Parts de paiement sans colocataire |
| 31 | `deposit_shares.roommate_id → roommates` | Parts de dépôt sans colocataire |
| 32 | `provider_invoices.provider_id → profiles` | Factures prestataire orphelines |
| 33 | `provider_quotes.provider_id → profiles` | Devis prestataire orphelins |
| 34 | `subscriptions.user_id → auth.users` | Abonnements sans utilisateur |
| 35 | `units.property_id → properties` | Unités sans propriété |

### 3.3 Requêtes SQL Individuelles

Pour chaque relation ci-dessus, la requête de détection est intégrée dans la fonction `audit_orphan_records()`. Pour exécuter une vérification isolée :

```sql
-- Exemple : trouver les factures dont le bail n'existe plus
SELECT i.*
FROM invoices i
LEFT JOIN leases l ON i.lease_id = l.id
WHERE l.id IS NULL;

-- Exemple : trouver les baux actifs sans signataire
SELECT l.*
FROM leases l
WHERE l.statut NOT IN ('draft', 'cancelled', 'archived', 'terminated')
  AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id);

-- Exemple : trouver les documents sans aucun rattachement parent
SELECT d.*
FROM documents d
WHERE d.owner_id IS NULL
  AND d.tenant_id IS NULL
  AND d.property_id IS NULL
  AND d.lease_id IS NULL
  AND d.profile_id IS NULL;
```

---

## 4. Phase 3 — Détection des Doublons

### Utilisation

```sql
SELECT * FROM audit_duplicate_records() ORDER BY severity;
```

### 4.1 Doublons Fonctionnels Vérifiés

| # | Table | Clé de doublon | Sévérité | Description |
|---|-------|---------------|----------|-------------|
| 1 | `profiles` | `user_id` | CRITICAL | Même auth.users avec 2+ profils |
| 2 | `profiles` | `email` | HIGH | Même email pour 2+ profils |
| 3 | `properties` | `owner_id + adresse_complete` | HIGH | Même propriétaire + même adresse |
| 4 | `properties` | `unique_code` | CRITICAL | Violation d'unicité du code |
| 5 | `leases` | `property_id + dates overlap` | HIGH | Baux actifs qui se chevauchent |
| 6 | `invoices` | `lease_id + periode` | CRITICAL | Double facturation |
| 7 | `lease_signers` | `lease_id + profile_id` | HIGH | Signataire en double |
| 8 | `lease_signers` | `lease_id + invited_email` | MEDIUM | Invitation en double |
| 9 | `documents` | `storage_path` | MEDIUM | Même fichier référencé 2+ fois |
| 10 | `subscriptions` | `user_id (active)` | HIGH | Double abonnement actif |
| 11 | `roommates` | `lease_id + profile_id` | HIGH | Colocataire en double |
| 12 | `legal_entities` | `siret` | HIGH | SIRET en double |
| 13 | `edl` | `lease_id + type` | MEDIUM | EDL en double par type |
| 14 | `notifications` | `user+type+title (même minute)` | LOW | Notification envoyée en double |
| 15 | `photos` | `property_id + storage_path` | LOW | Photo dupliquée |
| 16 | `owner_profiles` | `profile_id` (PK) | CRITICAL | Vérifie intégrité PK |

---

## 5. Phase 4 — Plan de Nettoyage SAFE

### 5.1 Principe : Archiver avant de supprimer

Chaque suppression passe par un cycle en 3 étapes :

```
1. ARCHIVE → INSERT INTO _audit_cleanup_archive (original_data en JSONB)
2. DELETE  → Suppression de l'enregistrement orphelin
3. VERIFY  → Vérification post-nettoyage via audit_orphan_records()
```

### 5.2 Utilisation

```sql
-- ÉTAPE 1 : Prévisualiser (DRY RUN) — aucune modification
SELECT * FROM safe_cleanup_orphans(true);

-- ÉTAPE 2 : Vérifier les résultats du dry run
-- Valider que les counts sont cohérents

-- ÉTAPE 3 : Exécuter le nettoyage réel
BEGIN;
SELECT * FROM safe_cleanup_orphans(false);
-- Vérifier les résultats
-- Si OK :
COMMIT;
-- Si problème :
-- ROLLBACK;

-- ÉTAPE 4 : Vérifier que les orphelins ont été nettoyés
SELECT * FROM audit_orphan_records() WHERE orphan_count > 0;

-- EN CAS DE PROBLÈME : consulter l'archive
SELECT * FROM _audit_cleanup_archive ORDER BY cleaned_at DESC;
```

### 5.3 Ordre de Nettoyage (respecte les dépendances)

Le nettoyage s'exécute dans cet ordre pour éviter les violations de FK :

```
Niveau 1 (feuilles) :
  ├── payments (invoice_id → invoices)
  ├── meter_readings (meter_id → meters)
  ├── edl_items, edl_media, edl_signatures (edl_id → edl)
  ├── payment_shares, deposit_shares (roommate_id → roommates)
  └── renovation_quotes (renovation_item_id → renovation_items)

Niveau 2 (intermédiaires) :
  ├── invoices (lease_id → leases)
  ├── meters (lease_id → leases)
  ├── edl (lease_id → leases)
  ├── roommates (lease_id → leases)
  ├── lease_signers (lease_id → leases)
  ├── deposit_movements (lease_id → leases)
  ├── lease_end_processes (lease_id → leases)
  └── renovation_items (lease_end_process_id → lease_end_processes)

Niveau 3 (nœuds principaux) :
  ├── documents (lease_id → leases, property_id → properties) [SET NULL]
  ├── tickets (lease_id → leases) [SET NULL]
  └── notifications (> 90 jours, lues)
```

### 5.4 Actions par Type

| Action | Tables concernées | Méthode |
|--------|-------------------|---------|
| **DELETE** | `lease_signers`, `invoices`, `payments`, `edl` (+enfants), `roommates`, `deposit_movements`, `meters` (+readings) | Suppression avec archivage préalable |
| **SET NULL** | `documents.lease_id`, `documents.property_id`, `tickets.lease_id` | Mise à NULL de la FK cassée (l'enregistrement est conservé) |
| **DELETE (TTL)** | `notifications` (lues > 90j), `otp_codes` (expirés) | Suppression des données obsolètes |

---

## 6. Recommandations Structurelles

### 6.1 FK Formelles à Ajouter (priorité haute)

```sql
-- À exécuter APRÈS vérification que les données sont propres

-- leases.tenant_id → profiles.id
ALTER TABLE leases
  ADD CONSTRAINT fk_leases_tenant_id
  FOREIGN KEY (tenant_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- leases.owner_id → profiles.id
ALTER TABLE leases
  ADD CONSTRAINT fk_leases_owner_id
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- tickets.assigned_provider_id → profiles.id
ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_assigned_provider_id
  FOREIGN KEY (assigned_provider_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- tickets.owner_id → profiles.id
ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_owner_id
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- documents.profile_id → profiles.id
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_profile_id
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- building_units.current_lease_id → leases.id
ALTER TABLE building_units
  ADD CONSTRAINT fk_building_units_current_lease_id
  FOREIGN KEY (current_lease_id) REFERENCES leases(id) ON DELETE SET NULL;

-- work_orders.quote_id → quotes.id
ALTER TABLE work_orders
  ADD CONSTRAINT fk_work_orders_quote_id
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;

-- work_orders.property_id → properties.id
ALTER TABLE work_orders
  ADD CONSTRAINT fk_work_orders_property_id
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
```

### 6.2 Contraintes d'Unicité Manquantes

```sql
-- Éviter les doublons de factures
-- (devrait déjà exister via UNIQUE(lease_id, periode), vérifier)
ALTER TABLE invoices
  ADD CONSTRAINT uq_invoices_lease_periode
  UNIQUE (lease_id, periode);

-- Éviter les doublons de signataires
ALTER TABLE lease_signers
  ADD CONSTRAINT uq_lease_signers_lease_profile
  UNIQUE (lease_id, profile_id) WHERE profile_id IS NOT NULL;

-- Éviter les doublons d'EDL
ALTER TABLE edl
  ADD CONSTRAINT uq_edl_lease_type
  UNIQUE (lease_id, type) WHERE status != 'cancelled';
```

### 6.3 Cron Job Recommandé

```sql
-- Via pg_cron ou Supabase Edge Functions (cron), exécuter mensuellement :
SELECT * FROM safe_cleanup_orphans(false, 'ALL');
```

### 6.4 Monitoring Continu

La vue `audit_integrity_dashboard` peut être consultée depuis le dashboard admin :

```sql
-- Alerter si des orphelins critiques apparaissent
SELECT COUNT(*) AS critical_orphans
FROM audit_orphan_records()
WHERE orphan_count > 0 AND severity = 'CRITICAL';
```

---

## Fichiers Livrés

| Fichier | Description |
|---------|-------------|
| `supabase/migrations/20260212000000_audit_database_integrity.sql` | Migration SQL avec toutes les fonctions d'audit et de nettoyage |
| `AUDIT_DATABASE_INTEGRITY.md` | Ce rapport |

## Commandes Rapides

```sql
-- 1. Audit complet des orphelins
SELECT * FROM audit_orphan_records() WHERE orphan_count > 0;

-- 2. Audit complet des doublons
SELECT * FROM audit_duplicate_records();

-- 3. FK implicites manquantes
SELECT * FROM audit_missing_fk_constraints() WHERE NOT has_fk;

-- 4. Dashboard consolidé
SELECT * FROM audit_integrity_dashboard;

-- 5. Nettoyage en dry run
SELECT * FROM safe_cleanup_orphans(true);

-- 6. Nettoyage réel (dans une transaction)
BEGIN;
SELECT * FROM safe_cleanup_orphans(false);
COMMIT;
```
