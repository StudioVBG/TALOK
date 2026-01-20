# Audit Connexions Backend/Frontend - TALOK
Date: 2026-01-20
Auditeur: Claude Opus 4.5
Version: 1.0

## Resume Executif

| Metrique | Valeur |
|----------|--------|
| **Total routes API** | 153+ |
| **Server Actions** | 5 fichiers |
| **Appels fetch frontend** | 100+ |
| **Schemas de validation** | 100+ fichiers (Zod) |
| **Hooks de donnees (React Query)** | 15+ hooks |
| **Score global** | **72/100** |

### Repartition du Score

| Categorie | Score | Poids |
|-----------|-------|-------|
| Architecture | 85/100 | 25% |
| Securite | 65/100 | 30% |
| Performance | 70/100 | 25% |
| Qualite de Code | 75/100 | 20% |

---

## 1. POINTS FORTS

### 1.1 Architecture

- **Organisation claire des routes API** : Structure modulaire dans `app/api/` suivant les conventions Next.js 14+
- **Separation des responsabilites** : Services dedies (`features/*/services/`), hooks (`lib/hooks/`), validations (`lib/validations/`)
- **Server Actions** : 5 fichiers identiques pour les actions serveur (leases, money, properties, invoices, tickets)
- **Middleware de souscription** : `withSubscriptionLimit()` pour gerer les quotas par plan (SOTA 2026)
- **Pattern outbox** : Utilisation coherente de la table `outbox` pour les evenements asynchrones

### 1.2 Securite

- **Authentification centralisee** : Helper `getAuthenticatedUser()` dans `lib/helpers/auth-helper.ts`
- **Verification de role** : Middleware `requireAdmin()` et verification explicite des roles
- **Validation systematique** : Schemas Zod pour toutes les entrees (100+ schemas)
- **Gestion des erreurs standardisee** : `handleApiError()` avec codes HTTP appropries
- **RLS Supabase** : Utilisation de Row Level Security pour la plupart des tables
- **CRON_SECRET_KEY** : Protection des routes cron par cle secrete

### 1.3 Performance

- **React Query** : Cache intelligent avec staleTime (5min) et gcTime (10min)
- **Pagination** : Implementee sur la plupart des routes de liste
- **Cache headers** : `Cache-Control: private, max-age=60, stale-while-revalidate=120`
- **Timeout management** : Timeouts configures sur les routes critiques (maxDuration)
- **Prefetch** : Hook `usePrefetch()` pour le pre-chargement des donnees

### 1.4 Qualite de Code

- **TypeScript strict** : Types bien definis dans `lib/supabase/database.types.ts`
- **Schemas de validation** : Zod avec messages d'erreur en francais
- **Hooks personnalises** : `useApiQuery`, `useApiMutation`, `usePaginatedQuery`
- **Constants centralisees** : `lib/constants/roles.ts` pour les roles et statuts
- **Query keys structurees** : Pattern `queryKeys` pour la gestion du cache React Query

---

## 2. POINTS FAIBLES

### 2.1 Critiques (Bloquants)

| Probleme | Fichier | Ligne | Impact | Solution |
|----------|---------|-------|--------|----------|
| Webhook signature non verifiee | `app/api/signatures/webhook/route.ts` | 17-21 | **CRITIQUE** - Faille de securite majeure | Implementer `verifyWebhookSignature()` (code commente) |
| CORS permissif (`*`) | `lib/api/middleware.ts` | 155 | **CRITIQUE** - Permet requetes cross-origin | Configurer domaines autorises explicitement |
| Rate limiting en memoire | `lib/api/middleware.ts` | 208-229 | **CRITIQUE** - Non persistant, contournable | Utiliser Redis ou Upstash pour le rate limiting |

### 2.2 Majeurs (A corriger rapidement)

| Probleme | Fichier | Ligne | Impact | Solution |
|----------|---------|-------|--------|----------|
| N+1 query | `app/api/agency/properties/route.ts` | 104-118 | Performance degradee | Utiliser une jointure ou batch query |
| Service role expose en frontend potentiel | `lib/server/service-role-client.ts` | 9 | Securite | S'assurer que ce client n'est jamais importe cote client |
| Pas de validation query params sur certaines routes | `app/api/tenants/route.ts` | 39-46 | Injection potentielle | Utiliser `validateQueryParams()` |
| Recherche cote client | `app/api/tenants/route.ts` | 203-213 | Performance | Deplacer la recherche cote serveur |
| Cast `as any` excessifs | Multiple routes | - | Type safety | Definir des types stricts |

