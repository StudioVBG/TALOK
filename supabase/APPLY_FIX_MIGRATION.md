# Appliquer la migration « Fix all missing tables and columns »

Cette migration corrige les erreurs 400/404 en production (colonnes `tenant_profiles`, table `conversations`, table `messages`, colonnes `documents`, bucket storage).

## Méthode recommandée : Supabase Dashboard (SQL Editor)

1. Ouvrir le [Dashboard Supabase](https://supabase.com/dashboard) et sélectionner le projet (ex. `poeijjosocmqlhgsacud`).
2. Aller dans **SQL Editor** (menu de gauche).
3. Cliquer sur **New query**.
4. Copier-coller **tout** le contenu du fichier :
   ```
   supabase/migrations/20260223200000_fix_all_missing_tables_and_columns.sql
   ```
5. Cliquer sur **Run** (ou Ctrl+Entrée).
6. Vérifier qu’aucune erreur n’apparaît dans le résultat.

## Méthode alternative : CLI Supabase

Si le projet est lié à Supabase en local :

```bash
npx supabase db push
```

Cela appliquera toutes les migrations en attente, dont celle-ci.

## Après application

- Recharger l’application (ex. `talok.fr/tenant/documents`) : les requêtes `tenant_profiles`, `documents` et `conversations` ne devraient plus renvoyer 400/404.
- L’upload de documents et la page Messages devraient fonctionner.
