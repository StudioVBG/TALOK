# AUDIT - Détection des Doublons & Cas Limites

**Date:** 2026-02-11
**Branche:** `claude/duplicate-detection-BTDtL`

---

## 1. TYPES DE DOCUMENTS IDENTIFIÉS

| Type | Table | Usage |
|------|-------|-------|
| `bail` | documents | Contrat de bail (PDF généré) |
| `quittance` | documents | Quittance de loyer |
| `EDL_entree` | documents | État des lieux d'entrée |
| `EDL_sortie` | documents | État des lieux de sortie |
| `attestation_assurance` | documents | Attestation d'assurance habitation |
| `attestation_loyer` | documents | Attestation de loyer |
| `justificatif_revenus` | documents | Justificatif de revenus |
| `piece_identite` | documents | Pièce d'identité (CNI/passeport) |
| `dpe` | documents | Diagnostic de performance énergétique |
| `autre` | documents | Tout autre document |
| 70+ types GED | ged_document_types | Types référentiels via GED system |

---

## 2. DÉTECTION DES DOUBLONS

### 2.1 Double entrée en base (même type + même bail + même période)

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Contrainte UNIQUE documents | ⚠️ PARTIEL | `supabase/migrations/20251221000000_document_caching.sql:65-92` | Pas de contrainte UNIQUE sur (type, lease_id, metadata->hash). Seuls des **index** existent (`idx_documents_quittance_lookup`, `idx_documents_bail_lookup`) mais pas de contrainte d'unicité | P2: Ajouter contrainte UNIQUE partielle ou utiliser `get_or_mark_document_creation()` systématiquement |
| Bail PDF cache hash | ✅ OK | `app/api/leases/[id]/pdf/route.ts:150-178` | Pattern hash-based correct : vérifie hash avant régénération, upsert si existant, update sinon | - |
| Document check API | ✅ OK | `app/api/documents/check/route.ts:67-96` | Vérifie existence par type+hash+lease_id avant création | - |
| Insurance upload doublon | ❌ KO | `app/api/insurance/upload/route.ts:117-131` | Aucune vérification de document existant avant insert. Chaque upload crée une nouvelle entrée | **CORRIGÉ**: Archive les anciens documents d'assurance du bail avant insert |
| GED versioning | ✅ OK | `supabase/migrations/20260201000000_ged_system.sql:128-134` | Système de versioning avec `parent_document_id`, `version`, `is_current_version` | - |
| Document alerts UNIQUE | ✅ OK | `supabase/migrations/20260201000000_ged_system.sql:196` | `UNIQUE(document_id, alert_type, days_before_expiry)` | - |

### 2.2 Double fichier dans Supabase Storage

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Upload single (uuid filename) | ✅ OK | `app/api/documents/upload-batch/route.ts:213` | UUID dans le nom = collision quasi-impossible | - |
| Upload legacy (timestamp+random) | ✅ OK | `app/api/documents/upload/route.ts:62` | `Date.now()-random.toString(36)` = collision très improbable | - |
| Upload upsert=false | ✅ OK | `app/api/documents/upload-batch/route.ts:221` | `upsert: false` empêche l'écrasement silencieux | - |
| Bail PDF storage | ✅ OK | `app/api/leases/[id]/pdf/route.ts:308-310` | `upsert: true` correct ici car le hash du chemin change | - |

### 2.3 Mutations (create/update) avec upsert ou guards

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Bail PDF upsert+update | ✅ OK | `app/api/leases/[id]/pdf/route.ts:316-345` | Update si existant, insert sinon | - |
| Insurance policy upsert | ✅ OK | `app/api/insurance/upload/route.ts:83-115` | Check `existing` avant insert/update sur insurance_policies | - |
| EDL signature upsert | ✅ OK | Trouvé dans edl/[id]/sign: `.upsert({...})` avec commentaire "pour éviter les doublons" | - |
| Lease create (pas de guard doublon) | ⚠️ PARTIEL | `app/api/leases/route.ts:406-422` | Pas de vérification qu'un bail draft n'existe pas déjà pour cette propriété. Permet la création de multiples baux draft | P2: Ajouter un warning si bail draft existant |

### 2.4 Protection double-clic sur boutons

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| GED upload dialog | ✅ OK | `components/ged/ged-upload-dialog.tsx:290` | `disabled={!file \|\| uploadMutation.isPending}` + **CORRIGÉ**: guard dans handleSubmit | - |
| Document upload form | ✅ OK | `features/documents/components/document-upload-form.tsx:142` | `disabled={loading \|\| !formData.file}` + **CORRIGÉ**: `if (loading) return` dans handleSubmit | - |
| EDL preview download | ✅ OK | `features/edl/components/edl-preview.tsx:389` | `disabled={!html \|\| downloading \|\| loading}` | - |
| Lease form auto-save | ✅ OK | `features/leases/components/lease-form.tsx:84` | `debounceMs: 1500` via useAutoSave | - |

