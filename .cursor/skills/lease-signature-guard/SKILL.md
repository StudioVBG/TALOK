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

# Lease & EDL Signature Guard — SOTA 2026 (avril 2026, PDF definitif)

## When to Activate

- Editing `app/api/leases/[id]/sign/route.ts`
- Editing `app/api/signature/[token]/sign/route.ts`
- Editing `lib/services/lease-post-signature.service.ts`
- Editing `lib/pdf/lease-signed-pdf.ts` or `lib/pdf/edl-signed-pdf.ts`
- Editing `lib/pdf/html-to-pdf.ts` or `lib/pdf/typography.ts`
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

### Bail: Two Signing Paths, One Post-Signature Service, One PDF Pipeline

```
Owner signs (app)                Tenant signs (token link)
POST /api/leases/[id]/sign       POST /api/signature/[token]/sign
         |                                |
         |   if fully_signed              |   if allSigned
         v                                v
    handleLeaseFullySigned(leaseId)
    lib/services/lease-post-signature.service.ts
         |
         |--- 1. generateSignedLeasePdf()   (lib/pdf/lease-signed-pdf.ts)
         |       - buildBailData (canonical builder)
         |       - LeaseTemplateService.generateHTML
         |       - injectTypography (Manrope + justify + @page)
         |       - Puppeteer -> PDF buffer
         |       - sha256 + upsert in documents
         |--- 2. Upload Storage            (bails/{leaseId}/signed_final.pdf)
         |--- 3. seal_lease RPC             (sealed_at + signed_pdf_path)
         |--- 4. ensureInitialInvoiceForLease()
         |--- 5. Outbox events (Lease.FullySigned, Invoice.InitialCreated)

Outbox handler                      Self-healing (fetchLeaseDetails)
Lease.FullySigned                   if active + no signed_pdf_path + allSigned
  -> generateSignedLeasePdf          -> calls handleLeaseFullySigned()
```

### EDL: Two Signing Paths, One Post-Signature Service, One PDF Pipeline

```
Owner signs (app)                Tenant signs (token link)
POST /api/edl/[id]/sign          POST /api/signature/edl/[token]/sign
         |                                |
         |   if allSigned                 |   if allSigned
         v                                v
    handleEDLFullySigned(edlId)
    lib/services/edl-post-signature.service.ts
         |
         |--- generateSignedEdlPdf(edlId)  (lib/pdf/edl-signed-pdf.ts)
               - load EDL + items + media + signed URLs
               - mapDatabaseToEDLComplet
               - generateEDLHTML + typography injection
               - Puppeteer -> PDF buffer
               - upsert documents (type EDL_entree | EDL_sortie, PDF)
               - Upload Storage (edl/{edlId}/{kind}_final.pdf)

Outbox handler Inspection.Signed fires generateSignedEdlPdf too (fire-and-forget).
```

## Mandatory Rules

### NEVER

- NEVER reintroduce the HTML signed_final.html / signed_document.html pipeline. All final documents are PDF.
- NEVER use pdf-lib for bail or EDL rendering — it cannot justify or embed Manrope. pdf-lib stays only for quittances / attestations remise clés.
- NEVER duplicate post-signature logic inline in signing routes. Always call `handleLeaseFullySigned()` or `handleEDLFullySigned()`.
- NEVER call `seal_lease` RPC without first attempting PDF generation.
- NEVER set `leases.statut` to `fully_signed` without triggering post-signature automation.
- NEVER remove the self-healing block in `fetchLeaseDetails.ts`.
- NEVER store `signed_pdf_path` as a placeholder (`pending_generation_*`) without emitting a `Lease.SealRetry` outbox event.
- NEVER insert a `documents` row with a fictitious `storage_path` — the file MUST exist in Storage.
- NEVER use `window.open(GET /api/edl/{id}/pdf)` — that route does not exist. EDL PDF is now a fixed file in storage.
- NEVER skip the typography injector — it is the source of Manrope + justify + hyphens + @page consistency.

### ALWAYS

- ALWAYS render signed bail and EDL documents via `lib/pdf/html-to-pdf.ts` (Puppeteer + @sparticuz/chromium).
- ALWAYS call `handleLeaseFullySigned()` from BOTH lease signing routes when all signataires have signed.
- ALWAYS call `handleEDLFullySigned()` from BOTH EDL signing routes when all signataires have signed.
- ALWAYS use `getServiceClient()` (not user-scoped client) for post-signature operations.
- ALWAYS wrap post-signature calls in try/catch — failures are non-blocking for the signing response.
- ALWAYS rely on the generator's built-in idempotence (lookup `type + is_generated + mime_type=application/pdf`).
- ALWAYS call `ensureInitialInvoiceForLease()` after sealing.
- ALWAYS inject typography via `injectTypography()` before rendering to keep Manrope + justification consistent.

