# Sprint B3 — PASS 7 : Monitoring & Sentry post-application

## Statut

⏳ **En attente d'exécution utilisateur** — Sentry non accessible via tools en session.

## Pré-requis

- Accès Sentry → projet `talok` (organisation `talok` selon `env.example`)
- Timestamp de référence : **fin Sprint B2 = ~2026-04-18 22:30 UTC** (heure de la dernière migration appliquée)
- Window d'observation : 4h après le timestamp ci-dessus

## Checks à faire (Sentry UI)

### 7.1 — Pic d'erreurs

Sentry → **Issues** → filtre `firstSeen:>2026-04-18T22:30Z` :

- ✅ < 5 nouvelles classes d'erreur → OK
- ⚠️ 5-15 → review individuelle
- 🔴 > 15 → régression majeure suspectée

### 7.2 — Erreurs RLS recursion

Search bar : `42P17 OR "infinite recursion"`

Window 4h post-B2 :
- ✅ 0 résultat → RLS non régressée
- 🔴 1+ résultat → identifier la table+policy fautive, fix urgent (cf. PASS 8 plan rollback section 2)

### 7.3 — Erreurs SMS Sprint 0+1

Search : `tags.sms.event:failed OR tags.sms.event:verify_failed`

- ✅ Volume similaire au baseline pré-B2 → SMS stable
- ⚠️ Pic > 3x baseline → vérifier credentials Twilio + endpoints
- Vérifier breakdown par `tags.sms.error_code` :
  - 60200/60203 (numéros invalides) → user error, non bloquant
  - 20003/20404 (config) → 🔴 problème credentials

### 7.4 — Erreurs SQL côté app (Supabase client)

Search : `error.value:*PostgrestError* OR error.value:*does not exist*`

- ✅ Volume stable
- 🔴 Pic d'erreurs `relation X does not exist` → migration manquante côté app (révéler la table qu'on doit créer)
- 🔴 Pic d'erreurs `column X does not exist` → schéma divergent (révéler la colonne)

### 7.5 — Latence routes critiques

Sentry → **Performance** → filtres :
- `transaction.op:http.server`
- Routes : `/owner/properties`, `/owner/dashboard`, `/tenant`, `/tenant/dashboard`, `/api/cron/*`

- ✅ p95 latency stable vs baseline pré-B2
- ⚠️ p95 augmentation > 50% → enquête nécessaire (probable index manquant ou query plan changé)

## Logs Netlify (alternative si Sentry indispo)

Netlify Dashboard → ton site → Functions → tab "Logs" :
- Filtrer `/api/cron/*` → vérifier qu'on voit des logs récents (les crons s'exécutent)
- Filtrer `/api/leases/*`, `/api/properties/*` → check 500 récents

## Output utilisateur attendu

| Check | Résultat |
|---|---|
| 7.1 nouvelles classes erreur | _____ |
| 7.2 erreurs RLS 42P17 | _____ |
| 7.3 erreurs SMS Twilio | _____ |
| 7.4 erreurs `does not exist` | _____ |
| 7.5 latence routes critiques | _____ |

## Verdict de cette PASS

- 🟢 **GO** si tous les checks à 0 ou volume stable
- 🟡 **GO avec réserves** si <5 erreurs isolées non-systémiques
- 🔴 **NO-GO** si pic massif d'erreurs nouvelles ou 42P17 / `relation does not exist` répétés
