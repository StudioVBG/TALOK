# ROUTES MAP - TALOK

> **Generated**: 2026-01-17
> **Purpose**: Audit de refactoring - NE PAS MODIFIER CES ROUTES

## STATISTIQUES

| Type | Nombre |
|------|--------|
| Routes Pages | 226 |
| Routes API | 426 |
| Routes Dynamiques | 239 |
| Layouts | 10 |
| Middleware | 1 |
| **TOTAL** | **652** |

---

## MIDDLEWARE

**Fichier**: `/middleware.ts`

**Fonctionnalités critiques**:
- Détection white-label via Host header
- Validation session via cookies auth
- Routes publiques bypass: `/`, `/auth/*`, `/signup`, `/pricing`, `/blog`, `/legal`, `/demo`, `/signature`
- Routes protégées: `/tenant`, `/owner`, `/provider`, `/agency`, `/guarantor`, `/copro`, `/syndic`, `/admin`, `/messages`, `/notifications`, `/settings`
- Redirections: `/app/*` → root, `/tenant/home` → `/tenant/lease`

---

## LAYOUTS (10)

| Fichier | Scope |
|---------|-------|
| `/app/layout.tsx` | Root - Providers globaux |
| `/app/admin/layout.tsx` | Section Admin |
| `/app/agency/layout.tsx` | Section Agency |
| `/app/copro/layout.tsx` | Section Copro |
| `/app/guarantor/layout.tsx` | Section Guarantor |
| `/app/owner/layout.tsx` | Section Owner |
| `/app/provider/layout.tsx` | Section Provider |
| `/app/syndic/layout.tsx` | Section Syndic |
| `/app/tenant/layout.tsx` | Section Tenant |

---

## PAGES PAR DOMAINE

### PUBLIC & ROOT
| Route | Fichier |
|-------|---------|
| `/` | `/app/page.tsx` |
| `/pricing` | `/app/pricing/page.tsx` |
| `/features` | `/app/features/page.tsx` |
| `/dashboard` | `/app/dashboard/page.tsx` |
| `/profile` | `/app/profile/page.tsx` |
| `/showcase` | `/app/showcase/page.tsx` |
| `/rejoindre-logement` | `/app/rejoindre-logement/page.tsx` |

### AUTHENTICATION
| Route | Fichier |
|-------|---------|
| `/auth/signin` | `/app/auth/signin/page.tsx` |
| `/auth/signup` | `/app/auth/signup/page.tsx` |
| `/auth/verify-email` | `/app/auth/verify-email/page.tsx` |
| `/auth/forgot-password` | `/app/auth/forgot-password/page.tsx` |
| `/auth/reset-password` | `/app/auth/reset-password/page.tsx` |

### SIGNUP FLOW
| Route | Fichier |
|-------|---------|
| `/signup/role` | `/app/signup/role/page.tsx` |
| `/signup/plan` | `/app/signup/plan/page.tsx` |
| `/signup/account` | `/app/signup/account/page.tsx` |
| `/signup/verify-email` | `/app/signup/verify-email/page.tsx` |

### BLOG & LEGAL
| Route | Fichier |
|-------|---------|
| `/blog` | `/app/blog/page.tsx` |
| `/blog/[slug]` | `/app/blog/[slug]/page.tsx` |
| `/legal/privacy` | `/app/legal/privacy/page.tsx` |
| `/legal/terms` | `/app/legal/terms/page.tsx` |

