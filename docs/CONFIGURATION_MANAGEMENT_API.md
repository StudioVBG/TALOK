# Configuration de l'API Management Supabase

## 🔑 Configuration du token

### Étape 1 : Ajouter le token dans `.env.local`

Créez ou modifiez le fichier `.env.local` à la racine du projet et ajoutez :

```env
SUPABASE_MANAGEMENT_API_TOKEN=PLACEHOLDER_TOKEN
```

⚠️ **Important** : 
- Le fichier `.env.local` est déjà dans `.gitignore` et ne sera pas commité
- Ne partagez jamais ce token publiquement
- Ce token a les mêmes privilèges que votre compte Supabase

### Étape 2 : Vérifier la configuration

Testez que le token fonctionne avec le script de test :

```bash
npx tsx scripts/test-management-api.ts
```

Ou si vous avez `tsx` installé globalement :

```bash
tsx scripts/test-management-api.ts
```

Le script devrait afficher la liste de vos projets Supabase.

## ✅ Vérification

Si tout fonctionne, vous devriez voir :

```
🔍 Test de l'API Management Supabase...

1. Création du client...
✅ Client créé avec succès

2. Récupération de la liste des projets...
✅ X projet(s) trouvé(s)

📋 Projets disponibles :
...
```

## 🚀 Utilisation

Une fois configuré, vous pouvez utiliser le client dans vos routes API :

```typescript
import { createManagementClient } from "@/lib/supabase/management-api";

const client = createManagementClient();
const projects = await client.listProjects();
```

## 🔒 Sécurité

- ✅ Le token est dans `.env.local` qui est ignoré par Git
- ✅ Utilisez uniquement dans les routes API (Server Components)
- ✅ Ne jamais exposer le token côté client
- ✅ Rotatez le token tous les 90 jours

## 📚 Documentation

Pour plus d'informations, consultez :
- [`SUPABASE_MANAGEMENT_API.md`](./SUPABASE_MANAGEMENT_API.md) - Documentation complète
- [`lib/supabase/management-api/README.md`](../lib/supabase/management-api/README.md) - Guide d'utilisation

