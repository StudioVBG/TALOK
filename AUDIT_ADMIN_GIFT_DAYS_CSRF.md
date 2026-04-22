# AUDIT — 403 "Token CSRF invalide" sur l'endpoint Offrir des jours

> **Phase 0 — audit en lecture seule. Aucune modification appliquée.**
> Branche : `claude/fix-csrf-gift-days-vOAWr` (clean)
> Date : 2026-04-22

---

## TL;DR

- L'endpoint réel est **`/api/admin/subscriptions/gift`** (pas `gift-days` — URL tronquée dans DevTools du rapport initial).
- Client et serveur sont câblés correctement : `fetchWithCsrf` côté UI → header `x-csrf-token` → `validateCsrfFromRequest` côté API.
- Le bug vient du **double-submit cookie** : `CsrfTokenInjector` régénère un token aléatoire à chaque render du layout, pousse toujours un meta tag frais, mais le `cookies().set(...)` côté Server Component est **non fiable** (cf. docs Next.js App Router + commentaire explicite dans le fichier). Résultat : après toute re-render du layout (soft nav, prefetch RSC, second onglet), le cookie `csrf_token` reste à l'ancienne valeur pendant que le meta tag (et donc le header envoyé) pointe vers la nouvelle → `cookieToken !== headerToken` → **403**.
- **Hypothèse P0** = H2 (mismatch cookie/meta). Subsidiaire **H_env** si `CSRF_SECRET` absent en prod, mais 6 endpoints protégés seraient affectés identiquement — donc pas spécifique à gift.
- **Surface additionnelle détectée** : `override`, `refund`, `site-content`, `impersonate`, `apply-migration` partagent exactement la même faille latente. Sur ~55 routes admin mutantes, **seules 6 valident le CSRF** — tout le reste (suspend, plans, promo-codes, users, flags, providers, broadcasts, moderation…) **n'a aucune validation CSRF**, ce qui explique pourquoi l'utilisateur ne voit le symptôme que sur gift/override/refund.

---

## 1. Localisation de l'endpoint

Fichier : `app/api/admin/subscriptions/gift/route.ts` (L1–74).

- Méthode : `POST /api/admin/subscriptions/gift`
- Runtime : Node.js (`export const runtime = 'nodejs'`)
- Imports pertinents :
  - `validateCsrfFromRequest` (lib/security/csrf.ts)
  - `requireAdminPermissions` + `isAdminAuthError` (lib/middleware/admin-rbac)
  - `adminGiftDays` (lib/subscriptions/subscription-service)
- Schéma Zod : `user_id (uuid)`, `days (1..365)`, `reason (≥3)`, `notify_user (bool)`, `plan_slug (enum optionnel)`.

Handler (extrait clé, L23–40) :

```ts
export async function POST(request: Request) {
  try {
    // CSRF validation
    try {
      const csrfValid = await validateCsrfFromRequest(request);
      if (!csrfValid) {
        return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
      }
    } catch {
      // CSRF_SECRET not configured — degrade gracefully
    }

    // RBAC + rate limit + audit
    const auth = await requireAdminPermissions(request, ["admin.subscriptions.write"], {
      rateLimit: "adminCritical",
      auditAction: "Gift de jours gratuits",
    });
    if (isAdminAuthError(auth)) return auth;
    …
```

> Le `try { … } catch {}` autour de `validateCsrfFromRequest` est **du code mort** : `validateCsrfFromRequest` ne `throw` jamais (cf. §3) ; elle renvoie `true`/`false`. Donc le commentaire « degrade gracefully » est trompeur — si `CSRF_SECRET` est absent, on part *tout de même* en 403 (header manquant côté client, pas de meta).

---

## 2. Localisation du client

Fichier : `app/admin/subscriptions/page.tsx` (composant `AdminActionModal`, L229–346).

- Import : `import { fetchWithCsrf } from "@/lib/security/csrf";` (L85)
- Construction URL : `` `/api/admin/subscriptions/${action}` `` (L265), où `action ∈ {"override", "gift", "suspend", "unsuspend", "refund"}`.
- Body pour `gift` (L274–278) :
  ```ts
  body.days = giftDays;
  if (giftPlan && giftPlan !== GIFT_KEEP_PLAN) body.plan_slug = giftPlan;
  ```
- Appel (L299–303) :
  ```ts
  const res = await fetchWithCsrf(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  ```

Le helper `fetchWithCsrf` (lib/security/csrf.ts L178–194) :

```ts
const csrfToken = getClientCsrfToken();
const headers = new Headers(options.headers);
if (csrfToken) headers.set("x-csrf-token", csrfToken);
return fetch(url, { ...options, headers, credentials: "same-origin" });
```

