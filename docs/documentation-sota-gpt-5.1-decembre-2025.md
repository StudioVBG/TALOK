# Documentation SOTA GPT-5.1 - Décembre 2025

## État de l'Art des Modèles de Langage et Frameworks Agentiques

**Version**: 1.0  
**Date de publication**: 1er Décembre 2025  
**Auteur**: Documentation Technique  
**Dernière mise à jour**: 3 Décembre 2025

---

## Table des Matières

1. [Introduction et Contexte](#1-introduction-et-contexte)
2. [GPT-5.1 : Le Nouveau Standard](#2-gpt-51--le-nouveau-standard)
3. [Architecture et Raisonnement Adaptatif](#3-architecture-et-raisonnement-adaptatif)
4. [Function Calling et Tool Use](#4-function-calling-et-tool-use)
5. [Outils Intégrés : apply_patch et shell](#5-outils-intégrés--apply_patch-et-shell)
6. [Fenêtre de Contexte et Capacités](#6-fenêtre-de-contexte-et-capacités)
7. [Modes de Fonctionnement](#7-modes-de-fonctionnement)
8. [Intégration API OpenAI](#8-intégration-api-openai)
9. [LangChain 1.0](#9-langchain-10)
10. [LangGraph : Orchestration Agentique](#10-langgraph--orchestration-agentique)
11. [Architectures Multi-Agents](#11-architectures-multi-agents)
12. [Mémoire et Persistance](#12-mémoire-et-persistance)
13. [Streaming et Temps Réel](#13-streaming-et-temps-réel)
14. [Human-in-the-Loop](#14-human-in-the-loop)
15. [Déploiement et Production](#15-déploiement-et-production)
16. [Benchmarks et Performances](#16-benchmarks-et-performances)
17. [Cas d'Usage et Patterns](#17-cas-dusage-et-patterns)
18. [Sécurité et Bonnes Pratiques](#18-sécurité-et-bonnes-pratiques)
19. [Tarification et Accès](#19-tarification-et-accès)
20. [Références et Sources](#20-références-et-sources)

---

## 1. Introduction et Contexte

### 1.1 Vue d'Ensemble

GPT-5.1, lancé en novembre 2025 par OpenAI, représente une avancée majeure dans le domaine des modèles de langage de grande taille (LLM). Cette version introduit des capacités révolutionnaires en matière de raisonnement adaptatif, d'exécution de code et de workflows agentiques.

**Sources officielles**:
- [OpenAI - GPT-5.1 for Developers](https://openai.com/index/gpt-5-1-for-developers/) - Annonce officielle
- [OpenAI Platform Documentation](https://platform.openai.com/docs/models/gpt-5.1/) - Documentation technique

### 1.2 Évolution de la Série GPT-5

| Version | Date de sortie | Caractéristiques principales |
|---------|----------------|------------------------------|
| GPT-5 | Août 2025 | Premier modèle de la série, SOTA pour le codage |
| GPT-5.1 | Novembre 2025 | Raisonnement adaptatif, outils intégrés |
| GPT-5.1 Instant | Novembre 2025 | Optimisé pour la rapidité |
| GPT-5.1 Thinking | Novembre 2025 | Optimisé pour le raisonnement profond |

### 1.3 Positionnement sur le Marché

GPT-5.1 se positionne comme le modèle de référence pour :
- **Développement logiciel** : Génération de code de haute qualité
- **Agents autonomes** : Workflows complexes avec outils
- **Applications conversationnelles** : Interactions naturelles et contextuelles
- **Analyse de documents** : Traitement de contextes très longs

---

## 2. GPT-5.1 : Le Nouveau Standard

### 2.1 Caractéristiques Principales

GPT-5.1 introduit plusieurs innovations majeures par rapport à ses prédécesseurs :

#### Raisonnement Adaptatif
Le modèle ajuste dynamiquement le temps consacré au raisonnement en fonction de la complexité de la tâche. Cette capacité permet d'optimiser à la fois la latence et la qualité des réponses.

> "GPT-5.1 is designed to balance intelligence and speed by dynamically adapting the time spent on reasoning based on task complexity."
> — [OpenAI Documentation](https://openai.com/index/gpt-5-1-for-developers/)

#### Mode Sans Raisonnement
Pour les tâches simples ne nécessitant pas de réflexion approfondie, GPT-5.1 propose un mode "sans raisonnement" qui réduit significativement la latence.

#### Fenêtre de Contexte Étendue
Avec **400 000 tokens** de contexte, GPT-5.1 peut traiter des documents volumineux et maintenir des conversations très longues sans perte d'information.

### 2.2 Spécifications Techniques

```yaml
Modèle: GPT-5.1
Fenêtre de contexte: 400,000 tokens
Modalités d'entrée: Texte, Images
Modalités de sortie: Texte
Outils intégrés: apply_patch, shell
Modes: Standard, Instant, Thinking, No-Reasoning
API: Chat Completions, Responses API
```

**Source**: [OpenAI Platform - Models](https://platform.openai.com/docs/models/gpt-5.1/)

---

## 3. Architecture et Raisonnement Adaptatif

### 3.1 Principe du Raisonnement Adaptatif

Le raisonnement adaptatif de GPT-5.1 repose sur un mécanisme d'évaluation de la complexité qui détermine automatiquement le niveau de "réflexion" nécessaire :

```
┌─────────────────────────────────────────────────────────┐
│                    ENTRÉE UTILISATEUR                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              ÉVALUATION DE COMPLEXITÉ                    │
│  • Analyse syntaxique                                    │
│  • Détection de domaine                                  │
│  • Estimation de difficulté                              │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ SIMPLE  │  │ MOYEN   │  │ COMPLEXE│
        │ ~100ms  │  │ ~500ms  │  │ ~2000ms │
        └─────────┘  └─────────┘  └─────────┘
              │            │            │
              └────────────┼────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    RÉPONSE OPTIMISÉE                     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Modes de Raisonnement

#### GPT-5.1 Standard
Mode par défaut avec raisonnement adaptatif automatique.

#### GPT-5.1 Instant
Optimisé pour les interactions conversationnelles rapides avec un suivi amélioré des instructions.

> "GPT-5.1 Instant is optimized for fast conversational interactions with improved instruction following and adaptive reasoning capability."
> — [OpenAI System Card Addendum](https://openai.com/fr-FR/index/gpt-5-system-card-addendum-gpt-5-1/)

#### GPT-5.1 Thinking
Ajuste précisément le temps de réflexion en fonction de chaque question, consacrant plus de temps aux problèmes complexes.

### 3.3 Configuration du Raisonnement

```python
from openai import OpenAI

client = OpenAI()

# Mode standard avec raisonnement adaptatif
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "user", "content": "Résous cette équation différentielle..."}
    ]
)

# Mode sans raisonnement pour réponses rapides
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "user", "content": "Quelle est la capitale de la France ?"}
    ],
    reasoning_effort="none"  # Désactive le raisonnement approfondi
)

# Mode raisonnement forcé pour tâches complexes
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "user", "content": "Analyse cette architecture système..."}
    ],
    reasoning_effort="high"  # Force un raisonnement approfondi
)
```

---

## 4. Function Calling et Tool Use

### 4.1 Vue d'Ensemble du Function Calling

Le function calling (appel de fonctions) permet à GPT-5.1 d'interagir avec des outils externes de manière structurée. Cette fonctionnalité est essentielle pour construire des agents autonomes capables d'exécuter des actions dans le monde réel.

**Source**: [OpenAI Platform - Function Calling](https://platform.openai.com/docs/guides/function-calling)

### 4.2 Définition des Outils

```python
from openai import OpenAI

client = OpenAI()

# Définition des outils disponibles
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Récupère les informations météo pour une ville donnée",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "La ville, ex: Paris, France"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "L'unité de température"
                    }
                },
                "required": ["location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_database",
            "description": "Recherche dans la base de données des propriétés",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "La requête de recherche"
                    },
                    "filters": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "price_max": {"type": "number"},
                            "surface_min": {"type": "number"}
                        }
                    }
                },
                "required": ["query"]
            }
        }
    }
]

# Appel avec outils
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "user", "content": "Quel temps fait-il à Paris ?"}
    ],
    tools=tools,
    tool_choice="auto"  # Le modèle décide s'il doit utiliser un outil
)
```

### 4.3 Structured Outputs

GPT-5.1 supporte les sorties structurées garantissant un format JSON valide :

```python
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Optional

class PropertyListing(BaseModel):
    id: str
    title: str
    price: float
    surface: float
    rooms: int
    location: str
    description: str
    amenities: List[str]
    available_from: Optional[str]

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "system", "content": "Tu es un assistant immobilier."},
        {"role": "user", "content": "Génère une annonce pour un appartement à Paris"}
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "property_listing",
            "schema": PropertyListing.model_json_schema()
        }
    }
)
```

### 4.4 Parallel Tool Calls

GPT-5.1 peut appeler plusieurs outils en parallèle pour optimiser les performances :

```python
# Réponse avec appels d'outils parallèles
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "user", "content": "Compare la météo entre Paris et Londres"}
    ],
    tools=tools,
    parallel_tool_calls=True  # Permet les appels parallèles
)

