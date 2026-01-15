# Migration Plan: "statut" to "status" Naming Standardization

## Overview

This document outlines the comprehensive plan for standardizing the French column name "statut" to the English "status" across the entire TALOK codebase. This is a **BREAKING CHANGE** that requires careful coordination between database migrations, TypeScript types, API routes, and frontend components.

**Analysis Date:** 2026-01-15
**Total Occurrences Found:** 655+ across 199+ files
**Estimated Impact:** HIGH - Affects core business logic

---

## 1. Database Tables/Columns Using "statut"

### 1.1 Core Tables (Initial Schema)

| Table | Column | Line in Migration | Current Values | Impact |
|-------|--------|-------------------|----------------|--------|
| `leases` | `statut` | `/supabase/migrations/20240101000000_initial_schema.sql:109` | draft, pending_signature, active, terminated | **CRITICAL** - Core business entity |
| `invoices` | `statut` | `/supabase/migrations/20240101000000_initial_schema.sql:145` | draft, sent, paid, late | **CRITICAL** - Financial data |
| `payments` | `statut` | `/supabase/migrations/20240101000000_initial_schema.sql:165` | pending, succeeded, failed | **CRITICAL** - Payment processing |
| `tickets` | `statut` | `/supabase/migrations/20240101000000_initial_schema.sql:196` | open, in_progress, resolved, closed | **HIGH** - Maintenance workflow |
| `work_orders` | `statut` | `/supabase/migrations/20240101000000_initial_schema.sql:215` | assigned, scheduled, done, cancelled | **HIGH** - Provider workflow |

### 1.2 Extended Lease Statuses (SOTA 2026)

**File:** `/supabase/migrations/20260107000001_sota_lease_status_constraint.sql:11-24`

The lease status constraint includes additional values:
- `sent` - Sent for signature
- `partially_signed` - Partially signed
- `pending_owner_signature` - Tenant signed, awaiting owner
- `fully_signed` - Fully signed (before activation)
- `notice_given` - Notice given
- `amended` - Amendment in progress
- `archived` - Archived

### 1.3 Database Constraints Affected

| Constraint Name | Table | File |
|----------------|-------|------|
| `leases_statut_check` | leases | Multiple migration files |
| `invoices_statut_check` | invoices | Initial schema |
| `payments_statut_check` | payments | Initial schema |
| `tickets_statut_check` | tickets | Initial schema |
| `work_orders_statut_check` | work_orders | Initial schema |

### 1.4 Database Indexes Affected

| Index Name | Table | File |
|-----------|-------|------|
| `idx_leases_statut` | leases | `/supabase/migrations/20260107000001_sota_lease_status_constraint.sql:27` |
| `idx_leases_pending_action` | leases | `/supabase/migrations/20260107000001_sota_lease_status_constraint.sql:30` |
| `idx_invoices_statut` | invoices | Initial schema |
| `idx_payments_statut` | payments | Initial schema |
| `idx_tickets_statut` | tickets | Initial schema |
| `idx_work_orders_statut` | work_orders | Initial schema |

### 1.5 RPC Functions and Triggers

Multiple stored procedures reference `statut`:
- `/supabase/migrations/20250101000001_owner_dashboard_rpc.sql`
- `/supabase/migrations/20251119070000_lease_details_rpc.sql`
- `/supabase/migrations/20251119080000_tenant_dashboard_rpc.sql`
- `/supabase/migrations/20251205000001_notification_triggers.sql`
- `/supabase/migrations/20260108400000_lease_lifecycle_sota2026.sql`
- `/supabase/migrations/20260103000010_fix_tenant_dashboard_email_search.sql`

---

## 2. TypeScript Types/Interfaces Using "statut"

### 2.1 Core Database Types

**File:** `/home/user/TALOK/lib/supabase/database.types.ts`

| Interface | Property | Line | Impact |
|-----------|----------|------|--------|
| `PropertyRow` | `statut?: string` | 66 | Medium |
| `LeaseRow` | `statut: string` | 124 | **CRITICAL** |
| `InvoiceRow` | `statut: string` | 154 | **CRITICAL** |
| `TicketRow` | `statut: string` | 175 | High |
| `PaymentRow` | `statut: string` | 241 | **CRITICAL** |

