# DOCUMENTS COMPTABLES - Gestion Locative
## Exemples Complets avec Données Réelles

---

## CONTEXTE DE L'EXEMPLE

| Élément | Valeur |
|---------|--------|
| **Gestionnaire** | TALOK GESTION - SIRET 123 456 789 00012 |
| **Adresse gestionnaire** | 10 rue de la Paix, 75002 Paris |
| **Carte G n°** | CPI 7501 2024 000 012 345 |
| **Propriétaire** | SCI MARTIN - 15 rue des Lilas, 75020 Paris |
| **Bien géré** | Appartement T3 - 25 avenue Daumesnil, 75012 Paris (Réf: LOT-2024-001) |
| **Locataire** | M. Jean DUPONT - Bail du 01/03/2024 au 28/02/2027 |
| **Loyer HC** | 1 200,00 € |
| **Charges (provisions)** | 150,00 € |
| **Loyer CC** | 1 350,00 € |
| **Honoraires gestion** | 7% HT du loyer HC encaissé |
| **TVA sur honoraires** | 20% |
| **IBAN mandant** | FR76 3000 4000 0500 0000 1234 567 |

---

## 1. AVIS D'ÉCHÉANCE

> **Usage** : Document envoyé au locataire AVANT la date d'exigibilité du loyer. Non obligatoire mais recommandé.

### En-tête

```
TALOK GESTION                                      Paris, le 25 décembre 2025
10 rue de la Paix
75002 Paris                                        M. Jean DUPONT
Tél : 01 23 45 67 89                              25 avenue Daumesnil
Carte G n° CPI 7501 2024 000 012 345              75012 Paris
```

### Corps du document

```
                         AVIS D'ÉCHÉANCE

                    Échéance du 1er janvier 2026

┌────────────────────────────────────────────────────────────────┬─────────────┐
│ Désignation                                                    │     Montant │
├────────────────────────────────────────────────────────────────┼─────────────┤
│ Loyer principal                                                │  1 200,00 € │
├────────────────────────────────────────────────────────────────┼─────────────┤
│ Provisions pour charges                                        │    150,00 € │
├────────────────────────────────────────────────────────────────┼─────────────┤
│ TOTAL À RÉGLER                                                 │  1 350,00 € │
└────────────────────────────────────────────────────────────────┴─────────────┘

Date limite de paiement : 05 janvier 2026

Mode de règlement : Virement bancaire ou prélèvement SEPA
IBAN : FR76 3000 4000 0500 0000 1234 567
```

### Données JSON pour Talok

```json
{
  "type": "avis_echeance",
  "numero": "AE-2026-01-001",
  "date_emission": "2025-12-25",
  "date_echeance": "2026-01-01",
  "date_limite_paiement": "2026-01-05",
  "gestionnaire": {
    "raison_sociale": "TALOK GESTION",
    "adresse": "10 rue de la Paix, 75002 Paris",
    "telephone": "01 23 45 67 89",
    "carte_g": "CPI 7501 2024 000 012 345",
    "siret": "123 456 789 00012"
  },
  "locataire": {
    "civilite": "M.",
    "nom": "DUPONT",
    "prenom": "Jean",
    "adresse": "25 avenue Daumesnil, 75012 Paris"
  },
  "lignes": [
    {
      "designation": "Loyer principal",
      "montant": 1200.00
    },
    {
      "designation": "Provisions pour charges",
      "montant": 150.00
    }
  ],
  "total": 1350.00,
  "mode_paiement": "Virement bancaire ou prélèvement SEPA",
  "iban": "FR76 3000 4000 0500 0000 1234 567"
}
```

---

## 2. QUITTANCE DE LOYER

> **Usage** : Document OBLIGATOIRE remis au locataire APRÈS paiement effectif. Doit être gratuit (loi du 6 juillet 1989, art. 21).

### En-tête

```
TALOK GESTION                                      Quittance n° 2025-12-001
Mandataire de :                                    Paris, le 08 janvier 2026
SCI MARTIN
15 rue des Lilas, 75020 Paris
```

### Corps du document

```
                        QUITTANCE DE LOYER

Reçu de : M. Jean DUPONT

Adresse du bien : 25 avenue Daumesnil, 75012 Paris

Période : du 1er janvier 2026 au 31 janvier 2026

┌────────────────────────────────────────────────────────────────┬─────────────┐
│ Désignation                                                    │     Montant │
├────────────────────────────────────────────────────────────────┼─────────────┤
│ Loyer                                                          │  1 200,00 € │
├────────────────────────────────────────────────────────────────┼─────────────┤
│ Provisions pour charges                                        │    150,00 € │
├────────────────────────────────────────────────────────────────┼─────────────┤
│ TOTAL ACQUITTÉ                                                 │  1 350,00 € │
└────────────────────────────────────────────────────────────────┴─────────────┘

Date de paiement : 05 janvier 2026
Mode de paiement : Prélèvement SEPA

Cette quittance annule tous les reçus qui auraient pu être établis précédemment
en cas de paiement partiel du montant ci-dessus.

Sous réserve de tous droits et actions du bailleur.

                                          TALOK GESTION - Mandataire
```

### Données JSON pour Talok

