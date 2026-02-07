# Application des migrations Supabase

## Fichiers disponibles

| Fichier | Description | Lignes |
|---------|-------------|--------|
| `../APPLY_ALL_MIGRATIONS.sql` | Toutes les migrations en un seul fichier | ~29 000 |
| `batch_01.sql` à `batch_05.sql` | Migrations découpées par lots (~7 000 lignes chacun) | ~7 000 |

## Comment appliquer sur Supabase

### Option 1 : SQL Editor Supabase (recommandé pour petits lots)

1. Ouvrez le [Dashboard Supabase](https://supabase.com/dashboard) → votre projet
2. Allez dans **SQL Editor**
3. Copiez le contenu de `batch_01.sql`
4. Collez et cliquez sur **Run**
5. Répétez pour `batch_02.sql`, `batch_03.sql`, etc.

### Option 2 : psql (recommandé pour le fichier complet)

```bash
# Avec l'URL de connexion directe (Settings → Database → Connection string)
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  -f APPLY_ALL_MIGRATIONS.sql
```

### Option 3 : Supabase CLI

```bash
npx supabase db push
```

(Requiert un projet lié : `npx supabase link`)

## Ordre d'exécution

Exécutez les fichiers **dans l'ordre** :
1. `batch_01.sql`
2. `batch_02.sql`
3. `batch_03.sql`
4. `batch_04.sql`
5. `batch_05.sql`

Ou exécutez `APPLY_ALL_MIGRATIONS.sql` en une seule fois avec psql.

## Migrations déjà appliquées (via MCP)

Si certaines migrations ont déjà été appliquées lors d'une session précédente, les erreurs du type "already exists" peuvent être ignorées (les migrations utilisent `IF NOT EXISTS` et `ADD COLUMN IF NOT EXISTS`).