### 2.2 Owner Module Types

**File:** `/home/user/TALOK/lib/owner/types.ts`

| Interface | Property | Line | Impact |
|-----------|----------|------|--------|
| `OwnerProperty.currentLease` | `statut: LeaseStatus` | 96 | High |
| `OwnerContract` | `statut: LeaseStatus` | 116 | High |
| `OwnerMoneyInvoice` | `statut: InvoiceStatus` | 152 | High |
| `OwnerDocument` | `statut: DocumentStatus` | 172 | Medium |

### 2.3 Service Layer Types

| File | Interface/Type | Line | Impact |
|------|---------------|------|--------|
| `/features/leases/services/leases.service.ts` | `UpdateLeaseData` | 21 | High |
| `/features/tickets/services/tickets.service.ts` | `UpdateTicketData` | 14 | High |
| `/features/tickets/services/work-orders.service.ts` | `UpdateWorkOrderData` | 13 | High |
| `/features/billing/services/invoices.service.ts` | `UpdateInvoiceData` | 13 | High |
| `/features/billing/services/payments.service.ts` | `UpdatePaymentData` | 13 | High |

### 2.4 Zod Validation Schemas

| File | Schema | Line | Impact |
|------|--------|------|--------|
| `/features/tickets/actions/tickets.ts` | `updateTicketSchema` | 19 | High |
| `/features/billing/actions/invoices.ts` | `updateInvoiceSchema` | 19 | High |

---

## 3. API Routes Referencing "statut"

### 3.1 Lease API Routes (27 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `GET/POST /api/leases` | `/app/api/leases/route.ts` | Filter by statut, create with statut | **CRITICAL** |
| `GET/PATCH /api/leases/[id]` | `/app/api/leases/[id]/route.ts` | Read/update statut | **CRITICAL** |
| `POST /api/leases/[id]/activate` | `/app/api/leases/[id]/activate/route.ts` | Check/update statut | **CRITICAL** |
| `POST /api/leases/[id]/seal` | `/app/api/leases/[id]/seal/route.ts` | Update to fully_signed | High |
| `POST /api/leases/[id]/sign` | `/app/api/leases/[id]/sign/route.ts` | Update signature statut | High |
| `POST /api/leases/[id]/terminate` | `/app/api/leases/[id]/terminate/route.ts` | Update to terminated | High |
| `POST /api/leases/[id]/renew` | `/app/api/leases/[id]/renew/route.ts` | Create new, update old statut | High |
| `POST /api/leases/[id]/notice` | `/app/api/leases/[id]/notice/route.ts` | Update to notice_given | High |
| `POST /api/leases/[id]/signature-sessions` | `/app/api/leases/[id]/signature-sessions/route.ts` | Update to pending_signature | High |
| `GET /api/leases/[id]/pdf` | `/app/api/leases/[id]/pdf/route.ts` | Check draft statut | Medium |
| `GET /api/leases/[id]/summary` | `/app/api/leases/[id]/summary/route.ts` | Return statut | Medium |

### 3.2 Invoice API Routes (12 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `GET/POST /api/invoices` | `/app/api/invoices/route.ts` | Filter/create with statut | **CRITICAL** |
| `POST /api/invoices/[id]/mark-paid` | `/app/api/invoices/[id]/mark-paid/route.ts` | Update to paid | **CRITICAL** |
| `POST /api/invoices/[id]/remind` | `/app/api/invoices/[id]/remind/route.ts` | Check statut | High |
| `GET /api/invoices/[id]/export` | `/app/api/invoices/[id]/export/route.ts` | Export statut | Medium |
| `POST /api/invoices/generate-monthly` | `/app/api/invoices/generate-monthly/route.ts` | Create with draft statut | High |

### 3.3 Ticket API Routes (8 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `GET/POST /api/tickets` | `/app/api/tickets/route.ts` | Filter/create with statut | High |
| `PATCH /api/tickets/[id]/status` | `/app/api/tickets/[id]/status/route.ts` | Update statut | High |
| `GET /api/tickets/[id]/history` | `/app/api/tickets/[id]/history/route.ts` | Return statut history | Medium |
| `GET /api/tickets/[id]/invoices` | `/app/api/tickets/[id]/invoices/route.ts` | Check work_order statut | Medium |