### OWNER (62 pages)
| Route | Fichier |
|-------|---------|
| `/owner` | `/app/owner/page.tsx` |
| `/owner/dashboard` | `/app/owner/dashboard/page.tsx` |
| `/owner/analytics` | `/app/owner/analytics/page.tsx` |
| `/owner/properties` | `/app/owner/properties/page.tsx` |
| `/owner/properties/new` | `/app/owner/properties/new/page.tsx` |
| `/owner/properties/[id]` | `/app/owner/properties/[id]/page.tsx` |
| `/owner/properties/[id]/edit` | `/app/owner/properties/[id]/edit/page.tsx` |
| `/owner/properties/[id]/diagnostics` | `/app/owner/properties/[id]/diagnostics/page.tsx` |
| `/owner/leases` | `/app/owner/leases/page.tsx` |
| `/owner/leases/new` | `/app/owner/leases/new/page.tsx` |
| `/owner/leases/[id]` | `/app/owner/leases/[id]/page.tsx` |
| `/owner/leases/[id]/edit` | `/app/owner/leases/[id]/edit/page.tsx` |
| `/owner/leases/[id]/roommates` | `/app/owner/leases/[id]/roommates/page.tsx` |
| `/owner/leases/[id]/signers` | `/app/owner/leases/[id]/signers/page.tsx` |
| `/owner/leases/parking/new` | `/app/owner/leases/parking/new/page.tsx` |
| `/owner/invoices` | `/app/owner/invoices/page.tsx` |
| `/owner/invoices/new` | `/app/owner/invoices/new/page.tsx` |
| `/owner/invoices/[id]` | `/app/owner/invoices/[id]/page.tsx` |
| `/owner/inspections` | `/app/owner/inspections/page.tsx` |
| `/owner/inspections/new` | `/app/owner/inspections/new/page.tsx` |
| `/owner/inspections/[id]` | `/app/owner/inspections/[id]/page.tsx` |
| `/owner/inspections/[id]/edit` | `/app/owner/inspections/[id]/edit/page.tsx` |
| `/owner/inspections/[id]/photos` | `/app/owner/inspections/[id]/photos/page.tsx` |
| `/owner/inspections/template` | `/app/owner/inspections/template/page.tsx` |
| `/owner/end-of-lease` | `/app/owner/end-of-lease/page.tsx` |
| `/owner/end-of-lease/[id]` | `/app/owner/end-of-lease/[id]/page.tsx` |
| `/owner/money` | `/app/owner/money/page.tsx` |
| `/owner/money/settings` | `/app/owner/money/settings/page.tsx` |
| `/owner/indexation` | `/app/owner/indexation/page.tsx` |
| `/owner/diagnostics` | `/app/owner/diagnostics/page.tsx` |
| `/owner/documents` | `/app/owner/documents/page.tsx` |
| `/owner/documents/upload` | `/app/owner/documents/upload/page.tsx` |
| `/owner/copro/charges` | `/app/owner/copro/charges/page.tsx` |
| `/owner/copro/regularisation` | `/app/owner/copro/regularisation/page.tsx` |
| `/owner/messages` | `/app/owner/messages/page.tsx` |
| `/owner/tickets` | `/app/owner/tickets/page.tsx` |
| `/owner/tickets/[id]` | `/app/owner/tickets/[id]/page.tsx` |
| `/owner/tickets/[id]/quotes` | `/app/owner/tickets/[id]/quotes/page.tsx` |
| `/owner/tickets/new` | `/app/owner/tickets/new/page.tsx` |
| `/owner/providers` | `/app/owner/providers/page.tsx` |
| `/owner/providers/[id]` | `/app/owner/providers/[id]/page.tsx` |
| `/owner/visits` | `/app/owner/visits/page.tsx` |
| `/owner/work-orders` | `/app/owner/work-orders/page.tsx` |
| `/owner/support` | `/app/owner/support/page.tsx` |
| `/owner/taxes` | `/app/owner/taxes/page.tsx` |
| `/owner/legal-protocols` | `/app/owner/legal-protocols/page.tsx` |
| `/owner/tenants` | `/app/owner/tenants/page.tsx` |
| `/owner/tenants/[id]` | `/app/owner/tenants/[id]/page.tsx` |
| `/owner/profile` | `/app/owner/profile/page.tsx` |
| `/owner/profile/identity` | `/app/owner/profile/identity/page.tsx` |
| `/owner/profile/emails` | `/app/owner/profile/emails/page.tsx` |
| `/owner/profile/banking` | `/app/owner/profile/banking/page.tsx` |
| `/owner/settings/branding` | `/app/owner/settings/branding/page.tsx` |
| `/owner/onboarding/profile` | `/app/owner/onboarding/profile/page.tsx` |
| `/owner/onboarding/property` | `/app/owner/onboarding/property/page.tsx` |
| `/owner/onboarding/finance` | `/app/owner/onboarding/finance/page.tsx` |
| `/owner/onboarding/lease` | `/app/owner/onboarding/lease/page.tsx` |
| `/owner/onboarding/tenant` | `/app/owner/onboarding/tenant/page.tsx` |
| `/owner/onboarding/complete` | `/app/owner/onboarding/complete/page.tsx` |

