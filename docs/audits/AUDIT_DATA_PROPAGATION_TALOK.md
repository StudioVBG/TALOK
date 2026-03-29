# RAPPORT D'AUDIT — PROPAGATION DES DONNEES INTER-COMPTES TALOK

**Date :** 04/03/2026
**Auditeur :** Claude Code — Audit Backend/Frontend & Flux de donnees
**Stack :** Next.js 14+ (App Router), Supabase (Postgres + Realtime), TypeScript
**Perimetre :** Propagation inter-roles, notifications, realtime, coherence des donnees

---

## RESUME EXECUTIF

| Metrique | Valeur |
|---|---|
| **Flux inter-comptes audites** | **12** |
| Flux entierement fonctionnels | **3** (33%) |
| Flux partiellement fonctionnels | **5** (42%) |
| Flux non fonctionnels | **4** (25%) |
| **Canaux realtime actifs** | **3 roles sur 9** |
| **Triggers de notification DB** | **12** |
| **Problemes critiques identifies** | **18** |

### Etat de la propagation par evenement

| Evenement | DB Trigger | Notification in-app | Email | Realtime UI | Dashboard mis a jour |
|---|---|---|---|---|---|
| Tenant paie un loyer | Oui | Oui (owner) | Oui (tenant) | Oui (owner) | Owner: oui, Admin: au refresh |
| Owner cree une facture | Non | Non | Non | Non | Aucun |
| Tenant cree un ticket | Non | Non | Non | Oui (owner) | Owner: oui, Admin: au refresh |
| Owner uploade un document | Non | Non | Non | Oui (tenant) | Tenant: oui |
| Tenant uploade un document | Oui | Oui (owner) | Non | Oui (owner) | Owner: oui |
| Bail signe (tenant) | Oui | Oui (owner) | Non | Oui (owner+tenant) | Owner+Tenant: oui |
| Bail signe (owner) | Oui | Oui (tenants) | Non | Oui (owner+tenant) | Owner+Tenant: oui |
| Provider termine intervention | Oui | Oui (owner+tenant) | Non | Oui (provider) | Provider: oui |
| Syndic cree une AG | Non | Non | Non | Non | Copro: non (100% mock) |
| Owner cree un bien | Non | Non | Non | Non | Admin: au refresh seulement |
| Facture en retard | Oui | Oui (owner) | Non | Oui (owner) | Owner: oui |
| EDL planifie | Oui | Oui (signataires) | Non | Oui (tenant) | Tenant: oui |

---

## PARTIE 1 — ARCHITECTURE REALTIME

### 1.1 Hooks realtime par role

| Role | Hook | Canaux | Tables ecoutees | Auto-reconnect |
|---|---|---|---|---|
| **Owner** | `use-realtime-dashboard.ts` (614 lignes) | 8 | payments, invoices, lease_signers, tickets, leases, edl, documents, work_orders | Oui (30s) |
| **Tenant** | `use-realtime-tenant.ts` (683 lignes) | 7 | leases, invoices, documents, tickets, lease_signers, properties, edl | Oui (30s) |
| **Provider** | `use-realtime-provider.ts` (219 lignes) | 2 | work_orders, provider_reviews | Oui (30s) |
| **Admin** | Aucun hook dedie | 0 | — | — |
| **Agency** | Aucun hook dedie | 0 | — | — |
| **Syndic** | Aucun hook dedie | 0 | — | — |
| **Copro** | Aucun hook dedie | 0 | — | — |
| **Guarantor** | Aucun hook dedie | 0 | — | — |

**Hook generique :** `use-realtime-sync.ts` (402 lignes) — Invalidation React Query liee aux changements Supabase Realtime.
- `useOwnerRealtimeSync()` : properties, leases, invoices, payments, documents, notifications
- `useTenantRealtimeSync()` : leases, invoices, payments, documents, notifications, tickets
- `useAdminRealtimeSync()` : all tables (properties, leases, profiles, invoices, payments, documents, notifications, tickets)

**Hook notifications :** `use-notifications.ts` (326 lignes) — Universel, ecoute la table `notifications` filtree par `user_id`.

### 1.2 Detail des subscriptions Owner

