# Resend Email Guard — Reference (SOTA March 2026)

## Resend SDK — Full parameter reference

### `resend.emails.send(params)`

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `from` | `string` | Yes | `Name <email@domain>` format. Must be verified domain. |
| `to` | `string \| string[]` | Yes | Max 50 recipients. |
| `subject` | `string` | Yes | |
| `html` | `string` | One of html/text/react/template | Full HTML email body. |
| `text` | `string` | Optional | Plain text fallback. **Auto-generated since Aug 2025** from `html`. Provide only for critical emails. |
| `react` | `ReactElement` | One of html/text/react/template | React Email component. |
| `replyTo` | `string \| string[]` | Recommended | camelCase in SDK. |
| `cc` | `string \| string[]` | Optional | |
| `bcc` | `string \| string[]` | Optional | |
| `tags` | `Tag[]` | Recommended | `[{ name: string, value: string }]`. Max 5 tags. Name max 256 chars. Value max 256 chars. |
| `idempotencyKey` | `string` | Recommended | Max 256 chars. Expires 24h. Deterministic format: `{type}/{entity-id}`. |
| `attachments` | `Attachment[]` | Optional | `[{ filename, content (base64), path (URL) }]`. Max 40MB total. |
| `headers` | `Record<string,string>` | Optional | Custom email headers. |
| `scheduledAt` | `string` | Optional | ISO 8601 date. Max 72h in future. Cannot combine with `attachments`. |
| `template` | `string` | Exclusive | Resend-hosted template ID. Mutually exclusive with html/text/react. |

### Response

```typescript
type SendEmailResponse = {
  data: { id: string } | null;
  error: {
    message: string;
    name: string; // 'validation_error' | 'rate_limit_exceeded' | etc.
  } | null;
};
```

SDK does **NOT** throw — always destructure `{ data, error }`.

### `resend.batch.send(emails, options?)`

```typescript
const { data, errors } = await resend.batch.send(
  [
    { from, to, subject, html, tags, idempotencyKey },
    // ... up to 100 emails
  ],
  { batchValidation: 'permissive' } // 'strict' (default) | 'permissive'
);
```

| Option | Default | Notes |
|--------|---------|-------|
| `batchValidation` | `'strict'` | `'strict'`: fails entire batch if any email invalid. `'permissive'`: sends valid, returns errors for invalid. |

- Max 100 emails per batch.
- `attachments` and `scheduledAt` NOT supported in batch.
- Batch idempotency keys supported since June 2025.

## REST API (Edge Functions / Deno only)

```typescript
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: normalizedFrom,
    to: [recipient],
    subject: 'Subject',
    html: '<p>Body</p>',
    reply_to: replyTo, // snake_case for REST!
    tags: [{ name: 'type', value: 'sepa_prenotif' }],
    idempotency_key: `sepa-prenotif/${leaseId}/${period}`,
  }),
});

if (!res.ok) {
  const err = await res.json();
  throw new Error(`Resend error: ${err.message}`);
}
```

**snake_case** for REST: `reply_to`, `scheduled_at`, `idempotency_key`.

## Idempotency key patterns for Talok

These keys match the actual implementation in the codebase as of March 2026.

### Keys in `resend.service.ts` (SDK layer)

| Flow | Key format | Example |
|------|-----------|---------|
| Password reset | `password-reset/{userEmail}` | `password-reset/user@mail.com` |
| Invoice notification | `invoice-notif/{invoiceId}` | `invoice-notif/uuid-789` |
| Payment confirmation | `payment-confirm/{paymentId}` | `payment-confirm/uuid-jkl` |
| Payment reminder | `payment-reminder/{invoiceId}/{daysLate}` | `payment-reminder/uuid-789/15` |
| Lease signed | `lease-signed/{leaseId}/{signerName}` | `lease-signed/uuid-456/Jean Dupont` |
| Visit reminder | `visit-reminder-{hours}h-{role}/{bookingId}` | `visit-reminder-24h-tenant/uuid-def` |
| Ticket created | `ticket-created/{ticketId}` | `ticket-created/uuid-abc` |
| Ticket update | `ticket-update/{ticketId}/{newStatus}` | `ticket-update/uuid-abc/resolved` |
| Signature request | `signature-request/{signatureToken}` | `signature-request/tok-xyz` |
| Property invitation | `property-invite/{propertyCode}/{tenantEmail}` | `property-invite/ABC123/user@mail.com` |
| Welcome | `welcome/{userEmail}` | `welcome/user@mail.com` |
| Visit booking request | `visit-booking-request/{bookingId}` | `visit-booking-request/uuid-def` |
| Visit booking confirmed | `visit-booking-confirmed/{bookingId}` | `visit-booking-confirmed/uuid-def` |
| Visit booking cancelled | `visit-booking-cancelled/{bookingId}` | `visit-booking-cancelled/uuid-def` |
| Visit feedback | `visit-feedback/{bookingId}` | `visit-feedback/uuid-def` |

