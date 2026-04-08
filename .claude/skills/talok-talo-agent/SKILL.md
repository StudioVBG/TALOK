---
name: talok-talo-agent
description: >
  Architecture complète de l'agent IA TALO : assistant comptable IA,
  analyse documents, conseil fiscal, scoring candidatures, chatbot métier.
  Déclenche dès que la tâche touche à agent TALO, IA Talok, assistant IA,
  scoring candidature, aide fiscale IA, chatbot propriétaire, analyse
  document IA, classification automatique, ou GPT-4 Talok.
---

# Talok — Agent IA TALO : Référence complète

## 1. Vision produit

TALO est l'assistant IA intégré à Talok. Il aide les propriétaires à :
1. **Classifier automatiquement** les documents uploadés (OCR + GPT-4)
2. **Scorer les candidatures** locataires (dossier → note /100)
3. **Conseiller sur la fiscalité** (micro-foncier vs réel, optimisation)
4. **Analyser les dépenses** (catégorisation, anomalies, tendances)
5. **Répondre aux questions** métier (chatbot gestion locative)

**Feature gating :** Disponible uniquement à partir du plan **Pro** (`hasAITalo: true`).

---

## 2. Architecture technique

```
Vercel AI SDK (streaming)
  ↓
LangChain / LangGraph (orchestration)
  ↓
OpenAI GPT-4o-mini (LLM principal — coût faible)
  ↑ fallback
OpenAI GPT-4o (pour les tâches complexes : scoring, fiscalité)
  ↓
Tesseract.js (OCR local — Sprint 2 compta, déjà codé)
```

### 2.1 Stack IA existant (dans le codebase)

- ✅ `openai` package installé
- ✅ `langchain` + `langgraph` installés
- ✅ Vercel AI SDK installé
- ✅ Tesseract.js pour OCR (Sprint 2 compta)
- ✅ `OCR_EXTRACTION_SYSTEM_PROMPT` défini
- ✅ `validateTVACoherence()` pour vérifier la cohérence TVA des factures

---

## 3. Modèle de données

```sql
-- ============================================================
-- Table : Conversations TALO
-- ============================================================
CREATE TABLE talo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  entity_id UUID REFERENCES legal_entities(id),
  title TEXT,                            -- Auto-généré depuis 1er message
  context JSONB DEFAULT '{}',            -- {propertyId, leaseId, tenantId...}
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE talo_conversations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Table : Messages TALO
-- ============================================================
CREATE TABLE talo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES talo_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',           -- {tokens_used, model, tool_calls}
  attachments JSONB DEFAULT '[]',        -- [{document_id, type, name}]
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE talo_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_talo_messages_conv ON talo_messages(conversation_id);

-- ============================================================
-- Table : Scorings candidatures
-- ============================================================
CREATE TABLE tenant_scorings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  lease_id UUID REFERENCES leases(id),
  tenant_profile_id UUID REFERENCES profiles(id),
  
  -- Identité candidat
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  
  -- Score
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  criteria JSONB NOT NULL,               -- Détail par critère
  -- {
  --   revenus: { score: 85, detail: "3.2x le loyer", weight: 30 },
  --   stabilite_emploi: { score: 70, detail: "CDI depuis 2 ans", weight: 20 },
  --   historique: { score: 90, detail: "Pas d'impayés", weight: 20 },
  --   dossier_complet: { score: 100, detail: "Toutes pièces fournies", weight: 15 },
  --   garant: { score: 60, detail: "Garant avec revenus 2x", weight: 15 }
  -- }
  
  recommendation TEXT NOT NULL
    CHECK (recommendation IN ('fortement_recommande', 'recommande', 'reserve', 'deconseille')),
  summary TEXT NOT NULL,                 -- Résumé en français
  
  -- Documents analysés
  documents_analyzed JSONB DEFAULT '[]', -- [{document_id, type, extracted_data}]
  
  -- IA metadata
  model_used TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER,
  cost_cents INTEGER,                    -- Coût IA de ce scoring
  
  scored_at TIMESTAMPTZ DEFAULT now(),
  scored_by UUID REFERENCES profiles(id) -- Le proprio qui a lancé le scoring
);

ALTER TABLE tenant_scorings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_scorings_property ON tenant_scorings(property_id);

-- ============================================================
-- Table : Usage IA (quotas et facturation)
-- ============================================================
CREATE TABLE talo_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  month TEXT NOT NULL,                   -- '2026-04'
  messages_count INTEGER DEFAULT 0,
  scorings_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, month)
);

ALTER TABLE talo_usage ENABLE ROW LEVEL SECURITY;
```

---

## 4. Routes API

### 4.1 Chat TALO

| Route | Méthode | Description | Gate |
|-------|---------|-------------|------|
| `/api/talo/conversations` | GET | Liste conversations | Pro+ |
| `/api/talo/conversations` | POST | Créer conversation | Pro+ |
| `/api/talo/conversations/[id]/messages` | GET | Historique messages | Pro+ |
| `/api/talo/chat` | POST (streaming) | Envoyer message + réponse stream | Pro+ |