### 2.5 Protection requêtes concurrentes (debounce, loading, disabled)

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Search debounce | ✅ OK | Multiple (CommandPalette, address-autocomplete, etc.) | 300ms debounce partout | - |
| Lease preview | ✅ OK | `features/leases/components/lease-preview.tsx:290` | 500ms debounce | - |
| Wizard state | ✅ OK | `stores/wizard-store.ts:271-288` | Debounce avec timer pour pending updates | - |
| React Query mutations | ✅ OK | `lib/hooks/use-ged-documents.ts:220-259` | `useMutation` avec `isPending` automatique | - |

---

## 3. CAS LIMITES

### 3.1 Suppression d'un bail

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Blocage baux actifs | ✅ OK | `app/api/leases/[id]/route.ts:467-506` | Bloque suppression pour `fully_signed`, `active`, `terminated`, `archived` | - |
| Notification locataires | ✅ OK | `app/api/leases/[id]/route.ts:509-527` | Notifie les locataires avant suppression | - |
| Cascade EDL | ✅ OK | `app/api/leases/[id]/route.ts:532-544` | Supprime items, media, signatures, puis EDL | - |
| Cascade documents DB | ✅ OK | `app/api/leases/[id]/route.ts:546-560` | **CORRIGÉ**: Supprime fichiers storage PUIS entrées DB | - |
| Fichiers storage orphelins | ❌ KO → ✅ CORRIGÉ | `app/api/leases/[id]/route.ts:546-550` | Les documents DB étaient supprimés SANS supprimer les fichiers Storage | **CORRIGÉ**: Récupère storage_path avant suppression |
| Cascade invoices | ✅ OK | `app/api/leases/[id]/route.ts:552-569` | Supprime payments puis invoices | - |
| Cascade signers/roommates | ✅ OK | `app/api/leases/[id]/route.ts:571-581` | Supprime lease_signers et roommates | - |
| FK CASCADE en base | ✅ OK | Migrations multiples | `ON DELETE CASCADE` sur lease_signers, invoices, payments, etc. | - |

### 3.2 Retrait d'un locataire d'un bail

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Documents tenant_id | ⚠️ PARTIEL | `features/documents/services/documents.service.ts` | Les documents avec `tenant_id` restent en base même si le locataire est retiré. Pas de nettoyage automatique | P2: Décision métier - archiver ou garder pour historique |
| Accès locataire via RLS | ✅ OK | `lib/hooks/use-documents.ts:137-198` | Accès conditionné à `lease_signers` actifs. Si retiré des signers, perd l'accès | - |

### 3.3 Suppression d'une propriété

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Soft-delete | ✅ OK | `app/api/properties/[id]/route.ts:788-799` | Marquage `etat: "deleted"` au lieu de hard delete | - |
| Blocage baux actifs | ✅ OK | `app/api/properties/[id]/route.ts:690-729` | Empêche la suppression si baux actifs | - |
| Documents préservés | ✅ OK | `app/api/properties/[id]/route.ts` | Soft-delete = documents intacts | - |
| Notification locataires | ✅ OK | `app/api/properties/[id]/route.ts:738-786` | Notifie tous les locataires | - |
| Accès bail après soft-delete | ✅ OK | `app/api/leases/[id]/route.ts:57-84` | LEFT JOIN + flag `property_deleted` | - |

### 3.4 Suppression compte propriétaire

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Anonymisation GDPR | ⚠️ PARTIEL | `app/api/privacy/anonymize/cascade/route.ts` | Anonymisation partielle : documents financiers conservés, identité supprimée. Mais PAS de transaction = risque d'anonymisation partielle | P1: Wrapper dans une transaction Postgres |
| Bucket hardcodé | ⚠️ PARTIEL | `app/api/privacy/anonymize/cascade/route.ts:375` | Bucket "identity" hardcodé, risque si renommé | P2: Centraliser les noms de buckets |

### 3.5 Fichier supprimé de Storage mais référence en base

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Check API | ✅ OK | `app/api/documents/check/route.ts:109-127` | Détecte et nettoie les entrées orphelines | - |
| Admin cleanup | ✅ OK | `app/api/admin/cleanup/route.ts:191-222` | Nettoyage des documents orphelins (storage → DB) | - |
| Pas de cron automatique | ⚠️ PARTIEL | - | Le cleanup est manuel (admin). Pas de cron planifié | P2: Ajouter un cron job Edge Function |

### 3.6 Génération PDF échoue à mi-parcours

| Élément | Statut | Fichier(s) concerné(s) | Problème détecté | Correction proposée |
|---------|--------|------------------------|------------------|---------------------|
| Bail PDF fallback | ✅ OK | `app/api/leases/[id]/pdf/route.ts:421-563` | Fallback pdf-lib si Edge Function échoue | - |
| Upload-batch cleanup | ✅ OK | `app/api/documents/upload-batch/route.ts:263-268` | **CORRIGÉ**: Nettoie le fichier storage si l'insert DB échoue | - |
| Insurance upload cleanup | ✅ OK | `app/api/insurance/upload/route.ts` | **CORRIGÉ**: Nettoie le fichier storage si l'insert documents échoue | - |
| Upload single cleanup | ✅ OK | `app/api/documents/upload/route.ts:98-99` | Nettoyage existant en cas d'erreur | - |

---