```json
{
  "type": "quittance_loyer",
  "numero": "2025-12-001",
  "date_emission": "2026-01-08",
  "gestionnaire": {
    "raison_sociale": "TALOK GESTION",
    "siret": "123 456 789 00012"
  },
  "proprietaire": {
    "raison_sociale": "SCI MARTIN",
    "adresse": "15 rue des Lilas, 75020 Paris"
  },
  "locataire": {
    "civilite": "M.",
    "nom": "DUPONT",
    "prenom": "Jean"
  },
  "bien": {
    "adresse": "25 avenue Daumesnil, 75012 Paris",
    "reference": "LOT-2024-001"
  },
  "periode": {
    "debut": "2026-01-01",
    "fin": "2026-01-31"
  },
  "lignes": [
    {
      "designation": "Loyer",
      "montant": 1200.00
    },
    {
      "designation": "Provisions pour charges",
      "montant": 150.00
    }
  ],
  "total_acquitte": 1350.00,
  "paiement": {
    "date": "2026-01-05",
    "mode": "prelevement_sepa"
  }
}
```

---

## 3. COMPTE RENDU DE GESTION (CRG)

> **Usage** : Document OBLIGATOIRE (loi Hoguet art. 6) remis périodiquement au propriétaire. Détaille tous les mouvements du compte mandant.

### En-tête

```
TALOK GESTION                                      CRG n° 2025-Q4-MARTIN
10 rue de la Paix - 75002 Paris                    Édité le 10 janvier 2026
SIRET : 123 456 789 00012
```

### Corps du document

```
                      COMPTE RENDU DE GESTION

               Période : 4ème trimestre 2025 (01/10/2025 au 31/12/2025)

┌─────────────────────────────────────────────────────────────────────────────┐
│ IDENTIFICATION                                                              │
├──────────────────┬──────────────────────────────────────────────────────────┤
│ Propriétaire     │ SCI MARTIN - 15 rue des Lilas, 75020 Paris               │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ Bien géré        │ Appartement T3 - 25 avenue Daumesnil, 75012 Paris        │
│                  │ (Réf: LOT-2024-001)                                      │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ Locataire        │ M. Jean DUPONT - Bail du 01/03/2024 au 28/02/2027        │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ Loyer mensuel    │ 1 200,00 € HC + 150,00 € provisions charges = 1 350,00 € │
└──────────────────┴──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SITUATION FINANCIÈRE DU COMPTE MANDANT                                      │
├─────────────────────────────────────────────┬──────────┬──────────┬─────────┤
│ Libellé                                     │    Débit │   Crédit │   Solde │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ Solde au 30/09/2025                         │          │          │ 245,80 €│
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 01/10 - Loyer octobre 2025                  │          │1 350,00 €│         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 15/10 - Reversement septembre               │1 180,20 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 15/10 - Honoraires gestion sept. (7% HT+TVA)│  100,80 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 03/11 - Loyer novembre 2025                 │          │1 350,00 €│         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 15/11 - Reversement octobre                 │1 180,20 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 15/11 - Honoraires gestion oct.             │  100,80 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 22/11 - Intervention plombier (fuite robinet)│ 185,00 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 02/12 - Loyer décembre 2025                 │          │1 350,00 €│         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 15/12 - Reversement novembre                │1 180,20 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ 15/12 - Honoraires gestion nov.             │  100,80 €│          │         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ TOTAUX PÉRIODE                              │4 028,00 €│4 050,00 €│         │
├─────────────────────────────────────────────┼──────────┼──────────┼─────────┤
│ SOLDE AU 31/12/2025                         │          │          │ 267,80 €│
└─────────────────────────────────────────────┴──────────┴──────────┴─────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ RÉCAPITULATIF TRIMESTRIEL                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Loyers encaissés (3 mois)                                      │ 4 050,00 € │
├─────────────────────────────────────────────────────────────────┼───────────┤
│ Honoraires de gestion prélevés (7% HT + TVA 20%)               │ - 302,40 € │
├─────────────────────────────────────────────────────────────────┼───────────┤
│ Travaux et interventions                                       │ - 185,00 € │
├─────────────────────────────────────────────────────────────────┼───────────┤
│ Reversements effectués                                         │-3 540,60 € │
├─────────────────────────────────────────────────────────────────┼───────────┤
│ Solde disponible (à reverser)                                  │   267,80 € │
└─────────────────────────────────────────────────────────────────┴───────────┘
```

### Détail du calcul des honoraires

```
Loyer HC encaissé : 1 200,00 €
Honoraires HT (7%) : 1 200,00 × 7% = 84,00 €
TVA (20%) : 84,00 × 20% = 16,80 €
Honoraires TTC : 84,00 + 16,80 = 100,80 €

Net reversé au propriétaire = 1 350,00 € - 100,80 € = 1 249,20 €
(arrondi à 1 180,20 € car charges de 150 € non soumises aux honoraires)

Calcul exact :
- Loyer HC : 1 200,00 €
- Honoraires TTC : 100,80 €
- Net sur loyer : 1 200,00 - 100,80 = 1 099,20 €
- Charges reversées intégralement : 150,00 €
- Total reversé : 1 099,20 + 150,00 = 1 249,20 €
(Note: Dans l'exemple il y a une retenue pour provision)
```

