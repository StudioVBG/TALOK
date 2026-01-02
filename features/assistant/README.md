# Assistant IA - Architecture SOTA 2026

## Vue d'ensemble

L'assistant IA utilise deux architectures différentes selon les besoins :

1. **Architecture Simple** : Agent unique avec tools adaptés par rôle
2. **Architecture Multi-Agent Supervisor** : Supervisor orchestre des agents spécialisés

## Architecture Simple

**Fichier** : `features/assistant/ai/property-assistant.graph.ts`

- **Utilisation** : Par défaut, pour la plupart des cas d'usage
- **Modèle** : GPT-5.2 Thinking
- **Persistance** : PostgresSaver (avec fallback MemorySaver)
- **Avantages** : Simple, rapide, efficace pour la plupart des tâches

### Exemple d'utilisation

```typescript
import { assistantService } from "@/features/assistant/services/assistant.service";

const result = await assistantService.sendMessage(
  threadId,
  "Recherche mes biens à Paris",
  context
);
```

## Architecture Multi-Agent Supervisor

**Fichier** : `features/assistant/ai/multi-agent-graph.ts`

- **Utilisation** : Pour des tâches complexes nécessitant plusieurs domaines d'expertise
- **Modèles** : 
  - Supervisor : GPT-5.2 Thinking
  - Property Agent : GPT-5.2 Thinking
  - Finance Agent : GPT-5.2 Thinking
  - Ticket Agent : GPT-5.2 Thinking
  - Legal Agent : GPT-5.2 Pro (pour précision maximale)
- **Persistance** : PostgresSaver
- **Avantages** : Spécialisation, meilleure précision pour les domaines complexes

### Agents Spécialisés

1. **property_agent** : Gestion des biens immobiliers
   - Recherche de biens
   - Création/modification de biens
   - Consultation des détails

2. **finance_agent** : Gestion financière
   - Recherche de paiements
   - Création de factures/quittances
   - Suivi des impayés

3. **ticket_agent** : Gestion des tickets de maintenance
   - Création de tickets
   - Mise à jour de statuts
   - Assignation de prestataires

4. **legal_agent** : Questions juridiques avec RAG
   - Recherche dans la Loi ALUR
   - Références légales précises
   - Conseils réglementaires

### Exemple d'utilisation

```typescript
import { assistantService } from "@/features/assistant/services/assistant.service";

const result = await assistantService.sendMessageMultiAgent(
  threadId,
  "Quels sont mes droits concernant le dépôt de garantie ?",
  context
);

console.log(`Agent utilisé : ${result.agentUsed}`); // "legal_agent"
```

## Configuration

### Variables d'environnement

```env
# GPT-5.2 Models
OPENAI_MODEL_INSTANT=gpt-5.2-instant
OPENAI_MODEL_THINKING=gpt-5.2-thinking
OPENAI_MODEL_PRO=gpt-5.2-pro

# Modèle par défaut
OPENAI_MODEL=gpt-5.2-thinking

# Database pour PostgresSaver
DATABASE_URL=postgresql://user:password@host:port/database
```

### Migration SQL

Appliquez la migration pour créer la table de checkpoints :

```bash
supabase migration up
```

La migration `20260101000001_langgraph_checkpoints.sql` crée :
- Table `langgraph_checkpoints` pour la persistance
- Index pour les performances
- Fonction de nettoyage des anciens checkpoints

## Routage Automatique

Le Supervisor route automatiquement vers l'agent approprié selon les mots-clés :

- **property_agent** : "bien", "propriété", "logement", "appartement"
- **finance_agent** : "paiement", "facture", "loyer", "charge"
- **ticket_agent** : "ticket", "maintenance", "réparation", "problème"
- **legal_agent** : "loi", "juridique", "droit", "bail", "alur"

## RAG Legal

L'agent Legal utilise le RAG (Retrieval Augmented Generation) pour :
- Rechercher dans la base de connaissances juridiques (Loi ALUR, décrets)
- Fournir des références légales précises
- Expliquer les droits et obligations

Le RAG est configuré dans `lib/ai/rag/legal-knowledge.service.ts`.

## Performance

### Contexte Étendu GPT-5.2

- **Contexte max** : 400k tokens (vs 128k pour GPT-4o)
- **Output max** : 128k tokens
- **Cutoff** : Août 2025

### Persistance

- **PostgresSaver** : Persistance durable en production
- **MemorySaver** : Fallback si DATABASE_URL non configurée
- **Checkpoints** : Sauvegarde automatique de l'état à chaque étape

## Monitoring

L'assistant est intégré avec Langfuse pour le monitoring :
- Traces des interactions
- Métriques de performance
- Analyse des coûts

## Migration depuis GPT-4o

L'architecture est rétrocompatible. Les anciens appels continuent de fonctionner, mais utilisent maintenant GPT-5.2 Thinking par défaut.

Pour migrer vers l'architecture multi-agent :

```typescript
// Avant
const result = await assistantService.sendMessage(threadId, message, context);

// Après (optionnel)
const result = await assistantService.sendMessageMultiAgent(threadId, message, context);
```

## Troubleshooting

### Erreur "DATABASE_URL non configurée"

L'assistant utilise MemorySaver en fallback. Pour activer PostgresSaver :
1. Configurez `DATABASE_URL` dans `.env`
2. Appliquez la migration SQL

### Erreur "createReactAgent not found"

Vérifiez que `@langchain/langgraph` est à jour :
```bash
npm install @langchain/langgraph@latest
```

### Erreur "Table langgraph_checkpoints does not exist"

Appliquez la migration :
```bash
supabase migration up
```

## Prochaines Étapes

- [ ] Implémenter le routage intelligent avec le Supervisor Agent (au lieu du routage par mots-clés)
- [ ] Ajouter le support des handoffs entre agents (multi-tours)
- [ ] Implémenter le Human-in-the-Loop pour les actions critiques
- [ ] Ajouter le monitoring des coûts par agent
- [ ] Optimiser les prompts pour chaque agent spécialisé