## 4. RÉSUMÉ EXÉCUTIF

| Catégorie | Critique (P0) | Important (P1) | Amélioration (P2) | OK |
|-----------|---------------|----------------|--------------------|----|
| Doublons base | 0 | 0 | 2 | 5 |
| Doublons storage | 0 | 0 | 0 | 4 |
| Mutations guards | 0 | 0 | 1 | 4 |
| Double-clic UI | 0 | 0 | 0 | 4 |
| Requêtes concurrentes | 0 | 0 | 0 | 4 |
| Cas limites | 0 | 1 | 3 | 15 |
| **Sécurité** | **1** | 0 | 0 | - |
| **TOTAL** | **1** | **1** | **6** | **36** |

---

## 5. CORRECTIONS APPLIQUÉES

### P0 - Bloquant

1. **Injection dans filtre `.or()` du check API** - `app/api/documents/check/route.ts`
   - Le hash utilisateur était injecté directement dans le filtre PostgREST `.or()`
   - **Fix**: Sanitization du hash (alphanumeric + tirets + underscores, max 128 chars)

### P1 - Important

2. **Fichiers storage orphelins à la suppression d'un bail** - `app/api/leases/[id]/route.ts`
   - Les documents DB étaient supprimés sans supprimer les fichiers correspondants dans Storage
   - **Fix**: Récupération des `storage_path` avant suppression, `remove()` Storage puis `delete()` DB

3. **Insurance upload sans cleanup storage** - `app/api/insurance/upload/route.ts`
   - Si l'insert dans `documents` échouait, le fichier uploadé restait orphelin dans Storage
   - **Fix**: Ajout de `remove()` Storage en cas d'erreur insert + archivage des anciens documents

4. **Upload-batch sans cleanup storage** - `app/api/documents/upload-batch/route.ts`
   - Si l'insert DB échouait, le fichier uploadé restait orphelin
   - **Fix**: Ajout de `remove()` Storage en cas d'erreur insert

5. **Double-clic non protégé** - `components/ged/ged-upload-dialog.tsx` et `features/documents/components/document-upload-form.tsx`
   - Le bouton était disabled mais la fonction `handleSubmit` n'avait pas de guard
   - **Fix**: Ajout de `if (isPending/loading) return` en début de handleSubmit

---

## 6. CORRECTIONS P2 APPLIQUÉES

### P2 - Amélioration

6. **Contrainte UNIQUE sur documents** - ✅ CORRIGÉ
   - Migration `20260211000000_p2_unique_constraint_and_gdpr_rpc.sql`
   - `CREATE UNIQUE INDEX idx_documents_unique_type_lease_hash ON documents (type, lease_id, content_hash) WHERE content_hash IS NOT NULL AND lease_id IS NOT NULL`

7. **Warning bail draft doublon** - ✅ CORRIGÉ
   - `app/api/leases/route.ts` : Vérifie s'il existe des baux draft pour la même propriété avant création
   - Retourne un champ `warning` dans la réponse 201 si des drafts existent déjà

8. **Transaction GDPR** - ✅ CORRIGÉ
   - RPC `anonymize_user_cascade()` dans la migration (PL/pgSQL, SECURITY DEFINER)
   - Toutes les opérations DB en une seule transaction atomique (rollback automatique si erreur)
   - `app/api/privacy/anonymize/cascade/route.ts` refactoré : Phase 1 (collecte Storage) → Phase 2 (RPC transactionnelle) → Phase 3 (suppression fichiers Storage)

9. **Cron cleanup orphelins** - ✅ CORRIGÉ
   - RPC `cleanup_orphan_documents()` dans la migration (transactionnelle)
   - Edge Function `supabase/functions/cleanup-orphans/index.ts` (planification recommandée : `0 3 * * *`)
   - Nettoie : documents orphelins (lease/property supprimé), notifications > 90j, OTP expirés, preview cache expiré
   - Supprime aussi les fichiers Storage correspondants

10. **Centraliser les noms de buckets** - ✅ CORRIGÉ
    - `lib/config/storage-buckets.ts` : constantes `STORAGE_BUCKETS.DOCUMENTS`, `.AVATARS`, `.PROPERTY_PHOTOS`, `.IDENTITY`, `.ASSEMBLY_DOCUMENTS`
    - 20+ occurrences remplacées dans 19 fichiers (API routes, services, composants)

---

## 7. TESTS À EFFECTUER

- [ ] Upload un document via GED → vérifier qu'un seul enregistrement est créé en base
- [ ] Upload d'assurance 2x pour le même bail → vérifier que l'ancien est archivé
- [ ] Supprimer un bail draft → vérifier que les fichiers Storage sont supprimés
- [ ] Cliquer rapidement 2x sur "Ajouter" dans le GED dialog → vérifier qu'un seul upload part
- [ ] Générer le PDF d'un bail 2x → vérifier qu'un seul fichier existe en storage
- [ ] Envoyer un hash malicieux via `/api/documents/check` → vérifier la sanitization
- [ ] Supprimer une propriété avec bail actif → vérifier le blocage
- [ ] Vérifier qu'un fichier storage supprimé manuellement est détecté par `/api/documents/check`
