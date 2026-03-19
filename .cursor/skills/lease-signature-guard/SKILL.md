---
name: lease-signature-guard
description: >-
  Enforces SOTA 2026 rules for the lease signing and post-signature flow.
  Use when creating, modifying, or reviewing any code that touches lease
  signing, signature tokens, PDF generation, seal_lease, lease_signers,
  post-signature automation, or invoice creation after signing. Prevents
  broken workflows where signed leases have no PDF, no seal, or no
  initial invoice.
---

# Lease Signature Guard — SOTA 2026

## When to Activate

- Editing `app/api/leases/[id]/sign/route.ts`
- Editing `app/api/signature/[token]/sign/route.ts`
- Editing `lib/services/lease-post-signature.service.ts`
- Editing `lib/services/lease-pdf-generator.ts`
- Editing `app/api/leases/[id]/pdf-signed/route.ts`
- Editing `app/api/leases/[id]/seal/route.ts`
- Editing `app/owner/_data/fetchLeaseDetails.ts` (lease consolidation section)
- Any code that changes `lease_signers.signature_status` or `leases.statut`
- Any code that references `signed_pdf_path`, `sealed_at`, or `seal_lease`

## Architecture: Two Signing Paths, One Post-Signature Service

```
Owner signs (app)                Tenant signs (token link)
POST /api/leases/[id]/sign       POST /api/signature/[token]/sign
         |                                |
         |   if fully_signed              |   if allSigned
         v                                v
    handleLeaseFullySigned(leaseId)
    lib/services/lease-post-signature.service.ts
         |
         |--- 1. generateSignedLeasePDF()  (lib/services/lease-pdf-generator.ts)
         |--- 2. Upload to Storage         (bails/{leaseId}/signed_final.pdf)
         |--- 3. Upsert document           (type: "bail_signe")
         |--- 4. seal_lease RPC            (sealed_at + signed_pdf_path)
         |--- 5. ensureInitialInvoiceForLease()
         |--- 6. Outbox events

Self-healing (fetchLeaseDetails)
         |--- if active + no signed_pdf_path + all signers signed
         |--- calls handleLeaseFullySigned() transparently
```

## Mandatory Rules

### NEVER

- NEVER duplicate post-signature logic inline in signing routes. Always call `handleLeaseFullySigned()`.
- NEVER call `seal_lease` RPC without first attempting PDF generation.
- NEVER generate a PDF via HTTP fetch to `/api/leases/[id]/pdf-signed` from server-side code. Use `generateSignedLeasePDF()` directly (avoids auth issues).
- NEVER set `leases.statut` to `fully_signed` without triggering post-signature automation.
- NEVER remove the self-healing block in `fetchLeaseDetails.ts`.
- NEVER store `signed_pdf_path` as a placeholder (`pending_generation_*`) without emitting a `Lease.SealRetry` outbox event.

### ALWAYS

- ALWAYS call `handleLeaseFullySigned()` from BOTH signing routes when all signataires have signed.
- ALWAYS use `getServiceClient()` (not user-scoped client) for post-signature operations — the signing user may be a tenant without owner permissions.
- ALWAYS wrap post-signature calls in try/catch — failures are non-blocking for the signing response.
- ALWAYS check `lease.sealed_at && lease.signed_pdf_path` before re-running post-signature (idempotency guard in the service).
- ALWAYS create the `bail_signe` document entry in the `documents` table after successful PDF upload.
- ALWAYS call `ensureInitialInvoiceForLease()` after sealing.

## Lease Status Workflow

```
draft -> sent -> pending_signature -> partially_signed
                                   -> pending_owner_signature
                                   -> fully_signed (triggers post-signature)
                                   -> active (after EDL + payment + key handover)
                                   -> notice_given -> terminated -> archived
```

Post-signature automation triggers at `fully_signed` transition.
Self-healing triggers at page load if `fully_signed` or `active` with missing PDF.

## Key Files Reference

| Domain | File |
|--------|------|
| Post-signature service | `lib/services/lease-post-signature.service.ts` |
| PDF generator | `lib/services/lease-pdf-generator.ts` |
| Invoice creation | `lib/services/lease-initial-invoice.service.ts` |
| Owner sign route | `app/api/leases/[id]/sign/route.ts` |
| Token sign route | `app/api/signature/[token]/sign/route.ts` |
| PDF download route | `app/api/leases/[id]/pdf-signed/route.ts` |
| Seal route | `app/api/leases/[id]/seal/route.ts` |
| seal_lease RPC | `supabase/migrations/20251228100000_sealed_lease_pdf.sql` |
| Lease detail fetch | `app/owner/_data/fetchLeaseDetails.ts` |
| Lease readiness | `app/owner/_data/lease-readiness.ts` |
| Contract tab UI | `app/owner/leases/[id]/LeaseDetailsClient.tsx` |
| Status constants | `lib/constants/roles.ts` (LEASE_STATUS) |
| Status types | `lib/types/status.ts` (LeaseStatus) |

## Checklist for Any Signing Change

- [ ] Both signing routes call `handleLeaseFullySigned()` when `fully_signed`
- [ ] `handleLeaseFullySigned()` is idempotent (checks `sealed_at` + `signed_pdf_path`)
- [ ] PDF generation uses `generateSignedLeasePDF()` from shared module (not HTTP fetch)
- [ ] `seal_lease` RPC is called with real PDF path (not placeholder)
- [ ] `ensureInitialInvoiceForLease()` is called after seal
- [ ] Outbox events are emitted for both success and retry scenarios
- [ ] Self-healing in `fetchLeaseDetails` still works for legacy data
- [ ] UI branch 2 in `LeaseDetailsClient.tsx` shows refresh action (not infinite spinner)
- [ ] No `any` types leaked into public interfaces
