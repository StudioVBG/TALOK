# Audit — Admin / Codes promo

**Date** : 2026-04-22
**Branche** : `claude/fix-promo-codes-table-t50lR`
**Symptôme** : `GET /api/admin/promo-codes` → 500 ; Supabase renvoie
> Could not find the table 'public.promo_codes' in the schema cache

**Scope** : Phase 0 uniquement — aucun changement appliqué. Recommandation à valider par Thomas avant toute Phase 1.

---

## 1. État du code existant

### 1.1 Fichiers front / back déjà livrés

| Zone | Fichier | État |
|---|---|---|
| UI admin | `app/admin/promo-codes/page.tsx` | **Complet.** 577 lignes. Formulaire de création riche (dialog), tableau avec badges (Actif / Archivé / Expiré / Quota atteint / Nouveaux abonnés uniquement), actions activer/désactiver + supprimer, copie du code. Utilise `ProtectedRoute` + React Query. Pas un stub. |
| Sidebar | `components/layout/admin-sidebar.tsx:99` | Lien `"Codes promo" → /admin/promo-codes` déjà présent. |
| API list + create | `app/api/admin/promo-codes/route.ts` | **Complet.** GET + POST. Validation Zod. Guard via `requireAdminPermissions(["admin.plans.read"|"admin.plans.write"])`. Audit action `promo_code_created`. Rate-limit `adminStandard` / `adminCritical`. |
| API update + delete | `app/api/admin/promo-codes/[id]/route.ts` | **Complet.** PATCH (allowlist de champs) + DELETE. Audit actions. Note : le DELETE est un hard delete, pas un archive — contrairement à la doc inline (« Conserve l'historique grâce à ON DELETE »). |
| API validation publique | `app/api/subscriptions/promo/validate/route.ts` | **Complet.** POST — lit `promo_codes` **et** `promo_code_uses`, calcule remise, vérifie éligibilité plan + cycle + premier abonnement + usages par user. |
| Service | `lib/subscriptions/subscription-service.ts:461` | `validatePromoCode(code, planSlug, billingCycle, userId?)` utilisé indirectement (export dans `index.ts`). |
| Types | `lib/subscriptions/types.ts:187-221` | `PromoCode`, `PromoCodeValidation`. Le type inclut déjà `stripe_coupon_id: string \| null` (champ jamais écrit par l'API POST). |
| Stub | `lib/subscriptions/index.ts:49-52` | `usePromoCode(code, userId)` → no-op `console.warn` + `return null`. **Jamais appelé** dans le code (censé incrémenter `uses_count` + insérer dans `promo_code_uses` après checkout réussi). |
| DB types | `lib/supabase/database.types.ts:2287,2474` | `promo_codes` et `promo_code_uses` référencés en `GenericRowType` (placeholders — preuve que le régénérateur de types n'a jamais vu ces tables). |

### 1.2 Migration SQL

```
$ ls supabase/migrations | grep -i promo
(aucun résultat)
$ grep -rn "promo_codes\|promo_code_uses" supabase/migrations
(aucun résultat sauf une ligne sans rapport : 'sci_construction_vente' -- SCCV (promotion))
```

**Constat** : **aucune migration** ne crée `promo_codes` ni `promo_code_uses`. 466 migrations présentes, zéro concerne ce schéma. Les tables n'existent ni en prod ni en dev. C'est la cause directe de l'erreur 500 (PostgREST schema cache miss).

Cohérent avec la règle drift 2026-04-19 : le repo doit être la source de vérité, donc la seule correction propre est d'ajouter une migration versionnée.

### 1.3 Shape attendu par le code déjà écrit

Reconstitué à partir des champs lus/écrits :

**`promo_codes`** — colonnes manipulées par POST/PATCH/validate :
- `id uuid pk`
- `code text unique` (stocké en UPPERCASE, regex `[A-Za-z0-9_-]{3,40}`)
- `name text`, `description text` (nullables)
- `discount_type text in ('percent','fixed')`  ← **pas** `amount_off`
- `discount_value numeric > 0` (% entier, ou centimes si fixed)
- `applicable_plans text[]` (slugs : `gratuit|starter|confort|pro|enterprise_s|_m|_l|_xl`)
- `min_billing_cycle text in ('monthly','yearly')` nullable
- `first_subscription_only boolean default false`
- `max_uses int`, `uses_count int default 0`, `max_uses_per_user int default 1`
- `valid_from timestamptz default now()`, `valid_until timestamptz`
- `is_active boolean default true` ← **pas** `status`
- `stripe_coupon_id text` (prévu dans le type, non écrit par l'API POST actuelle)
- `created_by uuid references profiles(id)`, `created_at`, `updated_at timestamptz`

**`promo_code_uses`** — lecture par validate route :
- `id`, `promo_code_id`, `user_id`
- (vraisemblablement aussi `subscription_id`, `created_at`, à confirmer)

### 1.4 Conflit de spec — à arbitrer

Le shape proposé dans l'énoncé (`discount_type in (percent,amount_off)`, `duration`, `status`, `stripe_promotion_code_id`, `eligible_territories`, `eligible_plans`) **ne correspond pas** au code existant (qui utilise `discount_type in (percent,fixed)`, `is_active`, `applicable_plans`, `min_billing_cycle`, `first_subscription_only`, sans territoires ni notion de durée Stripe).

→ Deux choix en Phase 1 :
1. **Garder le shape déjà codé** (minimum viable, diff réduite). Mais ça ignore les exigences DROM (`eligible_territories`) et la sémantique Stripe (`duration`).
2. **Réécrire le code existant** pour coller au shape cible de l'énoncé. Plus propre sémantiquement mais = réécriture de la page UI, du service, des routes API.

---

## 2. Scope réel prévu

### 2.1 À quoi s'applique un code promo ?

- **Abonnements SaaS uniquement** — confirmé par :
  - UI (`ALL_PLAN_SLUGS` = les 8 plans) et `applicable_plans` (array de plan slugs)
  - `validatePromoCode(code, planSlug, billingCycle)` utilise `PLANS[planSlug].price_monthly|yearly`
- **Pas** d'add-ons (`subscription_addons` existe depuis migration `20260408120000` mais aucun code ne croise promo + addon)
- **Pas** de work_orders (les paiements tickets récents dans l'historique git sont hors scope pricing)

### 2.2 Stratégie Stripe actuelle

Checkout (`app/api/subscriptions/checkout/route.ts:190`) :
```ts
allow_promotion_codes: true,
```
→ Stripe affiche son propre champ "Code promo" sur la page Checkout. Ces codes sont ceux créés **nativement dans le Dashboard Stripe** (`stripe.coupons` + `stripe.promotionCodes`), **pas** ceux de notre table locale.

**Aucune logique** n'injecte `discounts: [{ promotion_code: stripe_promotion_code_id }]` ni `coupon: stripe_coupon_id` à partir de la table locale.

**Conséquence pratique** : la table locale, même une fois créée, **ne serait pas lue par le checkout**. Un code créé dans `/admin/promo-codes` serait invisible à Stripe. L'endpoint `/api/subscriptions/promo/validate` existe mais **n'est appelé nulle part** — `grep -rn "promo/validate"` côté front retourne zéro usage.

### 2.3 Aval — consommation actuelle

| Consumer | État |
|---|---|
| Page pricing / front | Aucune UI ne saisit un code avant d'aller au Stripe Checkout. Pas de référence `promo` dans `app/pricing` ni `components/pricing`. |
| `/api/subscriptions/promo/validate` | Endpoint prêt mais orphelin (aucun appelant). |
| `usePromoCode()` | Stub no-op. Personne n'incrémente `uses_count` ni n'insère dans `promo_code_uses`. |
| Webhook Stripe | Ne persiste pas `stripe_coupon_id` sur la souscription. Ne décrémente pas le compteur local. |

**Conclusion** : la feature est à **50 % côté admin** (créer/lister/archiver) et à **0 % côté checkout**. Même si on crée la migration, rien ne se passe au moment du paiement — le panneau admin ne servirait qu'à tenir un registre "mort".

### 2.4 Priorité métier

Lancement DROM-COM mois 1-2. Il est **plausible** que le marketing veuille une campagne "BIENVENUEDROM -20%" à l'ouverture. Mais :
- Stripe Dashboard permet déjà de le faire en 2 clics (`allow_promotion_codes: true` fonctionne déjà)
- Aucune exigence "ciblage territoire DROM" dans le code (seulement `applicable_plans`, pas `eligible_territories`)
- Reste à clarifier avec Thomas : le besoin est-il **un UI admin interne** (Option A/B) ou **juste une campagne Stripe native** (Option C) ?

---

## 3. Trois options

### Option A — Wrapper Stripe Coupons + Promotion Codes (recommandé si lancement marketing imminent)

**Principe** : Stripe = source de vérité, table locale = miroir + métadonnées Talok (ciblage, audit, UI interne).

**Travaux** :
1. Migration SQL `promo_codes` + `promo_code_uses` (shape **existant** : `discount_type in (percent,fixed)`, `is_active`) + colonnes nouvelles `stripe_coupon_id`, `stripe_promotion_code_id`, optionnel `eligible_territories text[]` pour DROM.
2. Modifier `POST /api/admin/promo-codes` → créer d'abord `stripe.coupons.create` puis `stripe.promotionCodes.create`, et seulement ensuite `insert` local. Rollback Stripe si DB échoue (archive du coupon).
3. Modifier `PATCH` `is_active=false` → `stripe.promotionCodes.update({active:false})`. `DELETE` → remplacer par archive (conformité : Stripe n'autorise pas la suppression d'un coupon utilisé).
4. Injecter dans checkout : accepter `promo_code` en body, valider via la table locale, passer `discounts: [{ promotion_code: stripe_promotion_code_id }]` à `checkout.sessions.create`. Enlever `allow_promotion_codes: true` (ou le laisser pour permettre aussi les codes Stripe natifs — à trancher).
5. Webhook `checkout.session.completed` : incrémenter `uses_count`, insérer dans `promo_code_uses`.
6. UI pricing : champ "J'ai un code promo" avant le redirect checkout.
7. Tests Vitest : création sync, rollback si Stripe 400, validation plan/territoire, expiration, incrémentation compteur.

**Pros** :
- Source de vérité Stripe (utilisable dans Stripe Dashboard aussi)
- Rapport utilisation cohérent entre Stripe + Talok
- Scalable marketing (ciblage territoire pour DROM, audit admin, raison métier)

**Cons** :
- Double écriture Stripe ↔ DB ⇒ plus de chemins d'erreur à gérer
- ~3-4 jours de travail (migration + wrapper + checkout injection + webhook + UI pricing + tests)
- Nécessite retirer/cohabiter `allow_promotion_codes: true`

### Option B — Table 100 % locale

**Principe** : Talok gère tout, Stripe reçoit un line_item avec `unit_amount` déjà décoté, ou un `coupon` ad-hoc créé à la volée pour cette session uniquement.

**Travaux** :
1. Migration identique (sans colonnes Stripe permanentes).
2. POST/PATCH/DELETE = opérations DB seules (logique actuelle).
3. Checkout : valider localement, créer **un coupon Stripe one-shot** juste pour cette session (`stripe.coupons.create` en mode `once` + `duration_in_months`), passer en `discounts`.
4. Webhook → incrémenter compteur.

**Pros** :
- Contrôle total, pas de synchro
- Diff plus petite que A (pas de refonte des CRUD admin — ils marchent déjà avec le shape existant)
- La page admin actuelle fonctionne sans réécriture

**Cons** :
- Code non visible dans Stripe Dashboard (support client plus complexe)
- Duplication de logique Stripe (calcul de remise, durée, etc.)
- Le champ `stripe_coupon_id` du type devient mensonger (on en crée un par session, pas un par promo)

### Option C — Retirer l'UI derrière un feature flag jusqu'à ce que la feature soit planifiée

**Principe** : on ne casse rien, on arrête d'afficher un bouton qui crash.

**Travaux** :
1. Créer `lib/config/feature-flags.ts` (n'existe pas encore — aucun `feature-flags.ts` dans le repo). Exposer `ADMIN_PROMO_CODES_ENABLED` depuis env ou dur en `false`.
2. `components/layout/admin-sidebar.tsx:99` — masquer l'item si flag = false.
3. `app/admin/promo-codes/page.tsx` — redirect `/admin` si flag = false.
4. `app/api/admin/promo-codes/route.ts` — renvoyer 404 JSON propre au lieu de 500.
5. Conserver tout le code (migration à écrire quand la feature sera priorisée).
6. Issue backlog : "Implémenter schéma `promo_codes` + wrapper Stripe + injection checkout".

**Pros** :
- 1-2 h de travail, zéro risque de régression
- Propre UX (pas de page qui crash)
- Preserve l'investissement déjà fait (UI, API, types)
- En ligne avec `allow_promotion_codes: true` déjà fonctionnel côté Stripe natif

**Cons** :
- La feature reste non livrée
- Si une campagne marketing DROM est prévue dans 2 semaines → fausse bonne idée

---

## 4. Recommandation

**Option C si aucune campagne marketing n'est planifiée dans les 2 mois.**

Justification :
- Le checkout **accepte déjà les codes promo Stripe natifs** via `allow_promotion_codes: true`. Le marketing peut créer un coupon DROM dans le Dashboard Stripe et communiquer le code — ça marche **aujourd'hui**, sans aucune ligne de code.
- La page admin actuelle ne serait qu'un doublon visuel tant que l'injection checkout + webhook + UI pricing ne sont pas faits. Livrer Option A partiellement = mensonge fonctionnel (l'admin croit gérer des codes qui ne s'appliqueront à rien).
- Option C préserve tout le travail déjà fait et permet de migrer vers A proprement quand le besoin sera clair.

**Option A si Thomas confirme une campagne de lancement DROM avec ciblage territoire** → là on investit les 3-4 jours.

**Option B n'est pas recommandée** : elle crée de la dette (Stripe Dashboard incohérent, support client plus complexe) sans avantage net par rapport à A.

---

## 5. Questions ouvertes pour Thomas

1. Y a-t-il une campagne marketing DROM planifiée sur les 2 prochains mois qui justifie un outil admin interne ?
2. Si oui, ciblage par territoire (`martinique`, `guadeloupe`, `guyane`, `reunion`, `mayotte`) est-il requis ? Si non, un code Stripe natif suffit.
3. Conflit de shape (§1.4) : garde-t-on le shape déjà codé (`is_active` / `discount_type in (percent,fixed)`) ou on réaligne sur le shape de l'énoncé (`status` / `amount_off`, plus sémantique Stripe) ?
4. En Option A, `allow_promotion_codes: true` doit-il rester (codes Stripe natifs + codes Talok cohabitent) ou être retiré (codes Talok uniquement) ?

---

## 6. Livrables attendus

**Arrêt Phase 0.** Phase 1 démarre après décision explicite A / B / C + réponses aux 4 questions ci-dessus.