### Keys in callers (route handlers, crons, services)

| Flow | Key format | Source file | Example |
|------|-----------|-------------|---------|
| Onboarding 24h | `onboarding-24h/{reminderId}` | `onboarding-reminders/route.ts` | `onboarding-24h/uuid-abc` |
| Onboarding 72h | `onboarding-72h/{reminderId}` | `onboarding-reminders/route.ts` | `onboarding-72h/uuid-abc` |
| Onboarding 7d | `onboarding-7d/{reminderId}` | `onboarding-reminders/route.ts` | `onboarding-7d/uuid-abc` |
| SEPA pre-notif | `sepa-prenotif/{leaseId}/{period}` | `sepa-prenotification/index.ts` | `sepa-prenotif/uuid-pqr/2026-03` |
| Password changed | `password-changed/{userId}` | `password-recovery/complete/route.ts` | `password-changed/uuid-usr` |
| Invoice reminder | `invoice-reminder/{invoiceId}/{reminderLevel}` | `invoices/reminders/route.ts` | `invoice-reminder/uuid-789/relance_2` |
| Generic reminder | `reminder-{type}/{reminderId}` | `reminder-service.ts` | `reminder-lease_end/uuid-rem` |
| Rent reminder | `rent-reminder/{invoiceId}/{level}` | `rent-reminders.ts` | `rent-reminder/uuid-789/late_30` |
| CNI expiry | `cni-expiry/{documentId}/{notificationType}` | `check-cni-expiry/route.ts` | `cni-expiry/uuid-doc/expiring_soon` |

### Not yet implemented (candidates for future work)

| Flow | Suggested key format |
|------|---------------------|
| Lease invite | `lease-invite/{leaseId}/{email}` |
| Quittance | `quittance/{invoiceId}` |

## Webhook events (17 total)

| Event | Description |
|-------|-------------|
| `email.sent` | Email queued for delivery |
| `email.delivered` | Delivered to recipient |
| `email.delivery_delayed` | Temporary delivery failure |
| `email.bounced` | Hard bounce — address invalid |
| `email.complained` | Recipient marked as spam |
| `email.suppressed` | Sent to suppressed address (Jan 2026) |
| `email.failed` | Permanent send failure |
| `email.opened` | Recipient opened email |
| `email.clicked` | Recipient clicked a link |
| `contact.created` | Contact created in audience |
| `contact.updated` | Contact updated |
| `contact.deleted` | Contact deleted |
| `domain.created` | Domain added |
| `domain.updated` | Domain DNS updated |
| `domain.deleted` | Domain removed |
| `domain.verified` | Domain verification complete |
| `domain.temporary_failure` | Domain DNS check temp failure |

### Native crypto verification (Webhooks)

Talok uses native Node.js `crypto` for webhook signature verification — **no `svix` dependency**.

```typescript
import crypto from "crypto";

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const expectedSig = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;
  if (computed.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedSig));
}
```

### Talok custom endpoint (implemented)

`app/api/webhooks/resend/route.ts` handles:
- `email.delivered` → structured log
- `email.bounced` → structured log + alert
- `email.complained` → structured log + alert
- `email.delivery_delayed` → structured log warning

Uses native `crypto` HMAC SHA256 + `timingSafeEqual` with `RESEND_WEBHOOK_SECRET`.

### Webhooks Ingester (SOTA Jan 2026 — future upgrade)