Et `getClientCsrfToken` (L167–173) lit exclusivement le meta tag :
```ts
const meta = document.querySelector('meta[name="csrf-token"]');
return meta?.getAttribute("content") ?? null;
```

> Si la meta est absente (CSRF_SECRET manquant en prod), le header **n'est même pas envoyé** — et le serveur refusera systématiquement (L116 `if (!headerToken) return false;`).

---

## 3. Middleware / helper CSRF

### 3.1 Source unique : `lib/security/csrf.ts`

- Pas de validation CSRF dans `middleware.ts` (edge runtime, aucun import `@supabase/*` ni `csrf`).
- Tout passe par `validateCsrfFromRequest(request)` appelé explicitement par chaque route qui l'opt-in.
- Deuxième chemin (plus récent) : `lib/api/with-security.ts` (HOC) — non utilisé par les routes admin investiguées ici.

### 3.2 Génération du token (L55–62)

```ts
const token = randomBytes(32).toString("hex");         // 64 hex
const expiry = Date.now() + 24 * 3600 * 1000;          // +24h
const signature = HMAC_SHA256(CSRF_SECRET, `${token}:${expiry}`);
return `${token}:${expiry}:${signature}`;              // 3 segments, pas de `=`
```

- Secret : `process.env.CSRF_SECRET`, doit faire ≥ 32 chars. `getCsrfSecret()` **throw** sinon.
- Donc `generateCsrfToken()` throw si secret absent ou court.

### 3.3 Validation (L106–140)

Ordre exact des checks :
1. `GET|HEAD|OPTIONS` → `true` (méthode sûre).
2. Lire header `x-csrf-token` ; si absent → `false`.
3. `validateCsrfToken(header)` : split 3 segments, vérifie l'expiry puis HMAC timing-safe. Retourne `false` sur toute erreur (dont `CSRF_SECRET` manquant, car le `try/catch` interne renvoie `false`).
4. Parse le cookie `csrf_token` depuis le header `Cookie`.
5. **Double-submit** : `if (cookieToken && cookieToken !== headerToken) return false;`
   - Note : si le cookie est **absent**, le check est sauté. Le commentaire L126–127 justifie ce fallback par la fragilité de `cookies().set()` en Server Component.

`validateCsrfFromRequest` ne `throw` *jamais* → le `try/catch` des routes est inutile (voir §1).

### 3.4 Distribution du token : `components/security/CsrfTokenInjector.tsx`

Server Component rendu dans `app/admin/layout.tsx:46` (et aussi `owner`, `agency`, `tenant`, `syndic`, `provider`, `copro`, `guarantor`). Flow :

1. `generateCsrfToken()` — try/catch ; si throw (ex: pas de secret) → `return null` (pas de meta, pas de cookie).
2. `cookies().set({ name: "csrf_token", value: token, path:"/", httpOnly, sameSite:"strict", secure: prod, maxAge: 24h })` — **try/catch silencieux** :
   ```ts
   } catch {
     // En Server Component read-only, le set cookie peut échouer silencieusement
   }
   ```
3. `return <meta name="csrf-token" content={token} />` — injecté dans le DOM.

> **Problème clé** : d'après la doc Next.js App Router, `cookies().set()` n'est fiable que dans un Route Handler ou une Server Action. Dans un Server Component rendu pendant un RSC payload (soft nav) ou un prefetch, la consigne `Set-Cookie` peut ne pas être propagée au navigateur. Résultat : la valeur **en DOM** et la valeur **dans le cookie** peuvent diverger.

### 3.5 Panorama des endpoints admin CSRF-protégés vs exemptés

| Validation CSRF | Route(s) |
|---|---|
| ✅ (6 routes) | `subscriptions/gift`, `subscriptions/override`, `subscriptions/refund`, `site-content`, `impersonate` (POST uniquement — DELETE/GET non protégés), `apply-migration` |
| ❌ (≈ 50 routes) | `subscriptions/suspend`, `plans` (POST/PUT), `promo-codes`, `broadcasts`, `flags`, `users/[id]` (PATCH), `providers/*`, `branding`, `email-templates`, `moderation/*`, `notifications`, `support`, `addons`, `cleanup`, `reset-lease`, `reseal-edl`, `reseal-lease`, `sync-lease-statuses`, `fix-*`, `landing-images/upload`, `properties/*`, `templates/update-legislation`, `compliance/*`, `integrations/*`, `site-config` (PUT)… |