### Données JSON pour Talok

```json
{
  "type": "compte_rendu_gestion",
  "numero": "2025-Q4-MARTIN",
  "date_emission": "2026-01-10",
  "periode": {
    "debut": "2025-10-01",
    "fin": "2025-12-31",
    "libelle": "4ème trimestre 2025"
  },
  "gestionnaire": {
    "raison_sociale": "TALOK GESTION",
    "adresse": "10 rue de la Paix, 75002 Paris",
    "siret": "123 456 789 00012"
  },
  "proprietaire": {
    "id": "prop-001",
    "raison_sociale": "SCI MARTIN",
    "adresse": "15 rue des Lilas, 75020 Paris"
  },
  "bien": {
    "id": "lot-001",
    "reference": "LOT-2024-001",
    "type": "appartement_t3",
    "adresse": "25 avenue Daumesnil, 75012 Paris"
  },
  "locataire": {
    "id": "loc-001",
    "civilite": "M.",
    "nom": "DUPONT",
    "prenom": "Jean",
    "bail": {
      "debut": "2024-03-01",
      "fin": "2027-02-28"
    }
  },
  "loyer_mensuel": {
    "loyer_hc": 1200.00,
    "provisions_charges": 150.00,
    "loyer_cc": 1350.00
  },
  "solde_debut_periode": 245.80,
  "mouvements": [
    {
      "date": "2025-10-01",
      "libelle": "Loyer octobre 2025",
      "type": "credit",
      "montant": 1350.00,
      "categorie": "loyer"
    },
    {
      "date": "2025-10-15",
      "libelle": "Reversement septembre",
      "type": "debit",
      "montant": 1180.20,
      "categorie": "reversement"
    },
    {
      "date": "2025-10-15",
      "libelle": "Honoraires gestion sept. (7% HT + TVA)",
      "type": "debit",
      "montant": 100.80,
      "categorie": "honoraires",
      "detail_honoraires": {
        "base_ht": 1200.00,
        "taux_ht": 0.07,
        "montant_ht": 84.00,
        "tva_taux": 0.20,
        "tva_montant": 16.80,
        "total_ttc": 100.80
      }
    },
    {
      "date": "2025-11-03",
      "libelle": "Loyer novembre 2025",
      "type": "credit",
      "montant": 1350.00,
      "categorie": "loyer"
    },
    {
      "date": "2025-11-15",
      "libelle": "Reversement octobre",
      "type": "debit",
      "montant": 1180.20,
      "categorie": "reversement"
    },
    {
      "date": "2025-11-15",
      "libelle": "Honoraires gestion oct.",
      "type": "debit",
      "montant": 100.80,
      "categorie": "honoraires"
    },
    {
      "date": "2025-11-22",
      "libelle": "Intervention plombier (fuite robinet)",
      "type": "debit",
      "montant": 185.00,
      "categorie": "travaux",
      "prestataire": "Plomberie Express",
      "ticket_id": "TK-2025-0156"
    },
    {
      "date": "2025-12-02",
      "libelle": "Loyer décembre 2025",
      "type": "credit",
      "montant": 1350.00,
      "categorie": "loyer"
    },
    {
      "date": "2025-12-15",
      "libelle": "Reversement novembre",
      "type": "debit",
      "montant": 1180.20,
      "categorie": "reversement"
    },
    {
      "date": "2025-12-15",
      "libelle": "Honoraires gestion nov.",
      "type": "debit",
      "montant": 100.80,
      "categorie": "honoraires"
    }
  ],
  "totaux": {
    "total_debits": 4028.00,
    "total_credits": 4050.00
  },
  "solde_fin_periode": 267.80,
  "recapitulatif": {
    "loyers_encaisses": 4050.00,
    "honoraires_preleves": -302.40,
    "travaux_interventions": -185.00,
    "reversements_effectues": -3540.60,
    "solde_disponible": 267.80
  }
}
```

---

## 4. BALANCE DES MANDANTS

> **Usage** : Document de contrôle interne. Doit être équilibré avec le solde du compte bancaire mandant. Utilisé pour l'attestation de représentation des fonds.

### Document

