# 🛠 Guide de Déploiement : Modules IA Agentique

Ce guide détaille les étapes nécessaires pour activer les fonctionnalités d'IA basées sur LangGraph en production.

## 1. Pré-requis d'Environnement

Ajouter les variables suivantes dans votre `.env` (local) et dans les variables d'environnement Vercel/Supabase :

```bash
# Requis pour les appels LLM réels
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note :** Le code actuel est configuré avec un mode "Simulation" (Mock) par défaut pour éviter de consommer des crédits API pendant le développement. Pour activer le vrai LLM, vous devez décommenter les sections `ChatOpenAI` dans les fichiers `.graph.ts` situés dans `features/*/ai/`.

## 2. Migrations Base de Données

Trois migrations SQL doivent être appliquées pour stocker les résultats des analyses IA.

Exécutez les fichiers suivants via l'éditeur SQL de Supabase ou la CLI :

1.  `supabase/migrations/202502191200_document_verification.sql`
    *   Ajoute `verification_status`, `ai_analysis`, `rejection_reason` à la table `documents`.
2.  `supabase/migrations/202502191300_ticket_maintenance_ai.sql`
    *   Ajoute `ai_summary`, `ai_suggested_action`, `ai_suggested_provider_type` à la table `tickets`.

## 3. Vérification des Services

Les services suivants ont été créés et sont auto-initialisés :

*   `features/documents/services/document-ai.service.ts`
*   `features/tickets/services/messaging-ai.service.ts`
*   `features/tickets/services/maintenance-ai.service.ts`

Ils sont appelés automatiquement par les routes API existantes :
*   `POST /api/documents/upload-batch` -> Déclenche l'analyse documentaire.
*   `POST /api/tickets` -> Déclenche l'analyse maintenance.
*   `POST /api/tickets/[id]/ai-draft` -> Route dédiée pour la génération de réponse.

## 4. Activation "Réelle" (Sortie du mode Simulation)

Pour passer en mode production réel avec GPT-4o :

1.  Ouvrir `features/documents/ai/document-analysis.graph.ts`
2.  Ouvrir `features/tickets/ai/message-draft.graph.ts`
3.  Ouvrir `features/tickets/ai/maintenance.graph.ts`

Dans chaque fichier, remplacer le code mocké par l'appel LLM :

```typescript
// AVANT (Mock)
/*
const model = new ChatOpenAI(...)
const response = await model.invoke(...)
*/
const extractedData = { ...mock... }

// APRÈS (Prod)
const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
const response = await model.invoke(...);
const extractedData = JSON.parse(response.content as string);
```

## 5. Monitoring

Surveillez les logs Vercel/Server pour les tags suivants :
*   `[AI Agent]`
*   `[DocumentAiService]`
*   `[MaintenanceAiService]`

En cas d'erreur IA, les services sont conçus pour "fail soft" (ne pas bloquer l'action utilisateur, juste ne pas fournir l'enrichissement IA).

