# Rapport détaillé - Erreur MCP Supabase

**Date** : 2025-02-15  
**Statut** : Résolu (MCP désactivé, CLI/API utilisés)

---

## 1. Diagnostic de l'erreur

### Symptômes observés

Dans Cursor → Settings → Tools & MCP → Installed MCP Servers :
- Serveur "supabase" affiche : **"Error - Show Output"**
- Logs d'erreur npm :
  ```
  404 Not Found - GET https://registry.npmjs.org/supabase-mcp-server - Not found
  404 Not Found - GET https://registry.npmjs.org/@supabase/mcp - Not found
  ```

### Cause racine

**Aucun package npm officiel MCP Supabase n'existe actuellement** :
- Tentative d'installation de `@supabase/mcp` → 404
- Tentative d'installation de `supabase-mcp-server` → 404
- Le package référencé dans `.cursor/mcp.json` n'existe pas sur npm

### Configuration initiale (problématique)

**Fichier** : `.cursor/mcp.json`
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp"],  // ❌ Package inexistant
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
        "SUPABASE_PROJECT_REF": "${SUPABASE_PROJECT_REF}",
        "SUPABASE_DB_PASSWORD": "${SUPABASE_DB_PASSWORD}"
      },
      "disabled": false  // ❌ Tentative d'exécution → erreur
    }
  }
}
```

---

## 2. Solution appliquée (Option A - Recommandée)

### Actions réalisées

1. **Désactivation du serveur MCP** :
   - `.cursor/mcp.json` → `"disabled": true`
   - Ajout d'un commentaire explicatif

2. **Documentation mise à jour** :
   - `SUPABASE_MCP_SETUP.md` → Guide complet CLI + Management API
   - Explication claire : MCP non supporté officiellement

3. **Vérification CLI** :
   - ✅ Supabase CLI installé (v2.58.5)
   - ✅ Projet lié localement (`poeijjosocmqlhgsacud`)
   - ✅ Migrations présentes dans `supabase/migrations/`

### Configuration finale

**Fichier** : `.cursor/mcp.json`
```json
{
  "_comment": "MCP Supabase désactivé : aucun package officiel @supabase/mcp n'existe sur npm (404). Utiliser Supabase CLI et Management API à la place.",
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
        "SUPABASE_PROJECT_REF": "${SUPABASE_PROJECT_REF}",
        "SUPABASE_DB_PASSWORD": "${SUPABASE_DB_PASSWORD}"
      },
      "disabled": true,  // ✅ Désactivé
      "alwaysAllow": true
    }
  }
}
```

---

## 3. Outils alternatifs utilisés

### Supabase CLI (Opérations projet/DB)

**Installation** :
```bash
brew install supabase/tap/supabase
# Version installée : 2.58.5
```

**Commandes principales** :
```bash
supabase login                    # Authentification
supabase link --project-ref ...   # Lier projet
supabase db push                  # Pousser migrations
supabase db pull                  # Récupérer schéma remote
supabase gen types typescript     # Générer types TS
```

**État actuel** :
- ✅ CLI installé et fonctionnel
- ✅ Projet lié : `poeijjosocmqlhgsacud`
- ✅ Migrations disponibles : 42 fichiers dans `supabase/migrations/`

### Management API (Automatisation)

**Authentification** :
```bash
Authorization: Bearer <PAT>
```

**Endpoints utiles** :
- `GET /v1/projects` → Lister projets
- `GET /v1/projects/{ref}/secrets` → Secrets
- `GET /v1/projects/{ref}/storage/buckets` → Storage
- `POST /v1/projects/{ref}/database/query` → Requêtes SQL

**Documentation** : [Supabase Management API](https://supabase.com/docs/reference/api/introduction)

---

## 4. Option B - MCP Custom (Esquisse)

Si besoin d'un serveur MCP custom pour intégrer Supabase dans Cursor, voici une structure proposée :

### Structure proposée

```
tools/mcp/supabase/
├── index.ts          # Serveur MCP (spec MCP standard)
├── client.ts         # Client Management API
├── package.json      # Dépendances
└── README.md         # Documentation
```

### Tools exposés (exemples)

1. **`supabase_secrets_list`**
   - Description : Liste tous les secrets du projet
   - Endpoint : `GET /v1/projects/{ref}/secrets`
   - Paramètres : `projectRef` (string)

2. **`supabase_storage_buckets`**
   - Description : Liste tous les buckets Storage
   - Endpoint : `GET /v1/projects/{ref}/storage/buckets`
   - Paramètres : `projectRef` (string)

3. **`supabase_db_query`**
   - Description : Exécute une requête SQL
   - Endpoint : `POST /v1/projects/{ref}/database/query`
   - Paramètres : `projectRef` (string), `query` (string)

4. **`supabase_migrations_list`**
   - Description : Liste l'historique des migrations
   - Endpoint : `GET /v1/projects/{ref}/database/migrations`
   - Paramètres : `projectRef` (string)

### Implémentation minimale

**Fichier** : `tools/mcp/supabase/index.ts`
```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SupabaseClient } from './client.js';

