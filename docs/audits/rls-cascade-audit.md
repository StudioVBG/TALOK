# RLS Cascade Audit — Talok API Routes

> Audit transverse des routes API qui souffrent du même bug RLS silencieux que celui corrigé sur le module tickets dans la PR #499 (commits `71907d5`, `7518520`).
>
> **Date :** 2026-04-26
> **Périmètre :** factures, baux, propriétés, documents, paiements, work_orders, inspections.

---

## Résumé exécutif

**58 routes** présentent le même pattern à risque que celui qui causait le 404 sur `GET /api/v1/tickets/[id]`.

| Sévérité | Nombre |
|---|---|
| 🔴 Critique (404 silencieux probable, ou pas de check métier) | 28 |
| 🟠 Majeur (404 possible selon la cascade RLS) | 24 |
| 🟡 Mineur (théorique, dépend du chemin RLS) | 6 |

| Module | Routes à risque | Sévérité dominante |
|---|---|---|
| Leases | 18 | 🔴 |
| Properties | 10 | 🔴 |
| Documents | 9 | 🟠 |
| Work Orders | 7 | 🔴 (dont 1 sans aucun check métier) |
| Invoices | 3 | 🔴 (financier) |
| Payments | 2 | 🔴 (financier) |
| Inspections | 1 | 🟡 |

---

## Cause racine

Toutes les routes identifiées partagent ce schéma vulnérable :

```ts
// ❌ PATTERN À RISQUE
const supabase = await createClient();          // client RLS-aware (cookies)
const { data: resource } = await supabase
  .from("table")
  .select("*, relatedTable!inner(*)")           // jointure, RLS en cascade
  .eq("id", id)
  .single();                                    // 0 row si RLS bloque = silencieux

if (!resource) return 404;                      // indistinguable RLS-block vs row inexistante

// check métier ICI (trop tard si RLS a déjà bloqué)
if (resource.owner_id !== user.id) return 403;
```

**Pourquoi c'est dangereux :**

1. `createClient()` lie la session aux cookies → RLS active.
2. Les jointures `!inner` (ou cascadantes via `properties → leases → properties`) **amplifient** le risque : si la RLS bloque la table jointe, la row principale est filtrée.
3. `.single()` interprète "0 row" comme "non trouvé" → 404.
4. Le check métier après le SELECT n'est jamais atteint.

**Référence :** voir le commit `71907d5` pour le diagnostic et le fix sur le module tickets.

---

## Fix recommandé (réutilisable)

```ts
import { getServiceClient } from "@/lib/supabase/service-client";

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const supabase = getServiceClient();           // ✅ bypass RLS

    const { data: resource, error } = await supabase
      .from("resources")
      .select("*, relatedTable(*)")                // ✅ joins libres
      .eq("id", id)
      .maybeSingle();                              // ✅ null != 404

    if (error) return apiError("Erreur serveur", 500);
    if (!resource) return apiError("Non trouvé", 404);

    // ✅ check métier explicite, source de vérité de la sécurité
    const isAdmin = auth.profile.role === "admin";
    const isOwner = resource.owner_id === auth.profile.id;
    const isCreator = resource.created_by_profile_id === auth.profile.id;

    if (!isAdmin && !isOwner && !isCreator) {
      return apiError("Accès non autorisé", 403);
    }

    return apiSuccess({ resource });
  } catch (err) {
    return apiError("Erreur serveur", 500);
  }
}
```

**Règles à appliquer systématiquement :**
- `getServiceClient()` pour TOUS les SELECTs sur la ressource principale et ses relations.
- `createClient()` UNIQUEMENT pour `auth.getUser()` (lecture du cookie session).
- `.maybeSingle()` au lieu de `.single()` sur tout SELECT par id.
- Check métier explicite (creator / owner / assignee / admin) APRÈS le SELECT — c'est la garantie de sécurité quand on bypasse la RLS.
- Distinguer 404 (row inexistante) de 403 (existante mais non autorisée).

---

## Détail par module

### 🔴 Leases — 18 routes

