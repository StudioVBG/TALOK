# AUDIT COMPLET : Cycle de vie du bail - Création a Remise des clefs

**Date** : 2026-03-23
**Scope** : Invitation locataire, creation bail, EDL, documents, factures, paiements, notifications

---

## SOMMAIRE

1. [Flux complet et chronologie](#1-flux-complet)
2. [Bugs critiques identifies](#2-bugs-critiques)
3. [Bugs moyens](#3-bugs-moyens)
4. [Bugs mineurs / ameliorations](#4-bugs-mineurs)
5. [Ce qui fonctionne correctement](#5-ce-qui-fonctionne)

---

## 1. FLUX COMPLET

### Etape 1 : Creation du bail
- **UI** : `app/owner/leases/new/LeaseWizard.tsx` (wizard 3 etapes)
- **API** : `POST /api/v1/leases` → `lib/services/lease-creation.service.ts`
- **Modes** : draft, invite, colocation
- **Statut** : `draft` ou `pending_signature`

### Etape 2 : Invitation du locataire
- **Service** : `lease-creation.service.ts` (mode invite/colocation)
- **Token** : genere avec `generateSecureToken()` (expiration 30 jours)
- **Email** : envoye via outbox → notification email
- **Notification in-app** : creee si le profil existe deja

### Etape 3 : Signature du bail
- **Proprietaire** : `POST /api/leases/[id]/sign` (auth Supabase)
- **Locataire** : `POST /api/signature/[token]/sign` (token + OTP)
- **Service** : `lib/services/lease-signing.service.ts` → `executeSignature()`
- **Statut** : `pending_signature` → `partially_signed` → `fully_signed`

### Etape 4 : Post-signature (automatique)
- **Service** : `lib/services/lease-post-signature.service.ts` → `handleLeaseFullySigned()`
  1. Genere HTML du bail signe → stocke dans Storage
  2. Cree un enregistrement `documents` (type: `bail_signe`)
  3. Scelle le bail via RPC `seal_lease()`
  4. Cree la facture initiale via `ensureInitialInvoiceForLease()`
- **Trigger SQL** : `trg_invoice_on_lease_fully_signed` (redondance)
- **Facture** : statut `sent`, immediatement visible et payable

### Etape 5 : EDL (Etat des Lieux)
- **Creation** : `POST /api/edl` → cree l'EDL lie au bail et a la propriete
- **Conducteur** : `features/end-of-lease/components/edl-conductor.tsx`
- **Items** : pieces, elements, etats, medias
- **Signature EDL** :
  - Proprietaire : `POST /api/edl/[id]/sign`
  - Locataire : `POST /api/signature/edl/[token]/sign`
- **Post-signature EDL** : `handleEDLFullySigned()` genere le HTML signe

### Etape 6 : Remise des clefs
- **Route** : `POST /api/leases/[id]/key-handover/confirm`
- **Activation** : statut du bail → `active`
- **Readiness** : `app/owner/_data/lease-readiness.ts` verifie les pre-requis

### Etape 7 : Factures mensuelles + paiements
- **Cron** : `generate-invoices` (1er du mois, 6h30)
- **Paiement** : `POST /api/payments/create-intent` → Stripe PaymentIntent
- **Webhook** : `/app/webhooks/stripe/route.ts` → sync statut facture

---

## 2. BUGS CRITIQUES

### BUG C1 : profile_id locataire non lie → bail bloque en partially_signed
- **Fichier** : `lib/services/lease-signing.service.ts:196-221`
- **Cause** : `findSigner` Priority 2 retourne le signer par `invited_email` avec `profile_id: null`. `determineLeaseStatus` exige `profile_id` pour `fully_signed`.
- **Impact** : Le bail ne passe jamais en `fully_signed` → pas de facture initiale, pas de scellement, pas de paiement possible
- **Statut** : **CORRIGE** dans ce commit (resolution profile_id dans findSigner + determineLeaseStatus)

### BUG C2 : Message expiration token incohérent (30j vs 7j)
- **Fichier** : `app/signature/[token]/page.tsx:39` vs `:142`
- **Cause** : `isTokenExpired` utilise 30 jours, mais le message UI dit "validite 7 jours"
- **Impact** : Confusion utilisateur, le locataire pense que son lien a expire apres 7j alors qu'il est valide 30j
- **Statut** : A CORRIGER

### BUG C3 : Invoice status count mismatch sur le dashboard owner
- **Fichier** : `app/owner/_data/fetchDashboard.ts:202`
- **Cause** : Dashboard compte `pending = invoices.filter(i => i.statut === "sent")` mais l'API utilise `sent || draft`
- **Impact** : Le nombre de factures en attente affiche ne correspond pas a la realite
- **Statut** : A CORRIGER

### BUG C4 : Lookups email case-sensitive → profil non lie, facture non creee
- **Fichiers** :
  - `app/api/signature/[token]/profile/route.ts:421` — `.eq("invited_email", tenantEmail)` case-sensitive
  - `app/api/signature/[token]/profile/route.ts:181` — `.eq("email", tenantEmail)` case-sensitive
  - `lib/services/lease-initial-invoice.service.ts:120` — `.eq("email", ...)` case-sensitive
  - `lib/services/lease-creation.service.ts:194,324` — email non normalise avant insertion
- **Cause** : Si le locataire est invite avec "John@Example.com" mais s'authentifie avec "john@example.com", tous les lookups echouent
- **Impact** : Profil non lie → signer orphelin → facture non creee → bail bloque
- **Statut** : **CORRIGE** (`.eq()` → `.ilike()` + normalisation `.toLowerCase().trim()` a l'insertion)

### BUG C5 : Realtime toasts desactives pour le proprietaire
- **Fichier** : `app/owner/dashboard/DashboardClient.tsx:120`
- **Cause** : `useRealtimeDashboard({ showToasts: false })` alors que le locataire a `showToasts: true`
- **Impact** : Le proprietaire ne recoit pas de toast en temps reel (signature recue, paiement effectue, etc.)
- **Statut** : A CORRIGER

---

## 3. BUGS MOYENS

### BUG M0 : Activation manuelle du bail sans verification des signataires
- **Fichier** : `app/api/leases/[id]/activate/route.ts:95-112`
- **Cause** : Verifie `statut === "fully_signed"` mais ne verifie PAS que tous les `lease_signers` ont `signature_status === "signed"`
- **Impact** : Le bail pourrait etre active meme si les signataires n'ont pas tous signe (etat incoherent)
- **Statut** : **CORRIGE** (ajout verification des signataires avant etape 5)

### BUG M1 : EDL document update sans INSERT prealable (race condition)
- **Fichier** : `lib/services/edl-post-signature.service.ts:287-301`
- **Cause** : `handleEDLFullySigned` fait un UPDATE sur `documents` filtre par `metadata->>edl_id`. Le INSERT est fait dans la route de signature (ligne 622-638 de `edl/[id]/sign/route.ts`). Si le INSERT echoue silencieusement, l'UPDATE ne matchera rien.
- **Impact** : Le document EDL signe existe dans Storage mais pas dans la table documents → invisible pour l'utilisateur
- **Statut** : A CORRIGER (ajouter un INSERT fallback dans handleEDLFullySigned)

### BUG M2 : visible_tenant non applique dans tous les chemins d'acces
- **Fichier** : `lib/hooks/use-documents.ts:192-200` et `app/api/properties/[id]/documents/route.ts`
- **Cause** : Le flag `visible_tenant` n'est pas filtre dans la logique de fallback du hook et dans la route API documents par propriete
- **Impact** : Le locataire pourrait voir des documents que le proprietaire a marque comme caches
- **Statut** : A CORRIGER

### BUG M3 : Receipt generation echoue silencieusement
- **Fichier** : `lib/services/final-documents.service.ts:87-94`
- **Cause** : Retourne `null` si paiement/propriete manquant, sans notification
- **Impact** : La quittance n'est pas generee et personne n'est prevenu
- **Statut** : A CORRIGER (ajouter log + notification)

### BUG M4 : Tenant name split sur null
- **Fichier** : `app/signature/[token]/page.tsx:108`
- **Cause** : `lease.tenant_name_pending?.split(" ")` fonctionne grace au `?.` mais le fallback est une chaine vide
- **Impact** : Le nom du locataire peut apparaitre vide sur la page de signature
- **Statut** : A CORRIGER

### BUG M5 : Tenant dashboard race condition
- **Fichier** : `app/tenant/dashboard/DashboardClient.tsx:83-91`
- **Cause** : Auto-retry avec timeout de 1500ms qui peut etre insuffisant sur reseau lent
- **Impact** : Dashboard vide affiche pour les mobiles/connexions lentes
- **Statut** : A AMELIORER

### BUG M6 : Performance metrics optionnelles sans feedback
- **Fichier** : `app/api/owner/dashboard/route.ts:469-513`
- **Cause** : Si `prix_achat` non renseigne, tout le bloc performance retourne null
- **Impact** : Section vide sans explication cote UI
- **Statut** : A AMELIORER

### BUG M7 : Document type defini en double
- **Fichier** : `app/api/documents/upload/route.ts:30-45` ET `app/api/documents/upload-batch/route.ts:57-69`
- **Cause** : 42 types de documents dupliques dans 2 routes differentes
- **Impact** : Si un type est ajoute dans une route et oublie dans l'autre, upload rejete
- **Statut** : A REFACTORER (centraliser dans `lib/config/document-types.ts`)

### BUG M8 : Tenant auto-resolve lease arbitraire
- **Fichier** : `app/api/documents/upload/route.ts:137-143`
- **Cause** : Si le locataire a plusieurs baux actifs, le code prend le premier sans critere
- **Impact** : Document potentiellement lie au mauvais bail
- **Statut** : A CORRIGER (preferer le bail le plus recent)

### BUG M9 : Cache-Control mal configure
- **Fichier** : `app/api/owner/dashboard/route.ts:588-591`
- **Cause** : `s-maxage=300` (cache serveur) utilise dans un contexte Next.js API route qui n'a pas de CDN
- **Impact** : Donnees potentiellement obsoletes pendant 5 minutes
- **Statut** : A CORRIGER (utiliser `max-age` ou revalidation)

---

## 4. BUGS MINEURS / AMELIORATIONS

### BUG L1 : Signed URLs expirent sans rafraichissement
- **Fichier** : `app/api/documents/[id]/signed-url/route.ts:125`
- **Cause** : Expiration hardcodee a 3600s, pas de mecanisme de refresh dans le composant de preview
- **Impact** : L'utilisateur qui visualise un document longtemps verra un lien casse

### BUG L2 : Pas de rate limiting sur le download
- **Fichier** : `app/api/documents/download/route.ts`
- **Impact** : Risque d'abus (telechargement massif)

### BUG L3 : Activite recente sans contexte
- **Fichier** : `components/owner/dashboard/recent-activity.tsx:88`
- **Cause** : Seul `activity.title` est affiche, pas d'adresse, de montant ou de nom
- **Impact** : L'owner voit "Facture 2025-01" mais sans savoir pour quel locataire/bien

### BUG L4 : Property cast a `any` sans type safety
- **Fichier** : `app/signature/[token]/page.tsx:97`
- **Impact** : Si la structure property change, pas de detection TypeScript

### BUG L5 : EDL status column nommee `status` vs `statut` (incoherence)
- **Fichier** : `app/owner/_data/fetchDashboard.ts:146-149`
- **Cause** : La table EDL utilise `status` mais toutes les autres tables utilisent `statut`
- **Impact** : Source de confusion et bugs potentiels

### BUG L6 : Metadata documents non validee par schema Zod
- **Fichier** : `app/api/documents/upload-batch/route.ts:195-205`
- **Impact** : Metadata inconsistante entre documents

### BUG L7 : Redirect /owner/invoices perd les query params
- **Fichier** : `app/owner/invoices/page.tsx:10`
- **Impact** : Les filtres de l'utilisateur sont perdus

### BUG L8 : Double trigger d'activation du bail (EDL)
- **Fichier** : `supabase/migrations/20260105000002_edl_lease_sync_triggers.sql`
- **Cause** : Deux triggers distincts activent le bail (check_edl_finalization + trigger_activate_lease_on_edl_signed)
- **Impact** : Evenements outbox dupliques, double audit log

### BUG L9 : Tokens invitation EDL sans expiration si invitation_sent_at est NULL
- **Fichier** : `app/api/signature/edl/[token]/sign/route.ts:56-70`
- **Cause** : Si `invitation_sent_at` est null, le check d'expiration est saute
- **Impact** : Tokens valides indefiniment (risque securite)

### BUG L10 : Cles vides dans la remise des clefs
- **Fichier** : `app/api/leases/[id]/key-handover/route.ts:186`
- **Cause** : Si l'EDL n'a pas de cles, le handover est cree avec `keys_list: []`
- **Impact** : Attestation sans cles, pas de preuve juridique

### BUG L11 : Tenant multi-bail pas totalement supporte
- **Fichier** : `app/tenant/dashboard/DashboardClient.tsx:81`
- **Cause** : `selectedLeaseIndex` existe mais tous les widgets ne l'utilisent pas
- **Impact** : Certaines sections montrent le premier bail meme si un autre est selectionne

---

### BUG L12 : Owner non notifie quand facture initiale creee
- **Fichier** : `supabase/functions/process-outbox/index.ts:188-211`
- **Cause** : L'event `Invoice.InitialCreated` n'envoie une notification qu'au locataire
- **Impact** : Le proprietaire ne sait pas que la facture a ete creee

### BUG L13 : Quittance uniquement si facture reglee a 100%
- **Fichier** : `app/api/webhooks/stripe/route.ts:602-609`
- **Cause** : `ensureReceiptDocument()` appele seulement si `isSettled === true`
- **Impact** : Paiement partiel sans quittance

### BUG L14 : Deux processeurs outbox en concurrence
- **Fichier** : `app/api/cron/process-outbox/route.ts` vs `supabase/functions/process-outbox/index.ts`
- **Cause** : Deux processeurs distincts traitent les memes events
- **Impact** : Notifications dupliquees possibles

### BUG L15 : Pas de flow de remboursement Stripe
- **Fichier** : `app/api/webhooks/stripe/route.ts`
- **Cause** : Le statut `refunded` existe dans le schema mais aucun handler pour les events refund
- **Impact** : Les remboursements Stripe ne sont pas refletes dans l'application

---

## 5. CE QUI FONCTIONNE CORRECTEMENT

### Signature
- Flow de signature proprietaire (auth) : OK
- Flow de signature locataire (token + OTP) : OK (hors bug C1 corrige)
- Preuve cryptographique de signature : OK
- Upload image signature dans Storage : OK
- Audit log de chaque signature : OK

### EDL
- Creation EDL lie au bail/propriete : OK
- Conducteur EDL (pieces, items, medias) : OK
- Signature EDL par les 2 parties : OK
- Generation HTML EDL signe : OK
- Insertion document EDL dans la table documents : OK (dans les 2 routes de sign)
- Post-signature avec update du storage_path : OK

### Documents
- Upload simple et batch : OK
- Validation fichiers (taille, type MIME) : OK
- Signed URLs pour acces prive : OK
- Preview modal (PDF + images) : OK avec zoom/rotation
- Controle d'acces RLS : OK via vues v_tenant/v_owner_accessible_documents
- Flag visible_tenant : OK (en partie, voir M2)
- Auto-resolution lease/property pour tenants : OK (en partie, voir M8)

### Factures
- Facture initiale a la signature : OK (hors bug C1 corrige)
- Generation mensuelle par cron : OK
- Prorata si bail ne commence pas le 1er : OK
- Numero de facture unique : OK (INI-YYYYMM-XXX)
- Date d'echeance calculee : OK

### Paiements
- Stripe PaymentIntent creation : OK
- Checkout component (saved + new methods) : OK
- Webhook processing : OK
- Sync invoice ↔ payment status : OK
- Quittance generation apres paiement : OK (sauf M3)
- Cash receipt avec double signature : OK

### Notifications
- Notification in-app a la signature : OK
- Email d'invitation locataire : OK
- Rappels de paiement (cron) : OK (J-3, J-1, J+1, J+7, J+15, J+30)
- Detection retard/impayes (cron) : OK
- Calcul penalites de retard : OK

### Architecture
- Outbox pattern pour events async : OK
- Webhook queue avec retry : OK
- Audit events immutables partitionnes : OK
- Self-healing pour baux corrompus : OK (via outbox retry)
- Anti-doublon factures (garde SQL) : OK

---

## MATRICE DE PRIORITE

| ID | Severite | Effort | Statut |
|----|----------|--------|--------|
| C1 | CRITIQUE | Fait | CORRIGE |
| C2 | CRITIQUE | 5 min | A FAIRE |
| C3 | CRITIQUE | 15 min | A FAIRE |
| C4 | CRITIQUE | Fait | CORRIGE |
| C5 | CRITIQUE | 5 min | A FAIRE |
| M1 | MOYEN | 30 min | A FAIRE |
| M2 | MOYEN | 30 min | A FAIRE |
| M3 | MOYEN | 20 min | A FAIRE |
| M4 | MOYEN | 5 min | A FAIRE |
| M5 | MOYEN | 15 min | A FAIRE |
| M6 | MOYEN | 15 min | A FAIRE |
| M7 | MOYEN | 30 min | A FAIRE |
| M8 | MOYEN | 15 min | A FAIRE |
| M9 | MOYEN | 5 min | A FAIRE |
| L1-L8 | MINEUR | Variable | A PLANIFIER |
