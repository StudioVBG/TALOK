---
name: lease-signature-guard
description: >-
  Enforces SOTA 2026 rules for the lease/EDL signing and post-signature flow.
  Use when creating, modifying, or reviewing any code that touches lease or EDL
  signing, signature tokens, document generation/storage, seal_lease, lease_signers,
  edl_signatures, post-signature automation, or invoice creation after signing.
  Prevents broken workflows where signed documents have no file in Storage, no seal,
  or no initial invoice.
---

# Lease & EDL Signature Guard — SOTA 2026

## When to Activate

- Editing `app/api/leases/[id]/sign/route.ts`
- Editing `app/api/signature/[token]/sign/route.ts`
- Editing `lib/services/lease-post-signature.service.ts`
- Editing `lib/services/lease-pdf-generator.ts`
- Editing `app/api/leases/[id]/pdf-signed/route.ts`
- Editing `app/api/leases/[id]/seal/route.ts`
- Editing `app/owner/_data/fetchLeaseDetails.ts` (lease consolidation section)
- Editing `app/api/edl/[id]/sign/route.ts`
- Editing `app/api/signature/edl/[token]/sign/route.ts`
- Editing `lib/services/edl-post-signature.service.ts`
- Editing `app/tenant/inspections/[id]/TenantEDLDetailClient.tsx`
- Any code that changes `lease_signers.signature_status`, `leases.statut`, or `edl_signatures`
- Any code that references `signed_pdf_path`, `sealed_at`, `seal_lease`, or EDL `storage_path`

## Architecture

### Bail: Two Signing Paths, One Post-Signature Service

```
Owner signs (app)                Tenant signs (token link)
POST /api/leases/[id]/sign       POST /api/signature/[token]/sign
         |                                |
         |   if fully_signed              |   if allSigned
         v                                v
    handleLeaseFullySigned(leaseId)
    lib/services/lease-post-signature.service.ts
         |
         |--- 1. generateSignedLeasePDF()  -> returns HTML (not PDF!)
         |--- 2. Upload to Storage         (bails/{leaseId}/signed_final.html)
         |--- 3. Upsert document           (type: "bail_signe")
         |--- 4. seal_lease RPC            (sealed_at + signed_pdf_path)
         |--- 5. ensureInitialInvoiceForLease()
         |--- 6. Outbox events

Self-healing (fetchLeaseDetails)
         |--- if active + no signed_pdf_path + all signers signed
         |--- calls handleLeaseFullySigned() transparently
```

### EDL: Two Signing Paths, One Post-Signature Service

```
Owner signs (app)                Tenant signs (token link)
POST /api/edl/[id]/sign          POST /api/signature/edl/[token]/sign
         |                                |
         |   if allSigned                 |   if allSigned
         v                                v
    handleEDLFullySigned(edlId)
    lib/services/edl-post-signature.service.ts
         |
         |--- 1. Fetch EDL data (items, media, signatures, meters)
         |--- 2. generateEDLHTML() + wrap in full HTML document
         |--- 3. Upload to Storage    (edl/{edlId}/signed_document.html)
         |--- 4. Update documents table (storage_path -> real file)
```

## Mandatory Rules

### NEVER

- NEVER duplicate post-signature logic inline in signing routes. Always call `handleLeaseFullySigned()` or `handleEDLFullySigned()`.
- NEVER call `seal_lease` RPC without first attempting document generation.
- NEVER generate a document via HTTP fetch to signing routes from server-side code. Use shared services directly.
- NEVER set `leases.statut` to `fully_signed` without triggering post-signature automation.
- NEVER remove the self-healing block in `fetchLeaseDetails.ts`.
- NEVER store `signed_pdf_path` as a placeholder (`pending_generation_*`) without emitting a `Lease.SealRetry` outbox event.
- NEVER use `pdf-lib` to generate a placeholder PDF — the Edge Function is not available. Store **HTML** documents instead.
- NEVER insert a `documents` row with a fictitious `storage_path` — the file MUST exist in Storage.
- NEVER use `window.open(GET /api/edl/{id}/pdf)` — that route does not exist. EDL PDF is `POST /api/edl/pdf`.

### ALWAYS