### 3.4 Payment & Webhook Routes (9 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `POST /api/webhooks/stripe` | `/app/api/webhooks/stripe/route.ts` | Update invoice/payment statut | **CRITICAL** |
| `POST /api/webhooks/payments` | `/app/api/webhooks/payments/route.ts` | Update payment statut | **CRITICAL** |
| `POST /api/v1/payments/webhook` | `/app/api/v1/payments/webhook/route.ts` | Update payment statut | **CRITICAL** |
| `POST /api/v1/invoices/[iid]/payments` | `/app/api/v1/invoices/[iid]/payments/route.ts` | Check invoice statut | High |

### 3.5 Provider/Work Order Routes (7 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `PATCH /api/provider/jobs/[id]/status` | `/app/api/provider/jobs/[id]/status/route.ts` | Update work_order statut | High |
| `POST /api/work-orders/[id]/accept` | `/app/api/work-orders/[id]/accept/route.ts` | Update statut | High |
| `POST /api/work-orders/[id]/complete` | `/app/api/work-orders/[id]/complete/route.ts` | Update to done | High |
| `POST /api/work-orders/[id]/reject` | `/app/api/work-orders/[id]/reject/route.ts` | Update to cancelled | High |

### 3.6 Admin Routes (8 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `GET /api/admin/leases` | `/app/api/admin/leases/route.ts` | Filter by statut | High |
| `POST /api/admin/fix-lease-status` | `/app/api/admin/fix-lease-status/route.ts` | Fix statut | High |
| `POST /api/admin/sync-lease-statuses` | `/app/api/admin/sync-lease-statuses/route.ts` | Sync statut | High |
| `GET /api/admin/overview` | `/app/api/admin/overview/route.ts` | Count by statut | Medium |

### 3.7 Tenant Routes (6 files)

| Route | File | Operations | Impact |
|-------|------|------------|--------|
| `GET /api/tenant/credit-score` | `/app/api/tenant/credit-score/route.ts` | Check invoice statut | High |
| `GET /api/tenant/consumption` | `/app/api/tenant/consumption/route.ts` | Check lease statut | Medium |
| `GET /api/tenant/pending-signatures` | `/app/api/tenant/pending-signatures/route.ts` | Filter pending_signature | High |
| `GET /api/tenant/signature-link` | `/app/api/tenant/signature-link/route.ts` | Filter by statut | High |

---

## 4. Frontend Components Using "statut"

### 4.1 Lease Components (12 files)

| Component | File | Usage | Impact |
|-----------|------|-------|--------|
| `LeaseCard` | `/features/leases/components/lease-card.tsx:96-97` | Display/style by statut | High |
| `LeaseCard` (legacy) | `/components/leases/LeaseCard.tsx:62,157` | Display/style by statut | High |
| `LeaseDetailsClient` | `/app/owner/leases/[id]/LeaseDetailsClient.tsx` | 16 occurrences | **CRITICAL** |
| `ContractsClient` | `/app/owner/leases/ContractsClient.tsx` | 23 occurrences | **CRITICAL** |
| `SignersClient` | `/app/owner/leases/[id]/signers/SignersClient.tsx` | 5 occurrences | High |
| `LeaseRenewalWizard` | `/features/leases/components/lease-renewal-wizard.tsx:49` | Type definition | Medium |
| `LeasePreview` | `/features/leases/components/lease-preview.tsx:540` | Cache indicator | Low |
| `LeaseProgressTracker` | `/components/owner/leases/LeaseProgressTracker.tsx:22` | Status constants | Medium |

### 4.2 Invoice/Billing Components (8 files)

| Component | File | Usage | Impact |
|-----------|------|-------|--------|
| `InvoiceCard` | `/features/billing/components/invoice-card.tsx:163-183` | 8 occurrences | High |
| `InvoiceListUnified` | `/features/billing/components/invoice-list-unified.tsx:99-157` | 9 occurrences | High |
| `InvoiceDetail` | `/features/billing/components/invoice-detail.tsx:114,144,177` | Display statut | High |
| `MoneyClient` | `/app/owner/money/MoneyClient.tsx` | 8 occurrences | High |
| `TenantPaymentsClient` | `/app/tenant/payments/TenantPaymentsClient.tsx` | 8 occurrences | High |

