# API Management Supabase

Client TypeScript pour interagir avec l'API Management de Supabase.

## Configuration

### 1. Créer un Personal Access Token (PAT)

1. Allez sur [https://app.supabase.com/account/tokens](https://app.supabase.com/account/tokens)
2. Cliquez sur "Generate new token"
3. Donnez un nom à votre token (ex: "Talok - Management API")
4. Copiez le token généré (il ne sera affiché qu'une seule fois)

### 2. Ajouter le token aux variables d'environnement

Ajoutez dans votre fichier `.env.local` :

```env
SUPABASE_MANAGEMENT_API_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **Important** : Ne commitez jamais ce token dans Git. Il a les mêmes privilèges que votre compte Supabase.

## Utilisation

### Exemple basique

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

// Créer le client
const client = createManagementClient();

// Lister tous les projets
const projects = await client.listProjects();
console.log(projects);

// Récupérer un projet spécifique
const project = await client.getProject("votre-project-ref");
console.log(project);
```

### Gestion des branches

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Créer une branche de développement
const branch = await client.createBranch(projectRef, {
  branch_name: "feature/nouvelle-fonctionnalite",
  git_branch: "feature/nouvelle-fonctionnalite",
  persistent: true,
});

// Lister les branches
const branches = await client.listBranches(projectRef);

// Merger une branche
await client.mergeBranch(branch.id, {
  migration_version: "20240101000000",
});

// Supprimer une branche
await client.deleteBranch(branch.id);
```

### Gestion des fonctions Edge

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Lister les fonctions
const functions = await client.listFunctions(projectRef);

// Déployer une fonction
const file = new File([code], "index.ts", { type: "text/typescript" });
const deployedFunction = await client.deployFunction(
  projectRef,
  file,
  {
    slug: "ma-fonction",
    name: "Ma Fonction",
    verify_jwt: true,
    entrypoint_path: "index.ts",
  }
);

// Supprimer une fonction
await client.deleteFunction(projectRef, "ma-fonction");
```

### Gestion des secrets

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Créer des secrets
await client.createSecrets(projectRef, [
  { name: "STRIPE_SECRET_KEY", value: "sk_test_..." },
  { name: "RESEND_API_KEY", value: "re_..." },
]);

// Lister les secrets
const secrets = await client.listSecrets(projectRef);

// Supprimer des secrets
await client.deleteSecrets(projectRef, ["STRIPE_SECRET_KEY"]);
```

### Gestion des clés API

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Créer une clé API
const apiKey = await client.createApiKey(
  projectRef,
  {
    type: "anon",
    name: "Clé pour application mobile",
    description: "Utilisée par l'app iOS/Android",
  },
  true // reveal=true pour voir la clé complète
);

console.log("Nouvelle clé API:", apiKey.api_key);

// Lister les clés API
const keys = await client.listApiKeys(projectRef);

// Supprimer une clé API
await client.deleteApiKey(projectRef, apiKey.id, {
  reason: "Clé compromise",
  was_compromised: true,
});
```

### Configuration Auth

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Récupérer la configuration Auth
const authConfig = await client.getAuthConfig(projectRef);

// Mettre à jour la configuration Auth
await client.updateAuthConfig(projectRef, {
  site_url: "https://mon-app.com",
  disable_signup: false,
  mailer_autoconfirm: false,
  smtp_host: "smtp.resend.com",
  smtp_port: "587",
  smtp_user: "resend",
  smtp_pass: process.env.RESEND_API_KEY,
});
```

### Backups et restaurations

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Lister les backups
const backups = await client.listBackups(projectRef);
console.log("Backups disponibles:", backups.backups);

// Restaurer un backup PITR (Point-In-Time Recovery)
const recoveryTime = Math.floor(Date.now() / 1000) - 3600; // Il y a 1 heure
await client.restorePitrBackup(projectRef, recoveryTime);
```

### Migrations

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Lister les migrations appliquées
const migrations = await client.listMigrations(projectRef);

// Récupérer une migration spécifique
const migration = await client.getMigration(projectRef, "20240101000000");

// Appliquer une migration
await client.applyMigration(
  projectRef,
  "CREATE TABLE ma_table (id UUID PRIMARY KEY);",
  "create_ma_table",
  "DROP TABLE ma_table;"
);
```

### Génération de types TypeScript

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";
import { writeFile } from "fs/promises";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Générer les types TypeScript
const { types } = await client.generateTypeScriptTypes(projectRef, "public");

// Sauvegarder dans un fichier
await writeFile("lib/supabase/database.types.ts", types);
```

### Logs et monitoring

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Récupérer les logs des dernières 24h
const logs = await client.getLogs(projectRef, {
  iso_timestamp_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  iso_timestamp_end: new Date().toISOString(),
});

// Ou avec une requête SQL personnalisée
const customLogs = await client.getLogs(projectRef, {
  sql: "SELECT * FROM edge_logs WHERE level = 'error' LIMIT 100",
});
```

## Utilisation dans une route API Next.js

```typescript
// app/api/admin/projects/route.ts
import { NextResponse } from "next/server";
import { createManagementClient } from "@/lib/supabase/management-api";
import { requireAdmin } from "@/lib/helpers/auth-helper";

export async function GET(request: Request) {
  const { error, user } = await requireAdmin(request);

  if (error || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const client = createManagementClient();
    const projects = await client.listProjects();

    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error("Erreur lors de la récupération des projets:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
```

## Rate Limits

L'API Management a une limite de **120 requêtes par minute** par utilisateur. Si vous dépassez cette limite, vous recevrez une erreur HTTP 429.

Pour gérer cela, vous pouvez implémenter un système de retry avec backoff exponentiel :

```typescript
async function requestWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err.message.includes("429") && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Backoff exponentiel
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Sécurité

⚠️ **Important** :

1. **Ne jamais exposer le token dans le client** : Utilisez uniquement dans les routes API Next.js (Server Components ou API Routes)
2. **Ne jamais commiter le token** : Ajoutez `SUPABASE_MANAGEMENT_API_TOKEN` à votre `.gitignore`
3. **Utiliser des permissions minimales** : Le PAT a les mêmes privilèges que votre compte
4. **Rotater régulièrement** : Changez votre token tous les 90 jours

## Documentation complète

Pour plus de détails sur l'API Management, consultez :
- [Documentation officielle](https://api.supabase.com/v1)
- [OpenAPI Spec](https://api.supabase.com/v1/openapi.json)

