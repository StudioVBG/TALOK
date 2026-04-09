# Talok — Audit Complet : Code vs Skills
## Rapport exhaustif — 9 avril 2026

---

## Métriques globales du codebase

| Métrique | Valeur |
|----------|--------|
| Pages UI (page.tsx) | 385 |
| Routes API (route.ts) | 707 |
| Tables SQL (migrations) | 334 |
| Tables avec RLS | 323 (97%) |
| Hooks React | 88 |
| Feature components | 203 |
| Migrations SQL | 387 |
| Edge Functions Supabase | 18 |
| Skills documentés | 6 |

---

## A. Tableau récapitulatif global

| # | Module | Tables | Routes API | Pages UI | Composants | Feature gate | Score | Verdict |
|---|--------|--------|-----------|----------|------------|-------------|-------|---------|
| 1 | Baux | 4/4 | 40+/15 | 10/8 | 7/7 | ⚠️ partiel | 8/10 | ⚠️ Partiel |
| 2 | Paiements | 8/8 | 15+/15 | 8/8 | 6/6 | ✅ | 8/10 | ⚠️ Partiel |
| 3 | Documents | 5/5 | 12/12 | 4/4 | 5/5 | ✅ | 9/10 | ✅ Complet |
| 4 | Biens | 3/3 | 20+/10 | 6/6 | 15+/10 | ✅ | 9/10 | ✅ Complet |
| 5 | EDL | 8/6 | 15+/10 | 8/8 | 10/8 | ⚠️ | 8/10 | ⚠️ Partiel |
| 6 | Colocation | 5/5 | 12/10 | 9/8 | 12/10 | ⚠️ | 7/10 | ⚠️ Partiel |
| 7 | Charges | 5/4 | 10/8 | 3/3 | 1/3 | ⚠️ | 7/10 | ⚠️ Partiel |
| 8 | Candidatures | 3/3 | 10/8 | 5/5 | 7/7 | ⚠️ | 7/10 | ⚠️ Partiel |
| 9 | Prestataires | 6/4 | 20+/10 | 12/10 | 3/5 | ⚠️ | 7/10 | ⚠️ Partiel |
| 10 | Syndic | 4/4 | 10/8 | 20/10 | 2/5 | ⚠️ | 6/10 | ⚠️ Partiel |
| 11 | Garant | 4/4 | 8/6 | 6/5 | 2/3 | ✅ | 7/10 | ⚠️ Partiel |
| 12 | Agence/White-label | 5/4 | 12/8 | 20/10 | 2/5 | ⚠️ | 6/10 | ⚠️ Partiel |
| 13 | Notifications | 4/4 | 10/8 | 3/3 | 3/3 | ✅ | 7/10 | ⚠️ Partiel |
| 14 | Auth & RBAC | 6/5 | 15/10 | 8/8 | 3/3 | ✅ | 8/10 | ⚠️ Partiel |
| 15 | Onboarding | 4/4 | 3/3 | 15/10 | 3/3 | ✅ | 7/10 | ⚠️ Partiel |
| 16 | Comptabilité | 15/15 | 50+/20 | 12/10 | 4/5 | ✅ | 9/10 | ✅ Complet |
| 17 | Add-ons | 1/1 | 5/5 | 2/2 | 6/6 | ✅ | 8/10 | ⚠️ Partiel |
| 18 | Stripe Abonnement | 3/3 | 20/15 | 3/3 | 3/3 | ✅ | 8/10 | ⚠️ Partiel |
| 19 | Saisonnier | 5/5 | 10/8 | 5/5 | 3/3 | ⚠️ | 7/10 | ⚠️ Partiel |
| 20 | Compteurs | 3/3 | 10/8 | 5/4 | 2/3 | ⚠️ | 7/10 | ⚠️ Partiel |
| 21 | Agent TALO | 3/4 | 5/10 | 0/4 | 0/10 | ❌ | 3/10 | ❌ Absent |
| 22 | API REST | 4/4 | 30+/15 | 4/4 | 2/2 | ✅ | 8/10 | ⚠️ Partiel |
| 23 | Diagnostics | 2/2 | 5/4 | 4/3 | 7/5 | ⚠️ | 7/10 | ⚠️ Partiel |
| 24 | Assurances | 1/1 | 4/3 | 2/2 | 4/3 | ⚠️ | 6/10 | ⚠️ Partiel |
| 25 | RGPD | 3/3 | 4/4 | 3/3 | 1/2 | ✅ | 7/10 | ⚠️ Partiel |
| 26 | Admin | 2/2 | 50+/20 | 35/15 | 2/3 | ✅ | 8/10 | ⚠️ Partiel |
| 27 | Landing | 0/0 | 1/1 | 25+/15 | 5/5 | N/A | 8/10 | ⚠️ Partiel |
| 28 | Mobile | 1/1 | 2/2 | 0/0 | 2/2 | N/A | 6/10 | ⚠️ Partiel |
| 29 | Tickets | 2/2 | 12/8 | 6/5 | 2/3 | ⚠️ | 7/10 | ⚠️ Partiel |
| 30 | Droits locataire | 0/1 | 1/2 | 4/3 | 2/2 | N/A | 5/10 | ⚠️ Partiel |

---

## Module 1 : BAUX
### Skill de référence : talok-baux (non disponible — vérification directe)

### A. Tables SQL
| Table attendue | Existe ? | Colonnes clés vérifiées |
|----------------|---------|------------------------|
| leases | ✅ | `statut` (draft/pending_signature/active/terminated), `type_bail` (nu/meuble/colocation/saisonnier), `is_colocation`, `initial_payment_confirmed`, `coloc_config`, `invite_token`, `yousign_signature_request_id` |
| lease_signers | ✅ | lease_id, profile_id, role (proprietaire/locataire_principal/colocataire/garant), signature_status |
| lease_amendments | ✅ | Existe dans migrations |
| lease_notices | ✅ | public.lease_notices existe |

### B. Routes API (40+ routes /api/leases/*)
| Route | Existe ? | Fichier |
|-------|---------|---------|
| GET/POST /api/leases | ✅ | app/api/leases/route.ts |
| GET/PATCH /api/leases/[id] | ✅ | app/api/leases/[id]/route.ts |
| POST /api/leases/[id]/activate | ✅ | Activation avec conditions |
| POST /api/leases/[id]/sign | ✅ | Signature électronique |
| POST /api/leases/[id]/seal | ✅ | Scellement bail |
| POST /api/leases/[id]/initiate-signature | ✅ | Démarrage session signature |
| GET/POST /api/leases/[id]/signers | ✅ | Gestion signataires |
| POST /api/leases/[id]/amend | ✅ | Avenants |
| POST /api/leases/[id]/notice | ✅ | Congés |
| POST /api/leases/[id]/terminate | ✅ | Résiliation |
| POST /api/leases/[id]/renew | ✅ | Renouvellement |
| POST /api/leases/[id]/cancel | ✅ | Annulation |
| GET /api/leases/[id]/pdf | ✅ | Génération PDF |
| GET /api/leases/[id]/html | ✅ | Aperçu HTML |
| POST /api/leases/[id]/key-handover | ✅ | Remise des clés |
| POST /api/leases/[id]/deposit | ✅ | Dépôt de garantie |
| POST /api/leases/[id]/roommates | ✅ | Colocataires |
| POST /api/leases/[id]/payment-shares | ✅ | Parts de paiement |
| POST /api/leases/parking | ✅ | Bail parking |

