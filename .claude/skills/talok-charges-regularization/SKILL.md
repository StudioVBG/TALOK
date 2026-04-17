---
name: talok-charges-regularization
description: >
  Architecture complète de la régularisation des charges locatives et TEOM sur Talok —
  schéma DB canonique (lease_charge_regularizations, charge_categories, charge_entries),
  moteur de calcul engine.ts, OCR avis taxe foncière, génération PDF, écritures comptables,
  bridge copropriété, spécificités DROM-COM (EPCI, SMTVD, REOM, taux différenciés).
  Utilise ce skill pour TOUTE tâche liée aux charges locatives : provisions, forfait,
  régularisation annuelle, TEOM, REOM, ordures ménagères, taxe foncière, prorata temporis,
  copropriété syndic arrêté des comptes, charges récupérables, échelonnement 12 mois,
  prescription 3 ans, clause de renonciation, décompte charges, quittance charges,
  comptabilité charges, FEC charges, Stripe paiement régul, OCR taxe foncière,
  rappels automatiques, notification charges locataire, dashboard charges, module charges.
  Déclenche dès que l'utilisateur mentionne charges, provisions, forfait charges, TEOM,
  ordures ménagères, taxe foncière, régularisation, prorata, copropriété charges,
  charges récupérables, décret 87-713, arrêté syndic, charges locatives, échelonnement,
  trop-perçu, complément charges, frais de gestion 8%, REOM, redevance ordures,
  ou toute question sur la régularisation annuelle des charges.
---

# Talok — Régularisation des charges locatives & TEOM

## 1. Trois systèmes coexistants — source canonique

### ⚠️ Règle absolue : le système CANONIQUE est le moderne EN

| Système | Tables | Statut | Règle |
|---|---|---|---|
| 🟢 **Moderne EN** (canonique) | `lease_charge_regularizations`, `charge_categories`, `charge_entries` | ACTIF — toute nouvelle feature ici | **SEUL système autorisé pour les nouveaux développements** |
| 🟡 **Legacy FR** (vue compat) | `charge_regularisations` (vue INSTEAD OF → pointe vers `lease_charge_regularizations`) | COMPAT SEULE — NE JAMAIS insérer via la vue | Lecture seule pour les anciens composants accounting |
| 🔵 **Copro** (bridge) | `copro_services`, `service_expenses`, `locative_charge_rules` | Bridge copro → locatif | Les charges syndic transitent par ce bridge avant injection dans le système canonique |

**Règles critiques :**
- ❌ JAMAIS d'INSERT/UPDATE via la vue `charge_regularisations` (triggers INSTEAD OF risqués)
- ❌ JAMAIS de nouvelle route dans `/api/accounting/charges/regularisation/` (legacy)
- ✅ Toute nouvelle logique dans `/api/charges/*` et `lib/charges/`
- ✅ Toute nouvelle UI dans `/owner/properties/[id]/charges/` et `/tenant/charges/`

---

## 2. Schéma DB — colonnes réelles

### Table `leases` — champs charges

```sql
loyer                    DECIMAL(10,2) NOT NULL    -- Loyer nu mensuel
loyer_ht / loyer_ttc     NUMERIC(12,2)             -- Bail commercial TVA
charges_forfaitaires     DECIMAL(10,2) NOT NULL DEFAULT 0  -- Montant mensuel (forfait OU provision)
charges_type             TEXT DEFAULT 'forfait'     -- 'forfait' | 'provisions' | 'reel'
                                                    -- 'forfait' = pas de régularisation
                                                    -- 'provisions' = régul annuelle obligatoire
                                                    -- 'reel' = facturation directe après avis TF
mode_paiement            TEXT DEFAULT 'virement'
jour_paiement            INTEGER DEFAULT 5
grace_period_days        INTEGER DEFAULT 3
late_fee_rate            DECIMAL(10,6)
tva_applicable           BOOLEAN
tva_taux                 DECIMAL(5,2)
pinel_repartition_charges JSONB                    -- Commercial uniquement
```

**Points critiques :**
- Colonne bail = `statut` (PAS `status`) — cause des erreurs production si mal nommé
- `charges_forfaitaires` sert pour forfait ET provisions — c'est `charges_type` qui distingue le régime
- Montants en DECIMAL(10,2) sur leases (pas en centimes ici — MAIS le module comptable stocke en centimes INTEGER)