# Le modèle peut retourner plusieurs tool_calls simultanément
for tool_call in response.choices[0].message.tool_calls:
    print(f"Outil: {tool_call.function.name}")
    print(f"Arguments: {tool_call.function.arguments}")
```

---

## 5. Outils Intégrés : apply_patch et shell

### 5.1 Outil apply_patch

L'outil `apply_patch` est spécialement conçu pour l'édition de code fiable. Il permet d'appliquer des modifications précises sans réécrire des fichiers entiers.

**Source**: [OpenAI - GPT-5.1 for Developers](https://openai.com/index/gpt-5-1-for-developers/)

#### Format du Patch

```python
# Définition de l'outil apply_patch
apply_patch_tool = {
    "type": "function",
    "function": {
        "name": "apply_patch",
        "description": "Applique un patch de code à un fichier existant",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Chemin du fichier à modifier"
                },
                "patch": {
                    "type": "string",
                    "description": "Le patch au format unified diff"
                }
            },
            "required": ["file_path", "patch"]
        }
    }
}
```

#### Exemple d'Utilisation

```python
# Exemple de patch généré par GPT-5.1
patch_example = """
--- a/src/components/PropertyCard.tsx
+++ b/src/components/PropertyCard.tsx
@@ -15,6 +15,10 @@ export function PropertyCard({ property }: PropertyCardProps) {
   return (
     <Card className="property-card">
       <CardHeader>
+        {property.featured && (
+          <Badge variant="premium">À la une</Badge>
+        )}
         <CardTitle>{property.title}</CardTitle>
       </CardHeader>
       <CardContent>
"""
```

### 5.2 Outil Shell

L'outil `shell` permet à GPT-5.1 d'exécuter des commandes système de manière contrôlée.

> "The shell tool allows GPT-5.1 to interact with the local computer through a controlled command line interface."
> — [OpenAI Platform Documentation](https://platform.openai.com/docs/guides/gpt-5)

#### Définition de l'Outil

```python
shell_tool = {
    "type": "function",
    "function": {
        "name": "shell",
        "description": "Exécute une commande shell et retourne le résultat",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "La commande shell à exécuter"
                },
                "working_directory": {
                    "type": "string",
                    "description": "Le répertoire de travail (optionnel)"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout en secondes (défaut: 30)"
                }
            },
            "required": ["command"]
        }
    }
}
```

#### Sécurité et Sandboxing

```python
# Configuration sécurisée pour l'outil shell
shell_config = {
    "allowed_commands": [
        "ls", "cat", "grep", "find", "npm", "yarn",
        "python", "pip", "git status", "git diff"
    ],
    "blocked_commands": [
        "rm -rf", "sudo", "chmod", "chown", "mkfs"
    ],
    "working_directory": "/app/workspace",
    "max_output_size": 10000,
    "timeout": 30
}
```

---

## 6. Fenêtre de Contexte et Capacités

### 6.1 Fenêtre de 400K Tokens

GPT-5.1 dispose d'une fenêtre de contexte de **400 000 tokens**, permettant de traiter :

- **Documents volumineux** : Rapports, livres, bases de code
- **Conversations longues** : Historique complet des échanges
- **Multi-documents** : Analyse comparative de plusieurs sources

**Source**: [OpenAI Platform - Models](https://platform.openai.com/docs/models/gpt-5.1/)

### 6.2 Gestion Optimale du Contexte

```python
from openai import OpenAI
import tiktoken

def count_tokens(text: str, model: str = "gpt-5.1") -> int:
    """Compte le nombre de tokens dans un texte."""
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

def optimize_context(messages: list, max_tokens: int = 400000) -> list:
    """Optimise le contexte pour rester dans les limites."""
    total_tokens = sum(count_tokens(m["content"]) for m in messages)
    
    if total_tokens <= max_tokens:
        return messages
    
    # Stratégie de compression : garder le système et les derniers messages
    system_messages = [m for m in messages if m["role"] == "system"]
    other_messages = [m for m in messages if m["role"] != "system"]
    
    # Garder les messages les plus récents
    optimized = system_messages + other_messages[-50:]
    return optimized

# Exemple d'utilisation avec un document long
client = OpenAI()

long_document = open("rapport_annuel.txt").read()
token_count = count_tokens(long_document)

print(f"Tokens dans le document: {token_count}")
print(f"Capacité restante: {400000 - token_count} tokens")

response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {"role": "system", "content": "Analyse ce document et fournis un résumé."},
        {"role": "user", "content": long_document}
    ]
)
```

### 6.3 Modalités Supportées

| Modalité | Entrée | Sortie |
|----------|--------|--------|
| Texte | ✅ | ✅ |
| Images | ✅ | ❌ |
| Audio | ❌ | ❌ |
| Vidéo | ❌ | ❌ |

```python
# Analyse d'image avec GPT-5.1
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Décris cette image de propriété immobilière"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/property.jpg",
                        "detail": "high"
                    }
                }
            ]
        }
    ]
)
```

---

## 7. Modes de Fonctionnement

### 7.1 Tableau Comparatif des Modes

| Mode | Latence | Raisonnement | Cas d'usage |
|------|---------|--------------|-------------|
| Standard | Moyen | Adaptatif | Usage général |
| Instant | Faible | Minimal | Chat, FAQ |
| Thinking | Élevé | Profond | Analyse, Codage |
| No-Reasoning | Très faible | Aucun | Requêtes simples |

### 7.2 Configuration des Modes

```python
from openai import OpenAI

client = OpenAI()

# Mode Instant - Conversations rapides
instant_response = client.chat.completions.create(
    model="gpt-5.1-instant",
    messages=[{"role": "user", "content": "Bonjour !"}]
)

# Mode Thinking - Problèmes complexes
thinking_response = client.chat.completions.create(
    model="gpt-5.1-thinking",
    messages=[
        {"role": "user", "content": "Analyse cette architecture microservices..."}
    ]
)

# Configuration du niveau de raisonnement
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[{"role": "user", "content": "Question complexe..."}],
    reasoning_effort="high",  # "none", "low", "medium", "high"
    max_completion_tokens=8000
)
```

### 7.3 Personnalisation et Tonalité

GPT-5.1 permet une personnalisation avancée des réponses :

```python
# Personnalisation de la tonalité
response = client.chat.completions.create(
    model="gpt-5.1",
    messages=[
        {
            "role": "system",
            "content": """Tu es un assistant professionnel pour une agence immobilière.
            
            Tonalité: Professionnelle mais chaleureuse
            Style: Concis et informatif
            Format: Utilise des listes à puces quand approprié
            Langue: Français formel
            """
        },
        {"role": "user", "content": "Présentez-moi les avantages de ce bien."}
    ]
)
```

**Source**: [OpenAI Academy - Intro GPT-5.1](https://academy.openai.com/home/resources/intro-gpt-5-1)

---

## 8. Intégration API OpenAI

### 8.1 Chat Completions API

L'API principale pour interagir avec GPT-5.1 :

```python
from openai import OpenAI
from typing import Generator

client = OpenAI()

def chat_with_gpt51(
    messages: list,
    stream: bool = False,
    tools: list = None
) -> str | Generator:
    """Interface principale pour GPT-5.1."""
    
    params = {
        "model": "gpt-5.1",
        "messages": messages,
        "stream": stream,
    }
    
    if tools:
        params["tools"] = tools
        params["tool_choice"] = "auto"
    
    response = client.chat.completions.create(**params)
    
    if stream:
        return response  # Retourne un générateur
    
    return response.choices[0].message.content

