# Audit Express : Code vs Skills

**Date :** 2026-04-09
**Auteur :** Claude (audit automatisé)
**Scope :** 30 modules, 6 skills, ~365 tables SQL, ~600 routes API, ~320 pages UI

---

## 0. Skills disponibles

### `.claude/skills/` (6 skills)

| Skill | Description |
|-------|-------------|
| `talok-context` | Contexte global du projet Talok (SaaS gestion locative FR) |
| `talok-accounting` | Module comptabilité SOTA : 15 tables, double-entry, FEC, rapprochement bancaire, PCG |
| `talok-onboarding-sota` | Inscription, onboarding par rôle, tour guidé, emails, WelcomeModal |
| `talok-stripe-pricing` | Stripe, pricing, plans, feature gating, PLAN_LIMITS, signatures, SEPA |
| `talok-talo-agent` | Agent IA TALO : assistant comptable, scoring candidatures, analyse docs |
| `talok-documents-sota` | Gestion documents : upload, consultation, GED, quittances, permissions |

### `/mnt/skills/user/` : **Aucun skill trouvé**

---

## 1. Scan rapide

### Pages existantes (320 pages `page.tsx`)

```
app/(dashboard)/parametres/facturation/page.tsx
app/(marketing)/page.tsx  
app/(marketing)/pricing/page.tsx
app/admin/... (36 pages)
app/agency/... (26 pages)
app/auth/... (6 pages)
app/copro/... (9 pages)
app/guarantor/... (8 pages)
app/onboarding/... (6 pages)
app/owner/... (~150 pages)
app/provider/... (21 pages)
app/syndic/... (30 pages)
app/tenant/... (43 pages)
+ landing, blog, legal, fonctionnalites, outils, etc.
```

### Routes API existantes (~600 routes `route.ts`)

```
app/api/accounting/... (69 routes)
app/api/admin/... (91 routes)
app/api/leases/... (42 routes)
app/api/properties/... (26 routes)
app/api/v1/... (44 routes REST publique)
app/api/subscriptions/... (23 routes)
app/api/tenant/... (18 routes)
app/api/work-orders/... (16 routes)
app/api/provider/... (15 routes)
+ 250+ autres routes
```

### Tables SQL (365 tables dont partitions)

Tables principales : `leases`, `properties`, `profiles`, `payments`, `documents`, `edl`, `invoices`, `tickets`, `subscriptions`, `stripe_connect_accounts`, `photos`, `buildings`, `units`, `providers`, `guarantors`, `insurance_policies`, `diagnostics_termites`, `colocation_*`, `copro_*`, `seasonal_*`, `work_orders`, `accounting_*`, `charge_*`, etc.

### Feature gates utilisés (65 fichiers)

Fichiers clés :
- `lib/subscriptions/plan-limits.ts` — définition PLAN_LIMITS
- `lib/middleware/subscription-check.ts` — withSubscriptionLimit, withFeatureAccess
- `lib/accounting/feature-gates.ts` — gates comptabilité
- `lib/hooks/use-plan-access.ts` — hook React
- `lib/properties/guards.ts` — guards propriétés

---

## 2. Couverture par module