### Table `lease_charge_regularizations` (canonique)

```sql
id                  UUID PRIMARY KEY
lease_id            UUID FK → leases(id)
property_id         UUID FK → properties(id)
entity_id           UUID FK → legal_entities(id)
period_start        DATE NOT NULL
period_end          DATE NOT NULL
occupation_days     INTEGER NOT NULL          -- Jours effectifs d'occupation
exercise_days       INTEGER NOT NULL          -- Jours total de l'exercice
total_provisions    INTEGER NOT NULL          -- En centimes — provisions versées sur la période
total_real_charges  INTEGER NOT NULL          -- En centimes — charges réelles
balance             INTEGER NOT NULL          -- En centimes — (réel - provisions) ; >0 = locataire doit ; <0 = trop-perçu
status              TEXT CHECK (status IN ('draft','sent','contested','settled','cancelled'))
sent_at             TIMESTAMPTZ
settled_at          TIMESTAMPTZ
settlement_method   TEXT                      -- 'stripe' | 'next_rent' | 'installments_12' | 'deduction' | 'waived'
installment_count   INTEGER DEFAULT 1         -- Nb d'échéances si échelonnement
notes               TEXT
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
-- ⚠️ MANQUANT (à ajouter) : regularization_invoice_id UUID FK → invoices(id)
```

### Table `charge_categories`

```sql
id          UUID PRIMARY KEY
code        TEXT UNIQUE NOT NULL    -- 'teom', 'eau', 'chauffage', 'ascenseur', 'entretien_commun', 'espaces_verts', 'syndic_recuperable', 'autre'
label       TEXT NOT NULL           -- "Taxe d'enlèvement des ordures ménagères"
legal_ref   TEXT                    -- 'décret 87-713 art. 8-1' etc.
is_active   BOOLEAN DEFAULT TRUE
```

Source de vérité : `lib/charges/constants.ts` — 6 catégories alignées décret 87-713.

### Table `charge_entries`

```sql
id                  UUID PRIMARY KEY
regularization_id   UUID FK → lease_charge_regularizations(id)
category_id         UUID FK → charge_categories(id)
label               TEXT NOT NULL
amount_cents        INTEGER NOT NULL       -- Montant en centimes
source              TEXT DEFAULT 'manual'   -- 'manual' | 'ocr' | 'syndic_import'
justificatif_doc_id UUID FK → documents(id) -- Lien vers la GED
period_start        DATE
period_end          DATE
created_at          TIMESTAMPTZ DEFAULT NOW()
```

### Table `tax_notices` (À CRÉER)

```sql
id              UUID PRIMARY KEY
property_id     UUID FK → properties(id)
entity_id       UUID FK → legal_entities(id)
year            INTEGER NOT NULL
document_id     UUID FK → documents(id)    -- PDF stocké dans la GED
teom_brut       INTEGER                    -- Centimes — montant brut ligne TEOM
frais_gestion   INTEGER                    -- Centimes — ~8% non récupérable
teom_net        INTEGER                    -- Centimes — brut - frais = récupérable
reom_applicable BOOLEAN DEFAULT FALSE      -- TRUE si commune en REOM
extraction_method TEXT DEFAULT 'manual'    -- 'manual' | 'ocr'
validated       BOOLEAN DEFAULT FALSE
created_at      TIMESTAMPTZ DEFAULT NOW()
UNIQUE(property_id, year)
```

### Table `epci_reference` (À CRÉER)

```sql
id                    UUID PRIMARY KEY
code_departement      TEXT NOT NULL          -- '972', '971', '974', '973', '976'
code_postal_pattern   TEXT                   -- regex: '972\d{2}'
epci_name             TEXT NOT NULL          -- 'CACEM', 'Cap Nord Martinique', 'Espace Sud'
syndicat_traitement   TEXT                   -- 'SMTVD', 'SYVADE', 'SIDEVAM 976', etc.
waste_tax_type        TEXT DEFAULT 'teom'    -- 'teom' | 'reom' | 'none'
teom_rate_pct         NUMERIC(5,2)           -- ex: 19.00
teom_rate_year        INTEGER                -- ex: 2025
notes                 TEXT
```

---

