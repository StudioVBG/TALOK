# Guide de Migration GPT-5.2 Multi-Agent SOTA 2026

## ✅ Migration Terminée

Tous les fichiers ont été créés et configurés. Voici comment finaliser l'installation.

## 📋 Checklist de Démarrage

### 1. Installer les Dépendances

```bash
npm install
```

Cela installera :
- `@langchain/langgraph-checkpoint-postgres` pour PostgresSaver
- Mise à jour des dépendances LangGraph existantes

### 2. Appliquer la Migration SQL

```bash
# Via Supabase CLI
supabase migration up

# Ou via le dashboard Supabase
# Allez dans Database > Migrations et appliquez 20260101000001_langgraph_checkpoints.sql
```

Cette migration crée la table `langgraph_checkpoints` pour la persistance des états d'exécution.

### 3. Configurer les Variables d'Environnement

Ajoutez dans votre `.env.local` :

```env
# GPT-5.2 Models (SOTA Décembre 2025)
OPENAI_MODEL_INSTANT=gpt-5.2-instant
OPENAI_MODEL_THINKING=gpt-5.2-thinking
OPENAI_MODEL_PRO=gpt-5.2-pro

# Modèle par défaut pour l'assistant
OPENAI_MODEL=gpt-5.2-thinking

# Database URL pour PostgresSaver (optionnel mais recommandé)
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

**Note** : Si `DATABASE_URL` n'est pas configurée, l'assistant utilisera `MemorySaver` en fallback (persistance en mémoire uniquement).

### 4. Vérifier l'Installation

```bash
# Vérifier la configuration
npx tsx scripts/verify-ai-setup.ts
```

## 🚀 Utilisation

### Architecture Simple (Par Défaut)

Utilise un agent unique avec tools adaptés par rôle :

```typescript
import { assistantService } from "@/features/assistant/services/assistant.service";

const result = await assistantService.sendMessage(
  threadId,
  "Recherche mes biens à Paris",
  context
);
```

### Architecture Multi-Agent Supervisor

Utilise un Supervisor qui route vers des agents spécialisés :

```typescript
import { assistantService } from "@/features/assistant/services/assistant.service";

const result = await assistantService.sendMessageMultiAgent(
  threadId,
  "Quels sont mes droits concernant le dépôt de garantie ?",
  context
);

console.log(`Agent utilisé : ${result.agentUsed}`); // "legal_agent"
```

## 🏗️ Architecture

### Agents Spécialisés

1. **property_agent** : Gestion des biens immobiliers
   - Recherche, création, modification de biens
   - Modèle : GPT-5.2 Thinking

2. **finance_agent** : Gestion financière
   - Factures, paiements, loyers, charges
   - Modèle : GPT-5.2 Thinking

3. **ticket_agent** : Gestion des tickets de maintenance
   - Création, mise à jour, assignation
   - Modèle : GPT-5.2 Thinking

4. **legal_agent** : Questions juridiques avec RAG
   - Recherche dans la Loi ALUR
   - Références légales précises
   - Modèle : GPT-5.2 Pro (pour précision maximale)

### Routage Automatique

Le Supervisor route automatiquement selon les mots-clés :

- **property_agent** : "bien", "propriété", "logement"
- **finance_agent** : "paiement", "facture", "loyer"
- **ticket_agent** : "ticket", "maintenance", "réparation"
- **legal_agent** : "loi", "juridique", "droit", "alur"

## 🔧 Dépannage

### Erreur "Cannot find module '@langchain/langgraph/prebuilt'"

C'est probablement un problème de cache TypeScript. Essayez :

```bash
# Nettoyer le cache Next.js
rm -rf .next

# Nettoyer le cache TypeScript
rm -rf tsconfig.tsbuildinfo

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur "DATABASE_URL non configurée"

L'assistant utilisera automatiquement `MemorySaver` en fallback. Pour activer `PostgresSaver` :

1. Configurez `DATABASE_URL` dans `.env.local`
2. Appliquez la migration SQL
3. Redémarrez l'application

### Erreur "Table langgraph_checkpoints does not exist"

Appliquez la migration :

```bash
supabase migration up
```

## 📊 Performance

### Contexte Étendu GPT-5.2

- **Contexte max** : 400k tokens (vs 128k pour GPT-4o)
- **Output max** : 128k tokens
- **Cutoff** : Août 2025

### Persistance

- **PostgresSaver** : Persistance durable en production
- **MemorySaver** : Fallback si DATABASE_URL non configurée
- **Checkpoints** : Sauvegarde automatique de l'état à chaque étape

## 📚 Documentation

- **README Assistant** : `features/assistant/README.md`
- **Configuration Modèles** : `lib/ai/config.ts`
- **Migration SQL** : `supabase/migrations/20260101000001_langgraph_checkpoints.sql`

## 🎯 Prochaines Étapes

1. ✅ Migration GPT-5.2 terminée
2. ✅ Architecture multi-agent implémentée
3. ✅ PostgresSaver configuré
4. ⏳ Tester l'architecture multi-agent en production
5. ⏳ Implémenter le routage intelligent avec le Supervisor Agent
6. ⏳ Ajouter le support des handoffs entre agents (multi-tours)
7. ⏳ Implémenter le Human-in-the-Loop pour les actions critiques

## 📝 Notes Importantes

- Les modèles GPT-5.2 sont disponibles depuis décembre 2025
- L'architecture est rétrocompatible avec l'ancien code
- Le routage actuel utilise des mots-clés simples (peut être amélioré avec le Supervisor Agent)
- PostgresSaver nécessite PostgreSQL avec l'extension pgvector (déjà installée pour le RAG)

## 🆘 Support

En cas de problème :
1. Vérifiez les logs de l'application
2. Exécutez `npx tsx scripts/verify-ai-setup.ts`
3. Consultez `features/assistant/README.md` pour plus de détails