### 2.3 Mineurs (Ameliorations)

| Probleme | Fichier | Ligne | Impact | Solution |
|----------|---------|-------|--------|----------|
| Console.error sans structure | Multiple | - | Debug difficile | Utiliser un logger structure (Pino/Winston) |
| Pas de retry automatique | Frontend fetch calls | - | UX degradee | Ajouter retry avec backoff exponentiel |
| Manque de documentation OpenAPI | `app/api/` | - | DX | Generer specs OpenAPI |
| Pas de health check | - | - | Monitoring | Ajouter `/api/health` |
| Timeouts hardcodes | Multiple | - | Maintenabilite | Externaliser dans config |

---

## 3. RECOMMANDATIONS D'AMELIORATION

### 3.1 Quick Wins (< 1 jour)

| # | Amelioration | Fichier(s) | Effort |
|---|--------------|-----------|--------|
| 1 | Implementer verification webhook Yousign | `app/api/signatures/webhook/route.ts` | 2h |
| 2 | Configurer CORS avec domaines specifiques | `lib/api/middleware.ts` | 1h |
| 3 | Ajouter route `/api/health` | Nouveau fichier | 30min |
| 4 | Valider query params sur `/api/tenants` | `app/api/tenants/route.ts` | 1h |
| 5 | Ajouter retry sur hooks React Query | `lib/hooks/use-api.ts` | 1h |

#### Code: Verification webhook Yousign

```typescript
// app/api/signatures/webhook/route.ts
import crypto from 'crypto';

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET;
  if (!secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Dans POST handler:
const rawBody = await request.text();
const body = JSON.parse(rawBody);
const signature = request.headers.get("yousign-signature");

if (!verifyWebhookSignature(rawBody, signature)) {
  return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
}
```

### 3.2 Moyen Terme (1-5 jours)

| # | Amelioration | Fichier(s) | Effort |
|---|--------------|-----------|--------|
| 1 | Migrer rate limiting vers Redis/Upstash | `lib/api/middleware.ts` | 1-2j |
| 2 | Corriger N+1 queries | `app/api/agency/properties/route.ts` + autres | 2j |
| 3 | Ajouter logger structure | Creer `lib/logger.ts` | 1j |
| 4 | Generer documentation OpenAPI | - | 2j |
| 5 | Implementer circuit breaker pour services externes | - | 2j |

#### Code: Correction N+1 Query

```typescript
// app/api/agency/properties/route.ts - AVANT (N+1)
const propertiesWithLeases = await Promise.all(
  (properties || []).map(async (property) => {
    const { data: lease } = await supabase
      .from("leases")
      .select("id, loyer, charges_forfaitaires, statut, date_debut")
      .eq("property_id", property.id)
      .eq("statut", "active")
      .single();
    return { ...property, active_lease: lease || null };
  })
);

// APRES (Batch query)
const propertyIds = (properties || []).map(p => p.id);
const { data: leases } = await supabase
  .from("leases")
  .select("id, property_id, loyer, charges_forfaitaires, statut, date_debut")
  .in("property_id", propertyIds)
  .eq("statut", "active");

const leaseMap = new Map(leases?.map(l => [l.property_id, l]) || []);
const propertiesWithLeases = (properties || []).map(property => ({
  ...property,
  active_lease: leaseMap.get(property.id) || null,
}));
```

### 3.3 Refactoring (> 5 jours)

| # | Amelioration | Scope | Effort |
|---|--------------|-------|--------|
| 1 | Creer couche API gateway | Architecture globale | 2 semaines |
| 2 | Implementer CQRS pour queries complexes | Backend | 2 semaines |
| 3 | Migration vers tRPC pour type-safety E2E | Backend + Frontend | 3 semaines |
| 4 | Ajouter tests d'integration API | Tests | 1-2 semaines |

---

