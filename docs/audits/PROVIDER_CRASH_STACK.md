# PROVIDER_CRASH_STACK — Diagnostic crash `/provider/dashboard`

**Date audit** : 2026-04-20
**Branche** : `claude/fix-provider-dashboard-crash-sE6Pb`
**Symptôme prod** : `https://talok.fr/provider/dashboard` → error boundary **"Oups ! Une erreur est survenue"**

---

## 1. Identification de la boundary

Le texte **"Oups ! Une erreur est survenue"** provient de `app/error.tsx:41` (recherche Grep — 1 seul fichier match). C'est la boundary **racine** de l'App Router Next.js.

### Hiérarchie Next.js App Router

```
app/
  error.tsx                              ← racine — fires si layout.tsx ou sibling throw
  layout.tsx
  provider/
    error.tsx                            ← "Erreur dans votre espace Prestataire"
    layout.tsx                           ← SSR, await getUser() + getServerProfile()
    dashboard/
      error.tsx                          ← DashboardError wrapper
      page.tsx                           ← "use client" — fetch /api/provider/dashboard
```

**Règle Next.js** : un `error.tsx` ne peut **pas** catcher les erreurs de son propre `layout.tsx` ni de lui-même. Il remonte au parent.

Conséquence : quand l'utilisateur voit `"Oups ! Une erreur est survenue"` (et non `"Erreur dans votre espace Prestataire"`), **l'erreur vient du layout provider ou d'un ancêtre**, pas de `dashboard/page.tsx`.

---

## 2. Chaînes suspectes dans le layout

`app/provider/layout.tsx` exécute en série :

```ts
const supabase = await createClient();                                  // OK
const { data: { user } } = await supabase.auth.getUser();              // OK (getUser ne throw qu'en cas réseau)
const { profile } = await getServerProfile<...>(user.id, "...");       // catch interne
if (!profile || profile.role !== "provider") redirect(...);            // redirect() throw NEXT_REDIRECT (attendu)
const pathname = headers().get("x-pathname") || "/provider";           // sync en Next 14.0.4
checkIdentityGate(pathname, profile.role, profile.identity_status);    // peut throw NEXT_REDIRECT (attendu)
```

Points de rupture potentiels :

| # | Cause | Probabilité | Commentaire |
|---|---|---|---|
| A | Composants layout client (`ProviderSidebar`, `ProviderRailNav`, `ProviderBottomNav`) throw pendant SSR | Moyenne | `"use client"` mais SSR-rendered → throw en hydration remonte à `error.tsx` racine |
| B | `getServerProfile` retourne `profile=null` → `redirect(getRoleDashboardUrl(undefined))` → redirige vers `/auth/signin` → pas un crash | Faible | OK par design |
| C | `checkIdentityGate` avec `identity_status` NULL → traite comme `"unverified"` → redirect `/onboarding/phone` | Faible | Redirect, pas crash |
| D | Migration `20260401000000_add_identity_status_...` non appliquée en prod → colonne manquante → `getServerProfile` retourne erreur → fallback service role → même erreur → `profile=null` → redirect sans crash | Faible | OK par design, mais à vérifier |

**A** est la piste la plus crédible si l'erreur est régulière en prod.

---

## 3. Bugs logiques dans `/api/provider/dashboard/route.ts` (bloquent l'UX même si pas crash layout)

### 3.1 Colonne erronée sur `provider_reviews` (fallback)

Ligne 60 :
```ts
.eq("provider_id", profile.id)  // ❌ colonne inexistante
```

La table `provider_reviews` a `provider_profile_id` (voir `PROVIDER_SCHEMA_AUDIT.md`).

**Comportement** : Supabase renvoie `error.code = "PGRST204"` ou `42703` ("column does not exist"). Le `Promise.allSettled` masque l'erreur → `reviews = []`. Stats `avg_rating` fausses mais pas de crash.

### 3.2 Filtre `statut` avec valeurs fantômes (fallback)

Lignes 72 & 90 :
```ts
["pending", "accepted", "scheduled"].includes(wo.statut)  // ❌
```