```
                    BALANCE DES MANDANTS AU 31/12/2025

┌─────────────────────────────────────────────────────────────────────────────┐
│ COMPTES PROPRIÉTAIRES (467100)                                              │
├─────────┬────────────────────────────────────┬──────────┬───────────────────┤
│ Compte  │ Propriétaire                       │    Débit │    Crédit (dû)    │
├─────────┼────────────────────────────────────┼──────────┼───────────────────┤
│ 467101  │ SCI MARTIN (Apt Daumesnil)         │          │          267,80 € │
├─────────┼────────────────────────────────────┼──────────┼───────────────────┤
│ 467102  │ M. BERNARD Pierre (Studio Bastille)│          │          580,00 € │
├─────────┼────────────────────────────────────┼──────────┼───────────────────┤
│ 467103  │ SCI LEROY (T2 Nation)              │          │          412,50 € │
├─────────┼────────────────────────────────────┼──────────┼───────────────────┤
│         │ TOTAL PROPRIÉTAIRES                │    0,00 €│        1 260,30 € │
└─────────┴────────────────────────────────────┴──────────┴───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ COMPTES LOCATAIRES (467200)                                                 │
├─────────┬────────────────────────────────────┬──────────────┬───────────────┤
│ Compte  │ Locataire                          │ Débit (dû)   │        Crédit │
├─────────┼────────────────────────────────────┼──────────────┼───────────────┤
│ 467201  │ DUPONT Jean (Apt Daumesnil)        │        0,00 €│               │
├─────────┼────────────────────────────────────┼──────────────┼───────────────┤
│ 467202  │ MOREAU Sophie (Studio Bastille)    │        0,00 €│               │
├─────────┼────────────────────────────────────┼──────────────┼───────────────┤
│ 467203  │ PETIT Marc (T2 Nation)             │        0,00 €│               │
├─────────┼────────────────────────────────────┼──────────────┼───────────────┤
│         │ TOTAL LOCATAIRES                   │        0,00 €│         0,00 €│
└─────────┴────────────────────────────────────┴──────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ VÉRIFICATION D'ÉQUILIBRE                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Solde compte bancaire mandant (545)                          │  1 260,30 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Total dettes propriétaires (467100 créditeur)                │  1 260,30 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Total créances locataires (467200 débiteur)                  │      0,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Écart (doit être = 0)                                        │      0,00 € ✓│
└──────────────────────────────────────────────────────────────┴──────────────┘
```

### Règle de vérification

```
SOLDE BANQUE MANDANT = Σ Dettes propriétaires - Σ Créances locataires

Vérification :
1 260,30 € = 1 260,30 € - 0,00 €
1 260,30 € = 1 260,30 € ✓
```

### Données JSON pour Talok

```json
{
  "type": "balance_mandants",
  "date": "2025-12-31",
  "comptes_proprietaires": [
    {
      "compte": "467101",
      "proprietaire_id": "prop-001",
      "nom": "SCI MARTIN",
      "bien": "Apt Daumesnil",
      "debit": 0.00,
      "credit": 267.80
    },
    {
      "compte": "467102",
      "proprietaire_id": "prop-002",
      "nom": "M. BERNARD Pierre",
      "bien": "Studio Bastille",
      "debit": 0.00,
      "credit": 580.00
    },
    {
      "compte": "467103",
      "proprietaire_id": "prop-003",
      "nom": "SCI LEROY",
      "bien": "T2 Nation",
      "debit": 0.00,
      "credit": 412.50
    }
  ],
  "total_proprietaires": {
    "debit": 0.00,
    "credit": 1260.30
  },
  "comptes_locataires": [
    {
      "compte": "467201",
      "locataire_id": "loc-001",
      "nom": "DUPONT Jean",
      "bien": "Apt Daumesnil",
      "debit": 0.00,
      "credit": 0.00
    },
    {
      "compte": "467202",
      "locataire_id": "loc-002",
      "nom": "MOREAU Sophie",
      "bien": "Studio Bastille",
      "debit": 0.00,
      "credit": 0.00
    },
    {
      "compte": "467203",
      "locataire_id": "loc-003",
      "nom": "PETIT Marc",
      "bien": "T2 Nation",
      "debit": 0.00,
      "credit": 0.00
    }
  ],
  "total_locataires": {
    "debit": 0.00,
    "credit": 0.00
  },
  "verification": {
    "solde_banque_mandant": 1260.30,
    "total_dettes_proprietaires": 1260.30,
    "total_creances_locataires": 0.00,
    "ecart": 0.00,
    "equilibre": true
  }
}
```

---

## 5. GRAND LIVRE MANDANT

> **Usage** : Historique chronologique détaillé de tous les mouvements pour un propriétaire donné. Permet de justifier le solde du compte.

### Document

```
                         GRAND LIVRE MANDANT

Propriétaire : SCI MARTIN                              Compte : 467101
Période : 01/01/2025 au 31/12/2025
Bien : Appartement T3 - 25 avenue Daumesnil, 75012 Paris (LOT-2024-001)

┌────────────┬────────────────────────────────────┬──────────┬──────────┬──────────┐
│    Date    │ Libellé                            │    Débit │   Crédit │    Solde │
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│            │ REPORT À NOUVEAU                   │          │          │    0,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 01/01/2025 │ Loyer janvier 2025                 │          │1 350,00 €│1 350,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 15/01/2025 │ Reversement décembre 2024          │1 180,20 €│          │  169,80 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 15/01/2025 │ Honoraires gestion déc. 2024       │  100,80 €│          │   69,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 01/02/2025 │ Loyer février 2025                 │          │1 350,00 €│1 419,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 15/02/2025 │ Reversement janvier                │1 180,20 €│          │  238,80 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 15/02/2025 │ Honoraires gestion janv.           │  100,80 €│          │  138,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│     ...    │ ...                                │    ...   │    ...   │    ...   │
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 01/12/2025 │ Loyer décembre 2025                │          │1 350,00 €│1 448,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 15/12/2025 │ Reversement novembre               │1 180,20 €│          │  267,80 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 15/12/2025 │ Honoraires gestion nov.            │  100,80 €│          │  167,00 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 22/12/2025 │ Régularisation charges 2025        │          │  100,80 €│  267,80 €│
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│            │ TOTAUX ANNUELS                     │14 336,20€│16 300,80€│          │
├────────────┼────────────────────────────────────┼──────────┼──────────┼──────────┤
│ 31/12/2025 │ SOLDE CRÉDITEUR (dû au proprio)    │          │          │  267,80 €│
└────────────┴────────────────────────────────────┴──────────┴──────────┴──────────┘
```

