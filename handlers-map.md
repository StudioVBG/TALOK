# HANDLERS MAP - TALOK

> **Generated**: 2026-01-17
> **Purpose**: Audit de refactoring - NE PAS MODIFIER CES HANDLERS

## STATISTIQUES

| Type | Nombre |
|------|--------|
| Server Actions | 15+ |
| Form Handlers (onSubmit) | 60+ |
| Click Handlers (onClick) | 80+ |
| Change Handlers (onChange) | 50+ |
| Keyboard Handlers | 20+ |
| Async/API Handlers | 100+ |
| **TOTAL** | **200+** |

---

## NIVEAU DE RISQUE

| Niveau | Description | Action |
|--------|-------------|--------|
| **CRITIQUE** | Mutations Supabase, paiements, signatures | ❌ NE JAMAIS TOUCHER |
| **HIGH** | Auth, onboarding, documents | ⚠️ Révision obligatoire |
| **MEDIUM** | Navigation, filtres, UI state | ✅ Avec précaution |
| **LOW** | Cosmétique, hover states | ✅ Safe |

---

## SERVER ACTIONS - CRITIQUE ❌

### `/app/owner/leases/actions.ts`
| Action | Ligne | Description | Risque |
|--------|-------|-------------|--------|
| `terminateLease()` | 32 | Termine un bail | CRITIQUE |
| `activateLease()` | 105 | Active un bail après signature | CRITIQUE |
| `updateLeaseRent()` | 165 | Met à jour loyer/charges | CRITIQUE |

**Pattern Supabase**:
```typescript
// Auth check
const { data: { user } } = await supabase.auth.getUser()
// Ownership verification
const { data: lease } = await supabase.from("leases").select()
// Mutation
await supabase.from("leases").update({...})
// Cache invalidation
revalidatePath("/owner/leases")
```

### `/app/owner/money/actions.ts`
| Action | Ligne | Description | Risque |
|--------|-------|-------------|--------|
| `markInvoiceAsPaid()` | 23 | Marque facture payée | CRITIQUE |
| `sendPaymentReminder()` | 81 | Envoie rappel paiement | HIGH |
| `generateMonthlyInvoices()` | 137 | Génère factures mensuelles | CRITIQUE |
| `cancelInvoice()` | 228 | Annule facture | CRITIQUE |

### `/app/owner/properties/actions.ts`
| Action | Ligne | Description | Risque |
|--------|-------|-------------|--------|
| `updateProperty()` | 106 | Update complet propriété | CRITIQUE |
| `deleteProperty()` | 270 | Supprime propriété | CRITIQUE |
| `updatePropertyStatus()` | 346 | Change statut | HIGH |

---

## FORM HANDLERS (onSubmit) - HIGH ⚠️

### Authentication
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/auth/components/sign-in-form.tsx` | 238 | `handleSubmit` | Sign in email/password |
| `/app/auth/forgot-password/page.tsx` | 64 | `handleSubmit` | Reset password request |
| `/app/auth/reset-password/page.tsx` | 96 | `handleSubmit` | New password |
| `/app/auth/verify-email/page.tsx` | 58 | `handleResendEmail` | Resend verification |
| `/components/white-label/branded-login.tsx` | 118 | `handleSubmit` | Branded login |

### Lease Management
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/leases/components/lease-form.tsx` | 118 | `handleSubmit` | Create/edit lease |
| `/features/leases/components/lease-renewal-wizard.tsx` | 129 | `handleSubmit` | Renew lease |
| `/app/owner/leases/[id]/signers/TenantInviteModal.tsx` | 150 | `handleSubmit` | Invite signers |
| `/features/end-of-lease/components/lease-end-wizard.tsx` | 312 | `handleQuotesSubmit` | Submit quotes |