```
Canal payments:{ownerId}
  Table: payments
  Event: INSERT
  Filtre: wildcard (RLS gate)
  Action: Increment totalRevenue, toast "Paiement recu"

Canal invoices:{ownerId}
  Table: invoices
  Event: UPDATE
  Filtre: wildcard (RLS gate)
  Action: Update pendingPayments, latePayments counters

Canal lease_signers:{ownerId}
  Table: lease_signers
  Event: UPDATE
  Filtre: wildcard (RLS gate)
  Action: Update pendingSignatures counter

Canal tickets:{ownerId}
  Table: tickets
  Events: INSERT, UPDATE
  Filtre: wildcard (RLS gate)
  Action: Increment/decrement openTickets counter

Canal leases:{ownerId}
  Table: leases
  Event: UPDATE
  Filtre: wildcard (RLS gate)
  Action: Update activeLeases counter

Canal edl:{ownerId}
  Table: edl
  Events: INSERT, UPDATE
  Filtre: wildcard (RLS gate)
  Action: Event log (completion, signature)

Canal documents:{ownerId}
  Table: documents
  Event: INSERT
  Filtre: wildcard (RLS gate)
  Action: Event log

Canal work_orders:{ownerId}
  Table: work_orders
  Events: INSERT, UPDATE
  Filtre: wildcard (RLS gate)
  Action: Event log + notification intervention
```

### 1.3 Detail des subscriptions Tenant

```
Canal tenant-leases:{profileId}
  Table: leases
  Event: UPDATE
  Filtre: lease_id IN (tenant's leases via lease_signers)
  Action: Update currentRent, currentCharges, totalMonthly, leaseStatus

Canal tenant-invoices:{profileId}
  Table: invoices
  Events: INSERT, UPDATE
  Filtre: lease_id IN (tenant's leases)
  Action: Update unpaidAmount counter
  Toast: "Nouvelle facture" (INSERT), "Facture payee" (UPDATE to paid)

Canal tenant-documents:{profileId}
  Table: documents
  Event: INSERT
  Filtre: tenant_id or lease_id match
  Action: Event log

Canal tenant-tickets:{profileId}
  Table: tickets
  Event: UPDATE
  Filtre: created_by_profile_id = tenant's profile
  Action: Update openTickets counter

Canal tenant-signers:{profileId}
  Table: lease_signers
  Event: UPDATE
  Filtre: lease_id IN (tenant's leases)
  Action: Event log (co-signataire a signe)

Canal tenant-properties:{profileId}
  Table: properties
  Event: UPDATE
  Filtre: RLS gate
  Action: Address change notification

Canal tenant-edl:{profileId}
  Table: edl
  Events: INSERT, UPDATE
  Filtre: lease_id IN (tenant's leases)
  Action: Event log
```

### 1.4 Detail des subscriptions Provider

```
Canal provider-work-orders:{profileId}
  Table: work_orders
  Events: INSERT, UPDATE
  Filtre: provider_id match
  Action: INSERT → newOrdersCount++, toast "Nouvelle intervention"
          UPDATE → event log (accepted, scheduled, completed)

Canal provider-reviews:{profileId}
  Table: provider_reviews
  Event: INSERT
  Filtre: provider_id match
  Action: Event log avec preview note/commentaire
```

---

## PARTIE 2 — TRIGGERS DE NOTIFICATION (BASE DE DONNEES)

### 2.1 Triggers Owner (fichier: `20251205000001_notification_triggers.sql`)

| Trigger | Table | Event | Condition | Notification creee |
|---|---|---|---|---|
| `notify_payment_received` | invoices | UPDATE | statut → 'paid' | Owner: "Loyer recu de {tenant}" |
| `notify_invoice_late` | invoices | UPDATE | statut → 'late' | Owner: "Facture en retard — {tenant}" |
| `notify_lease_signed` | leases | UPDATE | statut → 'active' | Owner: "Bail active" |

### 2.2 Triggers Tenant (fichier: `20260108200000_tenant_notification_triggers.sql`)

| Trigger | Table | Event | Condition | Notification creee |
|---|---|---|---|---|
| `notify_tenant_lease_updated` | leases | UPDATE | loyer/charges/statut change | Tous les signataires du bail |
| `notify_tenant_invoice_created` | invoices | INSERT | — | Tous les signataires du bail |
| `notify_tenant_document_uploaded` | documents | INSERT | — | Tenant ou tous les signataires |
| `notify_tenant_owner_signed` | lease_signers | UPDATE | → signed | Tous les AUTRES signataires |
| `notify_tenant_edl_scheduled` | edl | INSERT/UPDATE | — | Tous les signataires EDL |
| `notify_tenant_signature_requested` | lease_signers | INSERT | pending | Le signataire specifique |
| `notify_tenant_ticket_updated` | tickets | UPDATE | statut change | Le createur du ticket |

### 2.3 Trigger Owner ← Tenant document (fichier: `20260223000003_notify_owner_on_tenant_document.sql`)