- ALWAYS store signed documents as **HTML** files (`.html`, `text/html`) — not PDF — until a reliable server-side PDF renderer is configured.
- ALWAYS call `handleLeaseFullySigned()` from BOTH lease signing routes when all signataires have signed.
- ALWAYS call `handleEDLFullySigned()` from BOTH EDL signing routes when all signataires have signed.
- ALWAYS use `getServiceClient()` (not user-scoped client) for post-signature operations.
- ALWAYS wrap post-signature calls in try/catch — failures are non-blocking for the signing response.
- ALWAYS check `lease.sealed_at && lease.signed_pdf_path` before re-running post-signature (idempotency guard).
- ALWAYS create the `bail_signe` document entry in the `documents` table after successful upload.
- ALWAYS call `ensureInitialInvoiceForLease()` after sealing.
- ALWAYS use `POST /api/edl/pdf` + `html2pdf.js` for client-side EDL PDF download (both owner and tenant).

## Document Storage Patterns

| Document | Storage Path | Content-Type | Generated By |
|----------|-------------|--------------|--------------|
| Bail signé | `bails/{leaseId}/signed_final.html` | `text/html` | `handleLeaseFullySigned` |
| EDL signé | `edl/{edlId}/signed_document.html` | `text/html` | `handleEDLFullySigned` |
| Quittance | `quittances/{leaseId}/{paymentId}.pdf` | `application/pdf` | `ensureReceiptDocument` |
| Attestation remise clés | `key-handover/{leaseId}/{handoverId}/attestation.pdf` | `application/pdf` | `ensureKeyHandoverAttestation` |

## Lease Status Workflow

```
draft -> sent -> pending_signature -> partially_signed
                                   -> pending_owner_signature
                                   -> fully_signed (triggers post-signature)
                                   -> active (after EDL + payment + key handover)
                                   -> notice_given -> terminated -> archived
```

## Key Files Reference

| Domain | File |
|--------|------|
| Bail post-signature | `lib/services/lease-post-signature.service.ts` |
| Bail document generator | `lib/services/lease-pdf-generator.ts` |
| EDL post-signature | `lib/services/edl-post-signature.service.ts` |
| EDL HTML generator | `lib/templates/edl/template.service.ts` |
| EDL data mapper | `lib/mappers/edl-to-template.ts` |
| Invoice creation | `lib/services/lease-initial-invoice.service.ts` |
| Owner lease sign | `app/api/leases/[id]/sign/route.ts` |
| Token lease sign | `app/api/signature/[token]/sign/route.ts` |
| Owner EDL sign | `app/api/edl/[id]/sign/route.ts` |
| Token EDL sign | `app/api/signature/edl/[token]/sign/route.ts` |
| Document download | `app/api/leases/[id]/pdf-signed/route.ts` |
| Seal route | `app/api/leases/[id]/seal/route.ts` |
| seal_lease RPC | `supabase/migrations/20251228100000_sealed_lease_pdf.sql` |
| Lease detail fetch | `app/owner/_data/fetchLeaseDetails.ts` |
| Lease readiness | `app/owner/_data/lease-readiness.ts` |
| Contract tab UI | `app/owner/leases/[id]/LeaseDetailsClient.tsx` |
| Tenant EDL detail | `app/tenant/inspections/[id]/TenantEDLDetailClient.tsx` |
| Document view route | `app/api/documents/view/route.ts` |
| Document download route | `app/api/documents/download/route.ts` |
| Status constants | `lib/constants/roles.ts` (LEASE_STATUS) |

## Checklist for Any Signing Change

### Bail
- [ ] Both signing routes call `handleLeaseFullySigned()` when `fully_signed`
- [ ] `handleLeaseFullySigned()` is idempotent (checks `sealed_at` + `signed_pdf_path`)
- [ ] Document generation returns **HTML** (not PDF placeholder)
- [ ] Upload path ends in `.html` with `text/html` content type
- [ ] `seal_lease` RPC is called with real document path (not placeholder)
- [ ] `ensureInitialInvoiceForLease()` is called after seal
- [ ] Outbox events are emitted for both success and retry scenarios
- [ ] Self-healing in `fetchLeaseDetails` still works for legacy data
- [ ] UI download links use `.html` extension
- [ ] No `any` types leaked into public interfaces

### EDL
- [ ] Both signing routes call `handleEDLFullySigned()` when all signers signed
- [ ] `handleEDLFullySigned()` generates real HTML and uploads to Storage
- [ ] `documents` table `storage_path` matches the actual file in Storage
- [ ] Tenant EDL download uses `POST /api/edl/pdf` + `html2pdf.js` (not GET)
- [ ] Owner EDL preview/download uses `EDLPreview` component (dynamic generation)