| Fichier | Lignes | Sévérité | Check métier après SELECT ? |
|---|---|---|---|
| `app/api/v1/leases/route.ts` | 39-47 | 🔴 | Non |
| `app/api/v1/leases/[lid]/signature-sessions/route.ts` | 49 | 🔴 | Non |
| `app/api/v1/leases/[lid]/rent-invoices/route.ts` | 60, 90, 119, 144 | 🔴 | Non |
| `app/api/leases/[id]/meter-consumption/route.ts` | 46 | 🔴 | Non |
| `app/api/leases/[id]/signature-sessions/route.ts` | 46, 67 | 🔴 | Non |
| `app/api/leases/[id]/rent-invoices/route.ts` | 48, 69, 151 | 🔴 | Non |
| `app/api/leases/[id]/summary/route.ts` | 42, 89 | 🔴 | Partiel |
| `app/api/leases/[id]/pay/route.ts` | 81, 96, 181 | 🔴 | Non |
| `app/api/leases/[id]/visale/verify/route.ts` | 46, 59 | 🔴 | Non |
| `app/api/leases/[id]/cancel/route.ts` | 69, 82, 139 | 🔴 | Non |
| `app/api/leases/[id]/receipts/route.ts` | 26, 101, 109 | 🔴 | Non |
| `app/api/leases/[id]/autopay/route.ts` | 45, 58 | 🔴 | Non |
| `app/api/leases/[id]/terminate/route.ts` | 37, 50, 83 | 🔴 | Non |
| `app/api/leases/[id]/generate-receipt/route.ts` | 46, 60, 97, 114 | 🔴 | Non |
| `app/api/leases/[id]/punctuality/route.ts` | 34, 44, 59 | 🔴 | Non |
| `app/api/leases/[id]/deposit/route.ts` | 45, 58, 74, 90 | 🔴 | Non |
| `app/api/leases/[id]/deposit/refunds/route.ts` | 52, 65, 127 | 🔴 | Non |
| `app/api/leases/[id]/edl/route.ts` | 38, 52, 70 | 🔴 | Non |

**Pattern commun :**
```ts
const { data: lease } = await supabase
  .from("leases")
  .select("*, properties(*)")                    // cascade lease → property RLS
  .eq("id", leaseId)
  .single();
```

**Impact :** locataires/propriétaires incapables de consulter, payer ou gérer leurs propres baux.
**Difficulté :** triviale (même pattern à appliquer 18 fois).

---

### 🔴 Work Orders — 7 routes

| Fichier | Lignes | Sévérité | Note |
|---|---|---|---|
| `app/api/work-orders/[id]/route.ts` | 24-28 (GET) | 🔴 | **Aucun check métier après SELECT** |
| `app/api/work-orders/[id]/flow/route.ts` | 92, 110, 302 | 🔴 | State machine sans auth check |
| `app/api/work-orders/[id]/accept/route.ts` | 58, 91, 106 | 🟠 | `.eq("provider_id")` partiel |
| `app/api/work-orders/[id]/reject/route.ts` | 58, 91, 106 | 🟠 | Idem accept |
| `app/api/work-orders/[id]/complete/route.ts` | 59, 100, 124 | 🔴 | Pas de check après SELECT |
| `app/api/work-orders/[id]/reports/route.ts` | 36, 55, 108 | 🔴 | Reports sans auth |

**Cas le plus grave :** `app/api/work-orders/[id]/route.ts`

```ts
const { data: workOrder } = await supabase
  .from("work_orders")
  .select("*")
  .eq("id", id)
  .single();
return NextResponse.json({ workOrder });   // ❌ retourne le work_order sans aucun check
```

**Impact :** un prestataire ou un locataire pourrait théoriquement énumérer et lire des work_orders d'autres propriétés (selon la RLS, mais c'est un bug d'architecture indépendamment).
**Priorité :** **CRITIQUE — à fixer en premier.**

---

### 🔴 Properties — 10 routes

| Fichier | Lignes | Sévérité |
|---|---|---|
| `app/api/v1/properties/[pid]/route.ts` | 32-46 | 🔴 |
| `app/api/v1/properties/route.ts` | 140 | 🔴 |
| `app/api/owner/properties/route.ts` | 36 | 🔴 |
| `app/api/properties/[id]/units/route.ts` | 48, 61, 82, 100 | 🔴 |
| `app/api/properties/[id]/meters/[meterId]/route.ts` | 33, 88, 98 | 🔴 |
| `app/api/properties/[id]/invitations/route.ts` | 42, 55, 104 | 🔴 |
| `app/api/properties/[id]/invitations/[iid]/route.ts` | 31, 44, 61, 82 | 🔴 |
| `app/api/properties/init/route.ts` | 69, 184 | 🔴 |
| `app/api/properties/diagnostic/route.ts` | 74 | 🔴 |
| `app/api/agency/properties/route.ts` | 26 | 🔴 |

**Pattern :**
```ts
const { data: property } = await supabase
  .from("properties")
  .select("*,units(*),leases(*,lease_signers(*,profiles(*))),documents(*),tickets(*),meters(*)")
  .eq("id", pid)
  .single();
// check après — n'est jamais atteint si la RLS bloque
```

---

### 🔴 Invoices — 3 routes (financier)

| Fichier | Lignes | Sévérité |
|---|---|---|
| `app/api/v1/invoices/[iid]/payments/route.ts` | 67-77, 99-125 | 🔴 |

**Pattern :**
```ts
const { data: invoice } = await supabase
  .from("invoices")
  .select(`*, leases!inner(id, properties!inner(adresse_complete))`)
  .eq("id", iid)
  .single();   // silencieux si RLS bloque la chaîne invoice → lease → property
```