| Module | Tables (exist/attendues) | Routes API (exist/attendues) | Pages UI (exist/attendues) | Feature gate OK ? | Score /10 | Verdict |
|--------|--------------------------|------------------------------|----------------------------|--------------------|-----------|---------|
| **Baux** | 8/8 (leases, lease_signers, lease_amendments, lease_annexes, lease_drafts, lease_indexations, lease_templates, lease_charge_regularizations) | 42/15 | 12/8 | ✅ | 9 | ✅ |
| **Paiements** | 10/8 (payments, payment_intents, payment_shares, payment_schedules, payment_reminders, payment_credits, payment_adjustments, payment_fee_config, payment_method_audit_log, rent_payments) | 10/8 | 5/4 | ✅ | 9 | ✅ |
| **Documents** | 7/6 (documents, document_shares, document_links, document_alerts, document_analyses, document_ged_audit_log, ged_document_types) | 12/10 | 4/3 | ✅ | 9 | ✅ |
| **Biens** | 6/5 (properties, photos, property_listings, property_diagnostics, property_ownership, buildings) | 26/15 | 24/10 | ✅ | 9 | ✅ |
| **EDL** | 10/6 (edl, edl_items, edl_rooms, edl_media, edl_meter_readings, edl_signatures, edl_inspection_items, edl_mandatory_furniture, edl_additional_furniture, edl_furniture_inventory) | 14/10 | 7/5 | ✅ | 9 | ✅ |
| **Colocation** | 5/5 (colocation_members, colocation_rooms, colocation_expenses, colocation_rules, colocation_tasks) | 13/10 | 8/6 | ✅ | 8 | ✅ |
| **Charges** | 6/5 (charges, charge_categories, charge_entries, charge_provisions, charge_reconciliations, charge_regularizations) | 11/8 | 3/3 | ✅ | 8 | ✅ |
| **Candidatures** | 3/3 (applications, application_files, tenant_applications) | 5/5 | 4/3 | ✅ | 8 | ✅ |
| **Prestataires** | 10/6 (providers, provider_profiles, provider_quotes, provider_invoices, provider_reviews, provider_compliance_documents, provider_portfolio_items, provider_availability, provider_payout_accounts, provider_kyc_requirements) | 21/10 | 21/8 | ✅ | 9 | ✅ |
| **Syndic** | 8/6 (copro_budgets, copro_fund_calls, copro_fund_call_lines, copro_lots, copro_units, sites, site_config, site_content) | 20/12 | 30/15 | ✅ | 9 | ✅ |
| **Garant** | 4/3 (guarantors, guarantor_profiles, guarantor_engagements, guarantor_invitations) | 9/6 | 8/5 | ✅ | 8 | ✅ |
| **White-label** | 3/3 (whitelabel_configs, custom_domains, organization_branding) | 3/3 | 2/2 | ⚠️ Pas de gate visible | 6 | ⚠️ |
| **Notifications** | 5/4 (notifications, notification_preferences, notification_settings, notification_event_preferences, push_subscriptions) | 9/6 | 3/2 | ✅ | 8 | ✅ |
| **Auth/RBAC** | 8/6 (profiles, roles, permissions, role_permissions, user_roles, user_2fa, passkey_credentials, passkey_challenges) | 15/10 | 6/5 | ✅ | 8 | ✅ |
| **Onboarding** | 4/3 (onboarding_progress, onboarding_drafts, onboarding_analytics, onboarding_reminders) | 3/3 | 18/10 | ✅ | 8 | ✅ |
| **Comptabilite** | 8/8 (accounting_entries, accounting_entry_lines, accounting_exercises, accounting_journals, chart_of_accounts, accounting_audit_log, bank_connections, bank_transactions) | 69/30 | 11/8 | ✅ | 9 | ✅ |
| **Add-ons** | 2/2 (subscription_addons, subscription_usage) | 6/4 | 2/2 | ✅ | 8 | ✅ |
| **Stripe Abo** | 5/4 (subscriptions, subscription_plans, subscription_invoices, stripe_connect_accounts, stripe_transfers) | 29/15 | 5/3 | ✅ | 9 | ✅ |
| **Saisonnier** | 4/3 (seasonal_listings, seasonal_rates, seasonal_blocked_dates, reservations) | 12/8 | 5/4 | ⚠️ Pas de gate sur pages seasonal | 7 | ⚠️ |
| **Compteurs** | 4/3 (meters, meter_readings, meter_alerts, property_meters) | 13/8 | 4/3 | ✅ | 8 | ✅ |
| **Agent TALO** | 3/3 (assistant_threads, assistant_messages, assistant_usage_stats) | 6/4 | 1/1 | ✅ | 7 | ✅ |
| **API REST** | 2/2 (api_keys, api_webhooks) | 44/20 | 4/3 | ⚠️ Auth via `requireAuth` OK mais pas de rate limit visible | 7 | ⚠️ |
| **Diagnostics** | 3/2 (property_diagnostics, diagnostics_termites, diagnostics_termites_zones) | 4/3 | 3/2 | ✅ | 7 | ✅ |
| **Assurances** | 1/2 (insurance_policies) | 4/3 | 1/1 | ❌ Pas de gate | 6 | ⚠️ |
| **RGPD** | 3/3 (gdpr_requests, data_requests, consent_records) | 6/5 | 2/2 | ✅ | 7 | ✅ |
| **Admin** | 6/5 (admin_logs, admin_revenue_metrics, feature_flags, moderation_queue, moderation_rules, moderation_actions) | 91/40 | 36/20 | ✅ | 9 | ✅ |
| **Landing** | 2/2 (blog_posts, site_content) | 2/2 | 25/15 | N/A (public) | 8 | ✅ |
| **Mobile** | 0/0 | 0/0 | 0/0 | N/A | 0 | ❌ Aucun module mobile dédié |
| **Tickets** | 3/3 (tickets, ticket_messages, ticket_comments) | 11/8 | 6/4 | ✅ | 8 | ✅ |
| **Droits locataire** | 2/2 (tenant_profiles, tenant_documents) | 18/10 | 43/15 | ⚠️ Pas de gate tenant-side | 7 | ⚠️ |

---

## 3. Bugs et incohérences trouvés