### C. Pages UI
| Page | Existe ? | Fichier |
|------|---------|---------|
| Liste baux | ✅ | app/owner/leases/page.tsx |
| Création bail | ✅ | app/owner/leases/new/page.tsx |
| Détail bail | ✅ | app/owner/leases/[id]/page.tsx |
| Édition bail | ✅ | app/owner/leases/[id]/edit/page.tsx |
| Signataires | ✅ | app/owner/leases/[id]/signers/page.tsx |
| Avenant | ✅ | app/owner/leases/[id]/amend/page.tsx |
| Congé | ✅ | app/owner/leases/[id]/notice/page.tsx |
| Colocataires | ✅ | app/owner/leases/[id]/roommates/page.tsx |
| Bail parking | ✅ | app/owner/leases/parking/new/page.tsx |
| Bail locataire | ✅ | app/tenant/lease/page.tsx |

### D. Composants
| Composant | Existe ? | Fichier |
|-----------|---------|---------|
| LeaseForm | ✅ | features/leases/components/lease-form.tsx |
| LeaseCard | ✅ | features/leases/components/lease-card.tsx |
| LeasesList | ✅ | features/leases/components/leases-list.tsx |
| LeasePreview | ✅ | features/leases/components/lease-preview.tsx |
| LeaseSigner | ✅ | features/leases/components/lease-signers.tsx |
| KeysHandover | ✅ | features/leases/components/keys-handover-dialog.tsx |
| LeaseRenewalWizard | ✅ | features/leases/components/lease-renewal-wizard.tsx |

### E. Logique métier
| Règle | Implémentée ? | Détail |
|-------|--------------|--------|
| State machine statut | ✅ | draft → pending_signature → active → terminated |
| Activation 4 conditions | ⚠️ | Signature vérifiée, paiement initial vérifié ; EDL et clés partiellement vérifiés |
| Signature électronique | ✅ | Canvas signature + Yousign intégration |
| Renouvellement tacite | ✅ | Route /api/leases/[id]/renew + cron lease-expiry-alerts |
| Templates par type | ⚠️ | Type bail dans le formulaire (nu/meublé/mobilité/étudiant) mais templates pas différenciés |
| Bail parking spécifique | ✅ | Wizard dédié parking-lease-wizard |

### Score : 8/10
### Verdict : ⚠️ Partiel
### Actions prioritaires :
1. Vérifier que l'activation vérifie bien les 4 conditions (signé + EDL + paiement + clés)
2. Différencier les templates bail par type (mobilité, étudiant ont des clauses spécifiques)
3. Ajouter feature gating sur certaines routes

---

## Module 2 : PAIEMENTS
### Skill de référence : talok-stripe-pricing

### A. Tables SQL
| Table attendue | Existe ? | Colonnes clés |
|----------------|---------|---------------|
| invoices | ✅ | statut (draft/sent/paid/late + extensions), montant_total, montant_loyer, montant_charges |
| payments | ✅ | stripe_payment_intent_id, amount, status, payment_method |
| rent_payments | ✅ | Table dédiée aux paiements de loyer |
| security_deposits | ✅ | Table dépôts de garantie |
| stripe_connect_accounts | ✅ | profile_id, stripe_account_id, charges_enabled, payouts_enabled |
| stripe_transfers | ✅ | stripe_transfer_id, amount, platform_fee, net_amount, status |
| payment_intents | ✅ | Tracking des PaymentIntents |
| sepa_mandates | ✅ | Mandats SEPA |

### B. Routes API
| Route | Existe ? |
|-------|---------|
| /api/payments/create-intent | ✅ |
| /api/payments/create-rent-intent | ✅ |
| /api/payments/create-checkout-session | ✅ |
| /api/payments/setup-sepa | ✅ |
| /api/payments/confirm | ✅ |
| /api/payments/calculate-fees | ✅ |
| /api/payments/cash-receipt | ✅ |
| /api/stripe/connect | ✅ |
| /api/stripe/connect/balance | ✅ |
| /api/stripe/connect/transfers | ✅ |
| /api/stripe/connect/payouts | ✅ |
| /api/stripe/connect/dashboard | ✅ |
| /api/stripe/collect-rent | ✅ |
| /api/webhooks/stripe | ✅ (1689 lignes) |

### C. Webhook Stripe — Événements gérés
| Événement | Géré ? |
|-----------|--------|
| checkout.session.completed | ✅ |
| payment_intent.succeeded | ✅ |
| payment_intent.payment_failed | ✅ |
| invoice.paid | ✅ |
| invoice.payment_failed | ✅ |
| customer.subscription.created/updated | ✅ |
| customer.subscription.deleted | ✅ |
| customer.subscription.trial_will_end | ✅ |
| account.updated | ✅ |
| transfer.created/failed | ✅ |
| payout.created/updated/paid/failed/canceled | ✅ |
| charge.dispute.created | ✅ |

### D. Pages UI
| Page | Existe ? |
|------|---------|
| Finances owner | ✅ | app/owner/finances/page.tsx + invoices/ + payments/ + deposits/ |
| Paiement tenant | ✅ | app/tenant/payment/page.tsx + history/ |
| Money owner | ✅ | app/owner/money/page.tsx + settings/ |
| Billing | ✅ | app/owner/settings/billing/ |

### E. Quittances
| Élément | État |
|---------|------|
| receipt-generator.ts | ✅ Existe (132 lignes) |
| Branché sur webhook Stripe | ✅ ensureReceiptDocument() appelé dans payment_intent.succeeded |
| Email quittance au locataire | ✅ sendReceiptEmail() dans le webhook |

### F. Crons
| Cron | Existe ? |
|------|---------|
| Génération factures mensuelles | ✅ /api/cron/generate-invoices |
| Relances paiement | ✅ /api/cron/payment-reminders |
| Relances loyer | ✅ /api/cron/rent-reminders |
| Vérification impayés | ✅ /api/cron/overdue-check |

### Score : 8/10
### Verdict : ⚠️ Partiel
### Actions prioritaires :
1. Vérifier que SEPA est bien le seul mode pour les loyers (pas CB)
2. Vérifier application_fee_amount dynamique depuis PLAN_LIMITS
3. Vérifier flux restitution dépôt de garantie complet

---

