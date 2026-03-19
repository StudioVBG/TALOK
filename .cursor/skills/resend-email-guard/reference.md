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

| Flow | Key format | Example |
|------|-----------|---------|
| Password reset | `password-reset/{userId}` | `password-reset/uuid-123` |
| Password changed | `password-changed/{userId}` | `password-changed/uuid-123` |
| Lease invite | `lease-invite/{leaseId}/{email}` | `lease-invite/uuid-456/john@mail.com` |
| Invoice reminder | `invoice-reminder/{invoiceId}/{attempt}` | `invoice-reminder/uuid-789/2` |
| Onboarding 24h | `onboarding-24h/{profileId}` | `onboarding-24h/uuid-abc` |
| Onboarding 72h | `onboarding-72h/{profileId}` | `onboarding-72h/uuid-abc` |
| Visit reminder | `visit-reminder/{visitId}/{recipientId}` | `visit-reminder/uuid-def/uuid-ghi` |
| Payment received | `payment-received/{paymentId}` | `payment-received/uuid-jkl` |
| CNI expiry | `cni-expiry/{documentId}/{type}` | `cni-expiry/uuid-mno/expiring_soon` |
| SEPA pre-notif | `sepa-prenotif/{leaseId}/{period}` | `sepa-prenotif/uuid-pqr/2026-03` |
| Ticket created | `ticket-created/{ticketId}` | `ticket-created/uuid-stu` |
| Quittance | `quittance/{invoiceId}` | `quittance/uuid-vwx` |
| Rent reminder | `rent-reminder/{invoiceId}/{level}` | `rent-reminder/uuid-yz1/L2` |

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

### Svix verification (Webhooks)

```typescript
import { Webhook } from 'svix';

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
const payload = wh.verify(rawBody, {
  'svix-id': headers['svix-id'],
  'svix-timestamp': headers['svix-timestamp'],
  'svix-signature': headers['svix-signature'],
});
```

### Webhooks Ingester (SOTA Jan 2026)

Open-source Next.js app by Resend: [github.com/resend/resend-webhooks-ingester](https://github.com/resend/resend-webhooks-ingester)

- 1-click deploy on Vercel/Railway/Render
- Supabase/PostgreSQL native
- Stores all 17 event types
- Idempotent + retry-safe
- Svix verification built-in
- Replaces need for custom webhook handler
- **Recommended** for production Talok deployment

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

| File | Role |
|------|------|
| `lib/services/resend-config.ts` | Config resolution (DB > ENV), address normalization |
| `lib/emails/resend.service.ts` | SDK wrapper, retry, rate limit, validation |
| `lib/services/email-service.ts` | Public facade (`sendEmail`), template routing |
| `lib/emails/templates.ts` | All HTML email templates (`emailTemplates.*`) |
| `lib/emails/branded-email.service.ts` | White-label emails for owners |
| `lib/services/reminder-service.ts` | Multi-channel reminder dispatching |
| `lib/automations/rent-reminders.ts` | Automated rent reminder processing |
| `lib/config/env-validation.ts` | Environment variable validation |
| `app/api/emails/send/route.ts` | Internal email sending endpoint |
| `app/api/auth/forgot-password/route.ts` | Password reset flow |
| `app/api/auth/password-recovery/complete/route.ts` | Password changed confirmation |
| `app/api/cron/onboarding-reminders/route.ts` | Onboarding reminders (24h/72h/7d) |
| `app/api/cron/visit-reminders/route.ts` | Visit reminders (24h/1h) |
| `app/api/cron/check-cni-expiry/route.ts` | CNI expiry notifications |
| `app/api/invoices/reminders/route.ts` | Invoice reminder management |
| `app/api/webhooks/stripe/route.ts` | Payment webhook → confirmation emails |
| `app/api/webhooks/resend/route.ts` | Resend webhook handler (bounce/complaint) |
| `supabase/functions/sepa-prenotification/index.ts` | SEPA emails (Edge Function, REST API) |
| `supabase/functions/process-outbox/index.ts` | Outbox processor (delegates to email service) |
| `tests/unit/services/resend-config.test.ts` | Config resolution tests |
| `tests/unit/services/email-service-config.test.ts` | Email service config tests |
