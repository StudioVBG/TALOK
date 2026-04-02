---
name: talok-documents-sota
description: >
  Architecture SOTA complète de la gestion des documents Talok.
  Utilise ce skill pour tout travail sur les documents : upload, consultation,
  génération automatique, quittances, GED, permissions, bugs, nouveaux comptes.
  Déclenche dès que la tâche touche à documents, upload, storage, quittance,
  bail PDF, EDL PDF, CNI, coffre-fort, bibliothèque, GED, pièces jointes.
---

# Talok — Gestion des documents SOTA

## 1. État déployé (vérifié visuellement le 26/03/2026)

### Corrections appliquées et validées
- `lib/documents/constants.ts` — source unique : DOCUMENT_TYPES, ALLOWED_MIME_TYPES, TYPE_TO_LABEL, TYPE_TO_CATEGORY
- `lib/documents/format-name.ts` — getDisplayName()
- `lib/documents/group-documents.ts` — logique groupDocuments()
- `features/documents/components/grouped-document-card.tsx` — composant CNI groupé
- Migration MIME bucket storage (Word/Excel désormais autorisés)
- Migration tenant_documents → documents (unification)
- Création table document_links
- Route GET + PATCH `/api/documents/[id]`
- Suppression hook useDocumentSearch dupliqué
- Dark mode uniforme : bg-card partout dans /owner/documents/

### Corrections partielles (à finaliser)
- Groupement CNI recto/verso : composant créé mais pas encore raccordé dans documents-list.tsx
- Titre anciens documents : la DB garde encore l'original_filename brut pour les docs existants

### Encore à implémenter
- Génération quittances automatique (receipt-generator.ts à brancher webhook Stripe)
- Génération PDF bail signé après signature
- Barre progression onboarding documents nouveaux comptes

---

## 2. Architecture base de données

### Table principale : `documents`
Table unifiée — 35+ colonnes issues de 25+ migrations.

**Colonnes obligatoires à l'INSERT :**
```sql
type, category, title, original_filename,
storage_path, file_size, mime_type, sha256,
uploaded_by, is_generated, ged_status,
visible_tenant, created_at, updated_at
```

**Colonnes optionnelles importantes :**
```sql
expiry_date           -- CNI, assurances, diagnostics
valid_from/until      -- Validité GED
parent_document_id    -- Chaînage recto/verso CNI
version, is_current_version
entity_id             -- SCI
application_id        -- Candidature locataire
guarantor_profile_id  -- Garant
tags TEXT[]
ged_ai_data JSONB     -- OCR, classification IA
```

### Tables liées
| Table | Usage |
|-------|-------|
| `documents` | Table unifiée principale |
| `tenant_documents` | LEGACY — migré vers documents |
| `document_links` | Liens de partage temporaires (7j) |
| `provider_compliance_documents` | Documents conformité prestataires |
| `preview_cache` | Cache aperçus HTML |

### Vues SQL disponibles
```sql
v_owner_accessible_documents    -- Documents visibles par le proprio
v_tenant_accessible_documents   -- Documents visibles par le locataire
v_tenant_key_documents          -- 4 docs clés du locataire
v_tenant_pending_actions        -- Actions en attente (upload assurance, etc.)
documents_enriched              -- Vue enrichie avec computed_category
```

### RPCs disponibles
```sql
tenant_document_center()        -- Centre documents locataire
tenant_documents_search()       -- Recherche côté locataire
search_documents()              -- Recherche côté proprio
get_or_mark_document_creation() -- Pattern idempotence
```

### Triggers actifs
- `auto_fill_document_fk` — auto-résout property_id, owner_id, tenant_id depuis lease_id
- `trg_documents_search_vector` — maintient l'index full-text
- `trigger_notify_owner_on_tenant_document` — notifie proprio quand locataire uploade
- `trg_notify_tenant_document_center` — notifie locataire

---

## 3. Bucket Supabase Storage

```
ID : documents
Visibilité : privé (signed URLs 1h)
Taille max : 50 Mo
MIME autorisés (après fix) :
  application/pdf
  image/jpeg, image/png, image/webp, image/heic
  application/msword
  application/vnd.openxmlformats-officedocument.wordprocessingml.document
  application/vnd.ms-excel
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  text/plain, text/csv
```