### Property Management
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/owner/onboarding/property/page.tsx` | 146 | `handleSubmit` | Create property |
| `/app/admin/properties/[id]/edit/page.tsx` | 180 | `handleSubmit` | Edit property |
| `/features/properties/components/v3/immersive/steps/ImportStep.tsx` | 67 | `handleSubmit` | Import data |

### Financial
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/owner/invoices/new/page.tsx` | 156 | `handleSubmit` | Create invoice |
| `/features/billing/components/payment-checkout.tsx` | 146 | `handleSubmit` | Process payment |
| `/features/billing/components/v2/PaymentMethodSetup.tsx` | 158 | `handleSubmit` | Setup payment method |
| `/features/billing/components/charge-form.tsx` | 80 | `handleSubmit` | Add charges |

### Onboarding
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/tenant/onboarding/context/page.tsx` | 156 | `handleSubmit` | Tenant context |
| `/app/tenant/onboarding/file/page.tsx` | 138 | `handleSubmit` | Tenant documents |
| `/app/guarantor/onboarding/financial/page.tsx` | 137 | `handleSubmit` | Guarantor financial |
| `/app/guarantor/onboarding/context/page.tsx` | 186 | `handleSubmit` | Guarantor info |
| `/app/syndic/onboarding/site/page.tsx` | 124 | `handleSubmit` | Syndic site |
| `/app/syndic/onboarding/profile/page.tsx` | 124 | `handleSubmit` | Syndic profile |

### Documents & Diagnostics
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/diagnostics/components/dpe-request-form.tsx` | 156 | `handleSubmit` | Request DPE |
| `/features/diagnostics/components/dpe-upload-form.tsx` | 146 | `handleSubmit` | Upload DPE |
| `/features/documents/components/document-upload-form.tsx` | 94 | `handleSubmit` | Upload docs |

### Tickets & Requests
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/tickets/components/ticket-form.tsx` | 76 | `handleSubmit` | Create ticket |
| `/app/owner/tickets/new/page.tsx` | 202 | `handleSubmit` | Work order |
| `/app/tenant/requests/new/page.tsx` | 248 | `handleSubmit` | Tenant request |

---

## CLICK HANDLERS (onClick) - MEDIUM/HIGH

### Navigation (MEDIUM)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/leases/new/page.tsx` | 20 | `router.push("/dashboard")` | Navigate |
| `/app/properties/page.tsx` | 36 | `router.push("/owner/properties")` | Navigate |
| `/components/search/command-palette.tsx` | 78-296 | `navigate()` | All routes |
| `/app/pricing/page.tsx` | 363 | `handleSelectPlan(slug)` | Plan selection |

### Delete Operations (CRITIQUE)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/leases/components/lease-card.tsx` | 21 | `handleDelete()` | Delete lease |
| `/features/tickets/components/ticket-card.tsx` | 23 | `handleDelete()` | Delete ticket |
| `/features/documents/components/document-card.tsx` | 24 | `handleDelete()` | Delete doc |
| `/features/properties/components/property-card.tsx` | 60 | `handleDelete()` | Delete property |
| `/features/finance/components/connected-accounts-list.tsx` | 41 | `handleDelete(id)` | Disconnect bank |
| `/features/properties/components/v3/rooms-photos-step.tsx` | 332 | `handleDeleteRoom(id)` | Delete room |
| `/app/guarantor/documents/page.tsx` | 123 | `handleDelete(documentId)` | Delete doc |

### Signature Operations (CRITIQUE)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/signature/[token]/SignatureFlow.tsx` | 346 | `handleSign()` | Sign lease |
| `/components/payments/CashReceiptFlow.tsx` | 143 | `handleOwnerSign()` | Sign receipt |

### Notifications (MEDIUM)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/notifications/page.tsx` | 179 | `markAllAsRead()` | Mark all read |
| `/app/notifications/page.tsx` | 231 | `markAsRead(id)` | Mark single |
| `/app/notifications/page.tsx` | 298 | `deleteNotification(id)` | Delete |

### Admin Operations (HIGH)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/admin/templates/TemplatesClient.tsx` | 348 | `handlePrint()` | Print |
| `/app/admin/templates/TemplatesClient.tsx` | 358 | `handleCopyHtml()` | Copy HTML |
| `/app/admin/blog/new/page.tsx` | 11 | `handleSuccess()` | Blog created |