### 4.3 Ticket/Work Order Components (6 files)

| Component | File | Usage | Impact |
|-----------|------|-------|--------|
| `TicketCard` | `/features/tickets/components/ticket-card.tsx:98-99` | Display statut | High |
| `TicketListUnified` | `/features/tickets/components/ticket-list-unified.tsx:104` | Display statut | High |
| `WorkOrdersList` | `/features/tickets/components/work-orders-list.tsx:72-103` | Multiple helper functions | High |

### 4.4 Dashboard Components (8 files)

| Component | File | Usage | Impact |
|-----------|------|-------|--------|
| `DashboardClient` | `/app/tenant/dashboard/DashboardClient.tsx` | 10 occurrences | High |
| `PriorityActions` | `/components/dashboard/PriorityActions.tsx` | 6 occurrences | High |
| `AdvancedFilters` | `/components/filters/advanced-filters.tsx` | 4 occurrences | Medium |

### 4.5 Property Components (5 files)

| Component | File | Usage | Impact |
|-----------|------|-------|--------|
| `PropertyDetailsClient` | `/app/owner/properties/[id]/PropertyDetailsClient.tsx` | 6 occurrences | High |
| `PropertyOccupation` | `/components/properties/PropertyOccupation.tsx` | 5 occurrences | High |
| `PropertyDetailsView` | `/components/properties/PropertyDetailsView.tsx` | 1 occurrence | Medium |

### 4.6 Admin Components (4 files)

| Component | File | Usage | Impact |
|-----------|------|-------|--------|
| `TenantsListClient` | `/app/admin/tenants/TenantsListClient.tsx` | 4 occurrences | High |
| `SubscriptionManager` | `/app/(dashboard)/admin/subscriptions/page.tsx` | Filter by statut | Medium |
| `OwnerModerationPanel` | `/components/admin/owner-moderation-panel.tsx` | Account statut | Medium |

---

## 5. Migration Strategy

### Phase 1: Preparation (Week 1)
1. **Create comprehensive test suite** for all statut-related functionality
2. **Document all API contracts** that expose statut
3. **Notify frontend teams** of upcoming changes
4. **Create feature flag** for gradual rollout

### Phase 2: Database Migration (Week 2)
1. Create new migration file: `20260XXX000000_rename_statut_to_status.sql`
2. Add new `status` column alongside `statut`
3. Create triggers to sync both columns during transition
4. Update all constraints and indexes to use `status`
5. Update all RPC functions and stored procedures

### Phase 3: Backend Code Migration (Week 2-3)
1. Update TypeScript types in `/lib/supabase/database.types.ts`
2. Update domain types in `/lib/owner/types.ts`
3. Update all service layer files
4. Update all API routes
5. Update Zod validation schemas

### Phase 4: Frontend Migration (Week 3-4)
1. Update all React components
2. Update hooks that reference statut
3. Update any local state management
4. Update UI labels (Note: French labels can remain)

### Phase 5: Cleanup (Week 5)
1. Remove `statut` column from database
2. Remove sync triggers
3. Update all remaining documentation
4. Final testing and validation

---

## 6. Risk Assessment

### Critical Risks
1. **Data loss during migration** - Mitigated by keeping both columns temporarily
2. **API breaking changes** - Mitigated by versioning or feature flags
3. **Payment webhook failures** - Must maintain backward compatibility during transition
4. **Mobile app compatibility** - If mobile apps exist, they need coordinated updates

### High Risks
1. **Stripe webhook integration** - Must handle both old and new field names
2. **Real-time subscriptions** - May need to update subscription filters
3. **Analytics/reporting** - Historical data queries may break

### Medium Risks
1. **Third-party integrations** - Any external systems using the API
2. **Cached data** - Redis or other caches may have stale field names
3. **Search indexes** - Elasticsearch or similar may need reindexing

---

## 7. Testing Requirements

### Unit Tests
- All service layer status update functions
- All validation schemas
- Status transition logic

