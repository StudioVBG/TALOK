# Sprint A — PASS 2 : Détection Staging Supabase

## Verdict

⚠️ **Aucun staging dédié détecté dans le repo.** Les recommandations d'audits antérieurs (`docs/audits/talok-audit-retest-2026-04-07.md`) mentionnaient explicitement « tester la migration entities/entity_members sur staging », mais aucune config staging n'est versionnée.

## Éléments trouvés

### Fichiers env
- `/home/user/TALOK/.env.example` : template unique (pas de variante staging/preview)
- `/home/user/TALOK/env.example` : idem
- **Aucun** `.env.staging`, `.env.preview`, `.env.production` versionné (normal — c'est secret)

### `supabase/config.toml`
- Un seul `project_id = "Gestion_locative"` (slug local de la CLI Supabase, pas un project_ref distant)
- `shadow_port = 54320` configuré pour les `supabase db diff` locaux → **shadow DB locale disponible** via `supabase start`
- Aucun multi-project ni alias staging

### `netlify.toml`
- Mentionne `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` comme vars à configurer dans l'UI Netlify, **sans distinction contexte** (pas de `[context.deploy-preview.environment]`, pas de `[context.branch-deploy]`)
- Tous les deploys (production, preview, branch) partagent donc la même DB Supabase en pratique, **sauf override manuel dans l'UI Netlify** (non auditable depuis le repo)

### Scripts
- `scripts/migrate-iban-encryption.ts:15` : commentaire « Tester en staging d'abord » → intent documenté mais aucun setup correspondant
- Aucun script type `db:clone-staging`, `db:shadow`, `db:promote`

### Documentation
Mentions de staging dans `docs/` : purement textuelles (bonnes pratiques, recommandations). Aucune config ni runbook.

## Options pour exécuter Sprint B (application des migrations)

### Option A — Créer un projet Supabase staging dédié (RECOMMANDÉ)
- **Pros** : environnement miroir de prod, pas de risque utilisateur, rollback = restore
- **Cons** : coût (~25 $/mois plan Pro), ~1h de setup, seed à refaire
- **Setup** :
  1. `supabase projects create talok-staging`
  2. Récupérer `project_ref`, URLs, keys
  3. `supabase db dump --linked` (prod) → `supabase db push --project-ref <staging>`
  4. Ajouter un context Netlify branch-deploy → pointer vers staging

### Option B — Shadow DB locale (RAPIDE, moins fidèle)
- **Pros** : gratuit, instantané, parfait pour valider la syntaxe des migrations
- **Cons** : pas de volume de données réel, triggers/crons prod non reproduits
- **Setup** :
  1. `supabase start` (docker local, port 54322)
  2. `supabase db reset --linked` (applique toutes les migrations du repo sur la DB locale)
  3. Si une migration crash → on sait laquelle, sans aucun impact sur prod

### Option C — Dry-run via `supabase db diff`
- **Pros** : compare repo vs prod SANS modifier prod
- **Cons** : nécessite shadow DB quand même
- **Commande** : `supabase db diff --linked --schema public` → génère un SQL des différences

## Recommandation Sprint B

**Option A indispensable pour les batches 🔴 et 🚨.**
Option B suffisante pour valider la syntaxe des batches 🟢 et 🟡 avant application prod.

## Prochaine décision utilisateur

- [ ] Créer un projet staging Supabase (Option A) — GO/NO-GO
- [ ] Accepter de faire uniquement shadow DB locale (Option B)
- [ ] Accepter d'appliquer direct en prod avec backup (risqué, déconseillé)