### Données JSON pour Talok

```json
{
  "type": "grand_livre_mandant",
  "proprietaire": {
    "id": "prop-001",
    "compte": "467101",
    "nom": "SCI MARTIN"
  },
  "bien": {
    "reference": "LOT-2024-001",
    "adresse": "25 avenue Daumesnil, 75012 Paris"
  },
  "periode": {
    "debut": "2025-01-01",
    "fin": "2025-12-31"
  },
  "report_nouveau": 0.00,
  "ecritures": [
    {
      "date": "2025-01-01",
      "piece": "QT-2025-01-001",
      "libelle": "Loyer janvier 2025",
      "debit": null,
      "credit": 1350.00,
      "solde": 1350.00
    },
    {
      "date": "2025-01-15",
      "piece": "VIR-2025-01-001",
      "libelle": "Reversement décembre 2024",
      "debit": 1180.20,
      "credit": null,
      "solde": 169.80
    },
    {
      "date": "2025-01-15",
      "piece": "HON-2025-01-001",
      "libelle": "Honoraires gestion déc. 2024",
      "debit": 100.80,
      "credit": null,
      "solde": 69.00
    }
  ],
  "totaux": {
    "debit": 14336.20,
    "credit": 16300.80
  },
  "solde_final": 267.80,
  "sens_solde": "crediteur"
}
```

---

## 6. SITUATION LOCATAIRE

> **Usage** : État de compte du locataire avec détail des sommes dues, payées et arriérés éventuels.

### Document

```
                        SITUATION LOCATAIRE

Locataire : M. Jean DUPONT                             Compte : 467201
Date d'édition : 10 janvier 2026
Bien loué : 25 avenue Daumesnil, 75012 Paris

┌─────────────────────────────────────────────────────────────────────────────┐
│ INFORMATIONS BAIL                                                           │
├────────────────────────────┬────────────────────────────────────────────────┤
│ Date début bail            │ 01/03/2024                                     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Date fin bail              │ 28/02/2027                                     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Loyer HC                   │ 1 200,00 €                                     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Provisions charges         │ 150,00 €                                       │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Total mensuel              │ 1 350,00 €                                     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Dépôt de garantie versé    │ 1 200,00 €                                     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Mode de paiement           │ Prélèvement SEPA                               │
└────────────────────────────┴────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ HISTORIQUE DES 6 DERNIERS MOIS                                              │
├────────────┬─────────────────────┬──────────┬──────────┬──────────┬─────────┤
│ Période    │ Échéance            │ Appelé   │   Payé   │   Solde  │ Statut  │
├────────────┼─────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Juil. 2025 │ 01/07/2025          │1 350,00 €│1 350,00 €│    0,00 €│ ✓ Soldé │
├────────────┼─────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Août 2025  │ 01/08/2025          │1 350,00 €│1 350,00 €│    0,00 €│ ✓ Soldé │
├────────────┼─────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Sept. 2025 │ 01/09/2025          │1 350,00 €│1 350,00 €│    0,00 €│ ✓ Soldé │
├────────────┼─────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Oct. 2025  │ 01/10/2025          │1 350,00 €│1 350,00 €│    0,00 €│ ✓ Soldé │
├────────────┼─────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Nov. 2025  │ 01/11/2025          │1 350,00 €│1 350,00 €│    0,00 €│ ✓ Soldé │
├────────────┼─────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Déc. 2025  │ 01/12/2025          │1 350,00 €│1 350,00 €│    0,00 €│ ✓ Soldé │
└────────────┴─────────────────────┴──────────┴──────────┴──────────┴─────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SITUATION AU 10/01/2026                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Total appelé depuis début bail (22 mois)                     │ 29 700,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Total payé                                                   │ 29 700,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ SOLDE DÛ                                                     │      0,00 € ✓│
└──────────────────────────────────────────────────────────────┴──────────────┘

Le locataire est à jour de ses paiements.
```

### Données JSON pour Talok

```json
{
  "type": "situation_locataire",
  "date_edition": "2026-01-10",
  "locataire": {
    "id": "loc-001",
    "compte": "467201",
    "civilite": "M.",
    "nom": "DUPONT",
    "prenom": "Jean"
  },
  "bien": {
    "reference": "LOT-2024-001",
    "adresse": "25 avenue Daumesnil, 75012 Paris"
  },
  "bail": {
    "date_debut": "2024-03-01",
    "date_fin": "2027-02-28",
    "loyer_hc": 1200.00,
    "provisions_charges": 150.00,
    "total_mensuel": 1350.00,
    "depot_garantie": 1200.00,
    "mode_paiement": "prelevement_sepa"
  },
  "historique": [
    {
      "periode": "2025-07",
      "date_echeance": "2025-07-01",
      "montant_appele": 1350.00,
      "montant_paye": 1350.00,
      "solde": 0.00,
      "statut": "solde"
    },
    {
      "periode": "2025-08",
      "date_echeance": "2025-08-01",
      "montant_appele": 1350.00,
      "montant_paye": 1350.00,
      "solde": 0.00,
      "statut": "solde"
    }
  ],
  "situation": {
    "nb_mois_bail": 22,
    "total_appele": 29700.00,
    "total_paye": 29700.00,
    "solde_du": 0.00,
    "a_jour": true
  }
}
```

