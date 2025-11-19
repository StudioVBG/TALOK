# Supabase - Configuration et utilisation (CLI + Management API)

## ⚠️ MCP Supabase non supporté officiellement

**Problème identifié** : Aucun package npm officiel `@supabase/mcp` ou `supabase-mcp-server` n'existe actuellement. Les tentatives d'installation via Cursor MCP génèrent des erreurs 404.

**Solution recommandée** : Utiliser les outils officiels supportés par Supabase :
- **Supabase CLI** pour les opérations projet/DB/migrations
- **Management API** pour l'automatisation programmatique

---

## 1. Supabase CLI (Recommandé)

### Installation

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# ou via npm
npm i -g supabase
```

### Authentification

```bash
# Méthode interactive
supabase login

# Méthode non-interactive (CI/CD)
export SUPABASE_ACCESS_TOKEN="votre_token"
```

### Lier un projet

```bash
supabase link --project-ref VOTRE_PROJECT_REF --password "VOTRE_MDP_POSTGRES"
```

### Commandes principales

```bash
# Vérifier l'état
supabase projects list
supabase services

# Migrations
supabase db push                    # Pousser migrations locales → remote
supabase migration list              # Lister les migrations
supabase migration up               # Appliquer migrations en attente

# Database
supabase db remote commit           # Commiter les changements locaux
supabase db reset                   # Reset local DB
supabase db dump                    # Dumper le schéma

# Types TypeScript
supabase gen types typescript --local > lib/types/supabase.ts
```

### Documentation complète

- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/start)

---

## 2. Management API (Pour automatisation)

### Authentification

Tous les appels API nécessitent un Personal Access Token (PAT) dans le header :

```bash
curl https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer sbp_..."
```

### Générer un PAT

1. Dashboard Supabase → Account → Access Tokens
2. Generate new token
3. Scopes recommandés : `projects:read`, `database:read`, `database:write`

### Endpoints utiles

#### Projets
```bash
# Lister tous les projets
GET /v1/projects
Authorization: Bearer <PAT>

# Obtenir un projet
GET /v1/projects/{ref}
```

#### Database
```bash
# Exécuter une requête SQL
POST /v1/projects/{ref}/database/query
Authorization: Bearer <PAT>
Content-Type: application/json
{
  "query": "SELECT * FROM properties LIMIT 10;"
}

# Lister les migrations
GET /v1/projects/{ref}/database/migrations
```

#### Secrets
```bash
# Lister les secrets
GET /v1/projects/{ref}/secrets
Authorization: Bearer <PAT>

# Créer un secret
POST /v1/projects/{ref}/secrets
{
  "name": "MY_SECRET",
  "value": "secret_value"
}
```

#### Storage
```bash
# Lister les buckets
GET /v1/projects/{ref}/storage/buckets
Authorization: Bearer <PAT>
```

### Documentation complète

- [Supabase Management API Reference](https://supabase.com/docs/reference/api/introduction)

---

## 3. Configuration dans le projet

### Variables d'environnement

Créez un fichier `.env.local` (non commité) :

```bash
# Supabase CLI (optionnel si vous utilisez `supabase login`)
SUPABASE_ACCESS_TOKEN=sbp_...

# Pour les appels Management API depuis le code
NEXT_PUBLIC_SUPABASE_URL=https://poeijjosocmqlhgsacud.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Utilisation dans le code

#### Via Supabase JS Client (recommandé)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

#### Via Management API (pour opérations admin)

```typescript
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
})
```

---

## 4. MCP Custom (Optionnel - Avancé)

Si vous avez besoin d'un serveur MCP custom pour intégrer Supabase dans Cursor, vous pouvez créer un serveur minimal :

### Structure proposée

```
tools/mcp/supabase/
├── index.ts          # Serveur MCP (spec MCP)
├── client.ts         # Client Management API
└── package.json      # Dépendances
```

### Exemple de serveur MCP minimal

Le serveur exposerait des tools comme :
- `supabase_secrets_list` → Liste les secrets du projet
- `supabase_storage_buckets` → Liste les buckets Storage
- `supabase_db_query` → Exécute une requête SQL

**Note** : Cette option nécessite ~0.5-1 jour de développement et n'est pas nécessaire si vous utilisez déjà le CLI.

---

## 5. Dépannage

### Erreur "command not found" (CLI)

```bash
# Vérifier l'installation
which supabase
supabase --version

# Réinstaller si nécessaire
brew reinstall supabase/tap/supabase
```

### Erreur 401/403 (API)

- Vérifier que le PAT est valide et non expiré
- Vérifier les scopes du token (projects:read, database:read, etc.)
- Régénérer le token si nécessaire

### Erreur "Project not found"

- Vérifier la référence du projet (Project Settings → General)
- Vérifier que le PAT a accès à ce projet

### Erreur de connexion DB

- Vérifier le mot de passe Postgres (Project Settings → Database)
- Vérifier les Network Restrictions si activées

---

## 6. Sécurité

- ⚠️ **Ne jamais commiter** les tokens, mots de passe ou clés API
- ✅ Utiliser des variables d'environnement locales (`.env.local`)
- ✅ Régénérer immédiatement les tokens en cas d'exposition
- ✅ Utiliser des tokens avec scopes minimaux nécessaires

---

## Résumé

| Outil | Usage | Quand l'utiliser |
|-------|-------|------------------|
| **Supabase CLI** | Opérations projet/DB/migrations | Développement local, migrations, types |
| **Management API** | Automatisation programmatique | CI/CD, scripts, intégrations |
| **Supabase JS Client** | Accès aux données depuis l'app | Frontend/Backend Next.js |

**MCP Supabase** : Non disponible officiellement → Utiliser CLI/API à la place.

---

Pour toute question, consulter :
- [Supabase CLI Docs](https://supabase.com/docs/reference/cli/start)
- [Management API Docs](https://supabase.com/docs/reference/api/introduction)