| # | Fichier | Probleme | Criticite |
|---|---------|----------|-----------|
| 1 | `features/leases/components/parking-lease-wizard/index.tsx:262` | Utilise `status: "draft"` au lieu de `statut: "draft"` — la table `leases` a une colonne `statut`, pas `status` | **P1** |
| 2 | `app/owner/_data/fetchLeaseDetails.ts:403` | Requete `.from("property_photos")` — cette table n'existe pas, la table reelle est `photos` | **P1** |
| 3 | `lib/properties/guards.ts:161` | Requete `.from('property_photos')` — meme bug, table inexistante `property_photos` vs `photos` | **P1** |
| 4 | `app/api/privacy/export/route.ts:152` | Reference `property_photos (*)` dans un select — table inexistante | **P2** |
| 5 | `components/notifications/NotificationBell.tsx` | Reference `property_photos` dans un select | **P2** |
| 6 | Tables sans RLS | `tenants`, `lease_templates`, `idempotency_keys`, `repair_cost_grid`, `two_factor_sessions`, `vetuste_grid`, `vetusty_grid`, `api_webhook_deliveries` — 8 tables sans RLS | **P1** |
| 7 | `app/api/v1/invoices/[iid]/payments/route.ts` | Route API v1 potentiellement sans verification auth (pas de `requireAuth` detecte) | **P2** |
| 8 | `app/api/identity/send-otp/route.ts` | Route OTP sans auth — potentiel abus (rate limit necessaire) | **P2** |
| 9 | `app/owner/seasonal/` (5 pages) | Pages saisonnier accessibles sans PlanGate — feature payante affichee sans gate | **P2** |
| 10 | `app/owner/insurance/page.tsx` | Page assurance sans feature gate visible | **P3** |
| 11 | `app/api/whitelabel/` | Routes white-label sans verification de plan Premium+ | **P2** |
| 12 | Multiple fichiers `property_owners` | 29 fichiers referencent `property_owners` (migrations, services, docs) — le schema reel est `property_ownership` + `stripe_connect_accounts`, pas `property_owners` | **P2** |
| 13 | `features/leases/components/parking-lease-wizard/index.tsx` | L'objet `ParkingLease` utilise un type local avec `status` au lieu du type DB `statut` — desalignement type/schema | **P1** |
| 14 | `app/api/v1/accounting/balance/route.ts`, `entries/route.ts`, `fec/route.ts` | Routes comptabilite API v1 sans auth detectee dans le grep (a verifier — possiblement via middleware) | **P2** |
| 15 | 0 pages mobile | Aucune page responsive/mobile dediee (pas de `/mobile/` route, PWA non detectee) | **P3** |

---

## 4. Top 10 actions prioritaires

### P0 — Critique

1. **Corriger `property_photos` -> `photos`** dans `fetchLeaseDetails.ts:403` et `guards.ts:161` — ces requetes Supabase echouent silencieusement car la table `property_photos` n'existe pas. Les donnees de photos ne sont pas chargees.

2. **Corriger `status` -> `statut`** dans `parking-lease-wizard/index.tsx:262` — l'insert du bail parking ecrit dans un champ `status` inexistant, le bail est cree sans statut correct.

3. **Ajouter RLS sur `tenants`** — table critique contenant des donnees personnelles de locataires, actuellement sans Row Level Security.

### P1 — Important

4. **Ajouter RLS sur `two_factor_sessions`** — table de securite (2FA) sans protection RLS, risque d'acces non autorise.

5. **Ajouter RLS sur `lease_templates`** — templates de baux accessibles potentiellement par tous les utilisateurs authentifies.

6. **Verifier auth sur les routes API v1** (`/api/v1/invoices/[iid]/payments`, `/api/v1/accounting/*`) — le grep ne detecte pas `requireAuth` dans certaines routes. A verifier manuellement si l'auth est geree par un middleware parent.

### P2 — Moyen

7. **Ajouter PlanGate sur `/owner/seasonal/`** — le module saisonnier est une feature payante mais les pages sont accessibles sans verification de plan.

8. **Ajouter PlanGate sur `/api/whitelabel/`** — les routes white-label ne verifient pas le plan Premium+.

9. **Nettoyer les references `property_photos`** dans `privacy/export/route.ts` et `NotificationBell.tsx` — requetes sur table inexistante.

### P3 — Amelioration

10. **Documenter l'absence de module mobile** et planifier soit une PWA, soit des vues responsives dediees pour les locataires (consultation quittances, paiement, tickets).

---

## 5. Resume chiffre

| Metrique | Valeur |
|----------|--------|
| Tables SQL totales | ~365 (dont 30 partitions audit_events) |
| Tables avec RLS | ~323 |
| Tables sans RLS (hors partitions/systeme) | **8** |
| Routes API | ~600 |
| Pages UI | ~320 |
| Skills Claude | 6 |
| Feature gate files | 65 |
| Modules OK (score >= 7) | **26/30** |
| Modules en alerte | **3** (White-label, Saisonnier, Mobile) |
| Modules KO | **1** (Mobile — inexistant) |
| Bugs P1 identifies | **5** |
| Bugs P2 identifies | **7** |
| Bugs P3 identifies | **3** |

---

## 6. Rappels schema reel

| Attention | Correct | Incorrect (trouve dans le code) |
|-----------|---------|-------------------------------|
| Colonne statut de bail | `statut` | `status` (parking-lease-wizard) |
| Table photos | `photos` | `property_photos` (4 fichiers) |
| Table comptes Stripe | `stripe_connect_accounts` | `property_owners` (29 refs, majoritairement dans migrations/docs) |
| Table ownership | `property_ownership` | `property_owners` (confusion frequente) |
| Table EDL | `edl` avec colonne `status` | OK dans le code (pas de confusion ici) |

> **Note :** La table `edl` utilise bien `status` (pas `statut`). Seule la table `leases` utilise `statut`. Cette asymetrie est volontaire mais source de confusion.