Valeurs légales : `assigned | scheduled | in_progress | done | cancelled`. "pending" et "accepted" n'existent pas → seules les lignes `scheduled` matchent.

**Comportement** : KPI `pending_interventions` sous-estimé. Pas de crash.

### 3.3 Shape `pending_orders` incompatible avec le composant (fallback)

Le composant `page.tsx:49-62` type :
```ts
interface PendingOrder {
  property: { adresse: string; ville: string }
  ticket: { titre: string; priorite: string }
}
```

Le fallback renvoie des lignes Supabase brutes avec `property: { adresse_complete, ville }`. Si la RPC tombe et la fallback renvoie des items, le composant accède à `order.property.adresse` → `undefined` (soft).
**Si `order.ticket` ou `order.property` est `null`** (RLS bloquée) : `order.ticket.titre` → **TypeError → crash côté client → boundary `dashboard/error.tsx` ou racine**.

### 3.4 Client Supabase RLS-scopé pour queries privilégiées

```ts
const serviceClient = getServiceClient();  // utilisé uniquement pour profile check
// …
const [workOrdersResult, reviewsResult] = await Promise.allSettled([
  supabase.from("work_orders")…   // ❌ user-authed client
]);
```

La règle Talok exige `getServiceClient()` pour tous les reads SSR/API (éviter 42P17 résiduels et "row not found"). Le profile check utilise déjà `serviceClient` — incohérent avec le reste.

---

## 4. Hypothèse racine retenue

Par ordre de vraisemblance :

1. **H1 — Fallback du dashboard crashe le composant client** (MOYEN-ÉLEVÉ)
   Si la RPC `provider_dashboard` échoue (e.g. index manquant, erreur planner sur prod), le fallback retourne des objets avec `order.ticket` null (car RLS tickets ne matche pas pour le prestataire sur un work_order standalone / orphan) → `order.ticket.titre` throw → hors try/catch → remonte `error.tsx` racine. **Corrige prioritairement.**

2. **H2 — RPC `provider_dashboard` retourne NULL silencieusement** (MOYEN)
   Si `v_profile_id IS NULL` dans la fonction, retour NULL → API retourne `null` → `!data` catch → Alert UI. Pas de crash racine.

3. **H3 — Recursion 42P17 sur `properties` ou `profiles`** (FAIBLE)
   Les policies récentes (`20260418130000`) mitigent, mais si la migration n'est pas appliquée en prod, le crash peut venir d'ici.

4. **H4 — Hydratation client composant layout** (FAIBLE-MOYEN)
   Divergence SSR/client sur un composant (e.g. `useAuth()` qui retourne des infos différentes avant/après hydration).

---

## 5. Reproduction locale (à exécuter)

```bash
npm install
npm run dev
# Se connecter comme provider test
# Ouvrir /provider/dashboard
# DevTools Network : voir la réponse de /api/provider/dashboard (status + JSON)
# Console : noter la stack exacte
```

**Éléments à capturer** :
- Status HTTP `/api/provider/dashboard` : 200/500 ?
- Body de la réponse : `null`, `{}`, `{stats:…}` ?
- Si 500, log Supabase côté API : code Postgres (42P17, PGRST204, …)
- Stack exacte React côté client

À documenter dans ce même fichier section 5.

---

## 6. Plan de correction

Voir `PROVIDER_CONFORMITY_REPORT.md` pour la liste hiérarchisée. Le P0 immédiat :

**Patch P0** — `app/api/provider/dashboard/route.ts` :
- Renommer `provider_id` → `provider_profile_id` dans la query reviews
- Corriger le filtre `statut` avec les valeurs réelles
- Passer la query `work_orders` et `provider_reviews` sur `serviceClient` (cohérence)
- Normaliser le shape `pending_orders` du fallback pour correspondre au type `PendingOrder` du composant
- Toujours retourner une structure `{profile_id, stats, pending_orders, recent_reviews}` non-null

Le patch complet accompagne ce rapport (commit dédié).
