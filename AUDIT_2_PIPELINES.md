# Audit 2/3 — Pipelines OCR, Quittances, Factures, Bridge

Date : 17/04/2026
Branche : claude/audit-documents-compta-1
Précédent : AUDIT_1_SCHEMA.md

## Résumé des verdicts
*(À remplir en dernier)*

| Pipeline | Statut |
|---|---|
| A. OCR | *(TBD)* |
| B. Quittances | *(TBD)* |
| C. Factures prestataires | *(TBD)* |
| D. Rapprochement bancaire Bridge | *(TBD)* |

## A. Pipeline OCR

Le projet contient **trois pipelines OCR distincts** qui coexistent sans hiérarchie claire. Chacun a sa propre destination de stockage.

### A.1 — Pipeline OCR comptable (pivot `document_analyses`)

#### Point d'entrée
- API : **`POST /api/accounting/documents/analyze`** (`app/api/accounting/documents/analyze/route.ts`) — détails dans `AUDIT_1_SCHEMA.md` §6.2
- Frontend : `lib/hooks/use-document-analysis.ts:177` (seul caller)
- **Déclenchement** : **manuel** uniquement — l'utilisateur doit cliquer "Analyser ce document" dans l'UI compta. **Pas de trigger automatique à l'upload.**

#### Moteur OCR
- **GPT-4o-mini** via l'edge function Supabase `supabase/functions/ocr-analyze-document/index.ts:70-90`
- Prompt système strict demandant un JSON `{document_type, emetteur, destinataire, date_document, montant_ht/tva/ttc_cents, taux_tva_percent, lignes, suggested_account, suggested_journal, alerts, confidence}`
- Pas de Tesseract dans cette pipeline, pas de combo Tesseract+GPT

#### Destination du résultat
- **`document_analyses.extracted_data`** (JSONB) : **oui**, seul destinataire officiel — mise à jour par edge function `ocr-analyze-document/index.ts:216`
- `documents.ged_ai_data` : **non** (cf. audit 1/3 §3, colonne fantôme)
- Colonnes dérivées renseignées en plus : `suggested_account`, `suggested_journal`, `document_type`, `confidence_score`, `siret_verified`, `tva_coherent`

#### Lien avec la compta
**Verdict : 🟡 enrichit un document sans écriture compta automatique**

- **Pas d'écriture comptable créée** automatiquement à la fin de l'OCR.
- Un deuxième appel **manuel** `POST /api/accounting/documents/[id]/validate` (`AUDIT_1_SCHEMA.md` §6.4) est nécessaire pour :
  - créer l'écriture via `createEntry()` (journal `ACH`, débit compte suggéré / crédit `401000` fournisseur générique)
  - lier `document_analyses.entry_id = <entry>.id`
  - mettre à jour `processing_status='validated'`
- Learning : si l'utilisateur override le compte suggéré → upsert `ocr_category_rules` pour la prochaine analyse.

**Deux clics humains minimum** pour qu'un document devienne une écriture.

#### Statut global
**🟡 partiellement branché** — pipeline complet et fonctionnel côté code, mais **déclenchement manuel obligatoire à chaque étape** et pas de bouclage automatique upload→écriture.

### A.2 — Pipeline OCR CNI (Tesseract, identités)

#### Point d'entrée
- **`POST /api/documents/upload`** (`app/api/documents/upload/route.ts:247-280`)
- Déclenchement : **automatique** si `type IN ('cni_recto','cni_verso')` ET `file.type` commence par `image/`

#### Moteur OCR
- **Tesseract.js** via `lib/ocr/tesseract.service.ts:42` (classe `TesseractOCRService`)
- Méthode `analyzeIdCard(imageBuffer, fileName)` — extrait `lastName`, `firstName`, `documentNumber`, `expiryDate`, `birthDate`, `birthPlace`, `gender`, `nationality`, `isValid`, `confidence`, `documentType`

#### Destination du résultat
- **`documents.metadata`** (JSONB) : oui, clés OCR ajoutées (`ocr_confidence`, `ocr_is_valid`, `nom`, `prenom`, `numero_document`, `date_expiration`, `date_naissance`, etc.)
- `document_analyses` : **non** (pipeline distinct, ne partage rien avec la compta)
- Comparaison avec profil owner si `profile.role === 'owner'` → champ `identity_match` dans metadata

#### Lien avec la compta
**Verdict : ❌ aucun lien** — ce pipeline gère **uniquement** la vérification d'identité (KYC locataire/propriétaire). Aucun appel à `createEntry` / `createAutoEntry`.

#### Statut global
**✅ en prod complet** sur son périmètre KYC. Hors-sujet compta.

### A.3 — Pipeline Document AI (LangGraph, vérification docs locataires)

#### Point d'entrée
- **`POST /api/documents/upload-batch`** (`app/api/documents/upload-batch/route.ts:324`)
- Déclenchement : **automatique** sur uploads batch (typiquement candidatures locataires : justificatifs revenus, domicile, etc.)