### Integration Tests
- API endpoint responses
- Database constraint validations
- Webhook processing

### E2E Tests
- Complete lease lifecycle
- Invoice payment flow
- Ticket resolution workflow
- Work order completion

### Performance Tests
- Query performance with new indexes
- Migration script performance on production-size data

---

## 8. Rollback Plan

1. **Database**: Keep `statut` column for 30 days after migration
2. **Code**: Tag release before migration for easy rollback
3. **API**: Support both field names for 2 weeks
4. **Monitoring**: Set up alerts for increased error rates

---

## 9. Estimated Effort

| Phase | Effort | Team |
|-------|--------|------|
| Preparation | 3-5 days | 1 developer |
| Database Migration | 2-3 days | 1 DBA + 1 developer |
| Backend Code | 5-7 days | 2 developers |
| Frontend Code | 5-7 days | 2 developers |
| Testing | 3-5 days | 1 QA + 1 developer |
| Cleanup | 1-2 days | 1 developer |
| **Total** | **19-29 days** | **~3 developers** |

---

## 10. Files Summary

### Total Files Affected: 199+
- Database migrations: ~50 files
- API routes: ~70 files
- Frontend components: ~40 files
- Services/utilities: ~25 files
- Documentation: ~14 files

### Key Files to Modify First
1. `/lib/supabase/database.types.ts` - Central type definitions
2. `/lib/owner/types.ts` - Owner module types
3. `/supabase/migrations/20240101000000_initial_schema.sql` - (create new migration)
4. All files in `/app/api/leases/` - Core lease API
5. All files in `/app/api/invoices/` - Invoice API
6. All files in `/features/*/services/` - Service layer

---

## Appendix A: Complete File List

### A.1 Database Migrations with "statut"
```
supabase/migrations/20240101000000_initial_schema.sql
supabase/migrations/20240101000001_rls_policies.sql
supabase/migrations/20240101000002_functions.sql
supabase/migrations/20240101000007_admin_architecture.sql
supabase/migrations/20240101000011_fix_properties_rls_recursion.sql
supabase/migrations/20241129000001_subscriptions.sql
supabase/migrations/20241129000002_cash_payments.sql
supabase/migrations/20241130000001_add_lease_invite_columns.sql
supabase/migrations/20241130000002_add_tenant_identity_documents.sql
supabase/migrations/20250101000001_owner_dashboard_rpc.sql
supabase/migrations/20251119060000_property_details_rpc.sql
supabase/migrations/20251119070000_lease_details_rpc.sql
supabase/migrations/20251119080000_tenant_dashboard_rpc.sql
supabase/migrations/20251204210000_cni_expiry_management.sql
supabase/migrations/20251204300000_complete_optimization.sql
supabase/migrations/20251204700000_fix_notifications_and_functions.sql
supabase/migrations/20251205000001_notification_triggers.sql
supabase/migrations/20251205100000_notifications_system.sql
supabase/migrations/20251205300000_work_order_reports.sql
supabase/migrations/20251205700000_provider_missing_tables.sql
supabase/migrations/20251205800000_intervention_flow_complete.sql
supabase/migrations/20251206500000_fix_lease_end_processes.sql
supabase/migrations/20251206600000_analytics_materialized_views.sql
supabase/migrations/20251206700000_agency_module.sql
supabase/migrations/20251206750000_fix_all_missing_tables.sql
supabase/migrations/20251208000000_fix_all_roles_complete.sql
supabase/migrations/20251228000000_documents_sota.sql
supabase/migrations/20251228000001_edl_before_activation.sql
supabase/migrations/20251228100000_sealed_lease_pdf.sql
supabase/migrations/20251228200000_fix_lease_status_trigger.sql
supabase/migrations/20251229000001_fix_existing_lease_statuses.sql
supabase/migrations/20251231000001_fix_owner_dashboard_rpc.sql
supabase/migrations/20251231000002_agency_dashboard_rpc.sql
supabase/migrations/20251231000003_enhance_tenant_dashboard_rpc.sql
supabase/migrations/20251231000005_finalize_owner_dashboard_rpc.sql
supabase/migrations/20251231000006_automated_billing.sql
supabase/migrations/20251231000009_tenant_housing_passport.sql
supabase/migrations/20260101000002_fix_tenant_dashboard_signers.sql
supabase/migrations/20260102000020_fix_pending_edls_query.sql
supabase/migrations/20260103000005_enhance_owner_dashboard_edl.sql
supabase/migrations/20260103000010_fix_tenant_dashboard_email_search.sql
supabase/migrations/20260104000001_lease_auto_activation_trigger.sql
supabase/migrations/20260107000001_sota_lease_status_constraint.sql
supabase/migrations/20260108200000_tenant_notification_triggers.sql
supabase/migrations/20260108300000_property_soft_delete.sql
supabase/migrations/20260108400000_lease_lifecycle_sota2026.sql
supabase/migrations/20260108500000_orphan_cleanup_sota2026.sql
supabase/migrations/20260110100000_fix_accounting_schema_gaps.sql
supabase/migrations/20260110100001_init_historical_accounting_data.sql
supabase/migrations/202502141000_property_rooms_photos.sql
supabase/migrations/202502150001_property_photos_storage_policies.sql
supabase/migrations/202502160000_fix_supabase_advisors_issues.sql
supabase/migrations/202502180001_fix_rls_conflicts.sql
supabase/migrations/202502180002_fix_rls_conflicts_final.sql
```