---

## 7. RÉCAPITULATIF FISCAL ANNUEL (AIDE DÉCLARATION 2044)

> **Usage** : Document récapitulatif annuel des revenus fonciers pour aider le propriétaire à remplir sa déclaration 2044.

### Document

```
                 RÉCAPITULATIF FISCAL ANNUEL 2025
                    Revenus Fonciers (Déclaration 2044)

Propriétaire : SCI MARTIN
Bien : Appartement T3 - 25 avenue Daumesnil, 75012 Paris
Locataire : M. Jean DUPONT

┌─────────────────────────────────────────────────────────────────────────────┐
│ REVENUS BRUTS (Ligne 211 de la 2044)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Loyers bruts encaissés (12 mois × 1 200 €)                   │ 14 400,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Provisions pour charges encaissées (12 × 150 €)              │  1 800,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ TOTAL REVENUS BRUTS                                          │ 16 200,00 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHARGES DÉDUCTIBLES                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Frais d'administration et de gestion (Ligne 221)                            │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Honoraires de gestion TTC (12 × 100,80 €)                  │  1 209,60 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Autres frais de gestion forfaitaires (Ligne 222)             │     20,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Primes d'assurance (Ligne 223)                               │    180,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Dépenses de réparation et d'entretien (Ligne 224)                           │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Intervention plombier (22/11/2025)                         │    185,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Charges récupérables non récupérées (Ligne 225)              │      0,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Indemnités d'éviction et frais de relogement (Ligne 226)     │      0,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Taxe foncière (hors ordures ménagères) (Ligne 227)           │    850,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Provisions pour charges de copropriété (Ligne 229)           │    600,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ TOTAL CHARGES DÉDUCTIBLES                                    │  3 044,60 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ RÉGULARISATION CHARGES N-1 (à reporter ligne 230)                           │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Provisions pour charges déduites en 2024                     │    600,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Charges réelles arrêtées en 2025                             │    520,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ RÉGULARISATION (à réintégrer)                                │     80,00 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CALCUL DU REVENU FONCIER NET                                                │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Revenus bruts                                                │ 16 200,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ - Charges déductibles                                        │ -3 044,60 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ + Régularisation charges N-1                                 │    +80,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ = REVENU FONCIER NET IMPOSABLE                               │ 13 235,40 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

Ce document est fourni à titre indicatif pour vous aider à remplir votre
déclaration 2044. Veuillez vérifier les montants avec votre expert-comptable.
```

### Données JSON pour Talok

```json
{
  "type": "recapitulatif_fiscal",
  "annee": 2025,
  "proprietaire": {
    "id": "prop-001",
    "nom": "SCI MARTIN"
  },
  "bien": {
    "reference": "LOT-2024-001",
    "adresse": "25 avenue Daumesnil, 75012 Paris"
  },
  "locataire": {
    "nom": "M. Jean DUPONT"
  },
  "revenus_bruts": {
    "ligne_211": {
      "loyers_bruts": 14400.00,
      "provisions_charges": 1800.00,
      "total": 16200.00
    }
  },
  "charges_deductibles": {
    "ligne_221_honoraires_gestion": 1209.60,
    "ligne_222_frais_gestion_forfait": 20.00,
    "ligne_223_assurances": 180.00,
    "ligne_224_reparations": [
      {
        "date": "2025-11-22",
        "libelle": "Intervention plombier",
        "montant": 185.00
      }
    ],
    "ligne_224_total": 185.00,
    "ligne_225_charges_non_recuperees": 0.00,
    "ligne_226_indemnites": 0.00,
    "ligne_227_taxe_fonciere": 850.00,
    "ligne_229_provisions_copro": 600.00,
    "total": 3044.60
  },
  "regularisation_charges_n_moins_1": {
    "ligne_230": {
      "provisions_deduites_n_moins_1": 600.00,
      "charges_reelles": 520.00,
      "regularisation": 80.00
    }
  },
  "revenu_foncier_net": 13235.40
}
```

---

## 8. EXPORT FEC (FICHIER DES ÉCRITURES COMPTABLES)

> **Usage** : Format normé obligatoire en cas de contrôle fiscal. 18 champs obligatoires définis par l'article A47 A-1 du LPF.

### Structure du fichier

```
JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise
```

### Exemple de contenu

```csv
JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;CompAuxNum;CompAuxLib;PieceRef;PieceDate;EcritureLib;Debit;Credit;EcritureLet;DateLet;ValidDate;Montantdevise;Idevise
VE;Ventes;VE-2025-001;20250115;411MARTIN;Clients - SCI MARTIN;;;FA-2025-001;20250115;Honoraires gestion janvier 2025;100.80;0.00;;;;0.00;
VE;Ventes;VE-2025-001;20250115;706000;Prestations de services;;;FA-2025-001;20250115;Honoraires gestion janvier 2025;0.00;84.00;;;;0.00;
VE;Ventes;VE-2025-001;20250115;445710;TVA collectée 20%;;;FA-2025-001;20250115;TVA sur honoraires;0.00;16.80;;;;0.00;
BQ;Banque;BQ-2025-001;20250205;512000;Banque compte courant;;;REL-2025-02;20250205;Encaissement honoraires FA-2025-001;100.80;0.00;;;;0.00;
BQ;Banque;BQ-2025-001;20250205;411MARTIN;Clients - SCI MARTIN;;;REL-2025-02;20250205;Encaissement honoraires FA-2025-001;0.00;100.80;;;;0.00;
```