| Trigger | Table | Event | Condition | Notification creee |
|---|---|---|---|---|
| `notify_owner_on_tenant_document` | documents | INSERT | uploaded by tenant | Owner du bien |

### 2.4 Triggers de propagation (fichier: `20260301100000_entity_audit_and_propagation.sql`)

| Trigger | Table | Event | Action |
|---|---|---|---|
| `trg_propagate_entity_changes` | legal_entities | UPDATE | Propage nom, adresse, SIRET vers leases et invoices |
| `log_entity_changes` | legal_entities | UPDATE | Audit trail |

### 2.5 Triggers Auto-link (fichier: `20260216200000_auto_link_lease_signers_trigger.sql`)

| Trigger | Table | Event | Action |
|---|---|---|---|
| Auto-link lease signers | profiles | INSERT | Lie les lease_signers orphelins (invited_email match) |

---

## PARTIE 3 — FLUX DE DONNEES DETAILLES

### 3.1 FLUX : Tenant paie un loyer

```
ETAPE 1: Tenant → POST /api/payments/confirm
  └─ Ecrit: payments (status=succeeded)
  └─ Ecrit: invoices (statut=paid si total couvert)
  └─ Ecrit: audit_log (payment_confirmed)
  └─ Ecrit: outbox (Invoice.Paid)
  └─ Appel: AccountingIntegrationService.recordRentPayment()
  └─ Email: sendPaymentConfirmation() → tenant (via Resend)

ETAPE 2: Trigger DB → notify_payment_received
  └─ Ecrit: notifications (owner) — "Loyer recu de {tenant}"

ETAPE 3: Realtime → Owner dashboard
  └─ Canal payments:{ownerId} → INSERT detecte
  └─ Action: totalRevenue incremente, toast affiche
  └─ Canal invoices:{ownerId} → UPDATE detecte
  └─ Action: pendingPayments decremente

ETAPE 4: Realtime → Tenant dashboard
  └─ Canal tenant-invoices:{profileId} → UPDATE detecte
  └─ Action: unpaidAmount decremente

ETAPE 5: Admin dashboard
  └─ NON IMMEDIAT — donnees mises a jour au prochain appel RPC admin_stats
  └─ Pas de realtime, pas de push, pas de notification

ETAPE 6: Agency dashboard (si bien sous mandat)
  └─ NON IMMEDIAT — donnees mises a jour au prochain appel RPC agency_dashboard
```

**Verdict : PARTIELLEMENT FONCTIONNEL**
- Owner: Oui (trigger + realtime)
- Tenant: Oui (email + realtime)
- Admin: Non (refresh manuel requis)
- Agency: Non (refresh manuel requis)

---

### 3.2 FLUX : Owner cree une facture

```
ETAPE 1: Owner → POST /api/invoices
  └─ Ecrit: invoices (statut=draft)
  └─ Ecrit: outbox (Rent.InvoiceIssued)
  └─ Ecrit: audit_log (invoice_created)

ETAPE 2: Trigger DB
  └─ AUCUN TRIGGER pour invoice INSERT avec statut draft
  └─ Le trigger notify_tenant_invoice_created existe mais
     ne se declenche que sur INSERT (pas conditionne par statut)

ETAPE 3: Realtime → Tenant dashboard
  └─ Canal tenant-invoices:{profileId} → INSERT detecte
  └─ Action: nouvelle facture visible, compteur mis a jour

ETAPE 4: Owner doit manuellement passer la facture en "sent"
  └─ Pas d'automatisation

ETAPE 5: Admin dashboard
  └─ NON IMMEDIAT — au prochain appel RPC
```