### 4.2 Scoring candidatures

| Route | Méthode | Description | Gate |
|-------|---------|-------------|------|
| `/api/talo/scoring` | POST | Lancer un scoring | Pro+ |
| `/api/talo/scoring/[id]` | GET | Résultat scoring | Pro+ |
| `/api/talo/scoring/compare` | POST | Comparer N candidats | Pro+ |

### 4.3 Aide fiscale

| Route | Méthode | Description | Gate |
|-------|---------|-------------|------|
| `/api/talo/fiscal/simulate` | POST | Simulation micro vs réel | Confort+ (hasFiscalAI) |
| `/api/talo/fiscal/optimize` | POST | Suggestions optimisation | Pro+ |

### 4.4 Classification documents

| Route | Méthode | Description | Gate |
|-------|---------|-------------|------|
| `/api/talo/classify` | POST | Classifier un document uploadé | Confort+ |
| `/api/talo/extract` | POST | Extraire données d'un document | Pro+ |

---

## 5. Prompts système

### 5.1 Prompt principal TALO

```typescript
const TALO_SYSTEM_PROMPT = `Tu es TALO, l'assistant IA de Talok, plateforme de gestion locative française.

RÔLE : Tu aides les propriétaires bailleurs à gérer leurs locations.

CONTEXTE UTILISATEUR :
- Nom : {ownerName}
- Plan : {plan}
- Entités : {entities}
- Biens : {properties}
- Baux actifs : {activeLeases}
- Localisation : {department} (TVA : {tvaRate}%)

