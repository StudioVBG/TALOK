# FIX — 403 "Token CSRF invalide" sur `/api/admin/subscriptions/gift`

> Phase 1 — correction appliquée sur la branche `claude/fix-csrf-gift-days-vOAWr`.
> Date : 2026-04-22
> Préambule : voir `AUDIT_ADMIN_GIFT_DAYS_CSRF.md` (Phase 0).

---

## Diagnostic retenu

**RCA (H1 de l'audit) : désynchronisation meta ↔ cookie après re-render du layout.**

`CsrfTokenInjector` régénérait un token aléatoire à *chaque* render du layout admin :
- la `<meta name="csrf-token">` embarquait toujours la nouvelle valeur (TOKEN_B),
- mais `cookies().set()` depuis un Server Component est non fiable pendant un RSC soft nav / prefetch (cf. docs Next.js App Router et commentaire explicite du fichier lui-même),
- le cookie `csrf_token` restait donc collé à l'ancienne valeur (TOKEN_A).

Côté serveur, `validateCsrfFromRequest` applique un double-submit strict :
```ts
if (cookieToken && cookieToken !== headerToken) return false;
```
→ `TOKEN_A !== TOKEN_B` → `403 "Token CSRF invalide"`.

Le même symptôme était latent sur les 5 autres endpoints admin qui valident le CSRF (`override`, `refund`, `site-content`, `impersonate` (POST), `apply-migration`).

---

## Fix appliqué

### 1. Token idempotent côté injector — fix racine

`components/security/CsrfTokenInjector.tsx` relit désormais le cookie existant avant de générer :

```ts
const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;
if (existing && validateCsrfToken(existing)) {
  return existing;           // réutilise → meta et cookie restent en phase
}
const fresh = generateCsrfToken();
try { cookieStore.set({ name: CSRF_COOKIE_NAME, value: fresh, … }); } catch {}
return fresh;
```

- 1ʳᵉ hard load : pas de cookie → génère TOKEN_A, set cookie=TOKEN_A, meta=TOKEN_A.
- Soft nav / RSC prefetch / 2ᵉ onglet : cookie TOKEN_A déjà envoyé par le navigateur → `validateCsrfToken(existing)` passe → on **réutilise** TOKEN_A. Pas de `cookies().set()` inutile, pas de nouvelle valeur qui divergerait.
- Cookie expiré (>24h) ou signature invalidée (changement de `CSRF_SECRET`) : régénération propre.

### 2. Validateur détaillé + Sentry — `lib/security/csrf.ts`

Ajout de deux exports :

```ts
export type CsrfFailureReason =
  | "missing_header"
  | "invalid_signature_or_expired"
  | "cookie_mismatch";

export async function validateCsrfFromRequestDetailed(request): Promise<{ valid: boolean; reason?: CsrfFailureReason }>;
export async function logCsrfFailure(request, reason, endpoint): Promise<void>;
```

- `validateCsrfFromRequestDetailed` conserve la même logique mais retourne la raison précise de l'échec. `validateCsrfFromRequest` (API booléenne) est conservée pour la rétrocompat et appelle désormais la détaillée en interne — aucun appelant externe à changer.
- `logCsrfFailure` émet un log JSON structuré (`console.warn`) et capture un message Sentry taggé `{ type:"csrf_violation", endpoint, reason }`. Safe si Sentry n'est pas importé (fallback silencieux).

### 3. Migration des 6 routes CSRF-protégées

Les 6 routes admin qui validaient le CSRF ont été migrées vers le nouveau pattern (suppression du `try/catch` mort + logging structuré) :

| Route | Endpoint tag pour Sentry |
|---|---|
| `app/api/admin/subscriptions/gift/route.ts` | `admin.subscriptions.gift` |
| `app/api/admin/subscriptions/override/route.ts` | `admin.subscriptions.override` |
| `app/api/admin/subscriptions/refund/route.ts` | `admin.subscriptions.refund` |
| `app/api/admin/site-content/route.ts` | `admin.site-content` |
| `app/api/admin/impersonate/route.ts` (POST) | `admin.impersonate` |
| `app/api/admin/apply-migration/route.ts` | `admin.apply-migration` |

Pattern unifié dans chaque handler :
```ts
const csrf = await validateCsrfFromRequestDetailed(request);
if (!csrf.valid) {
  await logCsrfFailure(request, csrf.reason!, "admin.xxx");
  return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
}
```

### 4. Ce qui n'a **pas** été touché (volontairement)

- **`lib/api/with-security.ts`** — le HOC utilise déjà `validateCsrfFromRequest` et gère sa propre journalisation. Refactor inutile pour le bug ciblé.
- **Les ~50 routes admin mutantes sans protection CSRF** (suspend, plans, promo-codes, users, providers, broadcasts, flags, moderation, etc.). C'est une dette de sécurité réelle, documentée dans l'audit Phase 0, mais hors-scope du ticket « gift ». À traiter dans une PR dédiée.

---

## Vérifications

### 1. Tests unitaires — `pnpm test tests/unit/security/csrf-validation.test.ts`

```
 ✓ tests/unit/security/csrf-validation.test.ts  (18 tests) 63ms
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

Nouveaux cas couverts par `describe("validateCsrfFromRequestDetailed")` :
- GET sans token → `valid: true` (méthode sûre).
- POST avec token valide (header seul) → `valid: true`.
- POST avec header + cookie identiques → `valid: true` (double-submit OK).
- POST sans header → `valid: false, reason: "missing_header"`.
- POST avec signature falsifiée → `valid: false, reason: "invalid_signature_or_expired"`.
- POST avec token expiré → `valid: false, reason: "invalid_signature_or_expired"`.
- POST avec cookie ≠ header → `valid: false, reason: "cookie_mismatch"`.

### 2. Typecheck — `pnpm tsc --noEmit`

- **339 erreurs TS pré-existantes** dans le repo (baseline : `lib/services/lrar-providers/*`, `lib/subscriptions/subscription-service.ts`, `tests/setup.ts`, `tests/unit/api/stripe-connect-routes.test.ts`, `tests/unit/security/otp-store.test.ts`, etc.). Aucune n'est introduite par ce fix.
- **0 erreur TS** sur les fichiers modifiés par ce commit :
  ```
  $ npx tsc --noEmit 2>&1 | grep -E "security/csrf|CsrfTokenInjector|subscriptions/gift|subscriptions/override|subscriptions/refund|admin/site-content|admin/impersonate|admin/apply-migration|csrf-validation.test"
  (vide)
  ```

### 3. Flow manuel attendu (à rejouer par l'humain en prod/staging)

1. Se connecter admin → `/admin/subscriptions`.
2. Ouvrir « Offrir des jours » sur Pierre Test → 90 jours → plan Pro → « Notifier par email » ON → Valider.
3. DevTools Network : requête `POST /api/admin/subscriptions/gift` → **200**, body `{ "success": true }`.
4. Vérifier en DB : `subscriptions.status = 'trialing'`, `trial_end ≈ now() + 90 days` pour ce user.
5. Rappel fonctionnel : `ENTITLED_STATUSES` inclut `trialing` → l'utilisateur bénéficie immédiatement du plan Pro.
6. Si « Notifier par email » = ON : mail envoyé au user (à vérifier via Resend / provider mail).
7. Régression : rejouer `POST /api/admin/subscriptions/override` (change plan) et `POST /api/admin/site-content` — doivent aussi répondre 200 (mêmes clients, même helper CSRF).

> Pas d'UI à tester dans le sandbox CI — c'est une action admin sur données live.

---

## Impact & risques

- **Sécurité** : aucun affaiblissement. Le double-submit reste en vigueur lorsque le cookie est présent. Le fix supprime le faux négatif qui faisait rejeter des requêtes légitimes. HMAC + expiry sur le header restent la défense principale.
- **Helper global** : `validateCsrfFromRequest` (signature booléenne historique) est conservée. Tout appelant externe (HOC, tests, futures routes) continue de fonctionner sans changement.
- **Observabilité** : tous les échecs CSRF partent désormais dans Sentry avec tag `type=csrf_violation`, endpoint et raison précise — utile pour distinguer un vrai attaquant (`missing_header` / `invalid_signature_or_expired`) d'un client mal synchronisé (`cookie_mismatch` qui ne devrait plus apparaître après ce fix).
- **Migration SQL** : aucune, pas de drift SQL Editor ↔ git.

---

## Fichiers modifiés

| Fichier | Type |
|---|---|
| `components/security/CsrfTokenInjector.tsx` | Fix racine (idempotence token) |
| `lib/security/csrf.ts` | Ajout `validateCsrfFromRequestDetailed` + `logCsrfFailure` + types |
| `app/api/admin/subscriptions/gift/route.ts` | Migration au nouveau pattern |
| `app/api/admin/subscriptions/override/route.ts` | Migration au nouveau pattern |
| `app/api/admin/subscriptions/refund/route.ts` | Migration au nouveau pattern |
| `app/api/admin/site-content/route.ts` | Migration au nouveau pattern |
| `app/api/admin/impersonate/route.ts` | Migration au nouveau pattern (POST) |
| `app/api/admin/apply-migration/route.ts` | Migration au nouveau pattern |
| `tests/unit/security/csrf-validation.test.ts` | 7 nouveaux cas sur `validateCsrfFromRequestDetailed` |

## Suivi recommandé (hors-scope de ce PR)

1. Protéger les ~50 routes admin mutantes actuellement sans CSRF (liste exhaustive dans l'audit §3.5).
2. Sur le HOC `lib/api/with-security.ts`, basculer sur `validateCsrfFromRequestDetailed` + `logCsrfFailure` pour unifier le pattern (même trace Sentry).
3. Ajouter un dashboard Sentry filtré sur `tags.type = "csrf_violation"` pour monitorer les tentatives et valider que `cookie_mismatch` tombe à zéro après déploiement.