**Impact :** échec création de PaymentIntent → locataires bloqués pour payer.
**Priorité :** **CRITIQUE — financier.**

---

### 🔴 Payments — 2 routes (financier)

| Fichier | Lignes | Sévérité | Note |
|---|---|---|---|
| `app/api/payments/checkout/route.ts` | 69-83 | 🔴 | `.eq("tenant_id")` après cascade RLS |
| `app/api/payments/setup-intent/route.ts` | 39-43 | 🟡 | `.single()` sur profiles seulement |

**Impact :** échecs de checkout Stripe pour des paiements locataires valides.

---

### 🟠 Documents — 9 routes

| Fichier | Lignes | Sévérité |
|---|---|---|
| `app/api/v1/documents/[did]/route.ts` | 31-35 | 🔴 |
| `app/api/v1/documents/route.ts` | 116, 135 | 🔴 |
| `app/api/accounting/documents/[id]/validate/route.ts` | 42, 59 | 🔴 |
| `app/api/accounting/documents/[id]/analysis/route.ts` | 29 | 🔴 |
| `app/api/accounting/documents/analyze/route.ts` | 42, 61, 110, 185 | 🔴 |
| `app/api/documents/[id]/download/route.ts` | 23, 79 | 🔴 |
| `app/api/documents/search/route.ts` | 33 | 🔴 |

**Pattern :**
```ts
const { data: document } = await supabase
  .from("documents")
  .select("*, properties!inner(owner_id)")     // RLS sur properties peut bloquer
  .eq("id", did)
  .single();
```

---

### 🟡 Inspections — 1 route

| Fichier | Lignes | Sévérité |
|---|---|---|
| `app/api/inspections/[iid]/photos/route.ts` | 97, 123, 184, 255 | 🟡 |

Note : `app/api/inspections/[iid]/close/route.ts` utilise déjà `getServiceClient()`. La route `photos` devrait être alignée pour cohérence.

---

## Priorisation recommandée

### Phase 1 — CRITIQUE (cette semaine)
1. **`app/api/work-orders/[id]/route.ts`** — aucun check métier, fuite potentielle de données
2. **`app/api/payments/checkout/route.ts`** — financier, échecs de paiement
3. **`app/api/v1/invoices/[iid]/payments/route.ts`** — financier, PaymentIntent

### Phase 2 — URGENT (sprint courant)
4. Module **leases** (18 routes) — paiements, résiliations, dépôts de garantie
5. Module **properties** (10 routes) — accès aux ressources principales

### Phase 3 — HIGH (sprint suivant)
6. Module **documents** (9 routes) — contrôle d'accès aux fichiers
7. **`app/api/work-orders`** routes restantes (flow, complete, reports)
8. **Inspections** (1 route, alignement)

---

## Notes sur les helpers RLS SQL

Audit des migrations SQL :
- `public.user_profile_id()` — défini, utilisé par tickets
- `public.tenant_accessible_ticket_ids()` — défini, utilisé par tickets uniquement
- `public.tenant_ticketable_property_ids()` — défini, utilisé par tickets uniquement

**Aucun équivalent `owner_accessible_lease_ids()`, `tenant_accessible_invoice_ids()`, etc.** Les autres modules s'appuient entièrement sur le filtrage côté query (cascade `properties → leases → ...`) qui est précisément ce qui casse silencieusement.

Si on souhaite garder la RLS comme défense en profondeur, il faudrait créer ces helpers SECURITY DEFINER pour chaque module — sinon le pattern service-role + check métier explicite reste la voie la plus simple et la plus testable.

---

## Stratégie de test

Pour chaque route corrigée, ajouter une suite minimale :

```ts
describe("RLS cascade fix - Resource API", () => {
  it("returns 404 for a non-existent id", async () => {
    expect(await GET("00000000-0000-0000-0000-000000000000")).toMatchStatus(404);
  });

  it("returns 403 for another owner's resource", async () => {
    // login as owner1
    expect(await GET(owner2.resource_id)).toMatchStatus(403);
  });

  it("returns 200 for own resource", async () => {
    // login as owner1
    expect(await GET(owner1.resource_id)).toMatchStatus(200);
  });

  it("returns 200 for admin on any resource", async () => {
    // login as admin
    expect(await GET(owner1.resource_id)).toMatchStatus(200);
  });
});
```

---

## Validation pour reviewers

À chaque route corrigée, vérifier que :

- [ ] `getServiceClient()` est utilisé pour tous les SELECTs sur la ressource
- [ ] `createClient()` n'est utilisé que pour `auth.getUser()`
- [ ] `.maybeSingle()` remplace `.single()` sur les lookups par id
- [ ] Le check métier explicite (creator / owner / assignee / admin) suit le SELECT
- [ ] 404 et 403 sont distincts dans les retours
- [ ] Tests : own (allow), other (deny), admin (allow), inexistante (404)
