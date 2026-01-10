# API Comptabilité - Documentation

## Vue d'ensemble

L'API Comptabilité de Talok permet de gérer l'ensemble des opérations comptables liées à la gestion locative : honoraires, CRG, balance des mandants, régularisation des charges, dépôts de garantie et export FEC.

## Authentification

Toutes les routes nécessitent une authentification via Supabase Auth.

```
Authorization: Bearer <token>
```

## Endpoints

---

### Compte Rendu de Gestion (CRG)

#### GET `/api/accounting/crg`

Génère le Compte Rendu de Gestion pour un propriétaire sur une période.

**Paramètres de requête:**
| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| owner_id | string | Oui (admin) | ID du propriétaire |
| start_date | string | Oui | Date de début (YYYY-MM-DD) |
| end_date | string | Oui | Date de fin (YYYY-MM-DD) |
| property_id | string | Non | Filtrer par bien |
| format | string | Non | `json` (défaut) ou `pdf` |

**Réponse (200):**
```json
{
  "success": true,
  "data": [
    {
      "numero": "CRG-2024-ABC1",
      "date_emission": "2024-01-15",
      "periode": {
        "debut": "2024-01-01",
        "fin": "2024-01-31",
        "libelle": "Du 1er janvier au 31 janvier 2024"
      },
      "proprietaire": {
        "id": "uuid",
        "nom": "Dupont",
        "prenom": "Jean"
      },
      "bien": {
        "id": "uuid",
        "adresse": "10 rue de la Paix",
        "ville": "Paris",
        "code_postal": "75002"
      },
      "locataire": {
        "nom": "Martin",
        "prenom": "Sophie"
      },
      "mouvements": [
        {
          "id": "LOY-xxx",
          "date": "2024-01-05",
          "libelle": "Loyer janvier 2024",
          "type": "credit",
          "montant": 1200.00
        }
      ],
      "totaux": {
        "total_debits": 100.80,
        "total_credits": 1200.00
      },
      "solde_fin_periode": 1099.20
    }
  ],
  "meta": {
    "count": 1,
    "periode": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    }
  }
}
```

---

### Balance des Mandants

#### GET `/api/accounting/balance`

Génère la balance des mandants (réservé aux administrateurs).