### TENANT (33 pages)
| Route | Fichier |
|-------|---------|
| `/tenant` | `/app/tenant/page.tsx` |
| `/tenant/dashboard` | `/app/tenant/dashboard/page.tsx` |
| `/tenant/lease` | `/app/tenant/lease/page.tsx` |
| `/tenant/documents` | `/app/tenant/documents/page.tsx` |
| `/tenant/inspections` | `/app/tenant/inspections/page.tsx` |
| `/tenant/inspections/[id]` | `/app/tenant/inspections/[id]/page.tsx` |
| `/tenant/meters` | `/app/tenant/meters/page.tsx` |
| `/tenant/payments` | `/app/tenant/payments/page.tsx` |
| `/tenant/receipts` | `/app/tenant/receipts/page.tsx` |
| `/tenant/marketplace` | `/app/tenant/marketplace/page.tsx` |
| `/tenant/colocation` | `/app/tenant/colocation/page.tsx` |
| `/tenant/identity` | `/app/tenant/identity/page.tsx` |
| `/tenant/identity/renew` | `/app/tenant/identity/renew/page.tsx` |
| `/tenant/messages` | `/app/tenant/messages/page.tsx` |
| `/tenant/notifications` | `/app/tenant/notifications/page.tsx` |
| `/tenant/help` | `/app/tenant/help/page.tsx` |
| `/tenant/legal-rights` | `/app/tenant/legal-rights/page.tsx` |
| `/tenant/visits` | `/app/tenant/visits/page.tsx` |
| `/tenant/visits/[id]` | `/app/tenant/visits/[id]/page.tsx` |
| `/tenant/requests` | `/app/tenant/requests/page.tsx` |
| `/tenant/requests/new` | `/app/tenant/requests/new/page.tsx` |
| `/tenant/settings` | `/app/tenant/settings/page.tsx` |
| `/tenant/signatures` | `/app/tenant/signatures/page.tsx` |
| `/tenant/rewards` | `/app/tenant/rewards/page.tsx` |
| `/tenant/onboarding/*` | 5 étapes |

### PROVIDER (22 pages)
| Route | Fichier |
|-------|---------|
| `/provider` | `/app/provider/page.tsx` |
| `/provider/dashboard` | `/app/provider/dashboard/page.tsx` |
| `/provider/jobs` | `/app/provider/jobs/page.tsx` |
| `/provider/jobs/[id]` | `/app/provider/jobs/[id]/page.tsx` |
| `/provider/quotes` | `/app/provider/quotes/page.tsx` |
| `/provider/quotes/new` | `/app/provider/quotes/new/page.tsx` |
| `/provider/quotes/[id]` | `/app/provider/quotes/[id]/page.tsx` |
| `/provider/portfolio` | `/app/provider/portfolio/page.tsx` |
| `/provider/invoices` | `/app/provider/invoices/page.tsx` |
| `/provider/compliance` | `/app/provider/compliance/page.tsx` |
| `/provider/reviews` | `/app/provider/reviews/page.tsx` |
| `/provider/calendar` | `/app/provider/calendar/page.tsx` |
| `/provider/documents` | `/app/provider/documents/page.tsx` |
| `/provider/settings` | `/app/provider/settings/page.tsx` |
| `/provider/help` | `/app/provider/help/page.tsx` |
| `/provider/onboarding/*` | 4 étapes |

### AGENCY (14 pages)
| Route | Fichier |
|-------|---------|
| `/agency` | `/app/agency/page.tsx` |
| `/agency/dashboard` | `/app/agency/dashboard/page.tsx` |
| `/agency/mandates` | `/app/agency/mandates/page.tsx` |
| `/agency/mandates/new` | `/app/agency/mandates/new/page.tsx` |
| `/agency/properties` | `/app/agency/properties/page.tsx` |
| `/agency/owners` | `/app/agency/owners/page.tsx` |
| `/agency/owners/invite` | `/app/agency/owners/invite/page.tsx` |
| `/agency/tenants` | `/app/agency/tenants/page.tsx` |
| `/agency/team` | `/app/agency/team/page.tsx` |
| `/agency/commissions` | `/app/agency/commissions/page.tsx` |
| `/agency/finances` | `/app/agency/finances/page.tsx` |
| `/agency/documents` | `/app/agency/documents/page.tsx` |
| `/agency/settings` | `/app/agency/settings/page.tsx` |
| `/agency/help` | `/app/agency/help/page.tsx` |