---

## 4. Source unique de vérité — lib/documents/constants.ts

**Ce fichier existe. Toujours l'importer, ne jamais redéfinir.**

```typescript
import {
  DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  TYPE_TO_CATEGORY,
  TYPE_TO_LABEL,
  GROUPED_DOCUMENT_TYPES,
  EXPIRABLE_DOCUMENT_TYPES,
  REQUIRED_TENANT_DOCS,
  AUTO_GENERATED_DOCS,
} from '@/lib/documents/constants'
```

---

## 5. Routes API documents

| Route | Méthodes | Statut |
|-------|----------|--------|
| `/api/documents/upload` | POST | ✅ title + original_filename remplis |
| `/api/documents/upload-batch` | POST | ✅ import constants |
| `/api/documents/[id]` | GET | ✅ créé |
| `/api/documents/[id]` | PATCH | ✅ créé (title, type, metadata, visible_tenant) |
| `/api/documents/[id]` | DELETE | ✅ existant |
| `/api/documents/[id]/signed-url` | GET | ✅ existant |
| `/api/documents/[id]/download` | GET/POST | ✅ existant |
| `/api/documents/search` | GET | ✅ existant |
| `/api/documents/check` | GET/POST | ✅ existant |

### Pattern upload obligatoire
```typescript
const documentInsert = {
  type: validatedType,
  category: TYPE_TO_CATEGORY[validatedType] ?? 'autre',
  title: getDisplayName(file.name, validatedType),
  original_filename: file.name,
  storage_path: storagePath,
  file_size: file.size,
  mime_type: file.type,
  sha256: await computeHash(buffer),
  owner_id: resolvedOwnerId,
  tenant_id: resolvedTenantId,
  property_id: resolvedPropertyId,
  lease_id: resolvedLeaseId,
  uploaded_by: userId,
  is_generated: false,
  ged_status: 'active',
  visible_tenant: role === 'tenant',
  version: 1,
  is_current_version: true,
}
```

---

## 6. Hooks React Query — règles

```typescript
// Upload : TOUJOURS utiliser useGedUpload (passe par l'API route)
import { useGedUpload } from '@/lib/hooks/use-ged-documents'

// NE PAS utiliser useCreateDocument (Supabase direct, pas de validation)

// Recherche : UN SEUL hook valide
import { useDocumentSearch } from '@/lib/hooks/use-document-search'
// NE PAS utiliser le useDocumentSearch de use-document-center.ts (supprimé)

// Documents center locataire
import { useDocumentCenter } from '@/lib/hooks/use-document-center'

// Documents enrichis propriétaire (GED)
import { useGedDocuments } from '@/lib/hooks/use-ged-documents'
```

---

## 7. Groupement CNI recto/verso

### Composants disponibles
- `lib/documents/group-documents.ts` — `groupDocuments()` + `GroupedDocument` type
- `features/documents/components/grouped-document-card.tsx` — card CNI groupée

### Connexion à faire dans documents-list.tsx
```typescript
import { groupDocuments } from '@/lib/documents/group-documents'
import { GroupedDocumentCard } from '@/features/documents/components/grouped-document-card'

// Dans le render de la liste :
const displayDocs = groupDocuments(documents)

return displayDocs.map(doc =>
  'group_type' in doc
    ? <GroupedDocumentCard key={doc.id} document={doc} />
    : <DocumentCard key={doc.id} document={doc} />
)
```

---

## 8. Mise à jour titres anciens documents (SQL)

```sql
-- Corriger les titres bruts des documents existants
UPDATE documents SET
  title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''Identité (Recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''Identité (Verso)'
    WHEN type = 'assurance_habitation' THEN 'Attestation d''assurance'
    WHEN type = 'contrat_bail' THEN 'Contrat de bail'
    WHEN type = 'edl_entree' THEN 'État des lieux d''entrée'
    WHEN type = 'edl_sortie' THEN 'État des lieux de sortie'
    WHEN type = 'quittance_loyer' THEN 'Quittance de loyer'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_salaire' THEN 'Bulletin de salaire'
    WHEN type = 'dpe' THEN 'Diagnostic de performance énergétique'
    ELSE title
  END
WHERE title IS NULL
   OR title ~ '^Capture d.écran'
   OR title ~ '^[A-Z_]+$'
   OR title ~ '\d{4}-\d{2}-\d{2}';
```

