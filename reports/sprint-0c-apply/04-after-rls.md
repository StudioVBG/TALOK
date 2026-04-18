# PASS 1 — Validation post-migration RLS

À remplir **après** avoir collé et Run `01-migration-rls.sql` dans le SQL Editor prod.

---

## 1.2 — Output du Run

Attendu (ordre exact) :

```
DROP POLICY
CREATE POLICY
COMMENT
```

> Output prod :
>
> ```
> (coller le résultat du Run ici)
> ```

Si erreur → STOP, pas de PASS 2. Rollback via `rollback.sql` (bloc ROLLBACK PASS 1). Ouvrir une section "Anomalies" ci-dessous.

---

## 1.3 — Vérification policy

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'lease_charge_regularizations'
  AND policyname = 'lease_charge_reg_tenant_contest';
```

**Attendu** :
- **1 row** (pas 2 — la migration a DROP + CREATE, pas CREATE-only)
- `cmd` = `UPDATE`
- `qual` (USING) contient :
  - `status = 'sent'`
  - `lease_id IN (SELECT l.id FROM leases l JOIN lease_signers ls ... ls.role IN ('locataire_principal', 'colocataire'))`
- `with_check` contient :
  - **`status IN ('sent', 'contested')`** (clé du fix Sprint 0.c — assouplissement)
  - Même condition lease_id que le qual

> Output prod :
>
> ```
> (coller le résultat ici)
> ```

**Validation** :
- [ ] 1 row retournée
- [ ] `cmd = UPDATE`
- [ ] `qual` contient `status = 'sent'` et `locataire_principal`
- [ ] `with_check` contient `status IN ('sent', 'contested')`
- [ ] `with_check` contient `locataire_principal`

---

## 1.4 — Test fonctionnel (OPTIONNEL)

Skipper si pas de compte tenant test dispo ou si jugé trop risqué en prod chaud.

Si tu l'exécutes :
1. Identifier une régul en status `sent` sur un bail dont tu es `locataire_principal` :
   ```sql
   SELECT id, status FROM lease_charge_regularizations
   WHERE lease_id IN (
     SELECT lease_id FROM lease_signers
     WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
   )
   AND status = 'sent'
   LIMIT 1;
   ```
2. UPDATE autorisé (doit réussir) :
   ```sql
   UPDATE lease_charge_regularizations
   SET status = 'contested', contest_reason = 'TEST — à retirer'
   WHERE id = '<id>';
   -- Attendu : 1 row updated
   ```
3. UPDATE interdit (doit échouer `42501 new row violates row-level security`) :
   ```sql
   UPDATE lease_charge_regularizations
   SET status = 'settled'
   WHERE id = '<id>';
   -- Attendu : ERROR 42501
   ```
4. Rollback test :
   ```sql
   UPDATE lease_charge_regularizations
   SET status = 'sent', contest_reason = NULL
   WHERE id = '<id>';
   ```

> Résultat test fonctionnel :
>
> ```
> (coller si exécuté, sinon écrire "skipped — validation fonctionnelle reportée au Sprint 0.d")
> ```

---

## 1.5 — Enregistrement schema_migrations

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20260418150000';
```

**Attendu** : 1 row avec `version = '20260418150000'` et `name` contenant `fix_charges_contested_rls`.

> Output prod :
>
> ```
> (coller le résultat ici)
> ```

Si absent (le SQL Editor n'auto-enregistre pas toujours vs CLI push) :

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260418150000', 'fix_charges_contested_rls')
ON CONFLICT (version) DO NOTHING;
```

---

## Verdict PASS 1

- [ ] ✅ Appliqué avec succès
- [ ] ⚠️ Appliqué avec anomalie mineure (décrire ci-dessous)
- [ ] 🔴 Échec — rollback exécuté

### Anomalies / notes

> (laisser vide si ✅)
