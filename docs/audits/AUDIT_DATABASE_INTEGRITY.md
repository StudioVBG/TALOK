# Audit d'Intégrité de la Base de Données Talok

**Date** : 2026-02-12
**Scope** : Toutes les tables du schéma `public` (127+ tables, 226 migrations)
**Stack** : Supabase (PostgreSQL 15), Next.js 14+, TypeScript

---

## Table des Matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Phase 1 — Cartographie des Relations](#2-phase-1--cartographie-des-relations)
3. [Phase 2 — Détection des Orphelins](#3-phase-2--détection-des-orphelins)
4. [Phase 3 — Détection des Doublons (avancée)](#4-phase-3--détection-des-doublons-avancée)
5. [Phase 4 — Plan de Fusion SAFE (Merge)](#5-phase-4--plan-de-fusion-safe-merge)
6. [Phase 5 — Prévention](#6-phase-5--prévention)
7. [Fichiers Livrés & Commandes](#7-fichiers-livrés--commandes)

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

## 4. Phase 3 — Détection des Doublons (avancée)

### Types de doublons détectés

| Type | Description | Méthode |
|------|-------------|---------|
| **EXACT** | Mêmes valeurs sur les champs métier clés | GROUP BY normalisé |
| **FUZZY** | Valeurs très similaires (même CP+ville+type+surface) | JOIN avec critères relaxés |
| **TEMPORAL** | Même entité créée 2+ fois en < 5 minutes (double-clic) | Comparaison created_at |
| **OVERLAP** | Baux actifs chevauchants sur la même propriété | Comparaison intervalles de dates |

### Fonctions de détection par entité

```sql
-- Propriétés (exact + fuzzy + temporal)
SELECT * FROM audit_duplicate_properties();

-- Profils/Contacts (email + identité + user_id)
SELECT * FROM audit_duplicate_profiles();

-- Baux (exact + temporal + overlap)
SELECT * FROM audit_duplicate_leases();

-- Factures (même bail + même période)
SELECT * FROM audit_duplicate_invoices();

-- Paiements (même montant + même facture + ±24h)
SELECT * FROM audit_duplicate_payments();

-- Documents (même storage_path + même nom + temporal)
SELECT * FROM audit_duplicate_documents();

-- EDL (même bail + même type + temporal)
SELECT * FROM audit_duplicate_edl();

-- Résumé consolidé de TOUS les doublons
SELECT * FROM audit_all_duplicates_summary();
```

### Critères de déduplication par entité

| Entité | Champs clés | Normalisation |
|--------|------------|---------------|
| **Propriétés** | `owner_id` + `adresse_complete` + `code_postal` | `LOWER(TRIM())` |
| **Profils** | `email` OU (`nom` + `prénom` + `date_naissance`) | `LOWER(TRIM())` |
| **Baux** | `property_id` + `date_debut` (±7 jours) + `type_bail` | Intervalle DATE |
| **Factures** | `lease_id` + `periode` | Exact |
| **Paiements** | `invoice_id` + `montant` + `created_at` (±24h) | EPOCH diff |
| **Documents** | `storage_path` OU (`nom` + entité parente + ±1min) | `LOWER(TRIM())` |
| **EDL** | `lease_id` + `type` + `created_at` (±24h) | EPOCH diff |

### Format de sortie

Chaque fonction retourne :

```
duplicate_key  | nb_doublons | ids (UUID[])     | match_type      | premier_cree | dernier_cree
───────────────┼─────────────┼──────────────────┼─────────────────┼──────────────┼─────────────
exact:owner:...|           2 | {id1, id2}       | EXACT           | 2025-01-15   | 2025-01-15
temporal:...   |           2 | {id3, id4}       | TEMPORAL (<5min)| 2025-03-20   | 2025-03-20
```

---

## 5. Phase 4 — Plan de Fusion SAFE (Merge)

### 5.1 Principe

Chaque fusion suit un cycle strict en **5 étapes** :

```
1. BACKUP   → Archive le doublon dans _audit_cleanup_archive (JSONB complet)
2. TRANSFER → UPDATE les tables enfants pour pointer vers le master
3. ENRICH   → COALESCE des champs du doublon vers le master (si master NULL)
4. DELETE   → Soft-delete (deleted_at) ou hard delete selon la table
5. AUDIT    → INSERT dans _audit_log (action=MERGE, old_id, new_id)
```

### 5.2 Élection du Master

Le **master** est élu selon ces critères (par ordre) :
1. Le plus complet (plus de champs non-NULL)
2. Le plus ancien (`created_at ASC`)
3. Le plus actif (celui avec le plus de relations enfants)

### 5.3 Fonctions de fusion disponibles

```sql
-- Fusion de propriétés (DRY RUN par défaut)
SELECT * FROM merge_duplicate_properties('master_id', 'duplicate_id', true);
-- Exécution réelle :
BEGIN;
SELECT * FROM merge_duplicate_properties('master_id', 'duplicate_id', false);
COMMIT;

-- Fusion de factures
SELECT * FROM merge_duplicate_invoices('master_id', 'duplicate_id', true);

-- Fusion de documents
SELECT * FROM merge_duplicate_documents('master_id', 'duplicate_id', true);

-- Fusion d'EDL
SELECT * FROM merge_duplicate_edl('master_id', 'duplicate_id', true);
```

### 5.4 Détail du transfert des relations (exemple propriétés)

```
merge_duplicate_properties(master, duplicate) :
  ├── 1.BACKUP   → _audit_cleanup_archive
  ├── 2.TRANSFER → leases.property_id
  ├── 2.TRANSFER → units.property_id
  ├── 2.TRANSFER → charges.property_id
  ├── 2.TRANSFER → documents.property_id
  ├── 2.TRANSFER → tickets.property_id
  ├── 2.TRANSFER → photos.property_id
  ├── 2.TRANSFER → visit_slots.property_id
  ├── 2.TRANSFER → property_ownership.property_id
  ├── 2.TRANSFER → conversations.property_id
  ├── 3.ENRICH   → COALESCE champs manquants
  ├── 4.DELETE    → soft-delete (deleted_at = NOW())
  └── 5.AUDIT    → _audit_log
```

### 5.5 Nettoyage des orphelins (cycle complet)

```sql
-- ÉTAPE 1 : DRY RUN (voir ce qui serait nettoyé)
SELECT * FROM safe_cleanup_orphans(true);

-- ÉTAPE 2 : Exécuter dans une transaction
BEGIN;
SELECT * FROM safe_cleanup_orphans(false);
-- Vérifier les résultats, puis :
COMMIT;
-- ou ROLLBACK; si problème

-- ÉTAPE 3 : Vérifier que c'est propre
SELECT * FROM audit_orphan_records() WHERE orphan_count > 0;
```

### 5.6 Ordre de nettoyage (respecte les dépendances FK)

```
Niveau 1 (feuilles) :
  ├── payments (invoice_id → invoices)
  ├── meter_readings (meter_id → meters)
  ├── edl_items, edl_media, edl_signatures (edl_id → edl)
  ├── payment_shares, deposit_shares (roommate_id → roommates)
  └── renovation_quotes (renovation_item_id → renovation_items)

Niveau 2 (intermédiaires) :
  ├── invoices (lease_id → leases)         → DELETE avec archive
  ├── meters (lease_id → leases)           → DELETE avec archive
  ├── edl (lease_id → leases)              → DELETE avec archive
  ├── roommates (lease_id → leases)        → DELETE avec archive
  ├── lease_signers (lease_id → leases)    → DELETE avec archive
  ├── deposit_movements (lease_id → leases)→ DELETE avec archive
  └── lease_end_processes                  → DELETE avec archive

Niveau 3 (nœuds principaux) :
  ├── documents (lease_id/property_id)     → SET NULL (conserver)
  ├── tickets (lease_id)                   → SET NULL (conserver)
  └── notifications (lues > 90j)           → DELETE (TTL)
```

### 5.7 Rollback

```sql
-- Lister les batches de nettoyage exécutés
SELECT cleanup_batch_id, COUNT(*), MIN(cleaned_at)
FROM _audit_cleanup_archive
GROUP BY cleanup_batch_id ORDER BY MIN(cleaned_at) DESC;

-- Rollback complet d'un batch
SELECT * FROM rollback_full_batch('<batch_id>');

-- Rollback par table
SELECT rollback_lease_signers('<batch_id>');
SELECT rollback_invoices('<batch_id>');
SELECT rollback_payments('<batch_id>');
-- etc.

-- Rollback d'une fusion
SELECT * FROM rollback_merge_property('<duplicate_id>');
```

---

## 6. Phase 5 — Prévention

### 6.1 FK Formelles ajoutées (8 contraintes)

La migration `20260212100000` ajoute automatiquement ces FK manquantes :

| Table | Colonne | Cible | ON DELETE | Nettoyage pré-ajout |
|-------|---------|-------|-----------|---------------------|
| `leases` | `tenant_id` | `profiles.id` | SET NULL | Orphelins → NULL |
| `leases` | `owner_id` | `profiles.id` | SET NULL | Orphelins → NULL |
| `tickets` | `assigned_provider_id` | `profiles.id` | SET NULL | Orphelins → NULL |
| `tickets` | `owner_id` | `profiles.id` | SET NULL | Orphelins → NULL |
| `documents` | `profile_id` | `profiles.id` | SET NULL | Orphelins → NULL |
| `building_units` | `current_lease_id` | `leases.id` | SET NULL | Orphelins → NULL |
| `work_orders` | `quote_id` | `quotes.id` | SET NULL | Orphelins → NULL |
| `work_orders` | `property_id` | `properties.id` | SET NULL | Orphelins → NULL |

### 6.2 Contraintes UNIQUE ajoutées (5 index)

| Table | Index | Condition | Nettoyage pré-ajout |
|-------|-------|-----------|---------------------|
| `invoices` | `(lease_id, periode)` | — | Doublons supprimés (on garde la payée/la plus ancienne) |
| `lease_signers` | `(lease_id, profile_id)` | `WHERE profile_id IS NOT NULL` | Doublons supprimés |
| `edl` | `(lease_id, type)` | `WHERE status NOT IN ('cancelled', 'disputed')` | — |
| `roommates` | `(lease_id, profile_id)` | — | Doublons supprimés |
| `subscriptions` | `(user_id)` | `WHERE status IN ('active', 'trialing')` | — |

### 6.3 Triggers anti-doublon (2 triggers)

| Trigger | Table | Comportement |
|---------|-------|-------------|
| `trg_prevent_duplicate_property` | `properties` | **BLOQUE** l'INSERT si même owner + même adresse + même CP existe déjà |
| `trg_prevent_duplicate_payment` | `payments` | **AVERTIT** (RAISE WARNING) si même invoice + même montant < 24h (ne bloque pas) |

### 6.4 Validations côté application (recommandations Zod)

```typescript
// Avant INSERT propriété
const PropertyInsertSchema = z.object({
  owner_id: z.string().uuid(),
  adresse_complete: z.string().min(5).transform(s => s.trim()),
  code_postal: z.string().regex(/^\d{5}$/),
  ville: z.string().min(2).transform(s => s.trim()),
  // Vérifier en amont via RPC si le doublon existe
});

// Avant INSERT facture
const InvoiceInsertSchema = z.object({
  lease_id: z.string().uuid(),
  periode: z.string().regex(/^\d{4}-\d{2}$/),
  // Vérifier UNIQUE(lease_id, periode) côté client avant INSERT
});

// Avant INSERT paiement — anti double-clic
const PaymentInsertSchema = z.object({
  invoice_id: z.string().uuid(),
  montant: z.number().positive(),
  // Implémenter un debounce côté UI + idempotency key
});
```

### 6.5 Cron Job recommandé

```sql
-- Mensuel : nettoyage automatique des orphelins + TTL
SELECT * FROM safe_cleanup_orphans(false, 'ALL');
```

### 6.6 Monitoring continu

```sql
-- Tableau de bord d'intégrité (à intégrer dans /admin)
SELECT * FROM audit_integrity_dashboard;

-- Alerte si orphelins CRITICAL
SELECT COUNT(*) AS critical_issues
FROM audit_orphan_records()
WHERE orphan_count > 0 AND severity = 'CRITICAL';

-- Alerte si doublons CRITICAL
SELECT COUNT(*) AS critical_duplicates
FROM audit_all_duplicates_summary()
WHERE severity = 'CRITICAL' AND duplicate_groups > 0;
```

---

## 7. Fichiers Livrés & Commandes

### Fichiers

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `supabase/migrations/20260212000000_audit_database_integrity.sql` | Phase 1-2 : Détection orphelins + doublons basiques + nettoyage SAFE |
| 2 | `supabase/migrations/20260212100000_audit_v2_merge_and_prevention.sql` | Phase 3-5 : Doublons avancés + fusion + FK/UNIQUE + triggers |
| 3 | `scripts/audit-dry-run.sql` | Script DRY RUN complet (100% lecture seule) |
| 4 | `scripts/audit-rollback.sql` | Fonctions de rollback par table + rollback batch complet |
| 5 | `AUDIT_DATABASE_INTEGRITY.md` | Ce rapport |

### Commandes rapides

```sql
-- ═══ DIAGNOSTIC ═══

-- 1. Orphelins (65 vérifications)
SELECT * FROM audit_orphan_records() WHERE orphan_count > 0;

-- 2. Doublons avancés par entité
SELECT * FROM audit_duplicate_properties();
SELECT * FROM audit_duplicate_profiles();
SELECT * FROM audit_duplicate_leases();
SELECT * FROM audit_duplicate_invoices();
SELECT * FROM audit_duplicate_payments();
SELECT * FROM audit_duplicate_documents();
SELECT * FROM audit_duplicate_edl();

-- 3. Résumé consolidé de tous les doublons
SELECT * FROM audit_all_duplicates_summary();

-- 4. FK implicites manquantes
SELECT * FROM audit_missing_fk_constraints() WHERE NOT has_fk;

-- 5. Dashboard consolidé (orphelins + doublons basiques)
SELECT * FROM audit_integrity_dashboard;

-- ═══ NETTOYAGE ═══

-- 6. DRY RUN orphelins
SELECT * FROM safe_cleanup_orphans(true);

-- 7. Exécution réelle
BEGIN;
SELECT * FROM safe_cleanup_orphans(false);
COMMIT;

-- ═══ FUSION ═══

-- 8. Fusion propriétés (dry run)
SELECT * FROM merge_duplicate_properties('master_id', 'dup_id', true);

-- 9. Fusion réelle
BEGIN;
SELECT * FROM merge_duplicate_properties('master_id', 'dup_id', false);
COMMIT;

-- ═══ ROLLBACK ═══

-- 10. Rollback complet
SELECT * FROM rollback_full_batch('<batch_id>');

-- 11. Rollback merge
SELECT * FROM rollback_merge_property('<duplicate_id>');

-- ═══ AUDIT LOG ═══

-- 12. Historique des opérations
SELECT * FROM _audit_log ORDER BY created_at DESC LIMIT 50;

-- 13. Archives de nettoyage
SELECT * FROM _audit_cleanup_archive ORDER BY cleaned_at DESC LIMIT 50;
```