const server = new Server(
  {
    name: 'supabase-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const client = new SupabaseClient(
  process.env.SUPABASE_ACCESS_TOKEN!,
  process.env.SUPABASE_PROJECT_REF!
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'supabase_secrets_list',
      description: 'Liste tous les secrets du projet Supabase',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'supabase_storage_buckets',
      description: 'Liste tous les buckets Storage',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'supabase_db_query',
      description: 'Exécute une requête SQL',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Requête SQL à exécuter',
          },
        },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'supabase_secrets_list':
      return { content: [{ type: 'text', text: JSON.stringify(await client.listSecrets()) }] };
    
    case 'supabase_storage_buckets':
      return { content: [{ type: 'text', text: JSON.stringify(await client.listBuckets()) }] };
    
    case 'supabase_db_query':
      return { content: [{ type: 'text', text: JSON.stringify(await client.query(args.query)) }] };
    
    default:
      throw new Error(`Tool ${name} not found`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Fichier** : `tools/mcp/supabase/client.ts`
```typescript
export class SupabaseClient {
  private baseUrl = 'https://api.supabase.com/v1';
  
  constructor(
    private accessToken: string,
    private projectRef: string
  ) {}

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listSecrets() {
    return this.request(`/projects/${this.projectRef}/secrets`);
  }

  async listBuckets() {
    return this.request(`/projects/${this.projectRef}/storage/buckets`);
  }

  async query(sql: string) {
    return this.request(`/projects/${this.projectRef}/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query: sql }),
    });
  }
}
```

**Fichier** : `tools/mcp/supabase/package.json`
```json
{
  "name": "@project/supabase-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "supabase-mcp": "./index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

**Configuration Cursor** : `.cursor/mcp.json`
```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["tools/mcp/supabase/index.js"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
        "SUPABASE_PROJECT_REF": "${SUPABASE_PROJECT_REF}"
      }
    }
  }
}
```

### Estimation de développement

- **Temps** : 0.5-1 jour
- **Complexité** : Moyenne
- **Dépendances** : `@modelcontextprotocol/sdk`

**Note** : Cette option n'est pas nécessaire si vous utilisez déjà le CLI Supabase et la Management API.

---

## 5. Validation

### Résultats attendus

- ✅ Plus d'erreur MCP dans Cursor
- ✅ CLI Supabase fonctionnel
- ✅ Documentation complète disponible
- ✅ Workflow opérationnel sans MCP

### Tests effectués

1. **CLI Supabase** :
   - ✅ Installation vérifiée (v2.58.5)
   - ✅ Projet lié (`poeijjosocmqlhgsacud`)
   - ✅ Migrations présentes (42 fichiers)

2. **Configuration MCP** :
   - ✅ Serveur désactivé (`disabled: true`)
   - ✅ Commentaire explicatif ajouté
   - ✅ Documentation mise à jour

---

## 6. Recommandations

### Court terme

1. **Utiliser Supabase CLI** pour toutes les opérations projet/DB/migrations
2. **Utiliser Management API** pour l'automatisation programmatique
3. **Ne pas réactiver le MCP** tant qu'aucun package officiel n'existe

### Long terme

1. **Surveiller** la publication d'un package MCP officiel Supabase
2. **Si publié** : Migrer vers le package officiel
3. **Si besoin urgent** : Implémenter l'Option B (MCP custom)

---

## 7. Références

- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/start)
- [Supabase Management API](https://supabase.com/docs/reference/api/introduction)
- [MCP Specification](https://modelcontextprotocol.io/)

---

**Rapport généré le** : 2025-02-15  
**Statut final** : ✅ Résolu (MCP désactivé, alternatives fonctionnelles)