For persistent storage beyond console logs, consider the open-source Next.js app by Resend: [github.com/resend/resend-webhooks-ingester](https://github.com/resend/resend-webhooks-ingester)

- 1-click deploy on Vercel/Railway/Render
- Supabase/PostgreSQL native
- Stores all 17 event types
- Idempotent + retry-safe
- Svix verification built-in
- **Recommended** as an upgrade to the custom endpoint for persistent event storage

## Test addresses

| Address | Behavior |
|---------|----------|
| `delivered@resend.dev` | Always delivered |
| `bounced@resend.dev` | Always bounces |
| `complained@resend.dev` | Always marked as spam |
| `suppressed@resend.dev` | Always suppressed |

Never use `onboarding@resend.dev` as `from` in production.

## Rate limits

| Plan | Limit |
|------|-------|
| Free | 2 emails/sec, 100/day |
| Pro | 10 emails/sec, unlimited |
| Enterprise | Custom |

- 429 response = rate limited → retry with exponential backoff (handled by `resend.service.ts`).
- Resend also has per-destination limits: max 5 emails/min to the same address (enforced by our service).

## Debug tools (2026)

### Resend CLI

```bash
npm install -g resend-cli

# Send a test email
resend emails send --from "Talok <noreply@mail.talok.fr>" \
  --to "test@example.com" \
  --subject "Test" \
  --html "<p>Hello</p>"

# List recent emails
resend emails list

# Check domain status
resend domains list
```

### Resend MCP Server

Available in Cursor for AI-assisted email debugging:
- 56+ tools (send, list, verify domains, manage audiences, etc.)
- Natural language interface
- Configure in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "resend": {
      "command": "npx",
      "args": ["-y", "resend-mcp@latest"]
    }
  }
}
```

## Talok email file map

### Core architecture (3 layers)

| File | Role |
|------|------|
| `lib/services/resend-config.ts` | Config resolution (DB > ENV), address normalization, consumer mailbox fallback |
| `lib/emails/resend.service.ts` | SDK wrapper, retry (3×), rate limit (5/min/dest), idempotencyKey passthrough |
| `lib/services/email-service.ts` | Public facade (`sendEmail`), re-exports `sendVisitReminderEmail`, `sendPaymentConfirmation`, `sendTicketUpdateNotification`, `emailService`. All wrappers use `emailTemplates.*` |
| `lib/emails/templates.ts` | **All** HTML email templates (`emailTemplates.*`) — 30+ templates including `leaseInvite`, `cniExpiryNotification`, `genericReminder`, `invoiceReminder`, `integrationTest` |
| `lib/emails/index.ts` | Exports `templates` only — no re-export of `resend.service` (callers must use `email-service.ts`) |
| `lib/emails/branded-email.service.ts` | White-label emails for owners. Delegates to `sendEmail()` from `email-service.ts` (no direct SDK usage) |

### Email callers

| File | Role |
|------|------|
| `lib/services/reminder-service.ts` | Multi-channel reminder dispatching, uses `emailTemplates.genericReminder`, idempotencyKey `reminder-{type}/{id}` |
| `lib/automations/rent-reminders.ts` | Automated rent reminder processing with `result.success` check, idempotencyKey `rent-reminder/{id}/{level}` |
| `app/api/emails/send/route.ts` | Internal email sending endpoint (used by Edge Functions), accepts optional `tags` param |
| `app/api/auth/forgot-password/route.ts` | Password reset flow |
| `app/api/auth/password-recovery/complete/route.ts` | Password changed confirmation with tags + idempotencyKey `password-changed/{userId}` |
| `app/api/cron/onboarding-reminders/route.ts` | Onboarding reminders (24h/72h/7d) with tags + idempotencyKey |
| `app/api/cron/visit-reminders/route.ts` | Visit reminders — imports `sendVisitReminderEmail` from `email-service.ts` |
| `app/api/cron/check-cni-expiry/route.ts` | CNI expiry notifications using `emailTemplates.cniExpiryNotification`, idempotencyKey `cni-expiry/{docId}/{type}` |
| `app/api/invoices/reminders/route.ts` | Invoice reminders using `emailTemplates.invoiceReminder` with tags + idempotencyKey `invoice-reminder/{id}/{level}` |
| `app/api/admin/integrations/providers/[id]/test/route.ts` | Admin integration test using `emailTemplates.integrationTest` |
| `app/api/webhooks/stripe/route.ts` | Payment webhook → confirmation emails with `result.success` check |

### Webhooks & Edge Functions

| File | Role |
|------|------|
| `app/api/webhooks/resend/route.ts` | Resend webhook handler (bounce/complaint/delivered/delayed), native `crypto` HMAC verification |
| `supabase/functions/_shared/email-templates.ts` | **Shared Deno-compatible HTML templates** (9 templates: `sepaPrenotification`, `signatureEmail`, `legislationUpdate`, `paymentReminder`, `overdueAlert`, `visitBookingRequest`, `visitBookingConfirmed`, `visitBookingCancelled`, `visitFeedbackRequest`) |
| `supabase/functions/sepa-prenotification/index.ts` | SEPA emails (Edge Function, REST API), uses `_shared/email-templates.ts`, `reply_to` fallback, `response.ok` check |
| `supabase/functions/process-outbox/index.ts` | Outbox processor with centralized `sendOutboxEmail()` helper, uses `_shared/email-templates.ts` for all 8 email types |

### UI Components

| File | Role |
|------|------|
| `components/white-label/email-preview.tsx` | Email preview component, uses `EMAIL_PREVIEW_TEMPLATES` (renamed from legacy `EMAIL_TEMPLATES`) |

### Config & Tests

| File | Role |
|------|------|
| `lib/config/env-validation.ts` | Environment variable validation |
| `tests/unit/services/resend-config.test.ts` | Config resolution tests |
| `tests/unit/services/email-service-config.test.ts` | Email service config tests |