#### Moteur OCR
- **Service `documentAiService`** (`features/documents/services/document-ai.service.ts`, 73 lignes)
- Utilise un graphe **LangGraph** (`features/documents/ai/document-analysis.graph.ts`) nommé `documentAnalysisGraph`
- État `DocumentAnalysisState` : `{ documentId, documentUrl, declaredType, tenantName, verificationStatus }`

#### Destination du résultat
- **`documents.verification_status`** (enum `pending`/`verified`/`rejected`/`manual_review_required`) — migration `202502191200_document_verification.sql:13`
- **`documents.ai_analysis`** (JSONB) — migration `202502191200_document_verification.sql:14` — **3e colonne JSONB sur `documents`** en plus de `ged_ai_data` et `metadata`
- **`documents.verified_at`**, **`documents.rejection_reason`**
- `document_analyses` : **non** (encore un pipeline distinct)

#### Lien avec la compta
**Verdict : ❌ aucun lien** — ce pipeline vise la validation de pièces de candidature/dossier locataire. Pas de chaîne vers `accounting_entries`.

#### Statut global
**🟡 partiellement branché** — appelé seulement depuis `upload-batch`, pas depuis `upload` simple. Ne tourne pas sur les uploads comptables.

### A.4 — Synthèse pipeline A

| Dimension | A.1 Compta | A.2 CNI | A.3 LangGraph |
|-----------|-----------|---------|---------------|
| Trigger | manuel (clic) | automatique (type CNI) | automatique (upload batch) |
| Moteur | GPT-4o-mini (edge fn) | Tesseract.js (serveur) | LangGraph |
| Stockage résultat | `document_analyses.extracted_data` | `documents.metadata` | `documents.ai_analysis` + `verification_status` |
| Crée écriture compta ? | ❌ non directement (nécessite /validate) | ❌ non | ❌ non |
| Branché à l'upload ? | ❌ non | ✅ oui | ✅ oui (batch seulement) |

**Trou identifié** : aucun pipeline ne fait `upload → OCR → écriture comptable` automatiquement. L'utilisateur doit :
1. Upload le document (aucun OCR comptable déclenché)
2. Aller dans l'UI compta et cliquer "Analyser"
3. Attendre la fin (polling `/analysis`)
4. Cliquer "Valider" avec éventuels overrides

**Verdict global pipeline A : 🟡 partiellement branché**. L'infrastructure OCR comptable existe et fonctionne, mais aucun hook automatique upload→OCR→écriture. Trois pipelines OCR parallèles qui ne partagent pas de stockage.


## B. Pipeline Quittances

### B.1 — État des fichiers

**Fichier `lib/documents/receipt-generator.ts`** : **n'existe pas**. Le générateur est localisé à `lib/services/receipt-generator.ts` (604 lignes, `generateReceiptPDF(data: ReceiptData): Promise<Uint8Array>`, utilise `pdf-lib`).

**Fichier `lib/services/final-documents.service.ts`** (419 lignes) : expose `ensureReceiptDocument(supabase, paymentId)` qui orchestre : contrôle d'existence → fetch payment + invoice + property → résolution identity owner → assemblage `ReceiptData` → génération PDF → upload Storage → INSERT `documents` (type `quittance`) → INSERT `receipts` (idempotent) → UPDATE `invoices.receipt_generated` + `receipt_document_id` + `receipt_generated_at`.

### B.2 — Point d'entrée et déclenchements

**Callers d'`ensureReceiptDocument`** (7 appels détectés) :

| Fichier | Contexte | Déclenchement |
|---------|----------|---------------|
| `app/api/webhooks/stripe/route.ts:48` (via `processReceiptGeneration`) | Wrapper utilitaire | — |
| `app/api/webhooks/stripe/route.ts:781` | Charge Stripe (1er paiement) | **auto** sur événement Stripe |
| `app/api/webhooks/stripe/route.ts:943` | `payment_intent.succeeded` → fire-and-forget si settlement OK | **auto** |
| `app/api/webhooks/stripe/route.ts:1154` | `invoice.payment_succeeded` (subscription) | **auto** |
| `app/api/webhooks/stripe/route.ts:1250` | `invoice.paid` fallback | **auto** |
| `app/api/invoices/[id]/mark-paid/route.ts:260` | Paiement manuel (espèces/virement/CB off-Stripe) | manuel (owner) |
| `app/api/payments/confirm/route.ts:242` | Confirmation paiement | manuel |
| `app/api/leases/[id]/generate-receipt/route.ts:127` | Régénération manuelle | manuel (owner) |
| `app/api/invoices/[id]/receipt/route.ts:184` | Download quittance (fire-and-forget si absente) | lecture |
| `app/owner/money/actions.ts:29` | Server action | manuel |

