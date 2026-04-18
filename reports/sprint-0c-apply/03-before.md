# PASS 0.3 — Snapshot AVANT application

Exécuter ces 3 snapshots dans Supabase SQL Editor (**prod**) **avant** toute exécution des migrations. Coller les résultats sous chaque bloc.

---

## Snapshot 1 — RLS policies actuelles sur `lease_charge_regularizations`

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'lease_charge_regularizations'
ORDER BY policyname;
```

**Attendu (d'après migrations sur main)** : 3 policies.

| policyname | cmd | Détail |
|---|---|---|
| `lease_charge_reg_owner_access` | ALL | owner via `properties.owner_id` |
| `lease_charge_reg_tenant_contest` | UPDATE | USING tenant + status='sent' — **WITH CHECK dépend de l'état prod réel** (090300 strict `status='contested'` appliqué ? ou 20260408130000 broken `status='sent'` toujours en place ?) |
| `lease_charge_reg_tenant_read` | SELECT | tenant via lease_signers |

> Output prod :
>
> ```
> (coller le résultat ici)
> ```

**Valider** :
- Si `with_check` contient `status = 'sent'` seul → la migration 090300 n'a pas été appliquée, on est bien sur la version BROKEN. La migration RLS Sprint 0.c va fixer ça.
- Si `with_check` contient `status = 'contested'` seul → la migration 090300 a déjà tourné en prod, Sprint 0.c va juste assouplir à `IN ('sent','contested')`.

---

## Snapshot 2 — Comptes PCG actuels

```sql
SELECT account_number, label, account_type,
       COUNT(DISTINCT entity_id) AS entity_count
FROM chart_of_accounts
WHERE account_number IN ('419100', '654000', '614100', '708000')
GROUP BY account_number, label, account_type
ORDER BY account_number;
```

**Attendu avant application** :
- Au minimum `419100` + `654000` (seedés par la migration 090400 Sprint 0.b si elle a tourné, sinon 0 rows).
- **614100 et 708000 probablement manquants** (c'est l'hypothèse Sprint 0.c : les anciennes entities n'ont pas eu le seed via `PCG_OWNER_ACCOUNTS` — c'est justement ce que cette migration corrige).

Total entities à connaître via :
```sql
SELECT COUNT(*) AS total_entities FROM legal_entities;
```

> Output prod :
>
> ```
> (coller le résultat ici)
> ```

---

## Snapshot 3 — `schema_migrations` state

```sql
SELECT COUNT(*) AS total_migrations
FROM supabase_migrations.schema_migrations;

-- Détail pour les 2 migrations qu'on va appliquer (doivent être ABSENTES avant) :
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260418150000', '20260418150100')
ORDER BY version;
```

**Attendu** :
- `total_migrations` = N (noter la valeur)
- Deuxième query : **0 rows** (les 2 versions ne doivent pas encore être enregistrées)

> Output prod :
>
> ```
> (coller le résultat ici)
> ```

---

## Checklist GO/NO-GO PASS 1

Avant de lancer PASS 1, tous les points ci-dessous doivent être ✅ :

- [ ] Snapshot 1 collé — policy `lease_charge_reg_tenant_contest` existe
- [ ] Snapshot 2 collé — état PCG documenté
- [ ] Snapshot 3 collé — versions 20260418150000 / 20260418150100 absentes
- [ ] `rollback.sql` relu
- [ ] Projet Supabase confirmé = **PROD** (pas staging)
- [ ] Pas d'autre déploiement en cours