---

## CHANGE HANDLERS (onChange) - MEDIUM

### Text Inputs
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/copro/tickets/page.tsx` | 232 | `setSearchQuery(e.target.value)` | Search |
| `/components/white-label/setup-wizard.tsx` | 258 | `updateBranding("company_name", ...)` | Branding |
| `/components/chat/chat-window.tsx` | 375 | `setNewMessage(e.target.value)` | Chat input |
| `/app/rejoin-logement/page.tsx` | 71 | `setCode(e.target.value.toUpperCase())` | Lease code |

### Financial Inputs (HIGH)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/leases/components/lease-renewal-wizard.tsx` | 244 | `setNewLoyer(parseFloat(...))` | Rent |
| `/features/leases/components/lease-renewal-wizard.tsx` | 263 | `setNewCharges(parseFloat(...))` | Charges |
| `/components/payments/ManualPaymentDialog.tsx` | 287 | `setFormData({...amount})` | Payment |
| `/features/end-of-lease/components/deposit-refund-wizard.tsx` | 384 | `updateDeductionAmount(...)` | Deduction |

### File Uploads (HIGH)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/documents/components/document-upload-form.tsx` | 125 | `handleFileChange()` | Doc upload |
| `/features/end-of-lease/components/edl-meter-readings.tsx` | 615 | `handleFileSelect()` | Meter upload |
| `/features/end-of-lease/components/edl-sortie-inspection.tsx` | 270 | `handlePhotoUpload()` | Photos |
| `/app/signature/[token]/CNIScanner.tsx` | 890 | `handleFileUpload()` | ID scan |

### Notification Settings (MEDIUM)
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/settings/notifications/page.tsx` | 258 | `updatePreference('notification_email', ...)` | Email pref |
| `/app/settings/notifications/page.tsx` | 294 | `updatePreference('sms_phone', ...)` | SMS |
| `/app/settings/notifications/page.tsx` | 342 | `updatePreference('quiet_hours_start', ...)` | Quiet hours |

---

## ASYNC HANDLERS (Database/API) - CRITIQUE ❌

### Authentication
| Fichier | Ligne | Handler | Supabase Call |
|---------|-------|---------|---------------|
| `/components/white-label/branded-login.tsx` | 39 | `handleSubmit()` | `auth.signInWithPassword()` |
| `/app/auth/forgot-password/page.tsx` | 20 | `handleSubmit()` | `auth.resetPasswordForEmail()` |
| `/app/auth/reset-password/page.tsx` | 44 | `handleSubmit()` | `auth.updateUser()` |
| `/app/auth/verify-email/page.tsx` | 58 | `handleResendEmail()` | `auth.resend()` |

### Document Upload
| Fichier | Ligne | Handler | Storage Call |
|---------|-------|---------|--------------|
| `/app/guarantor/documents/page.tsx` | 76 | `handleFileUpload()` | `storage.upload()` |
| `/app/guarantor/onboarding/financial/page.tsx` | 46 | `handleFileUpload(file, type)` | `storage.upload()` |
| `/features/end-of-lease/components/edl-meter-readings.tsx` | 164 | `handleFileSelect()` | `storage.upload()` |

### End of Lease
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/end-of-lease/components/edl-meter-readings.tsx` | 236 | `handleManualSubmit()` | Submit readings |
| `/features/end-of-lease/components/edl-meter-readings.tsx` | 293 | `handleValidateReading()` | Validate |
| `/features/end-of-lease/components/edl-meter-readings.tsx` | 337 | `handleDeleteReading()` | Delete |
| `/features/end-of-lease/components/lease-end-wizard.tsx` | 116 | `handleInspectionUpdate()` | Update |
| `/features/end-of-lease/components/lease-end-wizard.tsx` | 140 | `handleEdlComplete()` | Complete EDL |
| `/app/signature-edl/[token]/EDLSignatureClient.tsx` | 70 | `handleSign()` | Sign EDL |