COMPÉTENCES :
1. Comptabilité locative (revenus fonciers, BIC, micro/réel, charges déductibles)
2. Fiscalité immobilière (2044, 2072, LMNP, SCI IR/IS, déficit foncier)
3. Droit locatif (loi 89, ALUR, ELAN, préavis, caution, charges récupérables)
4. Gestion pratique (régularisation charges, révision loyer IRL, quittances)
5. Analyse documents (factures, baux, avis d'imposition)
6. Spécificités DROM-COM (TVA, codes postaux, réglementation locale)

RÈGLES :
- Réponds TOUJOURS en français
- Cite les articles de loi quand pertinent
- Précise toujours que tu n'es PAS un conseiller fiscal agréé
- Calcule la TVA DROM-COM correctement ({department})
- Ne donne JAMAIS de conseil d'investissement
- Si tu n'es pas sûr → recommande de consulter un expert-comptable
- Montants en euros, format français (1 234,56 €)
`;
```

### 5.2 Prompt scoring candidature

```typescript
const SCORING_SYSTEM_PROMPT = `Tu es un expert en analyse de dossiers locatifs.

Analyse le dossier du candidat et attribue un score /100 selon ces critères :
- Revenus (30%) : ratio revenus/loyer (idéal >= 3x)
- Stabilité emploi (20%) : CDI > CDD > intérim > sans emploi
- Historique (20%) : anciens bailleurs, impayés passés
- Dossier complet (15%) : toutes pièces fournies et lisibles
- Garant (15%) : solidité du garant si présent

DONNÉES EXTRAITES DES DOCUMENTS :
{extractedData}

LOYER DEMANDÉ : {rentAmount}€/mois

Réponds en JSON strict :
{
  "overall_score": 0-100,
  "criteria": {
    "revenus": { "score": 0-100, "detail": "...", "weight": 30 },
    "stabilite_emploi": { "score": 0-100, "detail": "...", "weight": 20 },
    "historique": { "score": 0-100, "detail": "...", "weight": 20 },
    "dossier_complet": { "score": 0-100, "detail": "...", "weight": 15 },
    "garant": { "score": 0-100, "detail": "...", "weight": 15 }
  },
  "recommendation": "fortement_recommande|recommande|reserve|deconseille",
  "summary": "Résumé en 2-3 phrases"
}`;
```

---

## 6. Pages UI

### 6.1 Chat TALO

```
app/owner/talo/
  ├── page.tsx                  → Interface chat (conversations + messages)
  ├── scoring/
  │   ├── page.tsx              → Liste scorings
  │   └── [id]/
  │       └── page.tsx          → Résultat scoring détaillé
  └── fiscal/
      └── page.tsx              → Simulateur fiscal (micro vs réel)
```

### 6.2 Composants

```typescript
// features/talo/components/

TaloChatInterface.tsx           // Interface chat complète (sidebar convos + messages)
TaloMessageBubble.tsx           // Bulle message (user/assistant) avec markdown
TaloInput.tsx                   // Input avec upload document + envoi
TaloConversationList.tsx        // Liste conversations (sidebar)
TaloContextBanner.tsx           // Bannière "Contexte : Bien X, Bail Y"
TaloTypingIndicator.tsx         // Animation "TALO réfléchit..."

ScoringLauncher.tsx             // Formulaire lancement scoring (sélection docs)
ScoringResultCard.tsx           // Résultat : score global + radar chart critères
ScoringComparison.tsx           // Comparaison N candidats (tableau)
ScoreBadge.tsx                  // Badge coloré (vert/orange/rouge)

FiscalSimulator.tsx             // Formulaire simulation (revenus, charges, régime)
FiscalComparisonChart.tsx       // Graphique micro vs réel (économie annuelle)
FiscalRecommendation.tsx        // Carte recommandation IA

TaloGate.tsx                    // Wrapper qui affiche upsell si plan < Pro
```

---

## 7. Streaming (Vercel AI SDK)

```typescript
// app/api/talo/chat/route.ts

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages, conversationId, context } = await req.json();
  
  // Feature gate
  const profile = await getAuthProfile(req);
  const plan = await getCurrentPlan(profile.id);
  if (!PLAN_LIMITS[plan].hasAITalo) {
    return new Response('Plan Pro requis', { status: 403 });
  }
  
  // Construire le contexte
  const systemPrompt = buildTaloPrompt(profile, context);
  
  // Stream la réponse
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
    maxTokens: 2000,
    temperature: 0.3,
    onFinish: async ({ text, usage }) => {
      // Sauvegarder en DB
      await saveTaloMessage(conversationId, 'assistant', text, {
        tokens_used: usage.totalTokens,
        model: 'gpt-4o-mini',
      });
      // Tracker usage
      await incrementTaloUsage(profile.id, usage.totalTokens);
    },
  });
  
  return result.toDataStreamResponse();
}
```

---

## 8. Tools LangGraph (fonctions que TALO peut appeler)

```typescript
const TALO_TOOLS = [
  {
    name: 'get_property_info',
    description: 'Récupère les informations d\'un bien (adresse, loyer, locataire)',
    parameters: { propertyId: 'string' },
  },
  {
    name: 'get_lease_info',
    description: 'Récupère les détails d\'un bail (dates, loyer, locataire, statut)',
    parameters: { leaseId: 'string' },
  },
  {
    name: 'get_financial_summary',
    description: 'Résumé financier (revenus, charges, solde) pour une période',
    parameters: { entityId: 'string', startDate: 'string', endDate: 'string' },
  },
  {
    name: 'simulate_fiscal',
    description: 'Simule micro-foncier vs régime réel pour un bien',
    parameters: { propertyId: 'string', year: 'number' },
  },
  {
    name: 'classify_document',
    description: 'Classifie un document uploadé (type, catégorie, données extraites)',
    parameters: { documentId: 'string' },
  },
  {
    name: 'calculate_rent_revision',
    description: 'Calcule la révision de loyer selon l\'IRL',
    parameters: { leaseId: 'string', quarter: 'string' },
  },
  {
    name: 'calculate_charges_regularization',
    description: 'Calcule la régularisation annuelle de charges',
    parameters: { leaseId: 'string', year: 'number' },
  },
];
```

---

## 9. Quotas et coûts

```typescript
const TALO_LIMITS = {
  pro: {
    messagesPerMonth: 500,           // ~500 messages/mois
    scoringsPerMonth: 20,            // ~20 scorings/mois
    maxTokensPerMessage: 4000,
  },
  enterprise: {
    messagesPerMonth: Infinity,
    scoringsPerMonth: Infinity,
    maxTokensPerMessage: 8000,
  },
};

// Coûts estimés par usage :
// GPT-4o-mini : ~0,003€/message (500 tokens avg)
// GPT-4o scoring : ~0,03€/scoring (3000 tokens avg)
// Coût mensuel par utilisateur Pro : ~2-3€
```

---

## 10. Feature gating détaillé

| Fonctionnalité | Gratuit | Confort | Pro | Enterprise |
|----------------|---------|---------|-----|------------|
| Classification docs auto | ❌ | ✅ (OCR seul) | ✅ (OCR + GPT) | ✅ |
| Aide fiscale simulation | ❌ | ✅ (basique) | ✅ (avancée) | ✅ |
| Chat TALO | ❌ | ❌ | ✅ 500 msg/mois | ✅ illimité |
| Scoring candidatures | ❌ | ❌ | ✅ 20/mois | ✅ illimité |
| Analyse dépenses IA | ❌ | ❌ | ✅ | ✅ |
| Tools (révision loyer, etc.) | ❌ | ❌ | ✅ | ✅ |

---

## 11. Règles TOUJOURS / JAMAIS

### TOUJOURS
- Vérifier `hasAITalo` ou `hasFiscalAI` AVANT tout appel API IA
- Tracker chaque appel dans `talo_usage` (tokens, coûts)
- Utiliser GPT-4o-mini par défaut (basculer GPT-4o uniquement pour scoring)
- Streamer les réponses (Vercel AI SDK)
- Sauvegarder l'historique complet en DB
- Afficher le disclaimer "TALO n'est pas un conseiller fiscal agréé"
- Respecter les quotas mensuels par plan

### JAMAIS
- Envoyer des données personnelles du locataire au LLM sans consentement
- Donner un conseil d'investissement
- Garantir un résultat fiscal
- Appeler GPT-4o pour du simple chat (coût x10)
- Stocker le contenu des documents dans les messages (stocker document_id)
- Permettre l'accès TALO en plan Gratuit ou Confort (sauf hasFiscalAI basique)