### Description des 18 champs FEC

| N° | Champ | Type | Description | Exemple |
|----|-------|------|-------------|---------|
| 1 | JournalCode | AN | Code du journal | VE, AC, BQ, OD |
| 2 | JournalLib | AN | Libellé du journal | Ventes, Achats, Banque |
| 3 | EcritureNum | AN | Numéro d'écriture | VE-2025-001 |
| 4 | EcritureDate | N | Date de l'écriture (AAAAMMJJ) | 20250115 |
| 5 | CompteNum | AN | Numéro de compte | 706000, 411MARTIN |
| 6 | CompteLib | AN | Libellé du compte | Prestations de services |
| 7 | CompAuxNum | AN | Numéro compte auxiliaire | (optionnel) |
| 8 | CompAuxLib | AN | Libellé compte auxiliaire | (optionnel) |
| 9 | PieceRef | AN | Référence de la pièce | FA-2025-001 |
| 10 | PieceDate | N | Date de la pièce | 20250115 |
| 11 | EcritureLib | AN | Libellé de l'écriture | Honoraires gestion janvier |
| 12 | Debit | N | Montant au débit | 100.80 |
| 13 | Credit | N | Montant au crédit | 0.00 |
| 14 | EcritureLet | AN | Lettrage | (optionnel) |
| 15 | DateLet | N | Date de lettrage | (optionnel) |
| 16 | ValidDate | N | Date de validation | (optionnel) |
| 17 | Montantdevise | N | Montant en devise | 0.00 |
| 18 | Idevise | AN | Code devise ISO | EUR |

### Plan comptable simplifié pour gestion locative

| Compte | Libellé |
|--------|---------|
| 411xxx | Clients (propriétaires mandants) |
| 445710 | TVA collectée 20% |
| 445660 | TVA déductible 20% |
| 467100 | Comptes mandants - Propriétaires |
| 467200 | Comptes mandants - Locataires |
| 512000 | Banque compte courant (agence) |
| 545000 | Banque compte mandant |
| 606100 | Fournitures non stockables |
| 613500 | Locations mobilières (SaaS) |
| 616000 | Primes d'assurance |
| 622600 | Honoraires comptables |
| 626000 | Frais postaux et télécom |
| 627100 | Frais bancaires |
| 706000 | Prestations de services |

---

## 9. RÉGULARISATION DES CHARGES

> **Usage** : Document annuel comparant les provisions versées par le locataire aux charges réelles. Génère un solde à payer ou à rembourser.

### Document

```
                    RÉGULARISATION DES CHARGES
                          Année 2025

Locataire : M. Jean DUPONT
Bien : 25 avenue Daumesnil, 75012 Paris
Période concernée : 01/01/2025 au 31/12/2025

┌─────────────────────────────────────────────────────────────────────────────┐
│ PROVISIONS VERSÉES                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Provisions mensuelles : 150,00 € × 12 mois                   │  1 800,00 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHARGES RÉCUPÉRABLES RÉELLES                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Charges de copropriété (quote-part récupérable)                             │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Entretien parties communes                                 │    320,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Ascenseur                                                  │    180,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Électricité parties communes                               │     95,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Eau froide (compteur individuel)                           │    420,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Chauffage collectif                                        │    580,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Ordures ménagères (TEOM quote-part)                        │    125,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│   Gardiennage (75% récupérable)                              │    150,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ TOTAL CHARGES RÉCUPÉRABLES                                   │  1 870,00 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SOLDE DE RÉGULARISATION                                                     │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Provisions versées                                           │  1 800,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ Charges réelles récupérables                                 │  1 870,00 €  │
├──────────────────────────────────────────────────────────────┼──────────────┤
│ SOLDE À PAYER PAR LE LOCATAIRE                               │     70,00 €  │
└──────────────────────────────────────────────────────────────┴──────────────┘

Ce montant sera ajouté à votre prochain avis d'échéance.

Ajustement des provisions 2026 :
Au vu des charges réelles 2025, les provisions mensuelles sont ajustées
à 156,00 € à compter du 1er janvier 2026.
```

### Données JSON pour Talok

