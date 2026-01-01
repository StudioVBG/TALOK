# Intégration de l'API Management Supabase

## 📋 Résumé

Un client TypeScript complet a été créé pour interagir avec l'API Management de Supabase. Ce client permet de gérer programmatiquement vos projets Supabase, branches, fonctions Edge, secrets, clés API, et bien plus.

## 📁 Structure créée

```
lib/supabase/management-api/
├── types.ts          # Types TypeScript pour toutes les entités de l'API
├── client.ts         # Client principal avec toutes les méthodes
├── index.ts          # Export centralisé et fonction helper
└── README.md         # Documentation complète avec exemples

app/api/admin/management-api/
├── projects/route.ts    # Routes API pour gérer les projets
├── branches/route.ts    # Routes API pour gérer les branches
└── secrets/route.ts     # Routes API pour gérer les secrets
```

## 🚀 Démarrage rapide

### 1. Configuration

Ajoutez votre Personal Access Token (PAT) dans `.env.local` :

```env
SUPABASE_MANAGEMENT_API_TOKEN=PLACEHOLDER_TOKEN
```

Pour créer un PAT :
1. Allez sur [https://app.supabase.com/account/tokens](https://app.supabase.com/account/tokens)
2. Cliquez sur "Generate new token"
3. Copiez le token (il ne sera affiché qu'une seule fois)

### 2. Utilisation basique

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

// Créer le client
const client = createManagementClient();

// Lister tous les projets
const projects = await client.listProjects();
console.log(projects);
```

## 🎯 Fonctionnalités disponibles

### Projets
- ✅ Lister tous les projets
- ✅ Récupérer un projet spécifique
- ✅ Créer un nouveau projet
- ✅ Supprimer un projet
- ✅ Mettre en pause / restaurer un projet
- ✅ Vérifier le statut de santé

### Branches de base de données
- ✅ Lister les branches
- ✅ Créer une branche
- ✅ Merger une branche
- ✅ Reset une branche
- ✅ Push une branche
- ✅ Supprimer une branche

### Fonctions Edge
- ✅ Lister les fonctions
- ✅ Déployer une fonction
- ✅ Récupérer une fonction
- ✅ Supprimer une fonction

### Secrets
- ✅ Lister les secrets
- ✅ Créer des secrets
- ✅ Supprimer des secrets

### Clés API
- ✅ Lister les clés API
- ✅ Créer une clé API
- ✅ Mettre à jour une clé API
- ✅ Supprimer une clé API

### Configuration
- ✅ Configuration Auth
- ✅ Configuration Postgres
- ✅ Configuration Pooler

### Backups & Migrations
- ✅ Lister les backups
- ✅ Restaurer un backup PITR
- ✅ Lister les migrations
- ✅ Appliquer une migration

### Monitoring
- ✅ Récupérer les logs
- ✅ Générer les types TypeScript
- ✅ Récupérer les advisors (performance, sécurité)

## 📡 Routes API créées

### GET `/api/admin/management-api/projects`
Liste tous les projets accessibles via le PAT.

**Query params :**
- `ref` (optionnel) : Récupère un projet spécifique

**Exemple :**
```bash
curl http://localhost:3000/api/admin/management-api/projects \
  -H "Cookie: your-session-cookie"
```

### GET `/api/admin/management-api/branches?ref=<project_ref>`
Liste toutes les branches d'un projet.

**Exemple :**
```bash
curl "http://localhost:3000/api/admin/management-api/branches?ref=your-project-ref" \
  -H "Cookie: your-session-cookie"
```

### POST `/api/admin/management-api/branches`
Crée une nouvelle branche.

**Body :**
```json
{
  "project_ref": "your-project-ref",
  "branch_name": "feature/nouvelle-fonctionnalite",
  "git_branch": "feature/nouvelle-fonctionnalite",
  "persistent": true
}
```

### GET `/api/admin/management-api/secrets?ref=<project_ref>`
Liste tous les secrets d'un projet (sans exposer les valeurs).

### POST `/api/admin/management-api/secrets`
Crée ou met à jour des secrets.

**Body :**
```json
{
  "project_ref": "your-project-ref",
  "secrets": [
    { "name": "STRIPE_SECRET_KEY", "value": "sk_test_..." },
    { "name": "RESEND_API_KEY", "value": "re_..." }
  ]
}
```

### DELETE `/api/admin/management-api/secrets`
Supprime des secrets.

**Body :**
```json
{
  "project_ref": "your-project-ref",
  "secret_names": ["STRIPE_SECRET_KEY"]
}
```

## 🔒 Sécurité

⚠️ **Important** :

1. **Ne jamais exposer le token dans le client** : Utilisez uniquement dans les routes API Next.js
2. **Ne jamais commiter le token** : Le token est déjà dans `.gitignore` via `env.example`
3. **Permissions minimales** : Le PAT a les mêmes privilèges que votre compte Supabase
4. **Rotation régulière** : Changez votre token tous les 90 jours

## 📚 Documentation complète

Pour plus de détails et d'exemples, consultez :
- [`lib/supabase/management-api/README.md`](../../lib/supabase/management-api/README.md) - Documentation complète avec exemples
- [Documentation officielle Supabase](https://api.supabase.com/v1)
- [OpenAPI Spec](https://api.supabase.com/v1/openapi.json)

## 🎨 Exemples d'utilisation

### Créer une branche de développement

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

const branch = await client.createBranch(projectRef, {
  branch_name: "feature/nouvelle-fonctionnalite",
  git_branch: "feature/nouvelle-fonctionnalite",
  persistent: true,
  with_data: false,
});

console.log("Branche créée:", branch.id);
```

### Déployer une fonction Edge

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

const functionCode = `
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  return new Response(JSON.stringify({ message: "Hello!" }), {
    headers: { "Content-Type": "application/json" },
  });
});
`;

const file = new File([functionCode], "index.ts", {
  type: "text/typescript",
});

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

console.log("Fonction déployée:", deployedFunction.id);
```

### Gérer les secrets

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projectRef = "votre-project-ref";

// Créer des secrets
await client.createSecrets(projectRef, [
  { name: "STRIPE_SECRET_KEY", value: process.env.STRIPE_SECRET_KEY! },
  { name: "RESEND_API_KEY", value: process.env.RESEND_API_KEY! },
]);

// Lister les secrets (sans valeurs)
const secrets = await client.listSecrets(projectRef);
console.log("Secrets:", secrets.map((s) => s.name));

// Supprimer un secret
await client.deleteSecrets(projectRef, ["STRIPE_SECRET_KEY"]);
```

## 🐛 Dépannage

### Erreur "SUPABASE_MANAGEMENT_API_TOKEN n'est pas défini"
→ Vérifiez que vous avez ajouté le token dans `.env.local`

### Erreur "401 Unauthorized"
→ Votre token est invalide ou expiré. Générez un nouveau PAT.

### Erreur "429 Too Many Requests"
→ Vous avez dépassé la limite de 120 requêtes/minute. Attendez 1 minute avant de réessayer.

### Erreur "403 Forbidden"
→ Votre token n'a pas les permissions nécessaires pour cette opération.

## 📝 Notes

- Le client est entièrement typé avec TypeScript
- Toutes les méthodes sont async/await
- Les erreurs sont gérées avec des messages clairs
- Le client respecte les rate limits de l'API (120 req/min)

## 🔄 Prochaines étapes

Vous pouvez maintenant :
1. Créer des interfaces admin pour gérer vos projets Supabase
2. Automatiser le déploiement de fonctions Edge
3. Gérer les secrets de manière programmatique
4. Créer des branches de développement automatiquement
5. Monitorer vos projets via les logs et advisors