### ADMIN (28 pages)
| Route | Fichier |
|-------|---------|
| `/admin` | `/app/admin/page.tsx` |
| `/admin/dashboard` | `/app/admin/dashboard/page.tsx` |
| `/admin/people` | `/app/admin/people/page.tsx` |
| `/admin/people/owners/[id]` | `/app/admin/people/owners/[id]/page.tsx` |
| `/admin/people/tenants/[id]` | `/app/admin/people/tenants/[id]/page.tsx` |
| `/admin/people/vendors/[id]` | `/app/admin/people/vendors/[id]/page.tsx` |
| `/admin/properties` | `/app/admin/properties/page.tsx` |
| `/admin/properties/[id]` | `/app/admin/properties/[id]/page.tsx` |
| `/admin/properties/[id]/edit` | `/app/admin/properties/[id]/edit/page.tsx` |
| `/admin/tenants` | `/app/admin/tenants/page.tsx` |
| `/admin/tenants/[id]` | `/app/admin/tenants/[id]/page.tsx` |
| `/admin/plans` | `/app/admin/plans/page.tsx` |
| `/admin/providers/pending` | `/app/admin/providers/pending/page.tsx` |
| `/admin/blog` | `/app/admin/blog/page.tsx` |
| `/admin/blog/new` | `/app/admin/blog/new/page.tsx` |
| `/admin/blog/[id]/edit` | `/app/admin/blog/[id]/edit/page.tsx` |
| `/admin/accounting` | `/app/admin/accounting/page.tsx` |
| `/admin/branding` | `/app/admin/branding/page.tsx` |
| `/admin/compliance` | `/app/admin/compliance/page.tsx` |
| `/admin/emails` | `/app/admin/emails/page.tsx` |
| `/admin/integrations` | `/app/admin/integrations/page.tsx` |
| `/admin/moderation` | `/app/admin/moderation/page.tsx` |
| `/admin/reports` | `/app/admin/reports/page.tsx` |
| `/admin/templates` | `/app/admin/templates/page.tsx` |
| `/admin/privacy` | `/app/admin/privacy/page.tsx` |

### COPRO & SYNDIC (20+ pages)
| Route | Fichier |
|-------|---------|
| `/copro/dashboard` | `/app/copro/dashboard/page.tsx` |
| `/copro/assemblies/[id]` | `/app/copro/assemblies/[id]/page.tsx` |
| `/copro/charges` | `/app/copro/charges/page.tsx` |
| `/copro/documents` | `/app/copro/documents/page.tsx` |
| `/copro/tickets` | `/app/copro/tickets/page.tsx` |
| `/syndic/dashboard` | `/app/syndic/dashboard/page.tsx` |
| `/syndic/assemblies` | `/app/syndic/assemblies/page.tsx` |
| `/syndic/assemblies/new` | `/app/syndic/assemblies/new/page.tsx` |
| `/syndic/assemblies/[id]` | `/app/syndic/assemblies/[id]/page.tsx` |
| `/syndic/assemblies/[id]/edit` | `/app/syndic/assemblies/[id]/edit/page.tsx` |
| `/syndic/sites` | `/app/syndic/sites/page.tsx` |
| `/syndic/sites/[id]` | `/app/syndic/sites/[id]/page.tsx` |
| `/syndic/sites/[id]/edit` | `/app/syndic/sites/[id]/edit/page.tsx` |
| `/syndic/invites` | `/app/syndic/invites/page.tsx` |
| `/syndic/calls/new` | `/app/syndic/calls/new/page.tsx` |
| `/syndic/expenses/new` | `/app/syndic/expenses/new/page.tsx` |
| `/syndic/onboarding/*` | 7 étapes |

### GUARANTOR (8 pages)
| Route | Fichier |
|-------|---------|
| `/guarantor` | `/app/guarantor/page.tsx` |
| `/guarantor/dashboard` | `/app/guarantor/dashboard/page.tsx` |
| `/guarantor/documents` | `/app/guarantor/documents/page.tsx` |
| `/guarantor/profile` | `/app/guarantor/profile/page.tsx` |
| `/guarantor/onboarding/context` | `/app/guarantor/onboarding/context/page.tsx` |
| `/guarantor/onboarding/financial` | `/app/guarantor/onboarding/financial/page.tsx` |
| `/guarantor/onboarding/sign` | `/app/guarantor/onboarding/sign/page.tsx` |