**Paramètres de requête:**
| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| date | string | Non | Date de la balance (défaut: aujourd'hui) |
| format | string | Non | `json`, `csv`, ou `pdf` |

**Réponse (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-31",
    "comptes_proprietaires": [
      {
        "compte": "467100-ABC1",
        "nom": "Jean Dupont",
        "bien": "10 rue de la Paix",
        "debit": 0,
        "credit": 1099.20
      }
    ],
    "comptes_locataires": [
      {
        "compte": "467200-XYZ1",
        "nom": "Sophie Martin",
        "debit": 0,
        "credit": 0
      }
    ],
    "verification": {
      "solde_banque_mandant": 1099.20,
      "total_dettes_proprietaires": 1099.20,
      "total_creances_locataires": 0,
      "ecart": 0,
      "equilibre": true
    }
  }
}
```

---

### Récapitulatif Fiscal

#### GET `/api/accounting/fiscal`

Génère le récapitulatif fiscal annuel pour la déclaration 2044.

**Paramètres de requête:**
| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| year | number | Non | Année fiscale (défaut: année précédente) |
| owner_id | string | Oui (admin) | ID du propriétaire |
| format | string | Non | `json`, `csv`, ou `pdf` |

**Réponse (200):**
```json
{
  "success": true,
  "data": {
    "annee": 2023,
    "proprietaire": {
      "nom": "Dupont",
      "prenom": "Jean"
    },
    "biens": [
      {
        "adresse": "10 rue de la Paix, Paris",
        "loyers_bruts": 14400.00,
        "charges_recuperees": 1800.00
      }
    ],
    "revenus_bruts": {
      "loyers": 14400.00,
      "charges_recuperees": 1800.00,
      "total": 16200.00
    },
    "charges_deductibles": {
      "ligne_221_honoraires_gestion": 1209.60,
      "ligne_222_frais_gestion_forfait": 20.00,
      "ligne_223_assurances": 250.00,
      "ligne_224_total": 500.00,
      "ligne_227_taxe_fonciere": 800.00,
      "total": 2779.60
    },
    "revenu_foncier_net": 13420.40
  },
  "meta": {
    "disclaimer": "Document indicatif pour la déclaration 2044"
  }
}
```

---

### Situation Locataire

#### GET `/api/accounting/situation/{tenantId}`

Génère la situation de compte d'un locataire.

**Paramètres de chemin:**
| Param | Type | Description |
|-------|------|-------------|
| tenantId | string | ID du locataire |

**Réponse (200):**
```json
{
  "success": true,
  "data": {
    "date_edition": "2024-01-15",
    "locataire": {
      "nom": "Martin",
      "prenom": "Sophie",
      "bail": {
        "debut": "2023-01-01",
        "type": "nu"
      }
    },
    "historique": [
      {
        "periode": "2024-01",
        "montant_appele": 1280.00,
        "montant_paye": 1280.00,
        "solde": 0,
        "statut": "solde"
      }
    ],
    "situation": {
      "nb_mois_bail": 13,
      "total_appele": 16640.00,
      "total_paye": 16640.00,
      "solde_du": 0,
      "a_jour": true
    }
  }
}
```

---

### Régularisation des Charges

#### GET `/api/accounting/charges/regularisation`

Liste les régularisations d'un bail.

**Paramètres de requête:**
| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| lease_id | string | Oui | ID du bail |
| year | number | Non | Filtrer par année |

#### POST `/api/accounting/charges/regularisation`

Crée une nouvelle régularisation.

**Corps de la requête:**
```json
{
  "lease_id": "uuid",
  "year": 2023,
  "charges_reelles": [
    {
      "type": "eau",
      "libelle": "Eau froide et chaude",
      "montant_total": 500,
      "quote_part": 100
    }
  ]
}
```

#### POST `/api/accounting/charges/regularisation/{id}/apply`

Applique une régularisation (crée facture ou avoir).

---

### Dépôts de Garantie

#### GET `/api/accounting/deposits`

Liste les dépôts de garantie.

**Paramètres de requête:**
| Param | Type | Description |
|-------|------|-------------|
| lease_id | string | Filtrer par bail |
| status | string | `active`, `restituted`, `retained` |

#### POST `/api/accounting/deposits`

Enregistre une opération sur dépôt.

**Corps de la requête:**
```json
{
  "lease_id": "uuid",
  "operation_type": "encaissement",
  "amount": 1500.00,
  "date": "2024-01-01",
  "description": "Dépôt de garantie initial"
}
```

**Types d'opération:**
- `encaissement` - Réception du dépôt
- `restitution` - Restitution au locataire
- `retenue` - Retenue (dégradations, impayés)

---

### Export FEC

#### GET `/api/accounting/fec/export`

Génère l'export FEC (Fichier des Écritures Comptables).

**Paramètres de requête:**
| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| year | number | Oui | Année fiscale |
| format | string | Non | `csv` (défaut) ou `txt` |

**Réponse:** Fichier CSV/TXT téléchargeable

**Format FEC conforme:**
```
JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;...
VE;Ventes;VE-2024-000001;20240105;411ABCDE;Client Dupont;...
```

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 400 | Paramètres invalides |
| 401 | Non authentifié |
| 403 | Accès non autorisé |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |
| 501 | Fonctionnalité non implémentée (ex: PDF) |

## Calculs

### Honoraires de gestion

```
Honoraires HT = Loyer HC × Taux (7% par défaut)
TVA = Honoraires HT × Taux TVA
  - Métropole: 20%
  - Antilles/Réunion: 8.5%
  - Guyane/Mayotte: 0%
Honoraires TTC = Honoraires HT + TVA
Net propriétaire = Loyer HC - Honoraires TTC
```

### Prorata temporis

```
Ratio = Jours d'occupation / Jours de l'année
Montant proratisé = Montant annuel × Ratio
```

## Plan comptable

| Compte | Libellé |
|--------|---------|
| 467100 | Comptes propriétaires mandants |
| 467200 | Comptes locataires |
| 512100 | Banque compte mandant |
| 512000 | Banque compte courant |
| 706100 | Honoraires de gestion locative |
| 445710 | TVA collectée |
| 165000 | Dépôts de garantie reçus |

## Exemples d'utilisation

### Générer un CRG pour le mois en cours

```bash
curl -X GET \
  'https://api.talok.fr/api/accounting/crg?start_date=2024-01-01&end_date=2024-01-31' \
  -H 'Authorization: Bearer <token>'
```

### Créer une régularisation

```bash
curl -X POST \
  'https://api.talok.fr/api/accounting/charges/regularisation' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "lease_id": "uuid-du-bail",
    "year": 2023
  }'
```

### Exporter le FEC

```bash
curl -X GET \
  'https://api.talok.fr/api/accounting/fec/export?year=2023' \
  -H 'Authorization: Bearer <token>' \
  -o FEC_2023.csv
```
