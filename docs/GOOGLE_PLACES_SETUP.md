# Configuration Google Places API (Fonctionnalité Premium)

Cette documentation explique comment configurer la recherche de prestataires locaux via Google Places API.

## 📋 Prérequis

Cette fonctionnalité est **optionnelle** et réservée aux plans **Confort, Pro et Enterprise**.

Sans configuration, le système affichera des données de démonstration.

## 🔧 Configuration

### 1. Créer un projet Google Cloud

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un existant
3. Activez les APIs suivantes :
   - **Places API** (pour la recherche de prestataires)
   - **Geocoding API** (pour convertir les adresses en coordonnées)

### 2. Créer une clé API

1. Dans la console, allez dans **APIs & Services > Credentials**
2. Cliquez sur **Create Credentials > API Key**
3. Configurez les restrictions :
   - **Application restrictions** : HTTP referrers
   - **Referrers** : `votre-domaine.com/*`, `localhost:3000/*`
   - **API restrictions** : Sélectionnez Places API et Geocoding API

### 3. Ajouter la clé dans .env.local

```bash
GOOGLE_PLACES_API_KEY=AIzaSy...votre-clé
```

## 💰 Coûts estimés

| API | Coût par requête | Détail |
|-----|------------------|--------|
| Places Text Search | ~0.032€ | Recherche de prestataires |
| Geocoding | ~0.005€ | Conversion adresse → coordonnées |
| Place Photos | ~0.007€ | Photos des établissements |

### Estimation mensuelle

Pour 100 propriétaires actifs :
- ~500 recherches/mois
- **Coût estimé : 15-25€/mois**

### Optimisations intégrées

- **Cache de 24h** : Les résultats sont mis en cache pour éviter les requêtes dupliquées
- **Limite de résultats** : Max 10 prestataires par recherche
- **Recherche ciblée** : Rayon de 15km par défaut

## 🔒 Sécurité

- La clé API est utilisée côté serveur uniquement
- Les requêtes sont authentifiées (utilisateur connecté requis)
- Vérification du plan d'abonnement avant chaque requête

## 🧪 Mode démonstration

Sans clé API configurée, le système retourne des données de démonstration :

```json
{
  "providers": [
    {
      "id": "demo-1",
      "name": "Plomberie Express",
      "rating": 4.7,
      "distance_km": 2.3
    }
  ],
  "source": "demo"
}
```

## 📊 Monitoring

Surveillez votre consommation dans la [Google Cloud Console](https://console.cloud.google.com/apis/dashboard).

Configurez des alertes de budget pour éviter les surprises.