# Utilisation simple
result = chat_with_gpt51([
    {"role": "user", "content": "Explique le bail commercial"}
])

# Utilisation avec streaming
for chunk in chat_with_gpt51(
    [{"role": "user", "content": "Explique le bail commercial"}],
    stream=True
):
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### 8.2 Responses API (Nouveau)

La nouvelle Responses API offre des fonctionnalités avancées :

```python
# Responses API avec outils intégrés
response = client.responses.create(
    model="gpt-5.1",
    input="Analyse ce code et corrige les bugs",
    tools=[
        {"type": "code_interpreter"},
        {"type": "file_search"}
    ],
    tool_resources={
        "file_search": {
            "vector_store_ids": ["vs_abc123"]
        }
    }
)
```

### 8.3 Gestion des Erreurs

```python
from openai import OpenAI, APIError, RateLimitError, APIConnectionError
import time

def robust_api_call(messages: list, max_retries: int = 3) -> str:
    """Appel API avec gestion robuste des erreurs."""
    client = OpenAI()
    
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-5.1",
                messages=messages
            )
            return response.choices[0].message.content
            
        except RateLimitError:
            wait_time = 2 ** attempt
            print(f"Rate limit atteint. Attente de {wait_time}s...")
            time.sleep(wait_time)
            
        except APIConnectionError:
            print("Erreur de connexion. Nouvelle tentative...")
            time.sleep(1)
            
        except APIError as e:
            print(f"Erreur API: {e}")
            raise
    
    raise Exception("Nombre maximum de tentatives atteint")
```

---

## 9. LangChain 1.0

### 9.1 Introduction à LangChain

LangChain est un framework open-source conçu pour faciliter l'intégration des grands modèles de langage (LLM) dans les applications. En novembre 2025, LangChain a atteint la version 1.0, marquant une étape importante de maturité.

