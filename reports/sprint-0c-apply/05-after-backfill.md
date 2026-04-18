# PASS 2 — Validation post-migration backfill PCG

À remplir **après** avoir collé et Run `02-migration-backfill.sql` dans le SQL Editor prod.

---

## 2.1 — Output du Run

Attendu (les 2 INSERT peuvent retourner 0, 1, 2 ou 3 rows selon état AVANT) :

```
INSERT 0 N1   -- 614100 : N1 = nombre d'entities qui n'avaient pas encore ce compte
INSERT 0 N2   -- 708000 : N2 = nombre d'entities qui n'avaient pas encore ce compte
```

`N1 + N2` ∈ [0, 2 × total_entities]. Pour le contexte 3 entities où l'audit indique que ni 614100 ni 708000 ne sont présents sur aucune, on attend `N1 = 3` et `N2 = 3` (soit 6 rows nettes ajoutées).

> Output prod :
>
> ```
> (coller le résultat du Run ici)
> ```

Si erreur CHECK `account_type` → STOP. Cela signifierait une régression côté CHECK constraint. Rollback via `rollback.sql` (bloc ROLLBACK PASS 2) puis investigation.

---

## 2.2 — Vérification

```sql
SELECT account_number, label, account_type,
       COUNT(DISTINCT entity_id) AS entity_count
FROM chart_of_accounts
WHERE account_number IN ('419100', '654000', '614100', '708000')
GROUP BY account_number, label, account_type
ORDER BY account_number;
```

**Attendu** :
- **4 rows** (un par account_number)
- chaque row avec `entity_count` = nombre total d'entities (généralement 3 selon l'audit)
- `419100` : `'liability'`, label existant `'Provisions de charges recues'`
- `614100` : `'expense'`, label `'Charges reelles recuperables'` (pour les rows insérées par Sprint 0.c — celles préexistantes peuvent avoir un autre label, c'est OK)
- `654000` : `'expense'`, label existant `'Charges recuperables non recuperees'`
- `708000` : `'income'`, label `'Charges recuperees / TEOM'` (pour les rows insérées par Sprint 0.c)

> Output prod :
>
> ```
> (coller le résultat ici)
> ```

### Validation fine

- [ ] 4 rows exactement
- [ ] `entity_count` identique sur les 4 rows
- [ ] `entity_count` = valeur de `SELECT COUNT(*) FROM legal_entities`
- [ ] `708000` a bien `account_type = 'income'` (pas `'revenue'`)
- [ ] Aucune row de doublon `(account_number, entity_id)` :
  ```sql
  SELECT account_number, entity_id, COUNT(*)
  FROM chart_of_accounts
  WHERE account_number IN ('614100', '708000')
  GROUP BY account_number, entity_id
  HAVING COUNT(*) > 1;
  -- Attendu : 0 rows
  ```

> Output doublons :
>
> ```
> (coller)
> ```

---

## 2.3 — Enregistrement schema_migrations

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20260418150100';
```

**Attendu** : 1 row avec `version = '20260418150100'` et `name` contenant `charges_pcg_accounts_backfill_p2`.

> Output prod :
>
> ```
> (coller)
> ```

Si absent :

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260418150100', 'charges_pcg_accounts_backfill_p2')
ON CONFLICT (version) DO NOTHING;
```

---

## Verdict PASS 2

- [ ] ✅ Appliqué avec succès
- [ ] ⚠️ Appliqué avec anomalie mineure (décrire)
- [ ] 🔴 Échec — rollback PASS 2 exécuté (PASS 1 conservé)

### Anomalies / notes

> (laisser vide si ✅)