## 4. MATRICE DES ROUTES API

### Routes Principales

| Route | Methodes | Validation | Auth | Erreurs | Types | Score |
|-------|----------|------------|------|---------|-------|-------|
| `/api/properties` | GET, POST | Zod | Cookie/Bearer | handleApiError | Partiel | 8/10 |
| `/api/properties/[id]` | GET, PATCH, DELETE | Zod | Cookie/Bearer | handleApiError | Partiel | 8/10 |
| `/api/leases` | GET, POST | Zod (LeaseCreateSchema) | Cookie/Bearer | handleApiError | Bon | 9/10 |
| `/api/leases/[id]` | GET, PATCH, DELETE | Partiel | Cookie/Bearer | handleApiError | Partiel | 7/10 |
| `/api/tenants` | GET | Aucune | Cookie | handleApiError | Partiel | 6/10 |
| `/api/tickets` | GET, POST | Zod (ticketSchema) | Cookie/Bearer | handleApiError | Bon | 8/10 |
| `/api/documents/upload` | POST | Zod | Cookie | handleApiError | Bon | 8/10 |
| `/api/signatures/webhook` | POST | Aucune | Webhook (KO) | Try/catch | Faible | 4/10 |

### Routes CRON

| Route | Methodes | Auth | Score |
|-------|----------|------|-------|
| `/api/cron/generate-invoices` | GET | CRON_SECRET_KEY | 7/10 |
| `/api/cron/generate-monthly-invoices` | GET | CRON_SECRET_KEY | 7/10 |
| `/api/cron/lease-expiry-alerts` | GET | CRON_SECRET_KEY | 7/10 |
| `/api/cron/irl-indexation` | GET | CRON_SECRET_KEY | 7/10 |
| `/api/cron/check-cni-expiry` | GET | CRON_SECRET_KEY | 7/10 |

### Routes Admin

| Route | Methodes | Validation | Auth | Score |
|-------|----------|------------|------|-------|
| `/api/admin/subscriptions/override` | POST | Zod | Admin role | 9/10 |
| `/api/admin/subscriptions/gift` | POST | Zod | Admin role | 9/10 |
| `/api/admin/impersonate` | GET, DELETE | - | Admin role | 8/10 |

**Legende:** Bon | Partiel | Faible | Aucune

---

## 5. MATRICE DES APPELS FRONTEND

### Hooks React Query

| Hook | Endpoint | Loading | Error | Cache | Types | Score |
|------|----------|---------|-------|-------|-------|-------|
| `usePropertyApi` | `/api/properties` | React Query | Toast | 5min stale | Partiel | 8/10 |
| `useInvoiceApi` | `/api/invoices` | React Query | Toast | 5min stale | Partiel | 8/10 |
| `useTicketApi` | `/api/tickets` | React Query | Toast | 5min stale | Partiel | 8/10 |
| `usePayments` | `/api/payments` | React Query | Toast | 5min stale | Bon | 9/10 |
| `useDocuments` | `/api/documents` | React Query | Toast | 5min stale | Bon | 9/10 |
| `usePaginatedQuery` | Variable | React Query | State | Configurable | Generique | 9/10 |

### Appels Directs (sans hook)

| Composant | Endpoint | Loading | Error | Cache | Score |
|-----------|----------|---------|-------|-------|-------|
| `NotificationBell` | `/api/notifications` | useState | Try/catch | Non | 6/10 |
| `SecuritySettings` | `/api/auth/2fa/*` | useState | Try/catch | Non | 6/10 |
| `PaymentCheckout` | `/api/payments/create-intent` | useState | Try/catch | Non | 7/10 |
| `AssistantPanel` | `/api/assistant` | useState | Try/catch | Non | 6/10 |

---

## 6. DETTE TECHNIQUE

### 6.1 Code duplique

| Pattern | Fichiers | Description |
|---------|----------|-------------|
| Auth check | 50+ routes | `getAuthenticatedUser` + profile query repete |
| Service client creation | 30+ routes | Creation dynamique du service client |
| Error handling | 20+ routes | Pattern try/catch similaire |
| Pagination | 15+ routes | Calcul offset/limit duplique |

**Recommandation:** Creer un middleware unifie pour auth + profile + pagination