### Lease Management
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/features/leases/components/lease-form.tsx` | 79 | `handleSubmit()` | Create/edit |
| `/features/leases/components/lease-signers.tsx` | 43 | `handleSign()` | Sign |
| `/features/leases/components/lease-signers.tsx` | 61 | `handleRefuse()` | Refuse |
| `/features/leases/components/lease-preview.tsx` | 332 | `handleDownloadPDF()` | Download |

### Financial
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/pricing/page.tsx` | 363 | `handleSelectPlan()` | Select plan |
| `/features/billing/components/payment-checkout.tsx` | 99 | `handleSubmit()` | Process payment |
| `/components/payments/ManualPaymentDialog.tsx` | 149 | `handleSubmitManualPayment()` | Manual payment |
| `/components/payments/CashReceiptFlow.tsx` | 159 | `handleTenantSign()` | Tenant sign |

### Admin
| Fichier | Ligne | Handler | Description |
|---------|-------|---------|-------------|
| `/app/admin/providers/pending/page.tsx` | 161 | `handleApprove(provider)` | Approve |
| `/app/admin/providers/pending/page.tsx` | 223 | `handleReject(provider)` | Reject |
| `/app/admin/accounting/page.tsx` | 267 | `handleExport()` | Export |
| `/app/admin/privacy/page.tsx` | 14 | `handleAnonymize()` | Anonymize |

---

## KEYBOARD HANDLERS - LOW ✅

| Fichier | Ligne | Event | Description |
|---------|-------|-------|-------------|
| `/components/chat/chat-window.tsx` | 376 | `onKeyDown` | Send on Enter |
| `/components/ui/editable-text.tsx` | 97 | `onKeyDown` | Save/cancel |
| `/components/ui/address-autocomplete.tsx` | 310 | `onKeyDown` | Navigate suggestions |
| `/components/white-label/domain-manager.tsx` | 207 | `onKeyDown` | Add on Enter |

---

## PATTERNS SUPABASE CRITIQUES

### Pattern Auth Check
```typescript
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) redirect("/auth/signin")
```

### Pattern Ownership Check
```typescript
const { data: resource } = await supabase
  .from("table")
  .select("*, property:properties(owner_id)")
  .eq("id", id)
  .single()

if (resource?.property?.owner_id !== user.id) {
  throw new Error("Unauthorized")
}
```

### Pattern Mutation + Revalidation
```typescript
const { error } = await supabase
  .from("table")
  .update({ field: value })
  .eq("id", id)

if (error) throw error
revalidatePath("/path")
```

---

## ZONES INTERDITES DE MODIFICATION

### Server Actions
- `/app/owner/leases/actions.ts` - Toutes les fonctions
- `/app/owner/money/actions.ts` - Toutes les fonctions
- `/app/owner/properties/actions.ts` - Toutes les fonctions

### Signature Flows
- `/app/signature/[token]/SignatureFlow.tsx`
- `/app/signature-edl/[token]/EDLSignatureClient.tsx`
- `/components/payments/SignaturePad.tsx`

### Payment Processing
- `/features/billing/components/payment-checkout.tsx`
- `/components/payments/ManualPaymentDialog.tsx`
- `/components/payments/CashReceiptFlow.tsx`

### Authentication
- `/features/auth/components/sign-in-form.tsx`
- `/components/white-label/branded-login.tsx`
- Tous les handlers dans `/app/auth/*`

---

## RECOMMANDATIONS

### Safe à modifier
1. Hover states (`onMouseEnter/Leave`)
2. UI state local (`useState` interne)
3. Logging/analytics handlers
4. Style/CSS handlers

### Vérification requise
1. Navigation handlers (vérifier les routes)
2. Filter/search handlers (vérifier les queries)
3. Form validation (ne pas changer la logique)

### NE JAMAIS toucher
1. Mutations Supabase
2. Auth flows
3. Payment processing
4. Signature workflows
5. Delete handlers avec cascade