---

## 9. Génération automatique de documents (à implémenter)

### Quittances — lib/documents/receipt-generator.ts
```typescript
export async function generateReceipt(paymentId: string): Promise<Document> {
  // 1. Charger payment + invoice + lease + tenant + owner + property
  // 2. Générer HTML depuis template quittance
  // 3. Créer PDF via pdf-lib (installé)
  // 4. Upload : documents/quittances/{leaseId}/{YYYY-MM}.pdf
  // 5. INSERT documents : type='quittance_loyer', is_generated=true, visible_tenant=true
  // 6. Email Resend au locataire avec PDF
  // 7. UPDATE invoices SET receipt_generated = true
}

// Brancher dans app/api/webhooks/stripe/route.ts :
// case 'payment_intent.succeeded' → generateReceipt() (non-bloquant)
```

### Bail signé PDF — lib/documents/lease-pdf-generator.ts
```typescript
export async function generateSignedLeasePDF(leaseId: string): Promise<Document> {
  // 1. Récupérer le HTML bail depuis storage
  // 2. Ajouter cachet signature + certificat
  // 3. Générer PDF final
  // 4. Upload : documents/bails/{leaseId}/signed_final.pdf
  // 5. INSERT documents : type='contrat_bail', is_generated=true, visible_tenant=true
}

// Brancher dans app/api/cron/process-outbox/route.ts :
// handler Inspection.Signed → generateSignedLeasePDF()
```

---

## 10. Permissions par rôle

| Action | owner | tenant | provider | guarantor | admin |
|--------|-------|--------|----------|-----------|-------|
| Upload | ✅ ses biens | ✅ auto-résolution bail | ✅ compliance | ✅ ses docs | ✅ |
| Voir | ✅ owner_id | ✅ tenant_id + visible_tenant=true | ✅ work_orders | ✅ ses docs | ✅ tout |
| Modifier titre/type | ✅ PATCH /api/documents/[id] | ✅ | ❌ | ❌ | ✅ |
| Supprimer | ✅ ses docs | ✅ ses docs | ❌ | ❌ | ✅ |
| Générer auto | système | système | système | — | ✅ |

**Règle visible_tenant :**
- `true` si uploadé par le locataire (automatique)
- `false` par défaut pour les docs propriétaire
- Le proprio peut basculer via PATCH visible_tenant

---

## 11. Onboarding nouveaux comptes

### Documents requis par étape
```typescript
// Candidature locataire
REQUIRED_TENANT_DOCS = [
  { type: 'cni_recto', required: true },
  { type: 'cni_verso', required: true },
  { type: 'avis_imposition', required: true },
  { type: 'bulletin_salaire', required: true },
]

// Documents générés automatiquement
AUTO_GENERATED_DOCS = [
  { trigger: 'lease.signed', type: 'contrat_bail' },
  { trigger: 'edl.signed', type: 'edl_entree' },
  { trigger: 'payment.confirmed', type: 'quittance_loyer' },
  { trigger: 'lease.ended', type: 'edl_sortie' },
]
```

---

## 12. Règles TOUJOURS / JAMAIS

### TOUJOURS
- Importer depuis `lib/documents/constants.ts`
- Remplir `title` + `original_filename` à chaque INSERT
- Passer par `/api/documents/upload` (pas Supabase direct)
- Utiliser `useGedUpload` dans les composants React
- Vérifier `visible_tenant` avant d'afficher au locataire
- Appeler `groupDocuments()` avant de rendre une liste de documents

### JAMAIS
- Hardcoder une liste de types en dehors de constants.ts
- Utiliser `useCreateDocument` pour les uploads
- Insérer dans documents sans `title`
- Afficher storage_path, sha256, ou tout path technique à l'utilisateur
- Supprimer storage sans supprimer l'entrée DB (et inversement)