> Liste produite par un scan `grep -c "validateCsrfFromRequest"` sur tous les `route.ts` sous `app/api/admin/**`.
>
> **Conséquence immédiate** : la majorité des actions admin passent sans jamais être confrontées au double-submit cassé — ce qui explique pourquoi l'utilisateur rapporte l'incident uniquement sur **gift** (et pourrait aussi le rapporter sur override / refund / site-content, qu'il n'a peut-être pas retesté aujourd'hui).
>
> **Problème de sécurité additionnel** : cette asymétrie est aussi un trou CSRF — les 50 routes exemptées sont vulnérables à une attaque CSRF en prod.

---

## 4. Comparaison avec endpoints admin qui fonctionnent

### 4.1 `POST /api/admin/subscriptions/override` (change plan)

Même code CSRF que gift (L23–32), même helper client (`fetchWithCsrf` depuis le même modal `AdminActionModal` — `app/admin/subscriptions/page.tsx:299`), même couche d'auth (`requireAdminPermissions`). **Diff = 0** sur la partie sécurité.

> Si gift échoue en 403, override doit échouer aussi. Le titre « quels endpoints admin POST répondent 200 aujourd'hui » de la Phase 0 est donc trompeur : parmi les endpoints **CSRF-protégés**, aucun n'est en pratique mieux loti. Parmi les endpoints **non protégés** (suspend, promo-codes, plans…), tous répondent 200 parce qu'ils ne regardent même pas le token.

### 4.2 `POST /api/admin/impersonate`

CSRF check identique (L47–55). Mais le code client n'appelle **jamais** `POST /api/admin/impersonate` — `components/admin/impersonation-banner.tsx` n'utilise que `GET` et `DELETE` (les deux exemptés de CSRF). Ce qui fait qu'on ne voit pas le symptôme. Si un jour on câble un bouton « Impersonner » qui poste réellement, on aura le même 403.

### 4.3 `POST /api/admin/site-content`

CSRF check + `fetchWithCsrf` côté UI (`app/admin/site-content/page.tsx:136`). Même pattern, même faille latente.

### 4.4 Requête « diff header par header »

Pour gift comme pour override / refund / site-content, la requête en DevTools est **identique** en structure :
- `Content-Type: application/json`
- `x-csrf-token: <hex>:<ts>:<hmac>` ← valeur du meta actuel
- `Cookie: sb-*=…; csrf_token=<hex>:<ts>:<hmac>` ← peut différer du meta si RSC a régénéré sans propager
- `credentials: "same-origin"` → cookies joints

Le diff qui fait 403 vs 200 n'est pas dans la route — c'est **l'égalité exacte cookie ↔ header au moment T**.

---

## 5. Hypothèses classées (P0 → P3)

### H1 — P0 : Mismatch cookie ↔ meta après re-render du layout (double-submit cassé)

**Mécanisme** :
1. Chargement dur de `/admin/...` → `CsrfTokenInjector` génère `TOKEN_A`, `cookies().set(…TOKEN_A…)` (peut marcher), meta = `TOKEN_A`.
2. Soft nav / RSC prefetch / 2ᵉ onglet → layout re-rendu → `TOKEN_B` généré. DOM mis à jour : meta = `TOKEN_B`. Mais `cookies().set()` depuis un RSC n'attache pas de `Set-Cookie` fiable → cookie reste `TOKEN_A`.
3. L'utilisateur soumet gift → `fetchWithCsrf` lit meta → `x-csrf-token: TOKEN_B` ; navigateur joint `csrf_token=TOKEN_A`.
4. Serveur : header valide HMAC (OK), cookie présent et `!==` header → `return false` → **403 "Token CSRF invalide"**.

**Preuves** :
- `lib/security/csrf.ts:135` : `if (cookieToken && cookieToken !== headerToken) return false;`
- `components/security/CsrfTokenInjector.tsx:55-57` : commentaire explicite « le set cookie peut échouer silencieusement ».
- Token = `randomBytes(32)` → chaque `generateCsrfToken()` produit une **nouvelle** valeur. Aucune idempotence, aucun caching.
- Doc Next.js : `cookies().set()` interdit/déconseillé en Server Component hors Server Action/Route Handler.

**Impact attendu si H1 vraie** :
- Premier submit après hard refresh de la page concernée : 200.
- Tout submit après une nav client (sidebar → autre page admin → retour) : 403 probable.
- Multi-onglets : 403 systématique sur l'onglet non dernier-rendu.

**Reproductibilité** : à valider en Phase 1 par un test E2E ou un log serveur `{cookie, header}` côté route.

---

### H2 — P0 (subsidiaire) : `CSRF_SECRET` non configuré dans l'environnement courant

**Mécanisme** :
1. `generateCsrfToken()` throw dans `CsrfTokenInjector` → `return null` → **pas de meta, pas de cookie**.
2. `fetchWithCsrf` : `getClientCsrfToken()` → `null` → header non envoyé.
3. `validateCsrfFromRequest` L116 : `!headerToken` → `return false` → **403**.

**Preuves** :
- `lib/security/csrf.ts:16-39` : `getCsrfSecret` throw si absent ou < 32 chars.
- `components/security/CsrfTokenInjector.tsx:21-32` : catch → `return null` → rien d'injecté.
- `.env.example:165` : `# CSRF_SECRET=xxxxx` (commenté — donc si l'ops n'a pas pushé la var, elle manque).
- Note : le commentaire « degrade gracefully » dans les routes est **incorrect** — rien ne dégrade : c'est 403 sec.

**Contradiction partielle avec H1** : si H2 est vraie, les 6 endpoints CSRF-protégés échouent tous identiquement, pas seulement gift. À confirmer en demandant un `echo $CSRF_SECRET | wc -c` côté prod (ou log serveur).

---

### H3 — P2 : Rotation du token après login admin non propagée

**Mécanisme hypothétique** : un flow de login/refresh aurait régénéré le cookie sans rafraîchir le DOM (donc l'inverse de H1 : meta ancien, cookie frais).

**Preuve contre** : aucune logique de rotation CSRF spécifique à l'auth dans le repo. Aucun appel à `generateCsrfToken` ailleurs que dans le layout injector et les tests. Improbable.

---

### H4 — P3 : Middleware applique CSRF à une route exemptée ailleurs

**Preuve contre** : `middleware.ts` laisse passer `/api/*` sans toucher aux cookies (L104–117 : bypass). Aucune autre source de validation CSRF globale. **Écartée**.

---

### H5 — P3 : Route demande un token mais n'est pas listée dans une whitelist de génération

**Preuve contre** : pas de whitelist de génération ; le token est injecté pour **toute** page rendue sous `admin/layout.tsx`. `/admin/subscriptions` l'est. **Écartée**.

---

## 6. Conclusion de la Phase 0

- **RCA la plus probable** : H1 (mismatch cookie ↔ meta à cause de `cookies().set()` non fiable en Server Component après re-render du layout). H2 (secret manquant) est subsidiaire et trivialement testable.
- **Le bug n'est pas spécifique à gift** : il affecte potentiellement les 6 endpoints CSRF-protégés (gift, override, refund, site-content, impersonate-POST, apply-migration).
- **Dette CSRF additionnelle** : ~50 routes admin POST/PATCH/DELETE n'ont **aucune validation CSRF**. C'est un trou de sécurité à traiter en parallèle du fix (Phase 1+).
- **Le `try/catch` autour de `validateCsrfFromRequest` est du code mort** — à nettoyer pour éviter de futures confusions sur la sémantique « degrade gracefully ».

---

## 7. Questions à lever avant Phase 1

1. En prod Netlify actuelle, `CSRF_SECRET` est-il défini et ≥ 32 chars ? (test rapide : poster sur `site-content` et voir si 403 aussi).
2. Le 403 sur gift est-il **systématique** ou **intermittent** (corrobore H1 si lié à la nav client) ?
3. Fix à retenir en Phase 1 (à confirmer) :
   - **Option A** (minimal) : supprimer la comparaison cookie ↔ header et ne garder que HMAC+expiry sur le header. Le token est signé et tourne en 24h — c'est suffisant contre un attaquant externe, à condition que le meta soit en same-origin (vrai). Retire la dépendance au `cookies().set()` fragile.
   - **Option B** : déplacer la génération du token dans un Route Handler `GET /api/csrf` invoqué au mount client (ou Server Action), qui pose fiablement le cookie et renvoie la valeur. `fetchWithCsrf` fait un round-trip si la meta est absente.
   - **Option C** : ne régénérer la paire (meta, cookie) que si le cookie est absent/expiré (idempotence) — mais on reste en Server Component, donc on garde la fragilité.
   - Recommandation : **A** (la plus simple, sans perte réelle de sécurité) + étendre la protection CSRF via `withSecurity` à tous les endpoints admin mutants.
4. Pattern réutilisable côté tests : ajouter 3 cas Vitest (header valide → 200, absent → 403, expiré → 403) dans `tests/unit/security/`.

---

## 8. Livrables Phase 0

- ✅ Ce fichier `AUDIT_ADMIN_GIFT_DAYS_CSRF.md`
- ⏸ Aucune modification de code. Attente GO pour Phase 1.