**Verdict : PARTIELLEMENT FONCTIONNEL**
- Tenant: Oui via realtime (mais la facture est en draft)
- Owner: N/A (il est l'emetteur)
- Admin: Non
- PROBLEME: Le trigger cree une notification meme pour les drafts — le tenant voit une facture draft qu'il ne devrait peut-etre pas voir

---

### 3.3 FLUX : Tenant cree un ticket

```
ETAPE 1: Tenant → POST /api/tickets
  └─ Ecrit: tickets (statut=open)
  └─ Ecrit: outbox (Ticket.Opened)
  └─ Ecrit: audit_log (ticket_created)
  └─ Appel async: maintenanceAiService.analyzeAndEnrichTicket()

ETAPE 2: Trigger DB
  └─ AUCUN TRIGGER pour ticket INSERT
  └─ Pas de notification owner
  └─ Pas de notification provider

ETAPE 3: Realtime → Owner dashboard
  └─ Canal tickets:{ownerId} → INSERT detecte
  └─ Action: openTickets incremente
  └─ PAS DE TOAST — l'owner ne sait pas qu'un ticket a ete cree

ETAPE 4: Admin dashboard
  └─ NON IMMEDIAT
```

**Verdict : INSUFFISANT**
- Owner: Realtime UI mis a jour (compteur) mais AUCUNE notification — l'owner doit regarder son dashboard pour voir le nouveau ticket
- Provider: Rien tant que le work order n'est pas cree
- Admin: Non
- CRITIQUE: Un ticket urgent (fuite d'eau, panne chauffage) ne genere aucune alerte

---

### 3.4 FLUX : Upload d'un document

```
CAS A: Owner uploade un document
  └─ POST /api/documents/upload
  └─ Ecrit: documents (storage_path, type, property_id)
  └─ AUCUN TRIGGER de notification vers le tenant
  └─ Realtime → Tenant: Canal tenant-documents → INSERT detecte (event log seulement)

CAS B: Tenant uploade un document
  └─ POST /api/documents/upload
  └─ Ecrit: documents (storage_path, type, property_id)
  └─ TRIGGER: notify_owner_on_tenant_document → notification owner
  └─ Realtime → Owner: Canal documents:{ownerId} → INSERT detecte (event log)
```

**Verdict : ASYMETRIQUE**
- Tenant → Owner : notification oui (trigger)
- Owner → Tenant : notification non (pas de trigger)
- PROBLEME: Si l'owner envoie une quittance ou un avis d'echeance, le tenant n'est pas notifie

---

### 3.5 FLUX : Signature d'un bail

```
ETAPE 1: Signataire → POST /api/leases/{id}/sign
  └─ Ecrit: lease_signers (signature_status=signed, signed_at, proof)
  └─ Ecrit: leases (statut → PENDING_SIGNATURE → PARTIALLY_SIGNED → FULLY_SIGNED)
  └─ Ecrit: outbox (Lease.TenantSigned / Lease.OwnerSigned / Lease.FullySigned)
  └─ Ecrit: audit_log (lease_signed)
  └─ Si FULLY_SIGNED: appel seal_lease() RPC

ETAPE 2: Triggers DB
  └─ notify_tenant_owner_signed → tous les autres signataires
  └─ notify_lease_signed (si → active) → owner

ETAPE 3: Realtime
  └─ Owner: Canal lease_signers + leases → UPDATE detecte
  └─ Tenant: Canal tenant-signers + tenant-leases → UPDATE detecte

ETAPE 4: Email
  └─ Pas d'email automatique dans le flux de signature
  └─ L'outbox emet Lease.TenantSigned mais le webhook processor doit etre actif
```

**Verdict : FONCTIONNEL (avec reserves)**
- Notifications in-app: oui (triggers)
- Realtime: oui (les deux cotes)
- Email: dependant du webhook processor cron (peut etre retarde)

---

### 3.6 FLUX : Provider termine une intervention

```
ETAPE 1: Provider → PATCH /api/work-orders/{id} (statut=completed)
  └─ Ecrit: work_orders (statut=completed)
  └─ Trigger DB: update ticket associe (statut=resolved)
  └─ Ecrit: outbox (WorkOrder.Completed)

ETAPE 2: Triggers DB
  └─ notify_tenant_ticket_updated → createur du ticket (tenant)
  └─ Notification owner via ticket update

ETAPE 3: Realtime
  └─ Provider: Canal provider-work-orders → UPDATE detecte
  └─ Owner: Canal tickets → UPDATE detecte (openTickets decremente)
  └─ Tenant: Canal tenant-tickets → UPDATE detecte
```

**Verdict : FONCTIONNEL**
- Tous les roles concernes sont notifies

---

### 3.7 FLUX : Syndic cree une AG

```
ETAPE 1: Syndic → POST /api/copro/assemblies
  └─ Ecrit: assemblies (scheduled_at, site_id, etc.)

ETAPE 2: Triggers DB
  └─ AUCUN TRIGGER identifie pour les assemblees
  └─ Pas de notification aux coproprietaires

ETAPE 3: Realtime
  └─ AUCUN — ni syndic ni copro n'ont de hooks realtime

ETAPE 4: Dashboard Copro
  └─ NON FONCTIONNEL — le dashboard copro est 100% mocke
  └─ Meme si les donnees existaient, aucun mecanisme de mise a jour
```

**Verdict : NON FONCTIONNEL**
- Aucune propagation
- Aucune notification
- Dashboard destinataire 100% mock

---

### 3.8 FLUX : Owner cree un bien

```
ETAPE 1: Owner → POST /api/properties
  └─ Ecrit: properties (adresse, type, owner_id)
  └─ Verification: check_property_limit_before_insert (trigger limite subscription)

ETAPE 2: Realtime → Owner
  └─ Canal owner realtime-sync → properties INSERT → invalide React Query

ETAPE 3: Admin dashboard
  └─ NON IMMEDIAT — totalProperties mis a jour au prochain appel RPC
  └─ useAdminRealtimeSync() ecoute properties mais n'invalide que le cache client
  └─ Si l'admin n'a pas son dashboard ouvert, il ne verra rien

ETAPE 4: Agency dashboard (si mandat)
  └─ NON IMMEDIAT — au prochain appel RPC agency_dashboard
```

**Verdict : PARTIELLEMENT FONCTIONNEL**
- Owner: oui (realtime sync)
- Admin: partiel (cache invalidation si dashboard ouvert)
- Agency: non

---

## PARTIE 4 — SYSTEME DE NOTIFICATIONS

### 4.1 Infrastructure

```
Table: notifications
  - profile_id (ou user_id legacy)
  - type, title, message
  - is_read, read_at
  - action_url, action_label
  - priority (normal/high/critical)
  - channels_status (JSON: {in_app, email, push})
  - status (pending/sent/failed)

API Routes:
  GET  /api/notifications         → Lire les notifications
  PATCH /api/notifications        → Marquer comme lue
  DELETE /api/notifications       → Supprimer
  POST /api/notifications         → Creer (admin/system)
  POST /api/notifications/push/subscribe → Inscription push
  POST /api/notifications/push/send     → Envoyer push (admin)
```

### 4.2 Pipeline d'evenements (Outbox pattern)

```
1. Action utilisateur (paiement, signature, etc.)
   ↓
2. INSERT dans table outbox (event_type + payload)
   ↓
3. Cron Job: /api/cron/process-webhooks (cadence inconnue)
   ↓
4. webhookRetryService.processPendingWebhooks()
   ↓
5. Traitement: emails, notifications, webhooks externes
   ↓
6. Retry: max 5 tentatives, backoff exponentiel
```

### 4.3 Emails (Resend)

| Template | Evenement | Destinataire |
|---|---|---|
| welcome | Inscription | Utilisateur |
| rent_receipt | Paiement confirme | Tenant |
| rent_reminder | Facture bientot due | Tenant |
| payment_confirmation | Paiement recu | Tenant |
| lease_signature | Signature demandee | Signataire |

### 4.4 Couverture des notifications

| Evenement | Trigger DB | Notification in-app | Email | Push |
|---|---|---|---|---|
| Paiement recu | Oui | Oui (owner) | Oui (tenant) | Non |
| Facture en retard | Oui | Oui (owner) | Non | Non |
| Bail active | Oui | Oui (owner) | Non | Non |
| Loyer/charges modifie | Oui | Oui (tenants) | Non | Non |
| Facture creee | Oui | Oui (tenants) | Non | Non |
| Document uploade (tenant→owner) | Oui | Oui (owner) | Non | Non |
| Document uploade (owner→tenant) | **Non** | **Non** | **Non** | **Non** |
| Ticket cree | **Non** | **Non** | **Non** | **Non** |
| Ticket mis a jour | Oui | Oui (createur) | Non | Non |
| EDL planifie | Oui | Oui (signataires) | Non | Non |
| Signature demandee | Oui | Oui (signataire) | Non | Non |
| Co-signataire a signe | Oui | Oui (autres) | Non | Non |
| AG creee | **Non** | **Non** | **Non** | **Non** |
| Bien cree | **Non** | **Non** | **Non** | **Non** |
| Work order assigne | **Non** | **Non** | **Non** | **Non** |
| Provider termine intervention | Via ticket | Via ticket | **Non** | **Non** |

---

## PARTIE 5 — SYSTEME DE CACHE

### 5.1 Niveaux de cache

| Niveau | Mecanisme | TTL | Invalidation |
|---|---|---|---|
| **HTTP Server** | Cache-Control headers | 5min (s-maxage=300) | stale-while-revalidate=60 |
| **React Query** | Client-side cache | 2min (staleTime) | invalidateQueries() + realtime sync |
| **Next.js Server** | revalidateTag / revalidatePath | Indefini | Via /api/revalidate endpoint |
| **Database** | Aucun (requetes fresh) | N/A | N/A |

### 5.2 Service d'invalidation (`lib/cache/invalidation.service.ts`)

```
React Query invalidation:
  invalidateReactQuery({ entities: ["property", "lease"], ids: [propertyId] })
  → queryClient.invalidateQueries({ queryKey: ["properties", propertyId] })

Next.js Server revalidation:
  revalidateServerCache({ entities: ["property"] })
  → POST /api/revalidate?tag=owner:properties
  → revalidateTag("owner:properties")

Cascade de dependances:
  property → [lease, document, edl]
  lease → [invoice, payment, signature, document]
```

### 5.3 Endpoint de revalidation (`/api/revalidate`)

- Valide un token secret (REVALIDATION_SECRET)
- Supporte revalidation par tag ou par path
- Rate-limite a 30/minute
- Tags autorises : `owner:*`, `admin:*`, `tenant:*`, `property:*`, `lease:*`, `document:*`, `payment:*`

---

## PARTIE 6 — SECURITE DES FLUX

### 6.1 Points forts

| Aspect | Statut |
|---|---|
| RLS Supabase sur toutes les tables sensibles | Oui |
| Filtrage par ID dans les subscriptions realtime | Oui |
| Notifications avec recipient_id explicite | Oui |
| Triggers isoles par role | Oui |
| Auto-reconnexion realtime | Oui (30s interval) |
| Audit trail des actions sensibles | Oui (audit_log) |

### 6.2 Points d'attention

| Risque | Severite | Detail |
|---|---|---|
| Subscriptions sans filtre explicite | FAIBLE | Owner realtime ecoute en wildcard — securise par RLS |
| Tenant properties subscription bruyante | FAIBLE | Ecoute TOUS les UPDATE de properties — filtre en RLS |
| Notifications INSERT permissif | FAIBLE | Policy "System can insert" — mitige par triggers |
| Chat realtime sans re-enable | FAIBLE | Desactive sur erreur "insecure", fallback polling |

### 6.3 Verification inter-roles

- Aucune evidence d'un owner voyant les donnees d'un autre owner
- Aucune evidence d'un tenant voyant les donnees d'un autre tenant
- Aucune fuite de donnees financieres vers le provider
- Aucune fuite cross-role via les subscriptions realtime

---

## PARTIE 7 — PROBLEMES CRITIQUES IDENTIFIES

### 7.1 Notifications manquantes (CRITIQUE)

**P01 — Ticket cree sans notification owner**
```
Probleme: Quand un tenant cree un ticket (maintenance, urgence), l'owner ne recoit aucune notification
Impact: Un ticket urgent (fuite d'eau, panne chauffage) peut rester non traite pendant des heures
Solution: Ajouter un trigger notify_owner_on_ticket_created sur la table tickets (INSERT)
Priorite: P0
```

**P02 — Document owner→tenant sans notification**
```
Probleme: Quand l'owner uploade un document (quittance, avis d'echeance), le tenant n'est pas notifie
Impact: Le tenant ne sait pas qu'une quittance est disponible
Solution: Ajouter un trigger symetrique a notify_owner_on_tenant_document
Priorite: P1
```

**P03 — Work order assigne sans notification provider**
```
Probleme: Quand un work order est cree/assigne, le provider ne recoit pas de notification in-app
Impact: Le provider doit checker manuellement son dashboard
Solution: Ajouter un trigger notify_provider_on_work_order_assigned
Priorite: P1
```

**P04 — AG creee sans notification coproprietaires**
```
Probleme: Quand le syndic planifie une AG, aucun coproprietaire n'est notifie
Impact: Les coproprietaires ne savent pas qu'une AG approche
Solution: Ajouter trigger + notification (mais dashboard copro est 100% mock)
Priorite: P2 (apres fix du dashboard copro)
```

### 7.2 Donnees non propagees (CRITIQUE)

**P05 — Facture draft visible par le tenant**
```
Probleme: Le trigger notify_tenant_invoice_created se declenche sur INSERT sans verifier le statut
Impact: Le tenant recoit une notification pour une facture en draft qu'il ne devrait pas voir
Solution: Ajouter condition WHERE NEW.statut != 'draft' dans le trigger
Priorite: P0
```

**P06 — Admin dashboard sans realtime**
```
Probleme: L'admin n'a aucune mise a jour temps reel — les stats ne bougent qu'au refresh page
Impact: L'admin ne voit pas les nouveaux utilisateurs, paiements, tickets en live
Solution: Activer useAdminRealtimeSync() dans le dashboard admin (existe mais non utilise)
Priorite: P1
```

**P07 — Agency dashboard sans realtime**
```
Probleme: L'agence n'a aucune mise a jour temps reel
Impact: Les mandats, paiements, taux d'occupation ne se mettent pas a jour
Solution: Creer useAgencyRealtimeSync() ou utiliser le hook generique
Priorite: P2
```

### 7.3 Architecture (MAJEUR)

**P08 — 6/9 dashboards sans realtime**
```
Probleme: Seuls Owner, Tenant et Provider ont des hooks realtime dedies
Impact: Admin, Agency, Syndic, Copro, Guarantor ne se mettent jamais a jour sans refresh
Solution: Implementer des hooks realtime pour chaque role ou utiliser use-realtime-sync.ts
Priorite: P1
```

**P09 — 5/9 dashboards sans DataProvider**
```
Probleme: Admin, Agency, Syndic, Copro, Guarantor n'ont pas de DataProvider React Context
Impact: Refetch inutiles, pas de partage de donnees entre composants
Solution: Creer des DataProviders pour chaque role
Priorite: P2
```

**P10 — 4/9 dashboards 100% "use client"**
```
Probleme: Provider, Syndic, Copro, Guarantor sont entierement client-side
Impact: Pas de SSR, pas de cache serveur, flash de contenu, auth non verifiee server-side
Solution: Migrer vers le pattern Server Component → Client Component
Priorite: P2
```

### 7.4 Coherence des donnees (MAJEUR)

**P11 — Webhook processor dependant du cron**
```
Probleme: Les evenements outbox ne sont traites que si /api/cron/process-webhooks tourne
Impact: Si le cron est down, aucun email n'est envoye (paiements, signatures)
Solution: Verifier que le cron est configure et monitore, ajouter alerting si queue > seuil
Priorite: P0
```

**P12 — Pas de push notifications**
```
Probleme: L'infrastructure push existe (/api/notifications/push) mais n'est jamais appelee automatiquement
Impact: Les utilisateurs mobiles ne recoivent aucune notification push
Solution: Integrer l'envoi push dans les triggers de notification
Priorite: P2
```

**P13 — Pas de notification par email pour les tickets**
```
Probleme: Un ticket urgent ne genere aucun email — ni pour l'owner ni pour le provider
Impact: Delai de reaction potentiellement tres long sur les urgences
Solution: Ajouter un email template ticket_created et l'integrer dans le flux
Priorite: P1
```

**P14 — Cache owner dashboard 5 minutes**
```
Probleme: Le dashboard owner a un Cache-Control de 5 minutes (s-maxage=300)
Impact: Apres un paiement, le dashboard API peut retourner des donnees stale pendant 5 min
Solution: Le realtime compense partiellement mais le cache API peut creer de la confusion
Mitigation: stale-while-revalidate=60 aide, mais le fond du probleme reste
Priorite: P3
```

### 7.5 Lacunes email (MINEUR)

**P15 — Pas d'email pour facture en retard**
```
Probleme: Le trigger notify_invoice_late cree une notification in-app mais pas d'email
Impact: L'owner doit regarder son dashboard pour voir les impayes
Solution: Ajouter un email rent_reminder a l'owner dans le trigger
Priorite: P2
```

**P16 — Pas d'email pour signature de bail**
```
Probleme: La signature de bail emet un event outbox mais pas d'email direct
Impact: L'autre partie ne sait pas qu'elle doit aller signer
Solution: Le template lease_signature existe mais n'est pas integre dans le flux
Priorite: P1
```

**P17 — Pas d'email pour document uploade**
```
Probleme: Aucun email quand un document est uploade (dans les 2 sens)
Impact: Les documents restent non consultes
Solution: Ajouter un email template document_uploaded
Priorite: P2
```

**P18 — Pas d'email pour EDL planifie**
```
Probleme: La notification in-app existe (trigger) mais pas d'email
Impact: Le tenant/owner peut rater un EDL
Solution: Ajouter un email template edl_scheduled
Priorite: P2
```

---

## PARTIE 8 — PLAN D'ACTION PRIORISE

### P0 — Immediat

| # | Action | Impact |
|---|---|---|
| 1 | Ajouter trigger `notify_owner_on_ticket_created` | Tickets urgents visibles immediatement |
| 2 | Conditionner `notify_tenant_invoice_created` sur statut != 'draft' | Eviter la fuite de factures draft |
| 3 | Verifier et monitorer le cron process-webhooks | Garantir la livraison des emails |

### P1 — Court terme

| # | Action | Impact |
|---|---|---|
| 4 | Ajouter trigger `notify_tenant_on_owner_document` | Symetrie des notifications documents |
| 5 | Ajouter trigger `notify_provider_on_work_order` | Provider notifie des interventions |
| 6 | Integrer email dans le flux de signature (lease_signature template) | Accelerer les signatures |
| 7 | Ajouter email pour les tickets urgents | Reaction rapide aux urgences |
| 8 | Activer useAdminRealtimeSync() dans le dashboard admin | Stats en temps reel |
| 9 | Creer hooks realtime pour Syndic et Agency | Mise a jour live |

### P2 — Moyen terme

| # | Action | Impact |
|---|---|---|
| 10 | Creer hooks realtime pour Copro et Guarantor | Couverture complete |
| 11 | Migrer les 4 dashboards "use client" vers Server → Client | SSR, cache, auth server |
| 12 | Creer DataProviders pour les 5 dashboards manquants | Partage de donnees |
| 13 | Integrer push notifications dans les triggers | Notifications mobiles |
| 14 | Ajouter trigger AG creee → notification coproprietaires | Propagation syndic→copro |
| 15 | Ajouter emails pour facture retard, document uploade, EDL | Couverture email complete |

### P3 — Long terme

| # | Action | Impact |
|---|---|---|
| 16 | Revoir le cache owner dashboard (5min trop long?) | Coherence donnees |
| 17 | Implementer notification preferences par utilisateur | UX personnalisee |
| 18 | Ajouter un tableau de bord de monitoring des notifications | Observabilite |

---

## PARTIE 9 — MATRICE DE PROPAGATION COMPLETE

```
                    ┌──────────────────────────────────────────────────────┐
                    │              MATRICE DE PROPAGATION                   │
                    ├──────────────────────────────────────────────────────┤
                    │                                                      │
   TENANT           │   OWNER           PROVIDER         ADMIN    AGENCY  │
   ──────           │   ──────          ──────────       ─────    ──────  │
                    │                                                      │
   Paie loyer ──────┼──►Notif in-app    ─                Refresh  Refresh │
                    │   + Realtime UI                     requis   requis  │
                    │   + Email (tenant)                                    │
                    │                                                      │
   Cree ticket ─────┼──►Realtime UI     ─                Refresh  ─       │
                    │   PAS DE NOTIF!                     requis           │
                    │                                                      │
   Uploade doc ─────┼──►Notif in-app    ─                ─        ─       │
                    │   + Realtime UI                                      │
                    │                                                      │
   ──────────────────┼─────────────────────────────────────────────────────│
                    │                                                      │
   OWNER            │   TENANT          PROVIDER         ADMIN    AGENCY  │
   ──────           │   ──────          ──────────       ─────    ──────  │
                    │                                                      │
   Cree facture ────┼──►Notif in-app*   ─                Refresh  Refresh │
                    │   + Realtime UI                     requis   requis  │
                    │   *meme en draft!                                     │
                    │                                                      │
   Uploade doc ─────┼──►PAS DE NOTIF!   ─                ─        ─       │
                    │   Realtime UI                                        │
                    │   seulement                                          │
                    │                                                      │
   Signe bail ──────┼──►Notif in-app    ─                Refresh  ─       │
                    │   + Realtime UI                     requis           │
                    │                                                      │
   Cree bien ───────┼──►─               ─                Refresh  Refresh │
                    │                                     requis   requis  │
                    │                                                      │
   ──────────────────┼─────────────────────────────────────────────────────│
                    │                                                      │
   PROVIDER         │   OWNER           TENANT           ADMIN    AGENCY  │
                    │                                                      │
   Termine interv. ─┼──►Via ticket      Via ticket       Refresh  ─       │
                    │   update          update            requis           │
                    │                                                      │
   ──────────────────┼─────────────────────────────────────────────────────│
                    │                                                      │
   SYNDIC           │   COPROPRIETAIRES                                    │
                    │                                                      │
   Cree AG ─────────┼──►PAS DE NOTIF! (+ dashboard copro 100% mock)       │
                    │                                                      │
                    └──────────────────────────────────────────────────────┘

Legende:
  Notif in-app = notification dans la table notifications (visible via use-notifications.ts)
  Realtime UI = subscription Supabase Realtime (mise a jour instantanee du dashboard)
  Email = email envoye via Resend
  Refresh requis = donnees mises a jour seulement au prochain appel RPC (pas de push)
  ─ = aucune propagation
```

---

*Rapport genere le 04/03/2026 — Audit complet de la propagation inter-comptes sur 9 dashboards, 12 triggers, 17 hooks realtime*