### 6.2 Types incohérents

| Type | Localisation | Probleme |
|------|--------------|----------|
| `any` | Multiple routes | Cast explicite `as any` sur 50+ lignes |
| Profile | Routes API | Interface `Profile` redéfinie localement |
| Supabase response | Hooks | Types generiques non stricts |

### 6.3 Patterns obsolètes

| Pattern | Localisation | Remplacement |
|---------|--------------|--------------|
| `fetch()` direct | 30+ composants | Utiliser hooks React Query |
| Console.log/error | 100+ occurrences | Logger structure |
| Hardcoded timeouts | 10+ routes | Configuration centralisee |

---

## 7. PLAN D'ACTION PRIORISE

### Sprint 1 (Urgent - Securite)

- [ ] **SEC-001**: Implementer verification webhook Yousign
- [ ] **SEC-002**: Configurer CORS avec whitelist de domaines
- [ ] **SEC-003**: Migrer rate limiting vers Redis/Upstash
- [ ] **SEC-004**: Audit des routes sans validation de query params

### Sprint 2 (Important - Performance)

- [ ] **PERF-001**: Corriger N+1 queries (agency/properties, etc.)
- [ ] **PERF-002**: Ajouter pagination sur routes manquantes
- [ ] **PERF-003**: Implementer retry avec backoff exponentiel
- [ ] **PERF-004**: Ajouter indexes Supabase manquants

### Sprint 3 (Qualite)

- [ ] **QA-001**: Implementer logger structure (Pino)
- [ ] **QA-002**: Ajouter tests d'integration API
- [ ] **QA-003**: Generer documentation OpenAPI
- [ ] **QA-004**: Refactoriser types `any` en types stricts

### Backlog

- [ ] **ARCH-001**: Evaluer migration vers tRPC
- [ ] **ARCH-002**: Implementer circuit breaker
- [ ] **ARCH-003**: Ajouter observabilite (traces, metrics)
- [ ] **DX-001**: Creer SDK client type-safe

---

## 8. ANNEXES

### A. Liste complete des routes API