**Sources**:
- [LangChain Wikipedia](https://en.wikipedia.org/wiki/LangChain)
- [LangChain 1.0 Release](https://blog.langchain.com/langchain-langgraph-1dot0/)
- [LangChain Reference Documentation](https://reference.langchain.com/python)

### 9.2 Architecture LangChain

```
┌─────────────────────────────────────────────────────────┐
│                    LANGCHAIN 1.0                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Models    │  │   Prompts   │  │   Chains    │     │
│  │  (LLMs)     │  │ (Templates) │  │  (LCEL)     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Memory    │  │   Tools     │  │  Retrievers │     │
│  │ (History)   │  │ (Functions) │  │   (RAG)     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Output Parsers & Validators           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 9.3 Intégration avec GPT-5.1

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate

# Initialisation du modèle GPT-5.1
llm = ChatOpenAI(
    model="gpt-5.1",
    temperature=0.7,
    max_tokens=4096
)

# Utilisation simple
response = llm.invoke([
    SystemMessage(content="Tu es un expert immobilier."),
    HumanMessage(content="Explique les différents types de baux.")
])

# Avec template de prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "Tu es un assistant pour la gestion locative. Tu aides les {role}."),
    ("human", "{question}")
])

chain = prompt | llm

result = chain.invoke({
    "role": "propriétaires",
    "question": "Comment calculer le loyer de référence ?"
})
```

### 9.4 LangChain Expression Language (LCEL)

LCEL permet de composer des chaînes de traitement de manière déclarative :

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel

llm = ChatOpenAI(model="gpt-5.1")

# Chaîne simple
simple_chain = (
    ChatPromptTemplate.from_template("Résume ce texte: {text}")
    | llm
    | StrOutputParser()
)

# Chaîne avec branchement parallèle
analysis_chain = RunnableParallel(
    summary=ChatPromptTemplate.from_template("Résume: {text}") | llm | StrOutputParser(),
    keywords=ChatPromptTemplate.from_template("Extrais les mots-clés: {text}") | llm | StrOutputParser(),
    sentiment=ChatPromptTemplate.from_template("Analyse le sentiment: {text}") | llm | StrOutputParser()
)

# Exécution
result = analysis_chain.invoke({"text": "Texte à analyser..."})
print(result)  # {"summary": "...", "keywords": "...", "sentiment": "..."}
```

### 9.5 Tool Calling avec LangChain

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

@tool
def calculate_rent(surface: float, price_per_sqm: float) -> float:
    """Calcule le loyer basé sur la surface et le prix au m²."""
    return surface * price_per_sqm

@tool
def search_properties(city: str, max_price: float) -> list:
    """Recherche des propriétés dans une ville avec un prix maximum."""
    # Simulation de recherche
    return [
        {"id": "1", "title": "Appartement T3", "price": max_price * 0.9},
        {"id": "2", "title": "Studio", "price": max_price * 0.5}
    ]

# Binding des outils au modèle
llm = ChatOpenAI(model="gpt-5.1")
llm_with_tools = llm.bind_tools([calculate_rent, search_properties])

# Invocation
response = llm_with_tools.invoke([
    HumanMessage(content="Calcule le loyer pour un 50m² à 25€/m²")
])

# Accès aux appels d'outils
for tool_call in response.tool_calls:
    print(f"Outil: {tool_call['name']}")
    print(f"Arguments: {tool_call['args']}")
```

**Source**: [LangChain Tool Calling Documentation](https://python.langchain.com/docs/concepts/tool_calling/)

---

## 10. LangGraph : Orchestration Agentique

### 10.1 Introduction à LangGraph

LangGraph est une bibliothèque pour construire des applications multi-acteurs avec état, idéale pour créer des workflows agentiques complexes. Elle offre un contrôle précis sur le flux et l'état de l'application.

**Sources officielles**:
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangGraph Platform](https://www.langchain.com/langgraph)
- [LangGraph Quickstart](https://langchain-ai.github.io/langgraph/agents/agents/)

### 10.2 Concepts Fondamentaux

#### États (State)
```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """État de l'agent avec historique des messages."""
    messages: Annotated[list, add_messages]
    current_step: str
    context: dict
```

#### Nœuds (Nodes)
```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

llm = ChatOpenAI(model="gpt-5.1")

def chatbot_node(state: AgentState) -> AgentState:
    """Nœud principal du chatbot."""
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def tool_executor_node(state: AgentState) -> AgentState:
    """Nœud d'exécution des outils."""
    last_message = state["messages"][-1]
    # Exécution des outils...
    return {"messages": [...]}
```

#### Arêtes (Edges)
```python
from typing import Literal

def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Détermine le prochain nœud à exécuter."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"
```

### 10.3 Construction d'un Agent ReAct

```python
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def get_property_info(property_id: str) -> dict:
    """Récupère les informations d'une propriété."""
    return {
        "id": property_id,
        "title": "Appartement T3",
        "price": 1200,
        "surface": 65,
        "location": "Paris 11e"
    }

@tool
def calculate_charges(surface: float, building_type: str) -> float:
    """Calcule les charges prévisionnelles."""
    base_rate = 3.5 if building_type == "ancien" else 2.5
    return surface * base_rate

# Création de l'agent
llm = ChatOpenAI(model="gpt-5.1")
checkpointer = MemorySaver()

agent = create_react_agent(
    model=llm,
    tools=[get_property_info, calculate_charges],
    checkpointer=checkpointer,
    prompt="Tu es un assistant spécialisé en gestion locative."
)

# Utilisation avec mémoire de conversation
config = {"configurable": {"thread_id": "user-123"}}

# Premier message
response1 = agent.invoke(
    {"messages": [{"role": "user", "content": "Donne-moi les infos du bien P001"}]},
    config
)

# Second message (contexte conservé)
response2 = agent.invoke(
    {"messages": [{"role": "user", "content": "Calcule les charges pour ce bien"}]},
    config
)
```

**Source**: [LangGraph Agents Documentation](https://langchain-ai.github.io/langgraph/agents/overview/)

### 10.4 Graph API Avancé

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated, Literal
from langgraph.graph.message import add_messages

class PropertyAnalysisState(TypedDict):
    messages: Annotated[list, add_messages]
    property_data: dict
    analysis_result: dict
    validation_status: str

def fetch_property(state: PropertyAnalysisState) -> PropertyAnalysisState:
    """Récupère les données de la propriété."""
    # Logique de récupération...
    return {"property_data": {"id": "P001", "price": 1200}}

def analyze_property(state: PropertyAnalysisState) -> PropertyAnalysisState:
    """Analyse la propriété."""
    # Logique d'analyse avec LLM...
    return {"analysis_result": {"score": 85, "recommendation": "Bon investissement"}}

def validate_analysis(state: PropertyAnalysisState) -> PropertyAnalysisState:
    """Valide l'analyse."""
    return {"validation_status": "approved"}

def route_after_analysis(state: PropertyAnalysisState) -> Literal["validate", "refetch"]:
    """Route conditionnelle après l'analyse."""
    if state["analysis_result"].get("score", 0) > 70:
        return "validate"
    return "refetch"

# Construction du graphe
workflow = StateGraph(PropertyAnalysisState)

workflow.add_node("fetch", fetch_property)
workflow.add_node("analyze", analyze_property)
workflow.add_node("validate", validate_analysis)

workflow.add_edge(START, "fetch")
workflow.add_edge("fetch", "analyze")
workflow.add_conditional_edges("analyze", route_after_analysis)
workflow.add_edge("validate", END)

# Compilation
app = workflow.compile()

# Exécution
result = app.invoke({"messages": [], "property_data": {}, "analysis_result": {}, "validation_status": ""})
```

---

## 11. Architectures Multi-Agents

### 11.1 Vue d'Ensemble

LangGraph supporte plusieurs architectures multi-agents :

```
┌─────────────────────────────────────────────────────────┐
│              ARCHITECTURES MULTI-AGENTS                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐       ┌─────────────────────────────┐ │
│  │   Network   │       │ Tous les agents peuvent     │ │
│  │   (N-to-N)  │       │ communiquer entre eux       │ │
│  └─────────────┘       └─────────────────────────────┘ │
│                                                          │
│  ┌─────────────┐       ┌─────────────────────────────┐ │
│  │ Supervisor  │       │ Un superviseur coordonne    │ │
│  │   (1-to-N)  │       │ les agents spécialisés      │ │
│  └─────────────┘       └─────────────────────────────┘ │
│                                                          │
│  ┌─────────────┐       ┌─────────────────────────────┐ │
│  │   Swarm     │       │ Les agents se passent le    │ │
│  │ (Dynamic)   │       │ contrôle dynamiquement      │ │
│  └─────────────┘       └─────────────────────────────┘ │
│                                                          │
│  ┌─────────────┐       ┌─────────────────────────────┐ │
│  │Hierarchical │       │ Superviseurs de superviseurs│ │
│  │  (Tree)     │       │ pour systèmes complexes     │ │
│  └─────────────┘       └─────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Source**: [LangGraph Multi-Agent Concepts](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)

### 11.2 Architecture Supervisor

```python
from langgraph_supervisor import create_supervisor
from langgraph.prebuilt import create_react_agent
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool

# Outils pour l'agent de recherche
@tool
def search_properties(query: str) -> list:
    """Recherche des propriétés."""
    return [{"id": "1", "title": "Appartement T3", "price": 1200}]

# Outils pour l'agent financier
@tool
def calculate_roi(price: float, rent: float) -> float:
    """Calcule le retour sur investissement."""
    return (rent * 12) / price * 100

# Création des agents spécialisés
research_agent = create_react_agent(
    model=init_chat_model("openai:gpt-5.1"),
    tools=[search_properties],
    prompt="Tu es un agent de recherche immobilière.",
    name="research_agent"
)

finance_agent = create_react_agent(
    model=init_chat_model("openai:gpt-5.1"),
    tools=[calculate_roi],
    prompt="Tu es un analyste financier immobilier.",
    name="finance_agent"
)

# Création du superviseur
supervisor = create_supervisor(
    model=init_chat_model("openai:gpt-5.1"),
    agents=[research_agent, finance_agent],
    prompt="""Tu es un superviseur gérant deux agents:
    - research_agent: pour les recherches de biens
    - finance_agent: pour les analyses financières
    
    Délègue les tâches appropriées à chaque agent.
    Ne fais pas le travail toi-même.""",
    add_handoff_back_messages=True,
    output_mode="full_history"
).compile()

# Utilisation
result = supervisor.invoke({
    "messages": [{"role": "user", "content": "Trouve un bien et calcule son ROI"}]
})
```

**Source**: [LangGraph Supervisor Tutorial](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/agent_supervisor/)

### 11.3 Architecture Swarm

```python
from langgraph.prebuilt import create_react_agent
from langgraph.graph import StateGraph, MessagesState
from langgraph.types import Command
from langchain_core.tools import tool, InjectedToolCallId
from langchain.chat_models import init_chat_model
from typing import Annotated

# Outil de transfert vers un autre agent
def create_handoff_tool(agent_name: str, description: str):
    @tool(name=f"transfer_to_{agent_name}", description=description)
    def handoff_tool(
        state: Annotated[MessagesState, "InjectedState"],
        tool_call_id: Annotated[str, InjectedToolCallId]
    ) -> Command:
        return Command(
            goto=agent_name,
            update={"messages": state["messages"]},
            graph=Command.PARENT
        )
    return handoff_tool

# Agents avec capacité de transfert
@tool
def book_property_visit(property_id: str, date: str) -> str:
    """Réserve une visite de propriété."""
    return f"Visite réservée pour {property_id} le {date}"

@tool
def sign_lease(property_id: str, tenant_id: str) -> str:
    """Signe un bail."""
    return f"Bail signé pour {property_id} par {tenant_id}"

visit_agent = create_react_agent(
    model=init_chat_model("openai:gpt-5.1"),
    tools=[
        book_property_visit,
        create_handoff_tool("lease_agent", "Transférer à l'agent de bail")
    ],
    name="visit_agent"
)

lease_agent = create_react_agent(
    model=init_chat_model("openai:gpt-5.1"),
    tools=[
        sign_lease,
        create_handoff_tool("visit_agent", "Transférer à l'agent de visite")
    ],
    name="lease_agent"
)

# Construction du graphe multi-agent
multi_agent_graph = (
    StateGraph(MessagesState)
    .add_node("visit_agent", visit_agent)
    .add_node("lease_agent", lease_agent)
    .add_edge("__start__", "visit_agent")
    .compile()
)
```

**Source**: [LangGraph Multi-Agent Systems](https://langchain-ai.github.io/langgraph/agents/multi-agent/)

### 11.4 Handoffs entre Agents

Les handoffs permettent le transfert de contrôle entre agents :

```python
from langgraph.types import Command
from typing import Literal

def create_handoff(
    destination: str,
    payload: dict,
    reason: str
) -> Command:
    """Crée un handoff vers un autre agent."""
    return Command(
        goto=destination,
        update={
            "messages": payload.get("messages", []),
            "handoff_reason": reason,
            "previous_agent": payload.get("current_agent")
        },
        graph=Command.PARENT
    )

# Utilisation dans un nœud d'agent
def agent_node(state: MessagesState) -> Command[Literal["other_agent", "__end__"]]:
    # Logique de l'agent...
    
    if should_handoff():
        return create_handoff(
            destination="other_agent",
            payload=state,
            reason="Tâche nécessitant une expertise spécifique"
        )
    
    return Command(goto="__end__", update={"messages": [response]})
```

---

## 12. Mémoire et Persistance

### 12.1 Types de Mémoire

LangGraph distingue deux types de mémoire :

| Type | Description | Durée | Utilisation |
|------|-------------|-------|-------------|
| **Short-term** | Mémoire de conversation | Session | Contexte immédiat |
| **Long-term** | Mémoire persistante | Permanent | Profils, préférences |

**Source**: [LangGraph Memory Concepts](https://langchain-ai.github.io/langgraph/concepts/memory/)

### 12.2 Mémoire Court-Terme (Checkpointing)

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.prebuilt import create_react_agent

# Checkpointer en mémoire (développement)
memory_checkpointer = MemorySaver()

# Checkpointer PostgreSQL (production)
postgres_checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost/langgraph"
)

# Agent avec mémoire
agent = create_react_agent(
    model="openai:gpt-5.1",
    tools=[...],
    checkpointer=memory_checkpointer
)

# Utilisation avec thread_id pour conserver le contexte
config = {"configurable": {"thread_id": "conversation-123"}}

# Premier échange
response1 = agent.invoke(
    {"messages": [{"role": "user", "content": "Je cherche un T3 à Paris"}]},
    config
)

# Deuxième échange (contexte conservé)
response2 = agent.invoke(
    {"messages": [{"role": "user", "content": "Quel est le prix moyen ?"}]},
    config
)
# L'agent sait qu'on parle d'un T3 à Paris
```

**Source**: [LangGraph Persistence Documentation](https://langchain-ai.github.io/langgraph/concepts/persistence/)

### 12.3 Mémoire Long-Terme (Store)

```python
from langgraph.store.memory import InMemoryStore
from langgraph.prebuilt import create_react_agent

# Store pour la mémoire long-terme
store = InMemoryStore()

# Sauvegarder des informations utilisateur
store.put(
    namespace=("users", "user-123"),
    key="profile",
    value={
        "preferences": {
            "property_type": "appartement",
            "budget_max": 1500,
            "location": "Paris"
        },
        "search_history": [
            {"date": "2025-12-01", "query": "T3 Paris 11e"}
        ]
    }
)

# Récupérer des informations
user_profile = store.get(
    namespace=("users", "user-123"),
    key="profile"
)

# Agent avec accès au store
def agent_with_memory(state, config, store):
    """Agent qui utilise la mémoire long-terme."""
    user_id = config["configurable"]["user_id"]
    
    # Récupérer le profil utilisateur
    profile = store.get(("users", user_id), "profile")
    
    # Utiliser les préférences dans le contexte
    system_prompt = f"""
    Préférences de l'utilisateur:
    - Type: {profile['preferences']['property_type']}
    - Budget: {profile['preferences']['budget_max']}€
    - Localisation: {profile['preferences']['location']}
    """
    
    # Continuer avec le LLM...
```

### 12.4 Gestion de l'Historique des Messages

```python
from langchain_core.messages import trim_messages, HumanMessage, AIMessage

# Trimmer pour limiter l'historique
trimmer = trim_messages(
    max_tokens=4000,
    strategy="last",
    token_counter=len,  # Ou une fonction de comptage de tokens
    include_system=True,
    allow_partial=False
)

# Utilisation dans un agent
def manage_message_history(messages: list, max_messages: int = 20) -> list:
    """Gère l'historique des messages."""
    if len(messages) <= max_messages:
        return messages
    
    # Garder le message système et les derniers messages
    system_messages = [m for m in messages if m.type == "system"]
    other_messages = [m for m in messages if m.type != "system"]
    
    return system_messages + other_messages[-max_messages:]

# Summarization pour les longues conversations
from langchain_openai import ChatOpenAI

def summarize_conversation(messages: list) -> str:
    """Résume une conversation longue."""
    llm = ChatOpenAI(model="gpt-5.1")
    
    summary_prompt = """Résume cette conversation en gardant les points clés:
    
    {conversation}
    
    Résumé concis:"""
    
    conversation_text = "\n".join([
        f"{m.type}: {m.content}" for m in messages
    ])
    
    response = llm.invoke(summary_prompt.format(conversation=conversation_text))
    return response.content
```

**Source**: [LangGraph Memory How-To](https://langchain-ai.github.io/langgraph/how-tos/memory/)

---

## 13. Streaming et Temps Réel

### 13.1 Modes de Streaming

LangGraph offre plusieurs modes de streaming :

| Mode | Description | Utilisation |
|------|-------------|-------------|
| `values` | État complet après chaque nœud | Debugging |
| `updates` | Changements d'état uniquement | Efficacité |
| `messages` | Tokens LLM en temps réel | UX |
| `custom` | Données personnalisées | Flexibilité |
| `debug` | Informations détaillées | Développement |

**Source**: [LangGraph Streaming Concepts](https://langchain-ai.github.io/langgraph/concepts/streaming/)

### 13.2 Streaming des Tokens LLM

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

# Agent avec streaming
agent = create_react_agent(
    model=ChatOpenAI(model="gpt-5.1", streaming=True),
    tools=[...]
)

# Streaming synchrone
for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "Décris ce bien immobilier"}]},
    stream_mode="messages"
):
    if hasattr(chunk, 'content') and chunk.content:
        print(chunk.content, end="", flush=True)

# Streaming asynchrone
async for chunk in agent.astream(
    {"messages": [{"role": "user", "content": "Décris ce bien immobilier"}]},
    stream_mode="messages"
):
    if hasattr(chunk, 'content') and chunk.content:
        print(chunk.content, end="", flush=True)
```

### 13.3 Streaming des Mises à Jour d'État

```python
# Streaming des mises à jour d'état
for update in agent.stream(
    {"messages": [{"role": "user", "content": "Analyse ce bien"}]},
    stream_mode="updates"
):
    print(f"Nœud: {update.get('node')}")
    print(f"Mise à jour: {update.get('state')}")

# Streaming multiple modes simultanément
for event in agent.stream(
    {"messages": [{"role": "user", "content": "Analyse ce bien"}]},
    stream_mode=["updates", "messages"]
):
    if event[0] == "updates":
        print(f"État mis à jour: {event[1]}")
    elif event[0] == "messages":
        print(f"Token: {event[1].content}", end="")
```

### 13.4 Streaming Personnalisé

```python
from langgraph.types import StreamWriter

def node_with_custom_streaming(state, writer: StreamWriter):
    """Nœud avec streaming personnalisé."""
    
    # Envoyer des mises à jour de progression
    writer({"type": "progress", "value": 0, "message": "Démarrage..."})
    
    # Traitement par étapes
    for i, step in enumerate(processing_steps):
        result = process_step(step)
        writer({
            "type": "progress",
            "value": (i + 1) / len(processing_steps) * 100,
            "message": f"Étape {i + 1} terminée"
        })
    
    writer({"type": "complete", "result": final_result})
    
    return {"result": final_result}

# Réception des événements personnalisés
for event in graph.stream(inputs, stream_mode="custom"):
    if event["type"] == "progress":
        print(f"Progression: {event['value']}% - {event['message']}")
    elif event["type"] == "complete":
        print(f"Terminé: {event['result']}")
```

**Source**: [LangGraph Streaming How-To](https://langchain-ai.github.io/langgraph/how-tos/streaming/)

---

## 14. Human-in-the-Loop

### 14.1 Concept et Utilisation

Le Human-in-the-Loop (HITL) permet l'intervention humaine dans les workflows automatisés :

```
┌─────────────────────────────────────────────────────────┐
│                 HUMAN-IN-THE-LOOP                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │  Agent  │───▶│Interrupt│───▶│  Human  │             │
│  │  Action │    │  Point  │    │  Review │             │
│  └─────────┘    └─────────┘    └─────────┘             │
│                                      │                   │
│                      ┌───────────────┼───────────────┐  │
│                      ▼               ▼               ▼  │
│               ┌─────────┐     ┌─────────┐     ┌─────────┐
│               │ Approve │     │  Edit   │     │ Reject  │
│               └─────────┘     └─────────┘     └─────────┘
│                      │               │               │   │
│                      └───────────────┼───────────────┘  │
│                                      ▼                   │
│                               ┌─────────┐               │
│                               │ Resume  │               │
│                               │  Agent  │               │
│                               └─────────┘               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Source**: [LangGraph Human-in-the-Loop Concepts](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)

### 14.2 Fonction Interrupt

```python
from langgraph.types import interrupt, Command
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import tool

@tool
def sign_lease_contract(
    property_id: str,
    tenant_name: str,
    monthly_rent: float
) -> str:
    """Signe un contrat de bail - nécessite approbation humaine."""
    
    # Interrompre pour validation humaine
    human_response = interrupt({
        "question": "Voulez-vous approuver ce contrat de bail ?",
        "details": {
            "property_id": property_id,
            "tenant_name": tenant_name,
            "monthly_rent": monthly_rent
        },
        "options": ["approve", "reject", "modify"]
    })
    
    if human_response["action"] == "approve":
        return f"Bail signé pour {tenant_name} - {monthly_rent}€/mois"
    elif human_response["action"] == "reject":
        return "Signature du bail annulée"
    elif human_response["action"] == "modify":
        # Utiliser les modifications
        new_rent = human_response.get("new_rent", monthly_rent)
        return f"Bail modifié et signé - {new_rent}€/mois"

# Agent avec HITL
agent = create_react_agent(
    model="openai:gpt-5.1",
    tools=[sign_lease_contract],
    checkpointer=MemorySaver()
)

# Exécution jusqu'à l'interruption
config = {"configurable": {"thread_id": "lease-001"}}

for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "Signe le bail pour Jean Dupont, 1200€/mois"}]},
    config
):
    print(chunk)
    # L'exécution s'arrête à l'interrupt

# Reprise avec la décision humaine
for chunk in agent.stream(
    Command(resume={"action": "approve"}),
    config
):
    print(chunk)
```

### 14.3 Breakpoints

```python
from langgraph.graph import StateGraph, START, END

# Définition du graphe avec breakpoints
workflow = StateGraph(AgentState)

workflow.add_node("fetch_data", fetch_data_node)
workflow.add_node("analyze", analyze_node)
workflow.add_node("generate_report", generate_report_node)

workflow.add_edge(START, "fetch_data")
workflow.add_edge("fetch_data", "analyze")
workflow.add_edge("analyze", "generate_report")
workflow.add_edge("generate_report", END)

# Compilation avec breakpoints
app = workflow.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["generate_report"]  # Pause avant ce nœud
)

# Exécution
config = {"configurable": {"thread_id": "report-001"}}

# Première exécution - s'arrête avant generate_report
result = app.invoke({"messages": [...]}, config)

# Inspection de l'état
state = app.get_state(config)
print(f"État actuel: {state.values}")

# Modification de l'état si nécessaire
app.update_state(config, {"analysis_result": modified_result})

# Reprise de l'exécution
final_result = app.invoke(None, config)
```

**Source**: [LangGraph Breakpoints Documentation](https://langchain-ai.github.io/langgraph/concepts/breakpoints/)

### 14.4 Time Travel

```python
# Récupérer l'historique des états
config = {"configurable": {"thread_id": "conversation-001"}}

# Liste des checkpoints
for state in app.get_state_history(config):
    print(f"Checkpoint: {state.config}")
    print(f"État: {state.values}")
    print(f"Timestamp: {state.created_at}")
    print("---")

# Revenir à un état précédent
previous_config = {"configurable": {"thread_id": "conversation-001", "checkpoint_id": "checkpoint-xyz"}}

# Reprendre depuis cet état
result = app.invoke(
    {"messages": [{"role": "user", "content": "Nouvelle direction..."}]},
    previous_config
)
```

**Source**: [LangGraph Time Travel](https://langchain-ai.github.io/langgraph/concepts/time-travel/)

---

## 15. Déploiement et Production

### 15.1 Options de Déploiement

LangGraph Platform offre plusieurs options :

| Option | Description | Gestion |
|--------|-------------|---------|
| **Cloud SaaS** | Hébergé par LangChain | Entièrement géré |
| **Self-Hosted Data Plane** | Infrastructure propre, control plane LangChain | Hybride |
| **Self-Hosted Control Plane** | Tout en interne | Auto-géré |
| **Standalone Container** | Container Docker simple | Auto-géré |

**Source**: [LangGraph Deployment Options](https://langchain-ai.github.io/langgraph/concepts/deployment_options/)

### 15.2 Configuration de l'Application

```json
// langgraph.json
{
  "dependencies": ["./requirements.txt"],
  "graphs": {
    "property_agent": "./agents/property_agent.py:graph",
    "lease_agent": "./agents/lease_agent.py:graph"
  },
  "env": ".env",
  "python_version": "3.11",
  "dockerfile_lines": [
    "RUN apt-get update && apt-get install -y libpq-dev"
  ]
}
```

```txt
# requirements.txt
langgraph>=0.2.0
langchain-openai>=0.2.0
langchain-core>=0.3.0
psycopg2-binary>=2.9.0
```

### 15.3 Déploiement Local

```bash
# Installation du CLI LangGraph
pip install langgraph-cli

# Démarrage du serveur local
langgraph dev

# Avec configuration personnalisée
langgraph dev --config langgraph.json --port 8000

# Build de l'image Docker
langgraph build -t my-agent:latest

# Lancement avec Docker
docker run -p 8000:8000 -e OPENAI_API_KEY=$OPENAI_API_KEY my-agent:latest
```

### 15.4 SDK Client

```python
from langgraph_sdk import get_client

# Client pour le serveur LangGraph
client = get_client(url="http://localhost:8000")

# Lister les assistants disponibles
assistants = await client.assistants.list()

# Créer un thread
thread = await client.threads.create()

# Exécuter un run
run = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="property_agent",
    input={"messages": [{"role": "user", "content": "Trouve un T3 à Paris"}]}
)

# Streaming des résultats
async for event in client.runs.stream(
    thread_id=thread["thread_id"],
    assistant_id="property_agent",
    input={"messages": [...]},
    stream_mode="messages"
):
    print(event)
```

**Source**: [LangGraph SDK Documentation](https://langchain-ai.github.io/langgraph/concepts/sdk/)

### 15.5 LangGraph Studio

LangGraph Studio est un IDE visuel pour le développement et le debugging :

```bash
# Lancement de LangGraph Studio
langgraph dev --studio

# Accès via navigateur
# http://localhost:8000/studio
```

Fonctionnalités :
- Visualisation du graphe en temps réel
- Inspection des états
- Debugging pas à pas
- Modification des prompts
- Test des agents

**Source**: [LangGraph Studio Documentation](https://langchain-ai.github.io/langgraph/concepts/langgraph_studio/)

---

## 16. Benchmarks et Performances

### 16.1 Benchmarks GPT-5.1

GPT-5.1 a été évalué sur plusieurs benchmarks standards :

| Benchmark | GPT-5 | GPT-5.1 | Amélioration |
|-----------|-------|---------|--------------|
| SWE-bench Verified | 72.8% | 76.3% | +3.5% |
| GPQA Diamond (sans outils) | 85.7% | 88.1% | +2.4% |
| AIME 2025 (sans outils) | 94.6% | 94.0% | -0.6% |
| FrontierMath (avec Python) | 26.3% | 26.7% | +0.4% |
| MMMU | 84.2% | 85.4% | +1.2% |
| Tau²-bench Airline | 62.6% | 67.0% | +4.4% |
| Tau²-bench Telecom | 96.7% | 95.6% | -1.1% |
| Tau²-bench Retail | 81.1% | 77.9% | -3.2% |
| BrowseComp Long Context 128k | 90.0% | 90.0% | = |

**Source**: [OpenAI GPT-5.1 Benchmarks](https://openai.com/index/gpt-5-1-for-developers/)

### 16.2 Latence et Throughput

| Mode | Latence moyenne | Tokens/seconde |
|------|-----------------|----------------|
| Instant | ~100ms | ~150 |
| Standard | ~500ms | ~100 |
| Thinking | ~2000ms | ~50 |
| No-Reasoning | ~50ms | ~200 |

### 16.3 Optimisation des Performances

```python
from openai import OpenAI
import time

client = OpenAI()

def benchmark_model(prompt: str, iterations: int = 10) -> dict:
    """Benchmark un prompt sur GPT-5.1."""
    latencies = []
    
    for _ in range(iterations):
        start = time.time()
        response = client.chat.completions.create(
            model="gpt-5.1",
            messages=[{"role": "user", "content": prompt}]
        )
        latencies.append(time.time() - start)
    
    return {
        "avg_latency": sum(latencies) / len(latencies),
        "min_latency": min(latencies),
        "max_latency": max(latencies),
        "tokens_per_second": response.usage.completion_tokens / latencies[-1]
    }

# Optimisation : utiliser le mode approprié
def optimized_call(prompt: str, complexity: str = "auto") -> str:
    """Appel optimisé selon la complexité."""
    
    params = {
        "model": "gpt-5.1",
        "messages": [{"role": "user", "content": prompt}]
    }
    
    if complexity == "simple":
        params["reasoning_effort"] = "none"
    elif complexity == "complex":
        params["reasoning_effort"] = "high"
    
    return client.chat.completions.create(**params).choices[0].message.content
```

---

## 17. Cas d'Usage et Patterns

### 17.1 Agent de Talok

```python
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from datetime import datetime

@tool
def search_properties(
    city: str,
    property_type: str = "appartement",
    max_rent: float = None,
    min_surface: float = None
) -> list:
    """Recherche des propriétés disponibles."""
    # Implémentation de la recherche...
    return [
        {"id": "P001", "title": "T3 Paris 11e", "rent": 1200, "surface": 65},
        {"id": "P002", "title": "T2 Paris 20e", "rent": 950, "surface": 45}
    ]

@tool
def get_property_details(property_id: str) -> dict:
    """Récupère les détails complets d'une propriété."""
    return {
        "id": property_id,
        "title": "T3 Paris 11e",
        "rent": 1200,
        "surface": 65,
        "rooms": 3,
        "description": "Bel appartement lumineux...",
        "amenities": ["balcon", "parking", "cave"],
        "available_from": "2025-01-15"
    }

@tool
def schedule_visit(
    property_id: str,
    visitor_name: str,
    preferred_date: str,
    preferred_time: str
) -> dict:
    """Planifie une visite de propriété."""
    return {
        "confirmation_id": f"V-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "property_id": property_id,
        "visitor": visitor_name,
        "scheduled_at": f"{preferred_date} {preferred_time}",
        "status": "confirmed"
    }

@tool
def calculate_rent_estimate(
    surface: float,
    location: str,
    property_type: str,
    condition: str = "bon"
) -> dict:
    """Calcule une estimation de loyer."""
    # Logique de calcul...
    base_price = 25 if location == "Paris" else 15
    multiplier = {"neuf": 1.2, "bon": 1.0, "moyen": 0.85}.get(condition, 1.0)
    
    estimated_rent = surface * base_price * multiplier
    
    return {
        "estimated_rent": estimated_rent,
        "price_per_sqm": base_price * multiplier,
        "market_range": {
            "low": estimated_rent * 0.9,
            "high": estimated_rent * 1.1
        }
    }

# Création de l'agent
property_agent = create_react_agent(
    model=ChatOpenAI(model="gpt-5.1"),
    tools=[
        search_properties,
        get_property_details,
        schedule_visit,
        calculate_rent_estimate
    ],
    checkpointer=MemorySaver(),
    prompt="""Tu es un assistant expert en gestion locative.
    
    Tu aides les utilisateurs à:
    - Rechercher des biens immobiliers
    - Obtenir des informations détaillées
    - Planifier des visites
    - Estimer les loyers
    
    Sois professionnel, précis et serviable.
    Pose des questions de clarification si nécessaire."""
)

# Utilisation
config = {"configurable": {"thread_id": "user-123"}}

response = property_agent.invoke(
    {"messages": [{"role": "user", "content": "Je cherche un T3 à Paris, budget max 1300€"}]},
    config
)
```

### 17.2 RAG Agentic pour Documents

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.tools import tool

# Configuration du vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vectorstore = Chroma(
    collection_name="lease_documents",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

@tool
def search_documents(query: str, k: int = 5) -> list:
    """Recherche dans les documents de bail."""
    results = vectorstore.similarity_search(query, k=k)
    return [
        {
            "content": doc.page_content,
            "metadata": doc.metadata,
            "relevance_score": score
        }
        for doc, score in vectorstore.similarity_search_with_score(query, k=k)
    ]

@tool
def get_document_by_id(document_id: str) -> dict:
    """Récupère un document spécifique par son ID."""
    # Implémentation...
    pass

@tool
def summarize_document(document_id: str) -> str:
    """Génère un résumé d'un document."""
    # Implémentation avec LLM...
    pass

# Agent RAG
rag_agent = create_react_agent(
    model=ChatOpenAI(model="gpt-5.1"),
    tools=[search_documents, get_document_by_id, summarize_document],
    prompt="""Tu es un assistant juridique spécialisé en droit immobilier.
    
    Utilise les documents disponibles pour répondre aux questions.
    Cite toujours tes sources avec les références des documents.
    Si l'information n'est pas dans les documents, indique-le clairement."""
)
```

### 17.3 Workflow de Signature de Bail

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt
from typing import TypedDict, Literal

class LeaseSigningState(TypedDict):
    lease_id: str
    tenant_info: dict
    property_info: dict
    lease_terms: dict
    documents_generated: bool
    tenant_approved: bool
    owner_approved: bool
    signed: bool

def generate_lease_documents(state: LeaseSigningState) -> LeaseSigningState:
    """Génère les documents de bail."""
    # Génération des documents...
    return {"documents_generated": True}

def request_tenant_approval(state: LeaseSigningState) -> LeaseSigningState:
    """Demande l'approbation du locataire."""
    response = interrupt({
        "type": "tenant_approval",
        "message": "Veuillez examiner et approuver les conditions du bail",
        "lease_terms": state["lease_terms"]
    })
    return {"tenant_approved": response.get("approved", False)}

def request_owner_approval(state: LeaseSigningState) -> LeaseSigningState:
    """Demande l'approbation du propriétaire."""
    response = interrupt({
        "type": "owner_approval",
        "message": "Veuillez approuver le bail",
        "tenant_info": state["tenant_info"]
    })
    return {"owner_approved": response.get("approved", False)}

def finalize_signing(state: LeaseSigningState) -> LeaseSigningState:
    """Finalise la signature du bail."""
    if state["tenant_approved"] and state["owner_approved"]:
        # Signature électronique...
        return {"signed": True}
    return {"signed": False}

def check_approvals(state: LeaseSigningState) -> Literal["finalize", "cancelled"]:
    """Vérifie si toutes les approbations sont obtenues."""
    if state["tenant_approved"] and state["owner_approved"]:
        return "finalize"
    return "cancelled"

# Construction du workflow
workflow = StateGraph(LeaseSigningState)

workflow.add_node("generate_documents", generate_lease_documents)
workflow.add_node("tenant_approval", request_tenant_approval)
workflow.add_node("owner_approval", request_owner_approval)
workflow.add_node("finalize", finalize_signing)

workflow.add_edge(START, "generate_documents")
workflow.add_edge("generate_documents", "tenant_approval")
workflow.add_edge("tenant_approval", "owner_approval")
workflow.add_conditional_edges("owner_approval", check_approvals)
workflow.add_edge("finalize", END)

lease_signing_app = workflow.compile(checkpointer=MemorySaver())
```

---

## 18. Sécurité et Bonnes Pratiques

### 18.1 Authentification et Autorisation

```python
from langgraph.auth import Auth
from typing import Optional

# Configuration de l'authentification
auth = Auth()

@auth.authenticate
async def authenticate(headers: dict) -> Optional[dict]:
    """Authentifie l'utilisateur via le token."""
    token = headers.get("Authorization", "").replace("Bearer ", "")
    
    if not token:
        return None
    
    # Validation du token
    user = await validate_token(token)
    return user

@auth.authorize
async def authorize(user: dict, resource: str, action: str) -> bool:
    """Vérifie les permissions de l'utilisateur."""
    user_permissions = user.get("permissions", [])
    required_permission = f"{resource}:{action}"
    
    return required_permission in user_permissions
```

**Source**: [LangGraph Authentication](https://langchain-ai.github.io/langgraph/concepts/auth/)

### 18.2 Validation des Entrées

```python
from pydantic import BaseModel, validator, Field
from typing import Optional

class PropertySearchInput(BaseModel):
    """Schéma de validation pour la recherche de propriétés."""
    city: str = Field(..., min_length=2, max_length=100)
    property_type: str = Field(default="appartement")
    max_rent: Optional[float] = Field(default=None, ge=0, le=50000)
    min_surface: Optional[float] = Field(default=None, ge=0, le=10000)
    
    @validator("property_type")
    def validate_property_type(cls, v):
        allowed = ["appartement", "maison", "studio", "loft"]
        if v not in allowed:
            raise ValueError(f"Type doit être parmi: {allowed}")
        return v

class LeaseInput(BaseModel):
    """Schéma de validation pour la création de bail."""
    property_id: str = Field(..., regex=r"^P\d{3,}$")
    tenant_id: str = Field(..., regex=r"^T\d{3,}$")
    monthly_rent: float = Field(..., ge=100, le=50000)
    deposit: float = Field(..., ge=0)
    start_date: str = Field(..., regex=r"^\d{4}-\d{2}-\d{2}$")
    
    @validator("deposit")
    def validate_deposit(cls, v, values):
        max_deposit = values.get("monthly_rent", 0) * 2
        if v > max_deposit:
            raise ValueError(f"Dépôt ne peut excéder 2 mois de loyer ({max_deposit}€)")
        return v
```

### 18.3 Gestion des Secrets

```python
import os
from dotenv import load_dotenv

# Chargement des variables d'environnement
load_dotenv()

# Configuration sécurisée
class Config:
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    REDIS_URL: str = os.getenv("REDIS_URL")
    
    # Validation au démarrage
    @classmethod
    def validate(cls):
        required = ["OPENAI_API_KEY", "DATABASE_URL"]
        missing = [k for k in required if not getattr(cls, k)]
        if missing:
            raise ValueError(f"Variables manquantes: {missing}")

Config.validate()
```

### 18.4 Logging et Monitoring

```python
import logging
from langsmith import traceable
from datetime import datetime

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@traceable(name="property_search")
def search_properties_logged(query: str) -> list:
    """Recherche avec logging et tracing."""
    logger.info(f"Recherche: {query}")
    start_time = datetime.now()
    
    try:
        results = perform_search(query)
        duration = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"Recherche terminée: {len(results)} résultats en {duration:.2f}s")
        return results
        
    except Exception as e:
        logger.error(f"Erreur recherche: {e}")
        raise
```

### 18.5 Rate Limiting

```python
from functools import wraps
import time
from collections import defaultdict

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
    
    def is_allowed(self, user_id: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Nettoyer les anciennes requêtes
        self.requests[user_id] = [
            t for t in self.requests[user_id] if t > window_start
        ]
        
        if len(self.requests[user_id]) >= self.max_requests:
            return False
        
        self.requests[user_id].append(now)
        return True

# Utilisation
rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

def rate_limited(func):
    @wraps(func)
    async def wrapper(user_id: str, *args, **kwargs):
        if not rate_limiter.is_allowed(user_id):
            raise Exception("Rate limit exceeded")
        return await func(user_id, *args, **kwargs)
    return wrapper
```

---

## 19. Tarification et Accès

### 19.1 Tarification GPT-5.1

| Modèle | Input (1M tokens) | Output (1M tokens) |
|--------|-------------------|-------------------|
| GPT-5.1 | $10.00 | $30.00 |
| GPT-5.1-instant | $5.00 | $15.00 |
| GPT-5.1-thinking | $15.00 | $45.00 |

**Note**: Les prix sont indicatifs et peuvent varier. Consultez la [page de tarification OpenAI](https://openai.com/pricing) pour les prix actuels.

### 19.2 Tarification des Outils

| Outil | Coût par appel |
|-------|----------------|
| apply_patch | $0.01 |
| shell | $0.02 |
| file_search | $0.005 |
| code_interpreter | $0.03/session |

### 19.3 Accès API

```python
from openai import OpenAI

# Configuration du client
client = OpenAI(
    api_key="sk-...",
    organization="org-...",  # Optionnel
    timeout=60.0,
    max_retries=3
)

# Vérification de l'accès
try:
    models = client.models.list()
    gpt51_available = any(m.id.startswith("gpt-5.1") for m in models.data)
    print(f"GPT-5.1 disponible: {gpt51_available}")
except Exception as e:
    print(f"Erreur d'accès: {e}")
```

### 19.4 Quotas et Limites

| Limite | Valeur |
|--------|--------|
| Requêtes par minute (RPM) | 10,000 |
| Tokens par minute (TPM) | 2,000,000 |
| Tokens par jour (TPD) | 100,000,000 |
| Contexte maximum | 400,000 tokens |

**Source**: [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

---

## 20. Références et Sources

### 20.1 Documentation Officielle OpenAI

1. **GPT-5.1 for Developers**
   - URL: https://openai.com/index/gpt-5-1-for-developers/
   - Description: Annonce officielle et présentation des fonctionnalités

2. **OpenAI Platform Documentation**
   - URL: https://platform.openai.com/docs/models/gpt-5.1/
   - Description: Documentation technique complète

3. **OpenAI API Reference**
   - URL: https://platform.openai.com/docs/api-reference
   - Description: Référence API détaillée

4. **OpenAI Academy**
   - URL: https://academy.openai.com/home/resources/intro-gpt-5-1
   - Description: Tutoriels et guides d'apprentissage

5. **GPT-5 System Card Addendum**
   - URL: https://openai.com/fr-FR/index/gpt-5-system-card-addendum-gpt-5-1/
   - Description: Informations de sécurité et capacités

### 20.2 Documentation LangChain

1. **LangChain Documentation**
   - URL: https://python.langchain.com/docs/
   - Description: Documentation principale LangChain

2. **LangChain Reference**
   - URL: https://reference.langchain.com/python
   - Description: Référence API Python

3. **LangChain 1.0 Release**
   - URL: https://blog.langchain.com/langchain-langgraph-1dot0/
   - Description: Annonce de la version 1.0

4. **LangChain Wikipedia**
   - URL: https://en.wikipedia.org/wiki/LangChain
   - Description: Vue d'ensemble et historique

### 20.3 Documentation LangGraph

1. **LangGraph Documentation**
   - URL: https://langchain-ai.github.io/langgraph/
   - Description: Documentation principale

2. **LangGraph Concepts**
   - URL: https://langchain-ai.github.io/langgraph/concepts/
   - Description: Concepts fondamentaux

3. **LangGraph Agents**
   - URL: https://langchain-ai.github.io/langgraph/agents/overview/
   - Description: Guide des agents

4. **LangGraph Platform**
   - URL: https://www.langchain.com/langgraph
   - Description: Présentation de la plateforme

5. **LangGraph Quickstart**
   - URL: https://langchain-ai.github.io/langgraph/agents/agents/
   - Description: Guide de démarrage rapide

### 20.4 Ressources Complémentaires

1. **LangGraph Multi-Agent Systems**
   - URL: https://langchain-ai.github.io/langgraph/concepts/multi_agent/
   - Description: Architectures multi-agents

2. **LangGraph Memory**
   - URL: https://langchain-ai.github.io/langgraph/concepts/memory/
   - Description: Gestion de la mémoire

3. **LangGraph Streaming**
   - URL: https://langchain-ai.github.io/langgraph/concepts/streaming/
   - Description: Streaming en temps réel

4. **LangGraph Human-in-the-Loop**
   - URL: https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/
   - Description: Intervention humaine

5. **LangGraph Deployment**
   - URL: https://langchain-ai.github.io/langgraph/concepts/deployment_options/
   - Description: Options de déploiement

### 20.5 Tutoriels et Exemples

1. **Building a Basic Chatbot**
   - URL: https://langchain-ai.github.io/langgraph/tutorials/get-started/1-build-basic-chatbot/
   
2. **Multi-Agent Supervisor**
   - URL: https://langchain-ai.github.io/langgraph/tutorials/multi_agent/agent_supervisor/

3. **Agentic RAG**
   - URL: https://langchain-ai.github.io/langgraph/tutorials/rag/langgraph_agentic_rag/

4. **SQL Agent**
   - URL: https://langchain-ai.github.io/langgraph/tutorials/sql-agent/

---

## Annexes

### A. Glossaire

| Terme | Définition |
|-------|------------|
| **Agent** | Système autonome utilisant un LLM pour prendre des décisions et exécuter des actions |
| **Checkpointer** | Mécanisme de sauvegarde d'état pour la persistance |
| **Function Calling** | Capacité du LLM à appeler des fonctions externes |
| **Handoff** | Transfert de contrôle entre agents |
| **HITL** | Human-in-the-Loop, intervention humaine dans un workflow |
| **LCEL** | LangChain Expression Language |
| **RAG** | Retrieval-Augmented Generation |
| **ReAct** | Reasoning + Acting, architecture d'agent |
| **State** | État courant d'un graphe LangGraph |
| **Thread** | Session de conversation avec historique |
| **Tool** | Fonction externe appelable par un agent |

### B. Checklist de Déploiement

- [ ] Variables d'environnement configurées
- [ ] Authentification mise en place
- [ ] Rate limiting configuré
- [ ] Logging et monitoring actifs
- [ ] Tests de charge effectués
- [ ] Backup et recovery testés
- [ ] Documentation à jour
- [ ] Alertes configurées

### C. Changelog

| Version | Date | Changements |
|---------|------|-------------|
| 1.0 | 2025-12-03 | Version initiale |

---

**Document généré le 3 décembre 2025**

*Cette documentation est basée sur les informations publiques disponibles à la date de publication. Les fonctionnalités et tarifs peuvent évoluer. Consultez toujours les sources officielles pour les informations les plus récentes.*