## 3. Architecture fichiers

### Routes API (canoniques)

```
app/api/charges/                              -- CRUD charge_entries
app/api/charges/regularization/               -- CRUD lease_charge_regularizations
app/api/charges/regularization/[id]/apply     -- Settle une régul (paiement/déduction)
app/api/leases/[id]/regularization            -- Régul par bail
app/api/copro/charges                         -- Bridge copro → charges locatives
```

**Legacy (NE PAS UTILISER pour nouveau code) :**
```
app/api/accounting/charges/regularisation/    -- ❌ Legacy FR — vue compat
app/api/accounting/regularization             -- ❌ Legacy
```

### Composants UI

```
-- Owner
app/owner/properties/[id]/charges/                    -- Liste des charges par bien
app/owner/properties/[id]/charges/regularization/     -- Calcul + envoi régul

-- Tenant
app/tenant/charges/                                   -- Consultation + paiement

-- Legacy accounting (NE PAS ÉTENDRE)
features/accounting/components/charge-regularisation-card.tsx
features/accounting/services/charge-regularization.service.ts
```

### Lib core

```
lib/charges/engine.ts       -- Moteur de calcul (prorata, ventilation)
lib/charges/constants.ts    -- Catégories, labels, décret 87-713
lib/charges/types.ts        -- Types TypeScript
```

### Templates email

```
lib/emails/templates/regularization-due.*
lib/emails/react/regularization-due.*
```

---

## 4. Cadre légal — source de vérité pour le code

### Les 3 régimes de charges (`leases.charges_type`)

| Valeur DB | Régime | Régularisation | Cas d'usage |
|---|---|---|---|
| `'provisions'` | Provisions sur charges (réel) | **Obligatoire** 1×/an | Location nue (obligatoire), meublé (optionnel) |
| `'forfait'` | Forfait de charges | **Interdite** — montant fixe, aucun complément possible | Meublé, colocation, bail mobilité (obligatoire) |
| `'reel'` | Sans provision (facturation directe) | Pas de régul — appel direct après avis TF | Maison individuelle (TEOM seule) |

**Règles business critiques :**
- Si `charges_type = 'forfait'` → JAMAIS afficher le bouton "Régulariser", JAMAIS générer d'écriture de régul
- Si `charges_type = 'provisions'` → régul obligatoire, alerte si > 1 an de retard
- Si `charges_type = 'reel'` → workflow simplifié : upload TF → appel TEOM direct

### Charges récupérables (décret n°87-713 du 26 août 1987)

**Récupérables :**
- Services liés au logement : eau froide/chaude, chauffage collectif, ascenseur, électricité parties communes
- Entretien courant : nettoyage parties communes, espaces verts, menues réparations
- Taxes : TEOM (montant NET uniquement), taxe de balayage