### SIGNATURES & INVITES
| Route | Fichier |
|-------|---------|
| `/signature/[token]` | `/app/signature/[token]/page.tsx` |
| `/signature/success` | `/app/signature/success/page.tsx` |
| `/signature-edl/[token]` | `/app/signature-edl/[token]/page.tsx` |
| `/invite/[token]` | `/app/invite/[token]/page.tsx` |
| `/invite/copro` | `/app/invite/copro/page.tsx` |

---

## API ROUTES (426 total)

### ACCOUNTING (18 routes)
- `GET/POST /api/accounting/balance`
- `GET/POST /api/accounting/entries`
- `GET/PUT/DELETE /api/accounting/entries/[id]`
- `POST /api/accounting/entries/[id]/reverse`
- `POST /api/accounting/entries/validate`
- `GET/POST /api/accounting/charges/regularisation`
- `POST /api/accounting/charges/regularisation/[id]/apply`
- `GET/POST /api/accounting/reconciliation`
- `GET /api/accounting/reconciliation/[id]`
- `POST /api/accounting/reconciliation/[id]/match`
- `POST /api/accounting/reconciliation/[id]/finalize`
- `GET/POST /api/accounting/deposits`
- `GET /api/accounting/exports`
- `GET /api/accounting/fec/export`
- `GET /api/accounting/fiscal`
- `GET /api/accounting/gl`
- `GET /api/accounting/crg`
- `GET /api/accounting/situation/[tenantId]`

### ADMIN (80+ routes)
- `/api/admin/users/[id]` - User CRUD
- `/api/admin/people/owners` - Owner management
- `/api/admin/people/owners/[id]` - Owner details
- `/api/admin/people/tenants` - Tenant management
- `/api/admin/people/vendors` - Vendor management
- `/api/admin/properties` - Property admin
- `/api/admin/plans` - Plan management
- `/api/admin/subscriptions/*` - Subscription admin
- `/api/admin/providers/*` - Provider admin
- `/api/admin/api-keys/*` - API key management
- `/api/admin/compliance/*` - Compliance
- `/api/admin/moderation/*` - Moderation
- `/api/admin/integrations/*` - Integrations
- (voir fichier complet pour détails)

### AUTH (9 routes)
- `POST /api/auth/2fa/setup`
- `POST /api/auth/2fa/enable`
- `POST /api/auth/2fa/disable`
- `POST /api/auth/2fa/verify`
- `GET /api/auth/2fa/status`
- `POST /api/auth/passkeys/register/options`
- `POST /api/auth/passkeys/register/verify`
- `POST /api/auth/passkeys/authenticate/options`
- `POST /api/auth/passkeys/authenticate/verify`

### LEASES (31 routes)
- `GET/POST /api/leases`
- `GET/PUT/DELETE /api/leases/[id]`
- `POST /api/leases/[id]/activate`
- `POST /api/leases/[id]/terminate`
- `POST /api/leases/[id]/renew`
- `POST /api/leases/[id]/seal`
- `GET /api/leases/[id]/documents`
- `GET /api/leases/[id]/summary`
- `GET /api/leases/[id]/html`
- `GET /api/leases/[id]/pdf`
- `GET /api/leases/[id]/pdf-signed`
- `POST /api/leases/invite`
- `POST /api/leases/[id]/initiate-signature`
- `POST /api/leases/[id]/sign`
- `GET /api/leases/[id]/signature-sessions`
- `GET/POST/DELETE /api/leases/[id]/signers`
- `POST /api/leases/[id]/signers/[signerId]/resend`
- `POST /api/leases/[id]/pay`
- `GET/POST /api/leases/[id]/deposit`
- `POST /api/leases/[id]/deposit/refund`
- `GET /api/leases/[id]/deposit/refunds`
- `GET/POST /api/leases/[id]/payment-shares`
- `GET /api/leases/[id]/rent-invoices`
- `GET /api/leases/[id]/receipts`
- `POST /api/leases/[id]/regularization`
- `GET/POST /api/leases/[id]/autopay`
- `GET /api/leases/[id]/notice`
- `GET /api/leases/[id]/notice/letter`
- `GET /api/leases/[id]/meter-consumption`
- `GET /api/leases/[id]/edl`
- `GET /api/leases/[id]/roommates`
- `POST /api/leases/[id]/visale/verify`