## Module 3 : DOCUMENTS
### Skill de référence : talok-documents-sota

### A. Fichiers clés
| Fichier attendu | Existe ? | Conforme ? |
|-----------------|---------|-----------|
| lib/documents/constants.ts | ✅ | Source unique DOCUMENT_TYPES, MIME, labels |
| lib/documents/format-name.ts | ✅ | getDisplayName() |
| lib/documents/group-documents.ts | ✅ | groupDocuments() |
| lib/documents/receipt-generator.ts | ✅ | Orchestrateur quittance (132 lignes) |
| features/documents/components/grouped-document-card.tsx | ✅ | CNI recto/verso |
| features/documents/components/documents-list.tsx | ✅ | Liste documents |
| features/documents/components/document-upload-form.tsx | ✅ | Upload form |

### B. Routes API
| Route | Existe ? |
|-------|---------|
| POST /api/documents/upload | ✅ |
| POST /api/documents/upload-batch | ✅ |
| GET/PATCH/DELETE /api/documents/[id] | ✅ |
| GET /api/documents/[id]/signed-url | ✅ |
| GET /api/documents/[id]/download | ✅ |
| GET /api/documents/search | ✅ |
| GET /api/documents/check | ✅ |

### C. Vues SQL
| Vue | Existe ? |
|-----|---------|
| v_owner_accessible_documents | ✅ (dans migrations) |
| v_tenant_accessible_documents | ✅ |
| v_tenant_key_documents | ✅ |
| documents_enriched | ✅ |

### D. État des corrections (skill)
| Correction | Appliquée ? |
|-----------|------------|
| constants.ts source unique | ✅ |
| format-name.ts | ✅ |
| group-documents.ts | ✅ |
| grouped-document-card.tsx | ✅ |
| MIME bucket (Word/Excel) | ✅ |
| CNI groupement raccordé | ⚠️ Composant créé, pas raccordé dans documents-list.tsx |
| Receipt generator branché | ✅ Branché sur webhook Stripe |

### Score : 9/10
### Verdict : ✅ Complet
### Actions prioritaires :
1. Raccorder CNI recto/verso dans documents-list.tsx
2. Implémenter génération PDF bail signé après signature

---

## Module 4 : BIENS (Properties)
### Skill de référence : talok-property-management

### A. Fichiers clés
| Fichier | Existe ? |
|---------|---------|
| lib/properties/constants.ts | ✅ (14 types, labels, catégories) |
| lib/properties/guards.ts | ✅ (canDeleteProperty, cleanupPropertyPhotos) |

### B. Tables
| Table | Existe ? |
|-------|---------|
| properties | ✅ |
| photos | ✅ (pas property_photos) |
| property_ownership | ✅ |
| rooms | ✅ |

### C. Routes principales
| Route | Existe ? |
|-------|---------|
| GET/POST /api/properties | ✅ |
| GET/PATCH/DELETE /api/properties/[id] | ✅ |
| /api/properties/[id]/photos | ✅ |
| /api/properties/[id]/rooms | ✅ |
| /api/properties/[id]/meters | ✅ |
| /api/properties/[id]/inspections | ✅ |
| /api/properties/[id]/leases | ✅ |
| /api/properties/[id]/share | ✅ |

### D. Wizard création v3
| Composant | Existe ? |
|-----------|---------|
| address-step.tsx | ✅ |
| conditions-step.tsx | ✅ |
| dynamic-step.tsx | ✅ |
| equipments-info-step.tsx | ✅ |
| Immersive wizard | ✅ (steps/ subdirectory) |

### E. Feature gating
- canCreateProperty() vérifie PLAN_LIMITS.maxProperties : ✅ via usePlanAccess()
- Soft delete : ✅ archived_at colonne ajoutée

### Score : 9/10
### Verdict : ✅ Complet

---

## Module 5 : EDL (États des lieux)
### Skill de référence : talok-edl

### A. Tables SQL
| Table | Existe ? |
|-------|---------|
| edl | ✅ |
| edl_rooms | ✅ |
| edl_items | ✅ |
| edl_inspection_items | ✅ |
| edl_media | ✅ |
| edl_signatures | ✅ |
| edl_meter_readings | ✅ |
| edl_furniture_inventory | ✅ |
| edl_mandatory_furniture | ✅ |
| vetuste_grid | ✅ |
| vetusty_grid | ✅ (variante) |
| vetusty_reports | ✅ |
| vetusty_items | ✅ |