### A.2 API Routes with "statut"
```
app/api/leases/route.ts
app/api/leases/[id]/route.ts
app/api/leases/[id]/activate/route.ts
app/api/leases/[id]/deposit/refund/route.ts
app/api/leases/[id]/notice/route.ts
app/api/leases/[id]/pdf/route.ts
app/api/leases/[id]/rent-invoices/route.ts
app/api/leases/[id]/renew/route.ts
app/api/leases/[id]/seal/route.ts
app/api/leases/[id]/sign/route.ts
app/api/leases/[id]/signature-sessions/route.ts
app/api/leases/[id]/signers/route.ts
app/api/leases/[id]/signers/[signerId]/route.ts
app/api/leases/[id]/summary/route.ts
app/api/leases/[id]/terminate/route.ts
app/api/leases/invite/route.ts
app/api/invoices/route.ts
app/api/invoices/[id]/export/route.ts
app/api/invoices/[id]/mark-paid/route.ts
app/api/invoices/[id]/remind/route.ts
app/api/invoices/generate-monthly/route.ts
app/api/tickets/route.ts
app/api/tickets/[id]/history/route.ts
app/api/tickets/[id]/invoices/route.ts
app/api/tickets/[id]/quotes/route.ts
app/api/tickets/[id]/quotes/[qid]/approve/route.ts
app/api/tickets/[id]/status/route.ts
app/api/payments/cash-receipt/route.ts
app/api/payments/checkout/route.ts
app/api/payments/[pid]/receipt/route.ts
app/api/provider/compliance/documents/route.ts
app/api/provider/compliance/documents/[id]/route.ts
app/api/provider/compliance/status/route.ts
app/api/provider/compliance/upload/route.ts
app/api/provider/invoices/[id]/payments/route.ts
app/api/provider/invoices/[id]/send/route.ts
app/api/provider/jobs/[id]/status/route.ts
app/api/provider/quotes/[id]/send/route.ts
app/api/work-orders/[id]/route.ts
app/api/work-orders/[id]/accept/route.ts
app/api/work-orders/[id]/complete/route.ts
app/api/work-orders/[id]/flow/route.ts
app/api/work-orders/[id]/reject/route.ts
app/api/work-orders/[id]/reports/route.ts
app/api/admin/fix-lease-status/route.ts
app/api/admin/leases/route.ts
app/api/admin/overview/route.ts
app/api/admin/people/owners/route.ts
app/api/admin/people/owners/[id]/activity/route.ts
app/api/admin/people/owners/[id]/financials/route.ts
app/api/admin/people/owners/[id]/properties/route.ts
app/api/admin/people/tenants/route.ts
app/api/admin/properties/[id]/route.ts
app/api/admin/properties/[id]/tenants/route.ts
app/api/admin/reset-lease/route.ts
app/api/admin/sync-edl-lease-status/route.ts
app/api/admin/sync-lease-statuses/route.ts
app/api/tenant/consumption/route.ts
app/api/tenant/credit-score/route.ts
app/api/tenant/pending-signatures/route.ts
app/api/tenant/signature-link/route.ts
app/api/tenants/route.ts
app/api/tenants/[id]/route.ts
app/api/v1/invoices/[iid]/payments/route.ts
app/api/v1/leases/route.ts
app/api/v1/leases/[lid]/rent-invoices/route.ts
app/api/v1/leases/[lid]/signature-sessions/route.ts
app/api/v1/payments/webhook/route.ts
app/api/v1/properties/[pid]/route.ts
app/api/v1/tickets/route.ts
app/api/webhooks/payments/route.ts
app/api/webhooks/stripe/route.ts
app/api/webhooks/twilio/route.ts
```