### PROPERTIES (25+ routes)
- `GET/POST /api/properties`
- `GET/PUT/DELETE /api/properties/[id]`
- `POST /api/properties/[id]/submit`
- `GET /api/properties/[id]/status`
- `GET /api/properties/diagnostic`
- `POST /api/properties/init`
- `GET /api/properties/share/[token]`
- `GET /api/properties/share/[token]/pdf`
- `POST /api/properties/share/[token]/revoke`
- `GET/POST/DELETE /api/properties/[id]/photos`
- `GET /api/properties/[id]/photos/upload-url`
- `POST /api/properties/[id]/photos/import`
- `GET/POST/PUT/DELETE /api/properties/[id]/rooms`
- `GET/POST /api/properties/[id]/units`
- `GET/POST/PUT/DELETE /api/properties/[id]/meters`
- `GET /api/properties/[id]/inspections`
- `POST /api/properties/[id]/features/bulk`
- `GET/POST /api/properties/[id]/heating`
- `GET /api/properties/[id]/documents`
- `GET/POST /api/properties/[id]/invitations`
- `POST /api/properties/[id]/share`
- `POST /api/property-codes/validate`

### PAYMENTS (9 routes)
- `POST /api/payments/checkout`
- `POST /api/payments/create-intent`
- `POST /api/payments/confirm`
- `POST /api/payments/create-checkout-session`
- `POST /api/payments/setup-intent`
- `POST /api/payments/setup-sepa`
- `GET /api/payments/calculate-fees`
- `POST /api/payments/cash-receipt`
- `GET /api/payments/[pid]/receipt`

### SUBSCRIPTIONS (17 routes)
- `GET/POST /api/subscriptions`
- `GET /api/subscriptions/current`
- `POST /api/subscriptions/checkout`
- `POST /api/subscriptions/cancel`
- `POST /api/subscriptions/reactivate`
- `GET /api/subscriptions/plans`
- `GET /api/subscriptions/features`
- `GET/POST /api/subscriptions/addons`
- `GET /api/subscriptions/invoices`
- `GET /api/subscriptions/portal`
- `POST /api/subscriptions/accept-price-change`
- `POST /api/subscriptions/promo/validate`
- `GET /api/subscriptions/recommend`
- `GET /api/subscriptions/usage`
- `GET /api/subscriptions/events`
- `GET /api/subscriptions/signatures`
- `POST /api/subscriptions/webhook`

### WEBHOOKS (3 routes)
- `POST /api/webhooks/payments`
- `POST /api/webhooks/stripe`
- `POST /api/webhooks/twilio`

### CRON (13 routes)
- `GET /api/cron/check-cni-expiry`
- `GET /api/cron/generate-invoices`
- `GET /api/cron/generate-monthly-invoices`
- `GET /api/cron/irl-indexation`
- `GET /api/cron/lease-expiry-alerts`
- `GET /api/cron/notifications`
- `GET /api/cron/onboarding-reminders`
- `GET /api/cron/payment-reminders`
- `GET /api/cron/process-outbox`
- `GET /api/cron/refresh-analytics`
- `GET /api/cron/rent-reminders`
- `GET /api/cron/subscription-alerts`
- `GET /api/cron/visit-reminders`

### LEGACY V1 (12 routes)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `GET /api/v1/properties`
- `GET /api/v1/properties/[pid]`
- `GET/POST /api/v1/properties/[pid]/invitations`
- `GET /api/v1/leases`
- `GET /api/v1/leases/[lid]/rent-invoices`
- `GET /api/v1/leases/[lid]/signature-sessions`
- `GET /api/v1/invoices/[iid]/payments`
- `POST /api/v1/payments/webhook`
- `GET/POST /api/v1/tickets`

---

## ZONES CRITIQUES - NE PAS TOUCHER

### Routes d'authentification
- `/auth/*`
- `/api/auth/*`
- `/middleware.ts`

### Routes de signature
- `/signature/[token]`
- `/signature-edl/[token]`
- `/api/signature/*`
- `/api/signatures/*`

### Routes de paiement
- `/api/payments/*`
- `/api/webhooks/stripe`
- `/api/subscriptions/*`

### Routes de bail
- `/api/leases/*` (toutes les mutations)
- `/app/owner/leases/actions.ts`

---

## NOTES

- **652 routes totales** - Application enterprise-grade
- **10 rôles utilisateur** - Owner, Tenant, Provider, Agency, Guarantor, Copro, Syndic, Admin
- **Routes dynamiques** - 239 routes avec paramètres `[id]`, `[token]`, etc.
- **API v1** - Backward compatibility maintenue