```
app/api/
├── accounting/
│   ├── entries/[id]/reverse/route.ts
│   ├── entries/[id]/route.ts
│   ├── entries/route.ts
│   ├── entries/validate/route.ts
│   ├── exports/route.ts
│   └── reconciliation/[id]/match/route.ts
├── admin/
│   ├── analytics/age/route.ts
│   ├── impersonate/route.ts
│   ├── people/owners/[id]/properties/route.ts
│   ├── properties/[id]/tenants/route.ts
│   └── subscriptions/
│       ├── gift/route.ts
│       ├── list/route.ts
│       ├── override/route.ts
│       ├── stats/route.ts
│       ├── suspend/route.ts
│       └── unsuspend/route.ts
├── agency/
│   ├── commissions/route.ts
│   ├── dashboard/route.ts
│   ├── mandates/route.ts
│   ├── profile/route.ts
│   └── properties/route.ts
├── assistant/
│   ├── route.ts
│   └── threads/route.ts
├── charges/route.ts
├── copro/
│   ├── assemblies/[assemblyId]/route.ts
│   ├── assemblies/route.ts
│   ├── buildings/route.ts
│   ├── charges/route.ts
│   ├── invites/route.ts
│   ├── sites/[siteId]/route.ts
│   ├── sites/route.ts
│   └── units/route.ts
├── cron/
│   ├── check-cni-expiry/route.ts
│   ├── generate-invoices/route.ts
│   ├── generate-monthly-invoices/route.ts
│   ├── irl-indexation/route.ts
│   ├── lease-expiry-alerts/route.ts
│   ├── notifications/route.ts
│   ├── onboarding-reminders/route.ts
│   ├── refresh-analytics/route.ts
│   └── visit-reminders/route.ts
├── documents/
│   ├── [id]/copy-link/route.ts
│   ├── [id]/download/route.ts
│   ├── [id]/reorder/route.ts
│   ├── [id]/route.ts
│   ├── [id]/signed-url/route.ts
│   ├── check/route.ts
│   ├── download/route.ts
│   ├── search/route.ts
│   ├── upload/route.ts
│   ├── upload-batch/route.ts
│   └── view/route.ts
├── edl/
│   ├── [id]/invite/route.ts
│   ├── [id]/meter-readings/[readingId]/route.ts
│   ├── [id]/route.ts
│   ├── [id]/sections/route.ts
│   ├── [id]/sign/route.ts
│   ├── pdf/route.ts
│   └── preview/route.ts
├── end-of-lease/
│   ├── [id]/compare/route.ts
│   ├── [id]/dg/retention/route.ts
│   ├── [id]/edl-out/route.ts
│   ├── [id]/inspection/route.ts
│   ├── [id]/renovation/estimate/route.ts
│   ├── [id]/renovation/timeline/route.ts
│   ├── [id]/route.ts
│   ├── renovation/devis/route.ts
│   ├── route.ts
│   └── trigger/route.ts
├── invoices/
│   └── generate-monthly/route.ts
├── invites/
│   ├── [id]/resend/route.ts
│   └── route.ts
├── leases/
│   ├── [id]/activate/route.ts
│   ├── [id]/autopay/route.ts
│   ├── [id]/deposit/refund/route.ts
│   ├── [id]/deposit/refunds/route.ts
│   ├── [id]/deposit/route.ts
│   ├── [id]/documents/route.ts
│   ├── [id]/edl/route.ts
│   ├── [id]/html/route.ts
│   ├── [id]/initiate-signature/route.ts
│   ├── [id]/meter-consumption/route.ts
│   ├── [id]/notice/letter/route.ts
│   ├── [id]/notice/route.ts
│   ├── [id]/pay/route.ts
│   ├── [id]/payment-shares/route.ts
│   ├── [id]/pdf/route.ts
│   ├── [id]/pdf-signed/route.ts
│   ├── [id]/receipts/route.ts
│   ├── [id]/regularization/route.ts
│   ├── [id]/renew/route.ts
│   ├── [id]/rent-invoices/route.ts
│   ├── [id]/roommates/route.ts
│   ├── [id]/route.ts
│   ├── [id]/seal/route.ts
│   ├── [id]/sign/route.ts
│   ├── [id]/signature-sessions/route.ts
│   ├── [id]/signers/[signerId]/resend/route.ts
│   ├── [id]/signers/[signerId]/route.ts
│   ├── [id]/signers/route.ts
│   ├── [id]/summary/route.ts
│   ├── [id]/terminate/route.ts
│   ├── [id]/visale/verify/route.ts
│   ├── invite/route.ts
│   └── route.ts
├── listings/
│   ├── publish/route.ts
│   └── unpublish/route.ts
├── me/occupants/route.ts
├── meters/readings/route.ts
├── notifications/
│   ├── preferences/route.ts
│   ├── push/send/route.ts
│   ├── push/subscribe/route.ts
│   └── sms/send/route.ts
├── payments/
│   ├── create-intent/route.ts
│   └── setup-sepa/route.ts
├── pricing/reference/route.ts
├── privacy/
│   ├── anonymize/cascade/route.ts
│   ├── anonymize/route.ts
│   └── export/route.ts
├── properties/
│   ├── [id]/features/bulk/route.ts
│   ├── [id]/status/route.ts
│   ├── init/route.ts
│   └── route.ts
├── provider/
│   ├── invoices/[id]/payments/route.ts
│   ├── invoices/route.ts
│   ├── jobs/[id]/status/route.ts
│   ├── portfolio/[id]/route.ts
│   ├── portfolio/route.ts
│   └── quotes/route.ts
├── quotes/
│   ├── [id]/accept/route.ts
│   └── [id]/reject/route.ts
├── scrape/route.ts
├── signatures/
│   ├── requests/[id]/route.ts
│   ├── requests/[id]/validate/route.ts
│   ├── requests/route.ts
│   ├── sessions/[sid]/route.ts
│   └── webhook/route.ts
├── subscriptions/cancel/route.ts
├── tenant/profile/route.ts
├── tenant-applications/
│   ├── [id]/draft-lease/route.ts
│   └── route.ts
├── tenants/
│   ├── [id]/route.ts
│   └── route.ts
├── threads/route.ts
├── tickets/
│   ├── [id]/ai-draft/route.ts
│   ├── [id]/history/route.ts
│   ├── [id]/invoices/route.ts
│   ├── [id]/messages/route.ts
│   ├── [id]/quotes/[qid]/approve/route.ts
│   ├── [id]/quotes/[qid]/reject/route.ts
│   ├── [id]/quotes/route.ts
│   ├── [id]/route.ts
│   ├── [id]/status/route.ts
│   └── route.ts
├── unified-chat/conversations/
│   ├── [id]/messages/route.ts
│   └── route.ts
├── units/
│   ├── [id]/code/route.ts
│   ├── [id]/leases/route.ts
│   ├── [id]/members/[mid]/route.ts
│   ├── [id]/route.ts
│   ├── _temp_id_leases/route.ts
│   ├── _temp_id_members/route.ts
│   └── route.ts
├── verification/tax-notice/route.ts
├── vigilance/check/route.ts
├── voice/transcribe/route.ts
└── work-orders/[id]/flow/route.ts
```

