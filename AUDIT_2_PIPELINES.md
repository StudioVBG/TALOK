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
*(Pending)*

## C. Pipeline Factures prestataires (work orders)
*(Pending)*

## D. Pipeline Rapprochement bancaire Bridge
*(Pending)*

## Synthèse
*(À remplir en dernier)*