### A.3 Frontend Components with "statut"
```
app/leases/[id]/page.tsx
app/owner/analytics/page.tsx
app/owner/invoices/[id]/page.tsx
app/owner/invoices/new/page.tsx
app/owner/leases/[id]/LeaseDetailsClient.tsx
app/owner/leases/[id]/signers/SignersClient.tsx
app/owner/leases/ContractsClient.tsx
app/owner/leases/actions.ts
app/owner/money/MoneyClient.tsx
app/owner/money/page.tsx
app/owner/properties/[id]/PropertyDetailsClient.tsx
app/owner/properties/[id]/PropertyDetailsWrapper.tsx
app/owner/properties/page.tsx
app/owner/tenants/[id]/TenantProfileClient.tsx
app/owner/tenants/page.tsx
app/owner/tickets/[id]/page.tsx
app/owner/tickets/page.tsx
app/owner/work-orders/page.tsx
app/provider/calendar/page.tsx
app/provider/jobs/[id]/page.tsx
app/provider/jobs/page.tsx
app/signature/[token]/page.tsx
app/tenant/dashboard/DashboardClient.tsx
app/tenant/lease/page.tsx
app/tenant/onboarding/sign/page.tsx
app/tenant/payments/TenantPaymentsClient.tsx
app/tenant/payments/page.tsx
app/tickets/[id]/page.tsx
app/work-orders/[id]/page.tsx
components/dashboard/PriorityActions.tsx
components/filters/advanced-filters.tsx
components/leases/LeaseCard.tsx
components/owner/leases/LeaseProgressTracker.tsx
components/properties/PropertyDetailsView.tsx
components/properties/PropertyOccupation.tsx
features/billing/components/invoice-card.tsx
features/billing/components/invoice-detail.tsx
features/billing/components/invoice-list-unified.tsx
features/leases/components/lease-card.tsx
features/leases/components/lease-preview.tsx
features/leases/components/lease-renewal-wizard.tsx
features/tickets/components/ticket-card.tsx
features/tickets/components/ticket-list-unified.tsx
features/tickets/components/work-orders-list.tsx
```

---

## Appendix B: SQL Migration Template

```sql
-- Migration: Rename 'statut' to 'status' across all tables
-- Date: YYYY-MM-DD
-- Author: [Name]
-- Ticket: [JIRA/Linear ticket number]

BEGIN;

-- =====================================================
-- PHASE 1: Add new 'status' columns
-- =====================================================

-- Leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE leases SET status = statut WHERE status IS NULL;

-- Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE invoices SET status = statut WHERE status IS NULL;

-- Payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE payments SET status = statut WHERE status IS NULL;

-- Tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE tickets SET status = statut WHERE status IS NULL;

-- Work Orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE work_orders SET status = statut WHERE status IS NULL;

-- =====================================================
-- PHASE 2: Create sync triggers (temporary)
-- =====================================================

CREATE OR REPLACE FUNCTION sync_status_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.statut = OLD.statut THEN
      NEW.statut := NEW.status;
    ELSIF NEW.statut IS DISTINCT FROM OLD.statut AND NEW.status = OLD.status THEN
      NEW.status := NEW.statut;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables...

-- =====================================================
-- PHASE 3: Update constraints (after code migration)
-- =====================================================

-- To be executed in separate migration after code changes

COMMIT;
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-15
**Author:** Migration Planning Team