## Document Storage Patterns

| Document | Storage Path | Content-Type | Generated By |
|----------|-------------|--------------|--------------|
| Bail signé | `bails/{leaseId}/signed_final.pdf` | `application/pdf` | `generateSignedLeasePdf` |
| EDL signé (entrée) | `edl/{edlId}/entree_final.pdf` | `application/pdf` | `generateSignedEdlPdf` |
| EDL signé (sortie) | `edl/{edlId}/sortie_final.pdf` | `application/pdf` | `generateSignedEdlPdf` |
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

## Backfill

For leases/EDL signed before the PDF pipeline rollout:

```bash
npx tsx scripts/backfill-signed-pdfs.ts --dry-run
npx tsx scripts/backfill-signed-pdfs.ts
npx tsx scripts/backfill-signed-pdfs.ts --lease-id=<uuid>
npx tsx scripts/backfill-signed-pdfs.ts --edl-id=<uuid>
npx tsx scripts/backfill-signed-pdfs.ts --only=leases
npx tsx scripts/backfill-signed-pdfs.ts --only=edl
```

## Key Files Reference

| Domain | File |
|--------|------|
| Central PDF renderer | `lib/pdf/html-to-pdf.ts` |
| Typography injector | `lib/pdf/typography.ts` |
| Bail PDF generator | `lib/pdf/lease-signed-pdf.ts` |
| EDL PDF generator | `lib/pdf/edl-signed-pdf.ts` |
| Bail post-signature | `lib/services/lease-post-signature.service.ts` |
| EDL post-signature | `lib/services/edl-post-signature.service.ts` |
| Bail data builder | `lib/builders/bail-data.builder.ts` |
| Bail HTML templates | `lib/templates/bail/template.service.ts` |
| EDL HTML generator | `lib/templates/edl/template.service.ts` |
| EDL data mapper | `lib/mappers/edl-to-template.ts` |
| Invoice creation | `lib/services/lease-initial-invoice.service.ts` |
| Owner lease sign | `app/api/leases/[id]/sign/route.ts` |
| Token lease sign | `app/api/signature/[token]/sign/route.ts` |
| Owner EDL sign | `app/api/edl/[id]/sign/route.ts` |
| Token EDL sign | `app/api/signature/edl/[token]/sign/route.ts` |
| Outbox processor | `app/api/cron/process-outbox/route.ts` |
| Document download | `app/api/leases/[id]/pdf-signed/route.ts` |
| Seal route | `app/api/leases/[id]/seal/route.ts` |
| seal_lease RPC | `supabase/migrations/20251228100000_sealed_lease_pdf.sql` |
| Lease detail fetch | `app/owner/_data/fetchLeaseDetails.ts` |
| Contract tab UI | `app/owner/leases/[id]/LeaseDetailsClient.tsx` |
| Tenant EDL detail | `app/tenant/inspections/[id]/TenantEDLDetailClient.tsx` |
| Document view route | `app/api/documents/view/route.ts` |
| Backfill script | `scripts/backfill-signed-pdfs.ts` |
| (deprecated) lib/services/lease-pdf-generator.ts | @deprecated, kept temporarily |
| (deprecated) lib/documents/lease-pdf-generator.ts | @deprecated, kept temporarily |

## Checklist for Any Signing Change

### Bail
- [ ] Both signing routes call `handleLeaseFullySigned()` when `fully_signed`
- [ ] `generateSignedLeasePdf()` idempotence key respected (type=bail, is_generated=true, mime_type=application/pdf)
- [ ] Storage path is `bails/{leaseId}/signed_final.pdf`
- [ ] `seal_lease` RPC receives the PDF path (not a placeholder)
- [ ] `ensureInitialInvoiceForLease()` is called after seal
- [ ] Outbox events are emitted for both success and retry scenarios
- [ ] Self-healing in `fetchLeaseDetails` still works for legacy data
- [ ] No `any` types leaked into public interfaces

### EDL
- [ ] Both signing routes call `handleEDLFullySigned()` when all signers signed
- [ ] Storage path is `edl/{edlId}/{entree|sortie}_final.pdf`
- [ ] `documents.mime_type` is `application/pdf` and `storage_path` matches the actual file
- [ ] Owner/tenant download relies on the stored PDF (no on-demand HTML regeneration)

### Typography (both bail + EDL)
- [ ] `injectTypography()` is called on the raw HTML before `renderHtmlToPdf`
- [ ] Footer template uses `buildPdfFooter()` for page numbering
- [ ] No bespoke CSS overriding Manrope or justification rules
