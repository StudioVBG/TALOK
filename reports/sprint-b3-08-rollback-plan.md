# Sprint B3 — PASS 8 : Plan de rollback d'urgence

⚠️ **Document dormant** — à activer UNIQUEMENT si une régression est détectée aux PASS 1-7.

## Décision préalable : ampleur de la régression

| Symptôme | Type rollback |
|---|---|
| 1 migration spécifique fautive identifiée | Reverse manuel (option 1) |
| Plusieurs régressions cascadantes | PITR Supabase (option 2) |
| RLS récursion détectée | Fix policy ciblé (option 3) |
| Cron qui ne déclenche plus | Re-vault + reschedule (option 4) |
| Table manquante | Re-apply migration isolée (option 5) |
| Bucket storage cassé | Re-créer via Dashboard (option 6) |

---

## Option 1 — Reverse de migration unique

### Quand l'utiliser
Une migration spécifique a introduit un bug identifiable mais le reste de Sprint B2 est sain.

### Procédure

1. Identifier la version coupable (ex: `20260417110000`)
2. Lire le fichier source pour déterminer ce qui doit être annulé
3. Créer un fichier de migration reverse :

```bash
# Sur la branche audit/migrations-168-pending
cat > supabase/migrations/$(date +%Y%m%d%H%M%S)_revert_<name>.sql <<'EOF'
-- Reverse of YYYYMMDDHHMMSS_<original_name>
-- Reason : <why this needs reverting>

-- Pour CREATE TABLE → DROP TABLE IF EXISTS
DROP TABLE IF EXISTS <table_name>;

-- Pour ADD COLUMN → DROP COLUMN
ALTER TABLE <table> DROP COLUMN IF EXISTS <column>;

-- Pour CREATE POLICY → DROP POLICY
DROP POLICY IF EXISTS "<policy>" ON <table>;

-- Pour CREATE TRIGGER → DROP TRIGGER
DROP TRIGGER IF EXISTS <trigger> ON <table>;

-- Tracking : NE PAS supprimer la ligne schema_migrations
-- (la migration originale reste "appliquée", on annule juste son effet)
EOF
```

4. Appliquer en SQL Editor (paste content)
5. Commit + push sur `audit/migrations-168-pending`

---

## Option 2 — PITR Supabase (Point-In-Time Recovery)

### Quand l'utiliser
Régressions multiples ou perte de données critiques. **Plan Supabase Pro ou supérieur requis**.

### Procédure

1. Dashboard Supabase → Database → **Backups**
2. Cliquer "Restore" → "Point in time"
3. Sélectionner timestamp **juste avant** Sprint B2 (ex: 2026-04-17 22:00 UTC)
4. Confirmer (la prod sera unavailable ~5-10 min)
5. **Toutes les migrations Sprint B2 seront annulées** — repartir d'un état cohérent

⚠️ **Données perdues** : tout ce qui a été créé/modifié pendant la fenêtre Sprint B2 (~24h) sera perdu. À discuter avec Thomas avant.

---

## Option 3 — Fix RLS recursion 42P17

### Quand l'utiliser
PASS 2 ou Sentry révèle une erreur `42P17 infinite recursion` sur policy.

### Procédure

```sql
-- 1. Identifier la policy fautive
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = '<table_problem>'
ORDER BY policyname;

-- 2. Drop la policy récursive
DROP POLICY "<policy_name>" ON <table_name>;

-- 3. Recréer avec helper SECURITY DEFINER (pattern Talok validé)
CREATE POLICY "<policy_name>" ON <table_name>
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());
  -- public.get_my_profile_id() est SECURITY DEFINER → bypass RLS
```

### Patterns à éviter (causent recursion)

```sql
-- ❌ Sub-SELECT direct sur la même table protégée par RLS
USING (id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))

-- ✅ Helper SECURITY DEFINER
USING (id = public.get_my_profile_id())
```

---

## Option 4 — Cron cassé (re-vault + reschedule)

### Quand l'utiliser
PASS 4 montre `total_runs = 0` ou `failed > 50%` pour un cron critique.

### Diagnostic

```sql
-- Vérifier que les secrets vault sont valides
SELECT name, length(decrypted_secret) AS len
FROM vault.decrypted_secrets
WHERE name IN ('app_url', 'cron_secret');
-- 'app_url' doit avoir len > 10
-- 'cron_secret' doit avoir len > 20
```

### Re-update des secrets si nécessaire

```sql
SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'app_url'),
  'https://talok.fr'
);

SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'cron_secret'),
  '<vraie_valeur_depuis_netlify_env>'
);
```

### Re-schedule un cron

```sql
-- Drop l'ancien
SELECT cron.unschedule('<jobname>');

-- Re-créer avec le pattern Vault standardisé
SELECT cron.schedule(
  '<jobname>',
  '<schedule_cron>',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/<endpoint>',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

---

## Option 5 — Table manquante détectée par PASS 1.1

### Quand l'utiliser
Une table critique attendue est `MISSING` dans la sortie de PASS 1.1.

### Procédure

1. Identifier la migration qui crée la table :
```bash
grep -rn "CREATE TABLE.*<missing_table>" supabase/migrations/
```

2. Lire le contenu, créer un standalone SQL block (CREATE TABLE IF NOT EXISTS + indexes + RLS + policies)

3. Coller dans SQL Editor, vérifier `\dt <missing_table>`

4. Tracker dans schema_migrations :
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('<version>', '<name>')
ON CONFLICT (version) DO NOTHING;
```

---

## Option 6 — Storage bucket à recréer

### Quand l'utiliser
PASS 3 montre un bucket attendu absent (ex: `documents`).

### Procédure

**Via Dashboard Supabase** (recommandé, le rôle SQL Editor n'a pas les permissions storage) :
1. Project → **Storage** → **New bucket**
2. Nommer (`documents` ou `landing-images`)
3. Public ON/OFF selon le bucket (cf. `sprint-b3-03-buckets.md`)
4. Configurer file_size_limit + allowed_mime_types
5. Créer les policies via UI Storage → bucket → Policies

---

## Procédure post-rollback

Quel que soit l'option choisie :

1. **Re-exécuter le PASS 1-5 audit pack** pour confirmer le retour à un état sain
2. **Documenter l'incident** dans `reports/sprint-b3-08-rollback-incident.md` (à créer si activé) :
   - Symptôme initial
   - Migration/policy/cron coupable identifié
   - Option choisie (1-6)
   - Procédure exécutée
   - Verdict final
3. **Mettre à jour le summary** Sprint B3 avec verdict NO-GO + actions correctives prises

---

## Statut au moment de l'écriture

✅ **Plan dormant** — aucune régression détectée à ce stade. Ce document n'est qu'une assurance.
