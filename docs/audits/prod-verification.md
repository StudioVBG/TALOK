# Verification prod & deblocage

**Date :** 2026-04-09

---

## STEP 1 — Migrations

- **Total :** 388 migrations
- **Dernieres :** 20260408-20260409 (13 migrations recentes)
- **Risque :** Les migrations 20260408* creent des tables critiques (seasonal, colocation, charges, tickets SOTA, providers SOTA). **A verifier si appliquees en prod.**
- Voir `docs/audits/migrations-status.md` pour le detail complet

---

## STEP 2 — Subscriptions expirees

### Comment le plan est determine
1. Table `subscriptions` avec `owner_id` (= profile.id) et jointure `subscription_plans`
2. Champ `plan.slug` determine le plan ('gratuit', 'starter', 'confort', 'pro', etc.)
3. Si pas de subscription ou erreur → fallback sur plan `gratuit`
4. `status` peut etre : trialing, active, past_due, canceled, unpaid, paused, incomplete

### Risque identifie
- Si `stripe_subscription_id = NULL` et `current_period_end` passe, le user pourrait garder un `status = 'active'` sans payer
- Le webhook Stripe met a jour le status, mais si le webhook rate (reseau, downtime), le status reste 'active'
- **Impact :** Users avec features payantes sans abonnement reel

### Fix
- Script SQL dans `supabase/fix-expired-subscriptions.sql` (a appliquer manuellement)
- Section DRY RUN pour voir l'impact avant d'appliquer

---

## STEP 3 — Finances double render

### Cause du double rendu
- Les 4 hooks Stripe Connect (`useStripeConnectStatus`, `useStripeConnectBalance`, `useStripeTransfers`, `useStripePayouts`) dans `CompteBancaireTab` se declenchent independamment
- En dev mode (React StrictMode), chaque hook fait un double fetch

### Erreur Stripe Connect
- **Fichier :** `app/api/stripe/connect/balance/route.ts:95`
- **Cause :** `getAccountBalance()` appele sans try/catch — crash si le compte Connect est restreint/incomplet
- **Fix :** Ajoute un try/catch autour de `getAccountBalance()` avec fallback a zeros + flag `balance_unavailable`

---

## STEP 4 — Dashboard KPIs = 0

### Cause
- **Fichier :** `app/owner/_data/OwnerDataProvider.tsx`
- Le state `dashboard` est initialise cote serveur et JAMAIS mis a jour quand l'entite change
- L'API `/api/owner/dashboard` supporte `entityId` mais ne retournait pas les KPIs de base (counts)
- Les KPIs dans `DashboardClient.tsx:419-426` lisent `dashboard.properties.total` qui reste a la valeur initiale

### Fix
1. **API** (`app/api/owner/dashboard/route.ts`) : ajoute un champ `counts` avec `properties.total`, `leases.active`, `leases.pending`
2. **Provider** (`OwnerDataProvider.tsx`) : quand l'API repond avec `data.counts`, met a jour le state `dashboard` avec les nouvelles valeurs

---

## STEP 5 — Tickets chargement infini

### Cause
- **Fichier :** `features/tickets/components/tickets-list.tsx:44-48`
- Le `useEffect` avait `[profile, propertyId]` dans son tableau de dependances
- `profile` est un objet qui change de reference a chaque render (vient de `useAuth()`)
- Chaque nouveau render → nouvelle reference `profile` → useEffect se redeclenche → fetch → re-render → boucle infinie

### Fix
- Remplace `[profile, propertyId]` par `[profile?.id, propertyId]` — utilise une valeur primitive stable

### Note
- La page principale `/owner/tickets/page.tsx` est un composant serveur qui fonctionne correctement
- Le bug affecte le composant deprecie `TicketsList` utilise dans la page detail propriete

---

## STEP 6 — Factures crash RangeError

### Cause
- 4 fichiers ont une fonction `formatDate()` qui fait `new Date(dateStr).toLocaleDateString()` sans verifier la validite
- Si `dateStr` est un string invalide (ex: "null", "undefined", chaine vide non null), `new Date()` retourne Invalid Date et `.toLocaleDateString()` throw un RangeError

### Fichiers corriges
1. `app/owner/finances/FinancesDashboardClient.tsx:36-39`
2. `app/owner/finances/invoices/InvoicesListClient.tsx:32-35`
3. `app/owner/finances/invoices/[id]/InvoiceDetailClient.tsx:35-38`
4. `app/owner/finances/payments/page.tsx:27-30`
5. `app/owner/finances/invoices/[id]/InvoiceDetailClient.tsx:99-106` — `daysOverdue` calcul avec `new Date(dueDate)` non protege

### Fix
- Ajoute `isNaN(d.getTime())` check avant `toLocaleDateString()`
- Retourne "—" si date invalide au lieu de crasher
- Protege le calcul `daysOverdue` contre les dates invalides

---

## Resume des changements

| Etape | Fichier(s) | Type |
|-------|-----------|------|
| 1 | `docs/audits/migrations-status.md` | Documentation |
| 2 | `supabase/fix-expired-subscriptions.sql` | Script SQL (manuel) |
| 3 | `app/api/stripe/connect/balance/route.ts` | Bug fix |
| 4 | `app/api/owner/dashboard/route.ts`, `app/owner/_data/OwnerDataProvider.tsx` | Bug fix |
| 5 | `features/tickets/components/tickets-list.tsx` | Bug fix |
| 6 | 4 fichiers finances/invoices | Bug fix |