Le handler webhook **`payment_intent.succeeded`** (route.ts ligne 869) appelle bien `processReceiptGeneration` → `ensureReceiptDocument` en **fire-and-forget** après avoir vérifié `settlement?.isSettled`. Confirmé à la ligne 943–953.

### B.3 — Colonnes DB

- **`invoices.receipt_generated BOOLEAN DEFAULT FALSE`** : migration `20260331000000_add_receipt_generated_to_invoices.sql` — **existe**. Migration en attente d'apply (cf. audit 1 backlog, classée 🟡).
- **`invoices.receipt_document_id UUID REFERENCES documents(id)`** : migration `20260408220000_payment_architecture_sota.sql:213` — **existe** avec FK propre. **En attente d'apply.**
- **`invoices.receipt_generated_at TIMESTAMPTZ`** : même migration ligne 219 — **existe**.

Les 3 colonnes sont **mises à jour** par `ensureReceiptDocument` (final-documents.service.ts ligne 246-251).

### B.4 — Moteur de génération

- PDF généré avec **pdf-lib** + fonts `StandardFonts` + `date-fns/fr`
- Conforme loi ALUR + Décret n°2015-587 + Art. 21 loi 89-462 (annoté dans les commentaires)
- Champs : `ownerName`, `ownerAddress`, `ownerSiret?`, `tenantName`, `propertyAddress/City/PostalCode`, `period`, `rentAmount`, `chargesAmount`, `totalAmount`, `paymentDate`, `paymentMethod`
- Upload : bucket `documents`, chemin `quittances/{leaseId}/{paymentId}.pdf`

### B.5 — Double écriture documentaire

À chaque quittance générée :
1. **INSERT `documents`** : `{ type: 'quittance', category: 'finance', lease_id, tenant_id, owner_id, property_id, storage_path, metadata: { invoice_id, payment_id, period, amount, final: true } }`
2. **INSERT `receipts`** : `{ payment_id, lease_id, invoice_id, tenant_id, owner_id, period, montant_loyer, montant_charges, montant_total, pdf_storage_path, generated_at }`
3. **UPDATE `invoices`** : `{ receipt_generated: true, receipt_document_id, receipt_generated_at }`

Triple stockage dans 3 tables distinctes. Pas de risque de perte mais **redondance** — une ligne `receipts` existe en plus de la ligne `documents` pour chaque quittance.

### B.6 — Lien avec la compta

**Verdict : ✅ crée une ligne compta** (mais via `createAutoEntry` dans la même fonction webhook, pas depuis `ensureReceiptDocument`).

Stripe webhook `payment_intent.succeeded` exécute en parallèle :
- `processReceiptGeneration` → quittance PDF + documents + receipts
- `createAutoEntry(supabase, 'rent_received', {...})` à la ligne 999 — crée l'écriture comptable

**Important** : `ensureReceiptDocument` **ne crée pas** directement une écriture comptable. Elle n'écrit pas non plus dans `document_analyses`. C'est `createAutoEntry` qui fait le lien documents/paiements → `accounting_entries`.

Pour les paiements off-Stripe (mark-paid / confirm / generate-receipt), la création de l'écriture `rent_received` est dupliquée dans `lib/accounting/receipt-entry.ts` (cf. audit 1/3 §5.4). Le code prend soin de garantir que `createAutoEntry` n'est appelé qu'une fois par payment (idempotence). Cf. commentaire `lib/accounting/receipt-entry.ts:14` : *"this helper can never produce a double"*.

### B.7 — Issue GitHub #282

Pas d'accès direct à `gh` CLI dans cet environnement (restrictions repo via MCP seulement). Status factuel basé sur le code : les colonnes `receipt_generated` + `receipt_document_id` existent (migrations pending), le générateur existe, le wiring Stripe est en place, le wiring off-Stripe est en place via `receipt-entry.ts`. **Si l'issue #282 portait sur "brancher receipt-generator au webhook Stripe", c'est fait.**

### B.8 — Statut global pipeline B

**✅ en prod complet** — le pipeline quittance existe, est branché sur tous les événements de paiement (Stripe auto + off-Stripe manuel), les colonnes DB sont prêtes (migrations en pending), la redondance documents/receipts est gérée, et la comptabilisation `rent_received` est déclenchée en parallèle via `createAutoEntry`.

**Caveat unique** : les migrations `20260331000000` et `20260408220000` sont dans le backlog pending (cf. audit 1/3 backlog). Le code de `ensureReceiptDocument` écrit dans `invoices.receipt_generated` / `receipt_document_id` — si ces colonnes ne sont pas en prod, l'UPDATE échoue silencieusement (code ne check pas). **Soft blocker à confirmer** côté Supabase prod avant d'estimer pleinement "complet".


## C. Pipeline Factures prestataires (work orders)
*(Pending)*

## D. Pipeline Rapprochement bancaire Bridge
*(Pending)*

## Synthèse
*(À remplir en dernier)*
