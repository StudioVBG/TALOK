# Guide d'application des migrations SQL

Ce guide explique comment appliquer les migrations SQL pour le projet de gestion locative.

## Migration à appliquer

### `20251206500000_fix_lease_end_processes.sql`

Cette migration crée les tables et fonctions nécessaires pour le module de fin de bail :

- **Table `lease_end_processes`** : Suivi des processus de fin de bail
- **Table `edl_inspection_items`** : Items d'inspection EDL sortie
- **Table `renovation_items`** : Travaux de rénovation planifiés
- **Table `lease_end_timeline`** : Timeline des actions
- **Tables de référence** : `vetusty_grid`, `repair_cost_grid`
- **Fonction RPC** : `get_owner_lease_end_processes`
- **Vue** : `v_upcoming_lease_ends`

---

## Méthode 1 : Via le Dashboard Supabase (Recommandé)

### Étapes :

1. **Connectez-vous** au [Dashboard Supabase](https://app.supabase.com)

2. **Sélectionnez votre projet**

3. **Allez dans "SQL Editor"** (icône dans la sidebar gauche)

4. **Créez une nouvelle requête** (bouton "+ New query")

5. **Copiez le contenu** du fichier :
   ```
   supabase/migrations/20251206500000_fix_lease_end_processes.sql
   ```

6. **Exécutez** en cliquant sur "Run" ou `Cmd+Enter` / `Ctrl+Enter`

7. **Vérifiez** dans "Table Editor" que les tables sont créées

---

## Méthode 2 : Via Supabase CLI

### Prérequis :

```bash
# Installer Supabase CLI
npm install -g supabase

# OU avec Homebrew (macOS)
brew install supabase/tap/supabase
```

### Configuration :

```bash
# Se connecter à Supabase
supabase login

# Lier le projet (remplacer par votre project-ref)
supabase link --project-ref YOUR_PROJECT_REF
```

### Application de la migration :

```bash
# Appliquer toutes les migrations en attente
supabase db push

# OU pour une seule migration
supabase migration up
```

---

## Méthode 3 : Connexion directe PostgreSQL

### Prérequis :

- `psql` installé
- URL de connexion depuis Dashboard > Settings > Database

### Commande :

```bash
# Récupérer l'URL depuis le dashboard Supabase
# Settings > Database > Connection string (URI)

psql "postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/20251206500000_fix_lease_end_processes.sql
```

---

## Vérification post-migration

### Via SQL Editor :

```sql
-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'lease_end_processes',
    'edl_inspection_items', 
    'renovation_items',
    'lease_end_timeline',
    'vetusty_grid',
    'repair_cost_grid'
  );

-- Vérifier la fonction RPC
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'get_owner_lease_end_processes';

-- Vérifier la vue
SELECT * FROM v_upcoming_lease_ends LIMIT 5;

-- Vérifier les RLS policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'lease_end_processes';
```

### Via l'application :

1. **Test API** : `GET /api/end-of-lease` doit fonctionner sans erreur
2. **Test UI** : `/owner/end-of-lease` doit afficher la liste des processus

---

## Rollback (si nécessaire)

En cas de problème, vous pouvez annuler la migration :

```sql
-- ⚠️ ATTENTION : Supprime toutes les données de ces tables

-- Supprimer les vues
DROP VIEW IF EXISTS v_upcoming_lease_ends;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS get_owner_lease_end_processes(UUID);
DROP FUNCTION IF EXISTS update_lease_end_processes_updated_at();

-- Supprimer les tables (ordre important pour les FK)
DROP TABLE IF EXISTS lease_end_timeline;
DROP TABLE IF EXISTS renovation_items;
DROP TABLE IF EXISTS edl_inspection_items;
DROP TABLE IF EXISTS repair_cost_grid;
DROP TABLE IF EXISTS vetusty_grid;
DROP TABLE IF EXISTS lease_end_processes;
```

---

## Problèmes courants

### Erreur "relation already exists"

La table existe déjà. Utilisez `CREATE TABLE IF NOT EXISTS` (déjà inclus dans la migration).

### Erreur "permission denied"

Vérifiez que vous utilisez bien le service_role key et non l'anon key.

### Erreur "column does not exist"

La table `edl` n'existe peut-être pas. Créez-la d'abord ou commentez les références :

```sql
-- Commentez ces lignes si la table edl n'existe pas
-- edl_entree_id UUID REFERENCES edl(id),
-- edl_sortie_id UUID REFERENCES edl(id),
```

---

## Support

En cas de problème :
1. Vérifiez les logs dans Supabase Dashboard > Logs > Postgres
2. Consultez la documentation : https://supabase.com/docs
3. Ouvrez une issue sur le repository du projet