**NON récupérables (pièges fréquents) :**
- Frais de gestion TEOM (~8% sur l'avis TF) → `tax_notices.frais_gestion`
- Taxe foncière (sauf bail commercial)
- Travaux d'amélioration votés en AG copropriété
- Grosses réparations, assurance PNO, frais de gestion locative
- Ravalement de façade, remplacement d'équipements

### TEOM — extraction du montant récupérable

```
TEOM récupérable = teom_brut - frais_gestion

Localisation sur l'avis de taxe foncière (page 2) :
  - Colonne "Taxe ordures ménagères" → ligne cotisation = teom_brut
  - "Frais de gestion de la fiscalité directe locale" ≈ 8% = frais_gestion
  - teom_net = teom_brut - frais_gestion
```

### TEOM vs REOM

| | TEOM | REOM |
|---|---|---|
| Payeur initial | Propriétaire (via taxe foncière) | Locataire directement |
| Récupérable | Oui, montant net | Non applicable (le locataire paie déjà) |
| Régularisation | Via régul charges annuelle ou appel direct | Aucune — payée au réel par l'occupant |
| Base de calcul | Valeur locative cadastrale × taux EPCI | Volume/poids déchets ou forfait par foyer |
| Présence sur avis TF | Oui | Non |

**Si `epci_reference.waste_tax_type = 'reom'` → message info propriétaire : "Votre bien est en zone REOM. La redevance est payée directement par le locataire."**

### Prorata temporis

```typescript
// Formule canonique — lib/charges/engine.ts
const chargesProratisees = chargesAnnuelles * (joursOccupation / joursExercice);
const provisionsVersees = provisionMensuelle * (joursOccupation / 30.44); // ou calcul exact mois/jours
const solde = chargesProratisees - provisionsVersees;
// solde > 0 → locataire doit un complément
// solde < 0 → propriétaire doit rembourser
```

### Prescription & échelonnement

- **Prescription : 3 ans** (loi ALUR 2014, art. 7-1 loi 89-462)
- **Régularisation tardive (> 1 an après exigibilité)** → le locataire peut exiger un échelonnement sur 12 mois (`settlement_method = 'installments_12'`)
- **Clause de renonciation** : le propriétaire peut renoncer à la régul au départ du locataire → charges non récupérées déductibles des revenus fonciers

### Obligations légales du décompte

1. Décompte détaillé par catégorie de charge → envoyé **1 mois avant** la date de régul
2. Justificatifs consultables par le locataire pendant **6 mois** après envoi du décompte
3. En copropriété : état de répartition (tantièmes) + consommation individuelle (chauffage, eau chaude)

---

## 5. Cartographie DROM-COM

### Martinique (972) — 3 EPCI + SMTVD

| EPCI | Zone | Taux TEOM ~2025 | Couverture |
|---|---|---|---|
| CACEM | Fort-de-France, Lamentin, Saint-Joseph, Schœlcher | ~15-16% | ~100% |
| Cap Nord Martinique | 18 communes nord | **19%** (hausse 2025) | ~75-80% |
| Espace Sud | 12 communes sud | ~14-16% | ~50% |
| **SMTVD** (traitement uniquement) | Toute l'île | — | — |

### Guadeloupe (971) — 6 EPCI + SYVADE

| EPCI | Zone notable |
|---|---|
| Cap Excellence | Pointe-à-Pitre, Abymes, Baie-Mahault |
| CANBT | Nord Basse-Terre |
| CARL | Grande-Terre Est |
| Grand Sud Caraïbe | Sud Basse-Terre |
| CA Nord Grande-Terre | Nord Grande-Terre |
| CC Marie-Galante | Marie-Galante (surcoût insulaire) |

Couverture TEOM moyenne : >85%. Taux : 12-20% selon EPCI.

### La Réunion (974) — 5 EPCI + 2 syndicats traitement

| EPCI | Syndicat traitement |
|---|---|
| CINOR (Nord) | Run'Eva (ex-SYDNE) |
| CIREST (Est) | Run'Eva |
| TCO (Ouest) | Run'Eva |
| CIVIS (Sud-Ouest) | ILEVA |
| CASUD (Sud) | ILEVA |

Couverture TEOM : ~91%. Taux : 10-18%.

### Guyane (973) — 4 EPCI, pas de syndicat mutualisé

| EPCI | Couverture TEOM | Particularité |
|---|---|---|
| CACL (Cayenne) | ~95% | Seul EPCI quasi à l'équilibre |
| CCDS (Kourou) | ~58% | |
| CCOG (Saint-Laurent) | **~25%** | Valeur locative très faible zones intérieures |
| CCEG (Saint-Georges) | **~15%** | **Camopi : aucune TEOM** (foncier = État) |

### Mayotte (976) — 5 EPCI + SIDEVAM

Couverture TEOM : ~52% (en hausse). Cadastre très incomplet. Taux élevés malgré populations en difficulté.

### COM (Saint-Martin 978, Saint-Barthélemy 977, Polynésie, Nouvelle-Calédonie)

**Hors scope Talok** — autonomie fiscale, pas de TEOM classique. Si un propriétaire saisit un CP 97x hors 971-976 → message "Fiscalité locale spécifique non supportée".

### Matching automatique bien → EPCI

```typescript
// À l'ajout d'un bien, si code postal matche un pattern DROM :
if (/^97[1-6]\d{2}$/.test(codePostal)) {
  const epci = await supabase
    .from('epci_reference')
    .select('*')
    .eq('code_departement', codePostal.substring(0, 3))
    // Affinage par commune si nécessaire
  // → Pré-remplir waste_tax_type et afficher info contextuelle
}
```

---

## 6. Écritures comptables

### Comptes PCG à utiliser (⚠️ certains à ajouter au seed)

| Compte | Libellé | Statut |
|---|---|---|
| 411 | Locataires (créances) | ✅ Existe |
| 4191 | Provisions de charges reçues | ⚠️ À CRÉER |
| 512 | Banque | ✅ Existe (+ 545 Banque mandant) |
| 614 | Charges locatives récupérables | ⚠️ À CRÉER |
| 654 | Charges récupérables non récupérées (renonciation) | ⚠️ À CRÉER |
| 706 | Revenus locatifs / Loyers | ✅ Existe (706100 Honoraires) |
| 708300 | Charges refacturées | ⚠️ À CRÉER |

**Format : `accounting_entry_lines`** — toujours en **centimes INTEGER** (`debit_cents`, `credit_cents`).

### Scénarios d'écritures

#### A. Encaissement mensuel loyer + provisions

```
Débit  512 (Banque)           73000  -- 730,00€
Crédit 706 (Loyers)           65000  -- 650,00€ loyer nu
Crédit 4191 (Provisions)       8000  -- 80,00€ provision charges
```

#### B. Régularisation — locataire doit un complément (solde > 0)

```
-- Solde des provisions
Débit  4191 (Provisions)      96000  -- 960,00€ provisions reçues
Crédit 614 (Charges récup)   201308  -- 2013,08€ charges réelles

-- Créance régul
Débit  411 (Locataires)      105308  -- 1053,08€ complément dû
```

Puis à l'encaissement :
```
Débit  512 (Banque)          105308
Crédit 411 (Locataires)      105308
```

#### C. Régularisation — trop-perçu (solde < 0)

```
Débit  4191 (Provisions)      96000
Crédit 614 (Charges récup)    87258  -- 872,58€
Crédit 4191 (Trop-perçu)       8742  -- 87,42€ à rembourser
```

#### D. Clause de renonciation

```
Débit  654 (Non récupérées)  105308  -- Déductible revenus fonciers
Débit  4191 (Provisions)      96000
Crédit 614 (Charges récup)   201308
```

#### E. Échelonnement 12 mois

Chaque mois : fraction du solde incluse dans l'encaissement loyer.
```
Débit  512 (Banque)           81776  -- 817,76€ (loyer 650 + prov 80 + régul 1/12 = 87,76)
Crédit 706 (Loyers)           65000
Crédit 4191 (Provisions)       8000
Crédit 411 (Locataires)        8776  -- Fraction régul
```

**⚠️ GAP ACTUEL : aucune logique de génération automatique d'écriture comptable lors du `settle` d'une régul — ni côté API `/regularization/[id]/apply`, ni côté trigger. À implémenter.**

---

## 7. Intégrations existantes

### OCR — Pipeline Tesseract.js + GPT-4o-mini

Pipeline existant (utilisé pour les documents). Pour l'avis de taxe foncière :

```typescript
// 1. Upload PDF → Tesseract.js extraction texte page 2
// 2. GPT-4o-mini prompt d'extraction structurée :
const prompt = `
Extrais du texte suivant (avis de taxe foncière française) :
- teom_brut : montant total ligne "Taxe ordures ménagères" en euros
- frais_gestion : montant "Frais de gestion de la fiscalité directe locale" en euros
- teom_net : teom_brut - frais_gestion
- annee_imposition : année
- adresse_bien : adresse complète
Réponds en JSON uniquement.
`;
// 3. Validation humaine → stockage dans tax_notices
```

### PDF — Génération via pdf-lib

Template régularisation à créer :
- Lettre de régularisation (en-tête propriétaire, coordonnées locataire, texte légal art. 23, décompte, solde)
- Décompte détaillé (tableau catégorie × montant × quote-part × prorata)

### Stripe Connect — Paiement régularisation

Le PaymentIntent pour une régul utilise les mêmes mécanismes que les loyers. Metadata à ajouter :
```typescript
metadata: {
  type: 'charge_regularization',  // Distingue du loyer
  regularization_id: '<uuid>',
  lease_id: '<uuid>',
  period: '2025-01-01/2025-12-31'
}
```
Commissions identiques : 2,2% CB / 0,50€ SEPA.

### Resend — Templates email

Templates existants : `regularization-due.*`. À compléter avec :
- Rappel import avis TF (septembre)
- Alerte prescription imminente
- Notification locataire "régul disponible"

### Cron / Rappels

Système de rappels à brancher sur le cron existant :

| Quand | Action | Destinataire |
|---|---|---|
| 1er septembre | "Importez votre avis de taxe foncière" | Propriétaire |
| 1er novembre | Rappel si pas d'import TF | Propriétaire |
| 30j avant fin exercice | "Régularisation à effectuer" | Propriétaire |
| > 1 an sans régul | "⚠️ Retard — risque échelonnement 12 mois" | Propriétaire |
| 3 ans - 3 mois | "🚨 Prescription imminente" | Propriétaire |
| À l'envoi | "Régularisation disponible" | Locataire |

---

## 8. Feature gating (PLAN_LIMITS)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|---|---|---|---|---|---|
| Saisie charges manuelle | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calcul régul + PDF décompte | ❌ | ✅ | ✅ | ✅ | ✅ |
| Envoi email régul au locataire | ❌ | ✅ | ✅ | ✅ | ✅ |
| OCR avis taxe foncière | ❌ | ❌ | ✅ | ✅ | ✅ |
| Rappels automatiques | ❌ | ❌ | ✅ | ✅ | ✅ |
| Écritures comptables auto | ❌ | ❌ | ❌ | ✅ | ✅ |
| Bridge copro → charges | ❌ | ❌ | ❌ | ✅ | ✅ |
| Paiement régul Stripe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Échelonnement 12 mois auto | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 9. Gaps actuels & roadmap

### Gaps critiques (P0)

1. **Pas de lien régul → facture/paiement** : `regularization_invoice_id` manquant sur `lease_charge_regularizations` → impossible de tracer l'encaissement
2. **Pas d'écriture comptable auto** au settle d'une régul → le module comptable ne reflète pas les réguls
3. **Comptes PCG manquants** dans le seed : 4191, 614, 654, 708300
4. **RLS locataire** : `WITH CHECK (status = 'sent')` empêche un locataire de passer en `contested` → à corriger

### Gaps importants (P1)

5. **Table `tax_notices`** inexistante → pas de stockage structuré TEOM
6. **Table `epci_reference`** inexistante → pas de matching automatique DROM
7. **OCR avis TF** : pipeline Tesseract existe mais pas de prompt spécifique taxe foncière
8. **Template PDF régularisation** : non créé (pdf-lib)
9. **Rappels/crons** charges : non branchés

### Améliorations (P2)

10. **Bridge copro** : `copro_services` → `charge_entries` pas automatisé
11. **Dashboard locataire charges** : page `/tenant/charges` existe mais contenu à enrichir
12. **Historique régul** : pas de vue comparaison N vs N-1
13. **Tests** : aucun test sur `engine.ts` ni `charge-regularization.service.ts`

---

## 10. Pièges connus

| Piège | Détail |
|---|---|
| `leases.statut` pas `status` | Erreur production fréquente — toujours vérifier |
| Montants centimes vs décimaux | `leases` = DECIMAL(10,2) en euros ; `accounting_entry_lines` = INTEGER centimes ; `lease_charge_regularizations` = INTEGER centimes |
| Frais gestion ~8% TEOM | NON récupérables — `tax_notices.frais_gestion` à soustraire systématiquement |
| Forfait = jamais de régul | Si `charges_type = 'forfait'` → bloquer tout workflow de régularisation |
| REOM ≠ TEOM | Si REOM → le locataire paie directement, rien à régulariser côté propriétaire |
| Vue legacy `charge_regularisations` | INSTEAD OF triggers — NE JAMAIS insérer directement |
| `getServiceClient()` pour SSR | Toutes les pages owner/tenant doivent utiliser le service role client pour les requêtes DB |
| Dark mode | `bg-card` jamais `bg-white` ; brand color `#2563EB` jamais indigo |
| DROM code postal | Regex `97[1-6]\d{2}` (pas `97[1-6]\d{3}`) |
| Exercice copro ≠ année civile | Le syndic peut avoir un exercice 01/04–31/03 → le prorata se complexifie |
| Rétention 20% DG | Au départ locataire, le propriétaire peut retenir 20% du dépôt de garantie en attendant l'arrêté des comptes |
| `tsc --noEmit` | Doit passer avec zéro erreurs avant tout PR |