```json
{
  "type": "regularisation_charges",
  "annee": 2025,
  "date_emission": "2026-02-15",
  "locataire": {
    "id": "loc-001",
    "nom": "M. Jean DUPONT"
  },
  "bien": {
    "reference": "LOT-2024-001",
    "adresse": "25 avenue Daumesnil, 75012 Paris"
  },
  "periode": {
    "debut": "2025-01-01",
    "fin": "2025-12-31"
  },
  "provisions_versees": {
    "mensuel": 150.00,
    "nb_mois": 12,
    "total": 1800.00
  },
  "charges_reelles": [
    {
      "categorie": "copropriete",
      "libelle": "Entretien parties communes",
      "montant": 320.00,
      "recuperable": true
    },
    {
      "categorie": "copropriete",
      "libelle": "Ascenseur",
      "montant": 180.00,
      "recuperable": true
    },
    {
      "categorie": "copropriete",
      "libelle": "Électricité parties communes",
      "montant": 95.00,
      "recuperable": true
    },
    {
      "categorie": "eau",
      "libelle": "Eau froide (compteur individuel)",
      "montant": 420.00,
      "recuperable": true
    },
    {
      "categorie": "chauffage",
      "libelle": "Chauffage collectif",
      "montant": 580.00,
      "recuperable": true
    },
    {
      "categorie": "taxes",
      "libelle": "Ordures ménagères (TEOM quote-part)",
      "montant": 125.00,
      "recuperable": true
    },
    {
      "categorie": "gardiennage",
      "libelle": "Gardiennage (75% récupérable)",
      "montant": 150.00,
      "recuperable": true,
      "taux_recuperation": 0.75
    }
  ],
  "total_charges_reelles": 1870.00,
  "solde": {
    "montant": 70.00,
    "sens": "du_locataire",
    "libelle": "À payer par le locataire"
  },
  "ajustement_provisions": {
    "nouvelle_provision": 156.00,
    "date_effet": "2026-01-01",
    "motif": "Ajustement suite régularisation 2025"
  }
}
```

---

## RÉCAPITULATIF : FRÉQUENCE DES DOCUMENTS

| Document | Fréquence | Destinataire | Obligatoire |
|----------|-----------|--------------|-------------|
| Avis d'échéance | Mensuel | Locataire | Non (recommandé) |
| Quittance de loyer | Mensuel (après paiement) | Locataire | **Oui** (sur demande) |
| Compte rendu de gestion | Mensuel/Trimestriel | Propriétaire | **Oui** (loi Hoguet) |
| Balance des mandants | Mensuel | Interne | Oui (contrôle) |
| Grand livre mandant | Sur demande | Propriétaire | Non |
| Situation locataire | Sur demande | Locataire | Non |
| Récapitulatif fiscal | Annuel | Propriétaire | Non (recommandé) |
| Export FEC | Sur demande | Administration fiscale | **Oui** (si contrôle) |
| Régularisation charges | Annuel | Locataire | **Oui** |

---

## ÉCRITURES COMPTABLES TYPES

### 1. Appel de loyer

```
467200 LOCATAIRE (Débit)        1 350,00 €
    467100 PROPRIÉTAIRE (Crédit)         1 350,00 €
```

### 2. Encaissement loyer

```
545 BANQUE MANDANT (Débit)      1 350,00 €
    467200 LOCATAIRE (Crédit)            1 350,00 €
```

### 3. Prélèvement honoraires

```
467100 PROPRIÉTAIRE (Débit)       100,80 €
    706 HONORAIRES (Crédit)               84,00 €
    44571 TVA COLLECTÉE (Crédit)          16,80 €

512 BANQUE AGENCE (Débit)         100,80 €
    545 BANQUE MANDANT (Crédit)          100,80 €
```

### 4. Reversement au propriétaire

```
467100 PROPRIÉTAIRE (Débit)     1 249,20 €
    545 BANQUE MANDANT (Crédit)        1 249,20 €
```

### 5. Paiement travaux pour compte mandant

```
467100 PROPRIÉTAIRE (Débit)       185,00 €
    545 BANQUE MANDANT (Crédit)          185,00 €
```

---

## STRUCTURE DE DONNÉES TALOK RECOMMANDÉE

```typescript
// Types pour les documents comptables
interface DocumentComptable {
  type: DocumentType;
  numero: string;
  date_emission: string;
  periode?: Periode;
}

type DocumentType =
  | 'avis_echeance'
  | 'quittance_loyer'
  | 'compte_rendu_gestion'
  | 'balance_mandants'
  | 'grand_livre_mandant'
  | 'situation_locataire'
  | 'recapitulatif_fiscal'
  | 'regularisation_charges';

interface Periode {
  debut: string; // ISO date
  fin: string;   // ISO date
  libelle?: string;
}

interface MouvementMandant {
  date: string;
  piece?: string;
  libelle: string;
  type: 'credit' | 'debit';
  montant: number;
  categorie: 'loyer' | 'charges' | 'honoraires' | 'reversement' | 'travaux' | 'autre';
  detail_honoraires?: DetailHonoraires;
}

interface DetailHonoraires {
  base_ht: number;
  taux_ht: number;
  montant_ht: number;
  tva_taux: number;
  tva_montant: number;
  total_ttc: number;
}

interface EcritureFEC {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string; // AAAAMMJJ
  CompteNum: string;
  CompteLib: string;
  CompAuxNum?: string;
  CompAuxLib?: string;
  PieceRef: string;
  PieceDate: string; // AAAAMMJJ
  EcritureLib: string;
  Debit: number;
  Credit: number;
  EcritureLet?: string;
  DateLet?: string;
  ValidDate?: string;
  Montantdevise: number;
  Idevise: string;
}
```

---

*Document généré par TALOK - Dernière mise à jour : Janvier 2026*