### B. Schemas de validation principaux

| Schema | Fichier | Entites validees |
|--------|---------|------------------|
| `propertySchema` | `lib/validations/index.ts` | Properties (legacy) |
| `propertySchemaV3` | `lib/validations/property-v3.ts` | Properties (V3) |
| `leaseSchema` | `lib/validations/index.ts` | Leases |
| `LeaseCreateSchema` | `lib/validations/lease-financial.ts` | Lease creation |
| `ticketSchema` | `lib/validations/index.ts` | Tickets |
| `invoiceSchema` | `lib/validations/index.ts` | Invoices |
| `paymentSchema` | `lib/validations/index.ts` | Payments |
| `chargeSchema` | `lib/validations/index.ts` | Charges |
| `documentSchema` | `lib/validations/index.ts` | Documents |
| `profileSchema` | `lib/validations/index.ts` | Profiles |
| `ownerProfileSchema` | `lib/validations/index.ts` | Owner profiles |
| `tenantProfileSchema` | `lib/validations/index.ts` | Tenant profiles |
| `providerProfileSchema` | `lib/validations/index.ts` | Provider profiles |

### C. Hooks de donnees

| Hook | Fichier | Fonctionnalites |
|------|---------|-----------------|
| `usePropertyApi` | `lib/hooks/use-api.ts` | CRUD properties |
| `useInvoiceApi` | `lib/hooks/use-api.ts` | List, markPaid, sendReminder |
| `useTicketApi` | `lib/hooks/use-api.ts` | CRUD tickets |
| `usePayments` | `lib/hooks/use-payments.ts` | Payments + sepa |
| `useDocuments` | `lib/hooks/use-documents.ts` | CRUD documents |
| `useLeases` | `lib/hooks/use-leases.ts` | CRUD leases |
| `useRooms` | `lib/hooks/use-rooms.ts` | CRUD rooms |
| `usePhotos` | `lib/hooks/use-photos.ts` | CRUD photos |
| `usePaginatedQuery` | `lib/hooks/use-paginated-query.ts` | Pagination generique |
| `useMutationWithToast` | `lib/hooks/use-mutation-with-toast.ts` | Mutations + toast |
| `useAuth` | `lib/hooks/use-auth.ts` | Auth state |
| `useNotifications` | `lib/hooks/use-notifications.ts` | Notifications |
| `useRealtimeTenant` | `lib/hooks/use-realtime-tenant.ts` | Realtime Supabase |
| `useRealtimeDashboard` | `lib/hooks/use-realtime-dashboard.ts` | Realtime dashboard |

---

## 9. Conclusion

L'application TALOK presente une architecture backend/frontend solide avec des patterns modernes (Next.js 14+, React Query, Zod). Les principales forces sont la validation systematique et l'organisation modulaire du code.

**Actions prioritaires:**
1. **Securite immediate**: Corriger la verification webhook et le CORS
2. **Performance**: Eliminer les N+1 queries identifiees
3. **Monitoring**: Ajouter logging structure et health checks

Le score de 72/100 peut etre ameliore a 85+ en addressant les points critiques identifies dans ce rapport.

---

*Rapport genere automatiquement - TALOK Audit v1.0*
