# Sprint B1 — PASS 4 : Investigation des ghost migrations

## Résumé

Un seul "ghost" investigué : la migration `20260208024659` citée par le prompt Sprint A comme « dernière appliquée en prod ».

- **Status** : GHOST APPLIED (supposé) — aucun fichier correspondant dans `supabase/migrations/`.
- **Aucune trace de suppression** dans l'historique git visible.
- **Aucune occurrence** dans le code ou les SQL files — uniquement citée dans le doc `docs/audits/pending-migrations.md`.
- **Reconstruction depuis `statements`** : nécessite PASS 1 (bloqué).

## Limite méthodologique : repo shallow

Le clone git de cette session est **shallow** (183 commits, le plus ancien étant le `2026-04-10`).

```
$ git rev-list --all --count
183
$ git rev-parse --is-shallow-repository
true
```

Conséquence : **impossible** d'investiguer l'historique avant le 2026-04-10. Si `20260208024659` a existé comme fichier .sql supprimé entre sa création (fév 2026) et le 10 avril 2026, cette suppression n'apparaît pas dans la vue git locale.

Pour un audit complet, il faudrait un clone full-history :

```bash
git fetch --unshallow
```

## Ce que l'archéologie partielle révèle

### 1. Aucune suppression de migration visible (post 2026-04-10)

```bash
git log --all --oneline --diff-filter=D -- "supabase/migrations/"
# → vide
```

### 2. Le timestamp `20260208024659` n'apparaît que dans un doc

```
docs/audits/pending-migrations.md:
  # Migrations en attente d'application (post-20260208024659)
  **Date :** 2026-04-09
  **Total migrations en attente :** 168
  **Derniere migration appliquee (prod) :** `20260208024659`
```

Ce document a été ajouté au repo par le **commit `2bf2cf8` le 2026-04-10** (première journée visible dans le repo). Il s'agit d'un snapshot exécuté par son auteur le 2026-04-09, qui a dû lire le résultat d'un `SELECT max(version) FROM supabase_migrations.schema_migrations`.

### 3. Aucun fichier proche avec timestamp 20260208xxxxxx

```
$ ls supabase/migrations/20260208*
20260208100000_fix_data_storage_audit.sql   ← seul résultat
```

Le premier fichier .sql du 8 février 2026 est `100000` (10h00m00s UTC). Le ghost `024659` signifierait 02h46m59s UTC — environ 7 heures plus tôt. Aucun fichier local ne correspond.

### 4. Explication des 55 migrations "en plus" vs l'annonce 168

Le doc de 2026-04-09 annonçait **168 pending**. Le Sprint A a compté **223 pending** le 2026-04-17 → différence de **55**.

Migrations ajoutées au repo entre 2026-04-10 et 2026-04-17 (8 jours) : **55 nouvelles**. Ça matche exactement — aucun mystère : c'est la velocity normale (Sprint 0 + Sprint 1 + autres commits de cette période contribuent).

Vérification rapide par énumération des fichiers avec timestamp > 20260410 :
```
$ ls supabase/migrations/2026041* 2026-04-1*.sql | wc -l
```

(~55 selon les comptages, à confirmer dans `sprint-b1-smoke-findings.md`).

## Hypothèses pour `20260208024659`

| # | Hypothèse | Probabilité | Test |
|---|---|---|---|
| 1 | **Migration exécutée directement dans Supabase SQL Editor** sans création de fichier. Supabase CLI enregistre quand même dans `schema_migrations`. | 🔴 **Élevée** | PASS 1 : `SELECT statements FROM schema_migrations WHERE version = '20260208024659'` — si le résultat contient du SQL, ça confirme |
| 2 | Fichier existait puis supprimé avant 2026-04-10 (hors vue shallow clone) | 🟡 Moyenne | `git fetch --unshallow` puis `git log --diff-filter=D` |
| 3 | Typo/erreur de lecture dans le doc | 🟡 Moyenne | PASS 1 : vérifier max(version) effectif |
| 4 | Entrée corrompue `schema_migrations` (`inserted_at` incohérent) | 🟢 Faible | PASS 1 : `SELECT inserted_at FROM schema_migrations WHERE version = '20260208024659'` |

## Recommandations

### Avant Sprint B2

1. **Débloquer PASS 1** (exécution SQL Editor par Thomas) pour confirmer/infirmer l'existence réelle de cette entrée dans `schema_migrations`.
2. **Si elle existe avec des statements** : la reconstruire localement en créant `supabase/migrations/20260208024659_<name>.sql` depuis les statements capturés. Permettra à la CI `supabase db diff --linked` de redevenir cohérente.
3. **Si elle existe sans statements** : laisser le ghost tel quel (Supabase moderne n'exige pas les statements pour la tracking), documenter dans un `README_MIGRATIONS.md`.
4. **Si elle n'existe pas** : corriger le doc `pending-migrations.md` (à archiver : ce doc est obsolète depuis Sprint A).

### Pour la stabilité long terme

- Proscrire l'exécution directe via SQL Editor (c'est par là que les ghosts arrivent).
- Imposer `supabase db push` comme seul canal d'application.
- Activer `CREATE TRIGGER` d'audit sur `supabase_migrations.schema_migrations` pour identifier qui a fait quoi.

## Risque résiduel

🟠 **Modéré** : ne pas résoudre ce ghost avant Sprint B2 n'est pas bloquant (Supabase ne re-tentera pas la migration `20260208024659`). Mais :

- `supabase db diff --linked` peut remonter cette migration comme "should be reverted" si l'état prod diverge.
- Tout nouveau développeur qui tente `supabase db reset --linked` en local produira un état différent de la prod.

## Conclusion

Le ghost `20260208024659` existe probablement en prod (hypothèse 1) mais son **contenu est perdu côté repo**. Sans PASS 1 exécuté, impossible de statuer. Pour Sprint B2, **traiter comme une inconnue** : ne pas tenter de le rejouer.