### B. Routes API (15+)
- /api/edl/route.ts, /api/edl/[id], /api/edl/[id]/rooms, /api/edl/[id]/sections
- /api/edl/[id]/sign, /api/edl/[id]/validate, /api/edl/[id]/compare
- /api/edl/[id]/retenues, /api/edl/[id]/meter-readings
- /api/edl/[id]/invite, /api/edl/[id]/duplicate
- /api/edl/pdf, /api/edl/preview
- /api/edl-media/[id]
- /api/vetuste/grid, /api/vetusty/reports/*
- /api/signature/edl/[token]/*

### C. Pages UI
| Page | Existe ? |
|------|---------|
| app/owner/inspections/page.tsx | ✅ |
| app/owner/inspections/new | ✅ |
| app/owner/inspections/[id] | ✅ |
| app/owner/inspections/[id]/edit | ✅ |
| app/owner/inspections/[id]/compare | ✅ |
| app/owner/inspections/[id]/photos | ✅ |
| app/owner/inspections/template | ✅ |
| app/tenant/inspections/ | ✅ |
| app/signature-edl/[token] | ✅ |

### D. Composants
| Composant | Existe ? |
|-----------|---------|
| ComparisonSplitView | ✅ |
| ElementCotation | ✅ |
| RetenueSummary | ✅ |
| RoomTemplates | ✅ |
| VetusteCalculator | ✅ |
| edl-preview | ✅ |
| features/end-of-lease/* | ✅ (17 composants) |

### E. Logique métier
| Règle | Implémentée ? |
|-------|--------------|
| Parcours pièce par pièce | ✅ |
| Comparaison entrée/sortie | ✅ |
| Calcul retenues + vétusté | ✅ |
| Signature mobile (canvas) | ✅ |
| Génération PDF | ✅ |
| Lien dépôt garantie | ✅ (retenues route) |

### Score : 8/10
### Verdict : ⚠️ Partiel
### Actions prioritaires :
1. Vérifier conformité PDF EDL au décret 2016-382
2. Feature gating EDL numérique (hasEdlDigital)

---

## Module 6 : COLOCATION
### Skill de référence : talok-colocation

### A. Tables SQL
| Table | Existe ? |
|-------|---------|
| colocation_rooms | ✅ |
| colocation_members | ✅ |
| colocation_rules | ✅ |
| colocation_tasks | ✅ |
| colocation_expenses | ✅ |

### B. Routes API (12+)
- /api/colocation/rooms, /api/colocation/rooms/[id]
- /api/colocation/members, /api/colocation/members/[id]/departure, /api/colocation/members/[id]/replace
- /api/colocation/rules, /api/colocation/rules/[id]
- /api/colocation/tasks, /api/colocation/tasks/[id], /api/colocation/tasks/rotate
- /api/colocation/expenses, /api/colocation/expenses/balances, /api/colocation/expenses/settle

### C. Pages UI
**Owner :**
- app/owner/properties/[id]/colocation/page.tsx
- app/owner/properties/[id]/colocation/rooms/page.tsx + [roomId]
- app/owner/properties/[id]/colocation/members/page.tsx + [memberId]
- app/owner/properties/[id]/colocation/rules
- app/owner/properties/[id]/colocation/tasks
- app/owner/properties/[id]/colocation/expenses

**Tenant :**
- app/tenant/colocation/page.tsx
- app/tenant/colocation/expenses + /add
- app/tenant/colocation/rules
- app/tenant/colocation/tasks
- app/tenant/colocation/payment

### D. Composants (12)
- ColocationDashboard, ColocationPaymentSplit, BalanceSummary
- RoomCard, RoomEditor, MemberCard, DepartureModal
- ExpenseForm, ExpensesList, RulesEditor
- TaskCalendar, SolidarityBadge

### Score : 7/10
### Verdict : ⚠️ Partiel
### Actions prioritaires :
1. Implémenter clause de solidarité (6 mois max)
2. Feature gating hasColocation (pas dans PlanLimits actuel)
3. SEPA individuel par colocataire

---

## Module 7 : CHARGES

### A. Tables : ✅ charge_categories, charge_entries, lease_charge_regularizations, charge_provisions
### B. Routes : 11 routes /api/charges/*
### C. Pages : 5 (owner charges, régularisation, tenant charges, copro charges)
### D. Engine : ✅ lib/charges/engine.ts avec calculateRegularization
### E. Envoi décompte : ✅ /api/charges/regularization/[id]/send
### F. Contestation locataire : ✅ /api/charges/regularization/[id]/contest

### Score : 8/10
### Verdict : ✅ Complet

---

## Module 8 : CANDIDATURES

### A. Tables : ✅ property_listings, applications, tenant_applications
### B. Page publique sans compte : ✅ app/(public)/annonce/[token]/
### C. Scoring IA : ✅ /api/applications/[id]/score avec solvability_scores
### D. Acceptation → bail auto : ✅ /api/v1/applications/[id]/accept crée draft lease
### E. 8 composants features/candidatures

### Score : 9/10
### Verdict : ✅ Complet

---

## Module 9 : PRESTATAIRES

### A. Tables : ✅ providers, owner_providers, work_orders (12+ statuts), provider_reviews
### B. State machine : ✅ 12 statuts work_order + flow séparé
### C. Ticket → work order : ✅ work_orders.ticket_id FK
### D. Devis : ✅ Routes request/submit/approve/reject-quote
### E. Rapport intervention : ✅ intervention_report + photos
### F. Lien comptabilité : ✅ accounting_entry_id, is_deductible
### G. Portail prestataire complet : ✅ 40+ pages app/provider/*

### Score : 9/10
### Verdict : ✅ Complet

---

## Module 10 : SYNDIC

### A. Tables : ✅ copro_lots, copro_budgets, copro_fund_calls, copro_fund_call_lines
### B. Feature gating : ✅ PlanGate feature="copro_module" + withFeatureAccess
### C. Pages : ✅ 47+ pages app/syndic/* + app/copro/* (extranet)
### D. Plan comptable copro : ✅ COPRO_ACCOUNTS 30 comptes décret 2005
### E. Stripe metered billing : ⚠️ UI seulement, pas branché Stripe

### Score : 8/10
### Verdict : ⚠️ Partiel

---

## Module 11 : GARANT

### A. Tables : ✅ guarantors, guarantor_engagements, guarantor_invitations, guarantor_profiles
### B. Signup flow : ✅ /signup/role inclut guarantor
### C. Acte cautionnement : ✅ CautionActeViewer.tsx (conforme art. 22-1 loi 89-462)
### D. Signature : ✅ app/guarantor/dashboard/[id]/sign/
### E. Libération 6 mois : ⚠️ Manuel uniquement (raison disponible, pas de cron)
### F. Visale : ✅ Vérification Visale intégrée

### Score : 7/10
### Verdict : ⚠️ Partiel

---

## Module 12 : AGENCE / WHITE-LABEL

### A. Tables : ✅ whitelabel_configs, agency_mandates, agency_crg, agency_mandant_accounts
### B. Theming dynamique : ✅ AgencyThemeWrapper avec CSS variables
### C. Pages : ✅ 57+ pages app/agency/*
### D. Loi Hoguet : ✅ Mandats conformes, comptes mandants séparés
### E. CRG : ✅ Génération + envoi
### F. Domaine personnalisé : ✅ DNS verification + résolution

### Score : 6/10 (Agency signup cassé — bug connu)
### Verdict : ⚠️ Partiel

---

## Module 13 : NOTIFICATIONS

### A. Tables SQL
| Table | Existe ? |
|-------|---------|
| notifications | ✅ |
| notification_preferences | ✅ |
| notification_event_preferences | ✅ |
| notification_settings | ✅ |
| push_subscriptions | ✅ |
| sms_messages | ✅ |
| sms_usage | ✅ |

### B. Services
| Service | Existe ? | Fichier |
|---------|---------|---------|
| Notification service | ✅ | lib/notifications/notification.service.ts |
| Events | ✅ | lib/notifications/events.ts |
| Email templates | ✅ | lib/notifications/email-templates.ts |
| Push send | ✅ | lib/push/send.ts |
| Push events | ✅ | lib/push/events.ts |
| SMS service | ✅ | lib/services/sms.service.ts |
| SMS billing | ✅ | lib/subscriptions/sms-billing.ts |

### C. Routes API
- /api/notifications/route.ts (GET)
- /api/notifications/[id]/read
- /api/notifications/read-all
- /api/notifications/preferences + event-preferences + settings
- /api/notifications/push/subscribe + push/send
- /api/notifications/sms/send

### D. In-app : Supabase Realtime (lib/hooks/use-realtime-dashboard.ts, use-realtime-tenant.ts)
### E. Bell icon avec badge : ✅ (notifications page avec badge count)

### Score : 7/10
### Verdict : ⚠️ Partiel
### Actions prioritaires :
1. Vérifier que Firebase Admin est configuré (FCM)
2. Twilio : vérifier les credentials en prod
3. Comptage réel des templates email Resend

---

## Module 14 : AUTH & RBAC

### A. 2FA TOTP
| Élément | Existe ? |
|---------|---------|
| Table user_2fa | ✅ |
| Table identity_2fa_requests | ✅ |
| Table two_factor_sessions | ✅ |
| Routes /api/auth/2fa/* | ✅ (setup, enable, disable, verify, status) |

### B. Passkeys WebAuthn
| Élément | Existe ? |
|---------|---------|
| Table passkey_credentials | ✅ |
| Table passkey_challenges | ✅ |
| Routes /api/auth/passkeys/* | ✅ (register/options, register/verify, authenticate/options, authenticate/verify) |

### C. Middleware RBAC
- ✅ ROUTE_ROLES mapping déclaratif (7 rôles)
- ✅ Routes publiques listées explicitement
- ✅ Cookie-based auth (edge-safe, pas de Supabase dans middleware)

### D. Sessions
| Élément | Existe ? |
|---------|---------|
| Table active_sessions | ✅ |
| Routes /api/auth/sessions | ✅ |
| Revocation /api/auth/sessions/[id]/revoke | ✅ |

### E. RLS (Row Level Security)
| Métrique | Valeur |
|----------|--------|
| Tables totales | 334 |
| Tables avec RLS | 323 (97%) |
| Tables SANS RLS | 15 |

### Score : 8/10
### Verdict : ⚠️ Partiel
### Actions prioritaires :
1. Activer RLS sur `tenants` (données sensibles)
2. Activer RLS sur `two_factor_sessions` (sécurité critique)
3. Vérifier que la validation JWT se fait bien dans les layouts serveur

---

## Module 15 : ONBOARDING

### A. Tables
| Table | Existe ? |
|-------|---------|
| onboarding_progress | ✅ |
| onboarding_analytics | ✅ |
| onboarding_reminders | ✅ |
| onboarding_drafts | ✅ |
| user_feature_discoveries | ✅ |

### B. Parcours par rôle
| Rôle | Pages onboarding | État |
|------|------------------|------|
| Owner | 6 étapes (profile/finance/property/invite/automation/review) | ✅ |
| Tenant | 5 étapes (context/file/identity/payments/sign) | ✅ |
| Provider | 4 étapes (profile/services/ops/review) | ✅ |
| Guarantor | 3 étapes (context/financial/sign) | ✅ |
| Syndic | 7 étapes (profile/site/buildings/units/tantiemes/owners/complete) | ✅ |
| Agency | 4 étapes (profile/mandates/team/review) | ⚠️ Signup cassé |

### C. Tour guidé : ✅ OnboardingTour.tsx existe (780 lignes)
### D. WelcomeModal : ✅
### E. Cron relances : ✅ /api/cron/onboarding-reminders

### Score : 7/10
### Verdict : ⚠️ Partiel
### Bugs connus (skill) :
1. 🔴 Agency inscription cassée
2. 🔴 Tour guidé en doublon (2 systèmes)
3. 🟠 data-tour attrs manquants
4. 🟠 Police Inter au lieu de Manrope dans emails
5. 🟠 Logo SVG absent pages auth
6. 🔴 Prix DB incohérents (19.90€ vs grille officielle)

---

## Module 16 : COMPTABILITÉ

### A. Tables SQL (15 tables dans la migration 20260406210000)
| Table | Existe ? |
|-------|---------|
| accounting_exercises | ✅ |
| chart_of_accounts | ✅ |
| accounting_journals | ✅ |
| accounting_entries | ✅ |
| accounting_entry_lines | ✅ |
| bank_connections | ✅ |
| bank_transactions | ✅ |
| document_analyses | ✅ |
| amortization_schedules | ✅ |
| amortization_lines | ✅ |
| deficit_tracking | ✅ |
| charge_regularizations | ✅ |
| ec_access | ✅ |
| ec_annotations | ✅ |
| copro_budgets | ✅ |
| accounting_audit_log | ✅ |

### B. Engine (lib/accounting/)
| Fichier | Lignes | État |
|---------|--------|------|
| engine.ts | ~571 | ✅ Double-entry, 14 auto-entries |
| fec.ts | ~267 | ✅ Générateur FEC 18 champs |
| reconciliation.ts | ~325 | ✅ Rapprochement bancaire auto |
| chart-amort-ocr.ts | ~278 | ✅ Plan comptable + OCR |
| index.ts | ~65 | ✅ Barrel export |

### C. Routes API (50+)
- /api/accounting/exercises/* (CRUD, balance, grand-livre, close)
- /api/accounting/entries/* (CRUD, validate, reverse)
- /api/accounting/chart/* (GET, seed)
- /api/accounting/fec/* (export)
- /api/accounting/bank/* (connections, sync, import, reconciliation)
- /api/accounting/documents/* (analyze, validate)
- /api/accounting/amortization/*
- /api/accounting/deficit, /api/accounting/fiscal-summary
- /api/accounting/charges/regularisation/*
- /api/accounting/ec/* (portail expert-comptable)
- /api/accounting/syndic/* (lots, budget, appels, close, annexes)
- /api/accounting/crg/*, /api/accounting/agency/*

### D. Pages (12)
- app/owner/accounting/page.tsx (dashboard)
- exercises, entries, bank, bank/connect, bank/reconciliation
- exports, amortization, declarations, ec, upload

### E. Edge Functions compta
- amortization-compute, analyze-documents, bank-sync, bank-consent-check
- crg-generate, deficit-update, ocr-analyze-document

### F. Feature gating : ✅ hasAccounting dans PlanLimits

### Score : 9/10
### Verdict : ✅ Complet
### Actions prioritaires :
1. Vérifier que les migrations sont appliquées en prod
2. Tester FEC export end-to-end

---

## Module 17 : ADD-ONS

### A. Table subscription_addons : ✅
### B. Routes /api/subscriptions/addons/ : ✅ (purchase, cancel, check, consume-signature)
### C. Composants features/addons/ : ✅
- AddonCard, AddonPurchaseButton, UpsellModal
- SignatureUsageBar, StorageUsageBar, SMSUsageSummary
- SubscriptionOverview
### D. Page add-ons : ✅ app/owner/settings/subscription/addons/

### Score : 8/10
### Verdict : ⚠️ Partiel

---

## Module 18 : STRIPE ABONNEMENT

### A. Table subscriptions : ✅ (stripe_subscription_id, stripe_customer_id, plan_slug, status)
### B. Webhook handlers : ✅ (checkout.session.completed, subscription.updated/deleted/trial_will_end)
### C. Page billing : ✅ app/owner/settings/billing/
### D. Routes /api/subscriptions/* : ✅ (20+ routes incluant checkout, cancel, portal, plans, features)
### E. Downgrade sur subscription.deleted : ✅ Géré dans webhook

### Score : 8/10
### Verdict : ⚠️ Partiel
### Bug connu : stripe_subscription_id potentiellement NULL

---

## Module 19 : SAISONNIER

### A. Tables
| Table | Existe ? |
|-------|---------|
| seasonal_listings | ✅ |
| seasonal_rates | ✅ |
| seasonal_blocked_dates | ✅ |
| reservations | ✅ |
| taxe_sejour_communes | ✅ |
| declarations_taxe_sejour | ✅ |
| tarifs_plafonds_taxe_sejour | ✅ |

### B. Routes
- /api/seasonal/listings/* (CRUD, calendar, rates, block)
- /api/seasonal/sync/airbnb, /api/seasonal/sync/booking
- /api/reservations/* (CRUD, cancel, check-in, check-out)
- /api/cron/seasonal-cleaning

### C. Pages
- app/owner/seasonal/page.tsx, calendar, listings/[id], reservations/*

### Score : 7/10
### Verdict : ⚠️ Partiel

---

## Module 20 : COMPTEURS

### A. Tables : ✅ property_meters, property_meter_readings, meter_readings, meter_alerts
### B. OAuth Enedis/GRDF : ✅ Routes callback /api/oauth/enedis + grdf
### C. Cron sync : ✅ /api/cron/meters-sync
### D. Pages : ✅ app/owner/properties/[id]/meters/* + app/tenant/meters/
### E. Connect/disconnect : ✅ /api/property-meters/[id]/connect + disconnect
### F. OCR photo : ✅ /api/meters/[id]/photo-ocr

### Score : 7/10
### Verdict : ⚠️ Partiel

---

## Module 21 : AGENT TALO

### A. Tables
| Table attendue (skill) | Table réelle | Existe ? |
|------------------------|-------------|---------|
| talo_conversations | ai_conversations | ✅ (nom différent) |
| talo_messages | assistant_messages + assistant_threads | ✅ (nom différent) |
| tenant_scorings | solvability_scores | ✅ (nom différent) |
| talo_usage | assistant_usage_stats | ✅ (nom différent) |

### B. Routes
| Route attendue (skill) | Route réelle | Existe ? |
|------------------------|-------------|---------|
| /api/talo/chat | /api/assistant/stream | ✅ (nom différent) |
| /api/talo/conversations | /api/assistant/threads | ✅ (nom différent) |
| /api/talo/scoring | /api/applications/[id]/score | ✅ |
| /api/talo/fiscal | ❌ | ❌ ABSENT |
| /api/talo/classify | ❌ | ❌ ABSENT |

### C. Pages UI
| Page attendue | Existe ? |
|--------------|---------|
| app/owner/talo/ | ❌ ABSENT |
| app/owner/talo/scoring | ❌ ABSENT |
| app/owner/talo/fiscal | ❌ ABSENT |

### D. Stack IA
- ✅ Vercel AI SDK installé (streamText usage trouvé)
- ✅ OpenAI package installé
- ✅ LangChain + LangGraph installés
- ✅ Tesseract.js pour OCR
- ✅ OCR_EXTRACTION_SYSTEM_PROMPT défini

### E. Ce qui manque vs skill :
- ❌ Pages dédiées TALO (chat, scoring, fiscal)
- ❌ Routes /api/talo/* (utilise /api/assistant/* à la place)
- ❌ System prompts TALO_SYSTEM_PROMPT, SCORING_SYSTEM_PROMPT
- ❌ LangGraph tools (get_property_info, etc.)
- ❌ Composants TaloChatInterface, TaloMessageBubble, etc.
- ❌ Feature gate hasAITalo non vérifié

### Score : 3/10
### Verdict : ❌ Absent (infrastructure IA existe mais agent TALO non construit)

---

## Module 22 : API REST

### A. Tables
| Table | Existe ? |
|-------|---------|
| api_keys | ✅ |
| api_webhooks | ✅ |
| api_webhook_deliveries | ✅ |
| api_usage_logs | ✅ |
| api_usage_events | ✅ |

### B. Routes /api/v1/* (30+)
- /api/v1/auth/login, /api/v1/auth/register
- /api/v1/properties/*, /api/v1/leases/*, /api/v1/tenants/*
- /api/v1/documents/*, /api/v1/invoices/*, /api/v1/payments/*
- /api/v1/applications/*, /api/v1/listings/*
- /api/v1/tickets/*, /api/v1/api-keys/*, /api/v1/webhooks/*
- /api/v1/accounting/balance, entries, fec

### C. Pages
- app/owner/settings/api/page.tsx
- app/owner/settings/api/keys/[id]
- app/owner/settings/api/docs
- app/owner/settings/api/webhooks

### D. Auth par API key : ✅ (dans les routes v1)

### Score : 8/10
### Verdict : ⚠️ Partiel

---

## Module 23 : DIAGNOSTICS

### A. Tables : ✅ property_diagnostics, diagnostics_termites, rent_control_zones
### B. Routes : ✅ /api/diagnostics/* (CRUD, check-required, expiring)
### C. Rent control : ✅ /api/rent-control/check
### D. Pages : ✅ app/owner/diagnostics/, app/owner/properties/[id]/diagnostics/*
### E. Composants (7) : DiagnosticCard, DiagnosticsList, ExpiryAlert, DPERatingBadge, RentControlChecker, RequiredDiagnosticsChecker, dpe-request-form/upload-form

### Score : 7/10
### Verdict : ⚠️ Partiel

---

## Module 24 : ASSURANCES

### A. Table insurance_policies : ✅
### B. Alertes expiration : ✅ /api/insurance/check-expiring
### C. Routes : ✅ /api/insurance/* (CRUD, upload, check-expiring)
### D. Pages : ✅ app/owner/insurance/, app/tenant/insurance/
### E. Composants (4) : insurance-card, insurance-form, expiry-badge, insurance-reminder

### Score : 6/10
### Verdict : ⚠️ Partiel

---

## Module 25 : RGPD

### A. Tables : ✅ consent_records, user_consents, gdpr_requests, data_requests
### B. Routes :
- /api/rgpd/export : ✅
- /api/rgpd/delete-account : ✅
- /api/rgpd/consent : ✅
- /api/consents : ✅
- /api/privacy/export + anonymize + anonymize/cascade : ✅
### C. Pages : app/settings/privacy/, app/legal/cookies/, app/legal/privacy/ : ✅

### Score : 7/10
### Verdict : ⚠️ Partiel

---

## Module 26 : ADMIN

### A. Tables : ✅ admin_logs, feature_flags
### B. Pages app/admin/* : ✅ (35+ pages)
- dashboard, metrics, users, tenants, properties, providers
- blog, email-templates, flags, integrations
- subscriptions, plans, compliance, moderation
- audit-logs, branding, privacy, site-content, support
### C. Routes /api/admin/* : ✅ (50+ routes)
- overview, stats, metrics, users, properties, providers
- flags, plans, subscriptions, templates, compliance
- impersonate, broadcast, moderation
### D. Impersonation : ✅ /api/admin/impersonate

### Score : 8/10
### Verdict : ⚠️ Partiel

---

## Module 27 : LANDING

### A. Pages marketing
- app/(marketing)/page.tsx (landing) : ✅
- app/(marketing)/pricing : ✅
- app/fonctionnalites/* (7 pages) : ✅
- app/solutions/* (5 pages) : ✅
- app/outils/* (4 calculateurs) : ✅
- app/blog : ✅
- app/contact, app/faq, app/guides : ✅
- app/temoignages : ✅
- app/a-propos : ✅
- app/modeles : ✅

### B. SEO
- ✅ Fichier robots.txt (à vérifier)
- ✅ Pages légales complètes (CGU, CGV, cookies, mentions, privacy, terms)

### C. Pricing
- ⚠️ Divergence possible : skill talok-context dit 24,90€/59,90€, skill talok-stripe-pricing dit 35€/69€

### Score : 8/10
### Verdict : ⚠️ Partiel

---

## Module 28 : MOBILE

### A. Capacitor : ✅ capacitor.config.ts configuré (com.gestionlocative.app)
### B. Répertoires iOS/Android : ✅ ios/ et android/ existent
### C. Plugins Capacitor (15+) : camera, push-notifications, geolocation, haptics, filesystem, etc.
### D. Table push_subscriptions : ✅
### E. PWA : ⚠️ À vérifier manifest + service worker

### Score : 6/10
### Verdict : ⚠️ Partiel

---

## Module 29 : TICKETS

### A. Tables : ✅ tickets (status, priority, category), ticket_comments, ticket_messages
### B. FK work_order : ✅ work_orders.ticket_id
### C. Routes : ✅ /api/tickets/* (CRUD, status, messages, quotes, attachments, ai-draft, history)
### D. Routes v1 : ✅ /api/v1/tickets/* (assign, close, reopen, resolve, comments, kpis, create-work-order)
### E. Pages :
- app/owner/tickets/* : ✅ (list, detail, new, quotes)
- app/tenant/requests/* : ✅ (list, detail, new)
- app/provider/tickets/* : ✅ (list, detail)
### F. KPIs : ✅ /api/v1/tickets/kpis
### G. Bug chargement infini : ⚠️ Toujours signalé comme en cours (skill talok-context)

### Score : 7/10
### Verdict : ⚠️ Partiel

---

## Module 30 : DROITS LOCATAIRE

### A. Calculateurs
- app/outils/calcul-revision-irl : ✅
- app/outils/calcul-frais-notaire : ✅
- app/outils/calcul-rendement-locatif : ✅
- app/outils/simulateur-charges : ✅

### B. Page droits : app/tenant/legal-rights : ✅
### C. Protocoles juridiques : app/owner/legal-protocols : ✅
### D. Table legal_articles : ❌ ABSENTE (pas de référentiel juridique en base)
### E. API indexation IRL : ✅ /api/cron/irl-indexation + /api/indexations/[id]/apply

### Score : 5/10
### Verdict : ⚠️ Partiel

---

## B. Matrice Feature Gating

| Feature flag | Dans PLAN_LIMITS ? | Vérifié côté API ? | Vérifié côté UI ? | Pages qui oublient |
|-------------|-------------------|-------------------|------------------|-------------------|
| maxProperties | ✅ | ✅ canCreateProperty() | ✅ usePlanAccess() | — |
| maxSignaturesPerMonth | ✅ | ✅ consume-signature route | ✅ SignatureUsageBar | — |
| maxStorageMB | ✅ | ⚠️ Pas vérifié sur upload | ✅ StorageUsageBar | /api/documents/upload |
| hasRentCollection | ✅ | ⚠️ Partiel | ⚠️ Partiel | Certaines routes payments |
| hasAccounting | ✅ | ✅ requireAccountingAccess() | ✅ | — |
| hasFECExport | ✅ | ✅ | ✅ | — |
| hasFiscalAI | ✅ | ⚠️ Non vérifié (routes talo absentes) | ❌ | app/owner/talo/* absent |
| hasAITalo | ✅ | ❌ Non vérifié | ❌ | Agent TALO non construit |
| hasMultiEntity | ✅ | ⚠️ Partiel | ⚠️ | — |
| hasAPI | ✅ | ⚠️ Non vérifié dans routes v1 | ✅ | /api/v1/* routes |
| hasOpenBanking | ✅ | ⚠️ Partiel | ⚠️ | /api/bank-connect/* |
| hasAutoReminders | ✅ | ⚠️ Non vérifié dans crons | ⚠️ | Crons relances |
| hasAutoRemindersSMS | ✅ | ⚠️ | ⚠️ | SMS routes |
| hasIRLRevision | ✅ | ⚠️ | ⚠️ | /api/cron/irl-indexation |
| hasEdlDigital | ✅ | ❌ Non vérifié | ❌ | /api/edl/* routes |
| hasScoringTenant | ✅ | ⚠️ | ⚠️ | /api/applications/[id]/score |
| hasWorkOrders | ✅ | ❌ Non vérifié | ❌ | /api/work-orders/* |
| hasProvidersManagement | ✅ | ❌ Non vérifié | ❌ | /api/providers/* |
| hasMultiUsers | ✅ | ⚠️ | ⚠️ | — |
| hasCoproModule | ✅ | ✅ withFeatureAccess | ✅ PlanGate | — |
| hasWhiteLabel | ✅ | ⚠️ Non vérifié | ⚠️ | /api/whitelabel/* |
| hasSSO | ✅ | ❌ Non implémenté | ❌ | — |
| hasPrioritySupport | ✅ | N/A | N/A | — |

**Résumé :** Sur 23 flags, seulement ~6 sont vérifiés côté API ET UI. C'est la lacune transversale la plus critique.

---

## C. Carte des liaisons de données

| Table A | Table B | FK attendue | FK réelle | RLS A | RLS B |
|---------|---------|------------|-----------|-------|-------|
| leases | properties | property_id | ✅ | ✅ | ✅ |
| leases | units | unit_id | ✅ | ✅ | ✅ |
| invoices | leases | lease_id | ✅ | ✅ | ✅ |
| payments | invoices | via stripe_payment_intent_id | ✅ | ✅ | ✅ |
| lease_signers | leases | lease_id | ✅ | ✅ | ✅ |
| lease_signers | profiles | profile_id | ✅ | ✅ | ✅ |
| documents | leases | lease_id | ✅ (nullable) | ✅ | ✅ |
| photos | properties | property_id | ✅ | ✅ | ✅ |
| property_ownership | properties | property_id | ✅ | ✅ | ✅ |
| property_ownership | legal_entities | entity_id | ✅ | ✅ | ✅ |
| legal_entities | owner_profiles | owner_profile_id | ✅ | ✅ | ✅ |
| owner_profiles | profiles | profile_id | ✅ | ✅ | ✅ |
| stripe_connect_accounts | profiles | profile_id | ✅ | ✅ | ✅ |
| subscriptions | profiles | profile_id | ✅ | ✅ | ✅ |
| work_orders | tickets | ticket_id | ✅ (nullable) | ✅ | ✅ |
| work_orders | providers | provider_id | ✅ | ✅ | ✅ |
| edl | properties | property_id | ✅ | ✅ | ✅ |
| edl | leases | lease_id | ✅ | ✅ | ✅ |
| colocation_members | leases | lease_id | ✅ | ✅ | ✅ |
| accounting_entries | accounting_exercises | exercise_id | ✅ | ✅ | ✅ |

---

## D. Bugs et incohérences trouvés

| # | Problème | Criticité | Détail |
|---|----------|-----------|--------|
| 1 | Agent TALO non construit | P1 | Tables existent (noms différents), pages et routes dédiées absentes |
| 2 | Feature gating incomplet | P0 | ~17/23 flags non vérifiés côté API |
| 3 | Agency signup cassé | P1 | Bug connu : rôle non validé dans schema |
| 4 | Tour guidé en doublon | P2 | OnboardingTour.tsx + guided-tour.tsx |
| 5 | Prix DB incohérents | P0 | subscription_plans : 19.90€ vs grille officielle 35€/69€ |
| 6 | Tickets chargement infini | P1 | Bug connu non résolu |
| 7 | Libération garant non automatisée | P2 | Manuel seulement, pas de cron 6 mois |
| 8 | Stripe metered billing syndic | P2 | UI seulement, pas branché Stripe |
| 9 | CNI groupement non raccordé | P2 | Composant créé mais pas dans documents-list.tsx |
| 10 | Tables nommées différemment du skill | P3 | ai_conversations vs talo_conversations, solvability_scores vs tenant_scorings |
| 11 | /owner/invoices/[id] crash RangeError | P1 | Bug connu : safeDate() non appliqué |
| 12 | Dashboard Biens=0 Baux=0 | P1 | Filtre entityId manquant |
| 13 | SSO non implémenté | P3 | Flag hasSSO existe mais aucune implémentation |
| 14 | Génération PDF bail signé | P2 | Pas encore implémenté post-signature |

---

## E. Tables SQL sans RLS (DANGER)

| Table | Données sensibles ? | Action requise |
|-------|--------------------|-|
| tenants | ✅ OUI — données locataires | 🔴 ACTIVER RLS immédiatement |
| two_factor_sessions | ✅ OUI — sessions 2FA | 🔴 ACTIVER RLS immédiatement |
| lease_templates | ⚠️ Templates bail | 🟡 Activer RLS (lecture seule publique) |
| vetuste_grid | ❌ Données référentiel | 🟢 Acceptable (données statiques) |
| vetusty_grid | ❌ Données référentiel | 🟢 Acceptable |
| repair_cost_grid | ❌ Données référentiel | 🟢 Acceptable |
| idempotency_keys | ❌ Clés techniques | 🟢 Acceptable |
| api_webhook_deliveries | ⚠️ Données webhook | 🟡 Activer RLS |
| _audit_cleanup_archive | ❌ Archive interne | 🟢 Acceptable |
| _audit_log | ❌ Log interne | 🟢 Acceptable |
| _schema_translations | ❌ Traductions | 🟢 Acceptable |
| public._repair_log | ❌ Log réparation | 🟢 Acceptable |
| public.accounting_accounts | ⚠️ Comptes | 🟡 Vérifier |
| public.accounting_journals | ⚠️ Journaux | 🟡 Vérifier |
| public.lease_notices | ⚠️ Congés | 🟡 Activer RLS |

**Tables critiques sans RLS : 2 (tenants, two_factor_sessions)**

---

## F. Fichiers orphelins / code mort

| Fichier/Pattern | Problème | Action |
|-----------------|----------|--------|
| guided-tour.tsx | Doublon avec OnboardingTour.tsx | Supprimer |
| tenant_documents (table) | LEGACY — migré vers documents | Vérifier si encore requise |
| app/auth/reset-password | Deprecated → /recovery/password/[requestId] | Supprimer ou rediriger |
| app/login/page.tsx | Doublon avec /auth/signin | Vérifier redirection |

---

## G. Résumé exécutif

### État global

- **Modules complets (score >= 8/10) :** 12/30 (Baux, Paiements, Documents, Biens, Charges, Candidatures, Prestataires, Syndic, Comptabilité, Add-ons, Stripe, Admin)
- **Modules partiels (score 5-7) :** 17/30
- **Modules absents (score 0-4) :** 1/30 (Agent TALO)

### Statistiques clés

| Métrique | Valeur |
|----------|--------|
| Pages UI totales | 385 |
| Routes API totales | 707 |
| Tables SQL | 334 |
| Couverture RLS | 97% (323/334) |
| TypeScript strict | ✅ Activé |
| Migrations | 387 |
| Edge Functions | 18 |

### Top 5 priorités

1. **Feature Gating** — 17/23 flags non vérifiés côté API : tout utilisateur authentifié peut accéder à des features payantes. **Effort : 3-5 jours**
2. **RLS sur tenants + two_factor_sessions** — Données sensibles accessibles sans policy. **Effort : 0,5 jour**
3. **Prix DB incohérents** — subscription_plans contient 19.90€ au lieu de 35€/69€. **Effort : 0,5 jour**
4. **Agent TALO** — Infrastructure IA existe mais pages/routes/composants dédiés absents. **Effort : 5-10 jours**
5. **Bugs critiques connus** — Tickets infini, invoices crash, dashboard 0, agency signup. **Effort : 2-3 jours**

### Tables manquantes (à créer)
| Table | Module | Priorité |
|-------|--------|----------|
| talo_conversations (dédiée) | Agent TALO | P2 (ai_conversations existe) |
| talo_messages (dédiée) | Agent TALO | P2 (assistant_messages existe) |
| legal_articles | Droits locataire | P3 |

### Routes API manquantes (top 10)
1. /api/talo/chat (streaming dédié TALO)
2. /api/talo/conversations
3. /api/talo/fiscal/simulate
4. /api/talo/fiscal/optimize
5. /api/talo/classify
6. /api/talo/extract
7. /api/talo/scoring (dédié)
8. /api/talo/scoring/compare
9. Middleware feature gating API v1 (hasAPI check)
10. Middleware feature gating work_orders (hasWorkOrders)

### Pages UI manquantes (top 10)
1. app/owner/talo/page.tsx (chat TALO)
2. app/owner/talo/scoring/page.tsx
3. app/owner/talo/scoring/[id]/page.tsx
4. app/owner/talo/fiscal/page.tsx
5. Composants TaloChatInterface, TaloMessageBubble, etc.
6. Page pricing unifiée (prix cohérents)
7. Progress bar onboarding Syndic/Agency
8. Page droits locataire enrichie (au-delà des calculateurs)
9. Comparaison scoring candidatures côté à côté
10. Dashboard syndic metered billing
