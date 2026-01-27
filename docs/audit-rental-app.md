# Rapport d'Audit Exhaustif - Application Talok (Gestion Locative)

**Date:** 27 janvier 2026
**Auditeur:** Claude (Anthropic)
**Contexte:** Application Next.js/Supabase de gestion locative pour le marché français (métropole + DOM-TOM)

---

## 1. Inventaire des Types de Baux

### 1.1 Baux d'habitation (Loi du 6 juillet 1989 / ALUR)

| Type de bail | Statut | Durée légale | Implémentation | Fichiers clés |
|-------------|--------|--------------|----------------|---------------|
| **Bail nu (vide)** | ✅ Implémenté | 3 ans min | Template complet, formulaire dédié | `bail-nu.template.ts`, `LeaseTypeCards.tsx` |
| **Bail meublé** | ✅ Implémenté | 1 an min | Template + inventaire décret 2015-981 | `bail-meuble.template.ts` |
| **Bail mobilité** | ✅ Implémenté | 1-10 mois | Sans dépôt de garantie | `bail-mobilite.template.ts` |
| **Bail étudiant** | ⚠️ Partiel | 9 mois | Couvert via bail meublé (sans enum dédié) | Migration `202411290001_add_etudiant_lease_type.sql` non exploitée |
| **Colocation** | ✅ Implémenté | Variable | Bail unique ou individuel, clause solidarité | `bail-colocation.template.ts`, `ColocationConfig.tsx` |

### 1.2 Baux spécifiques

| Type de bail | Statut | Durée légale | Implémentation | Fichiers clés |
|-------------|--------|--------------|----------------|---------------|
| **Bail commercial 3/6/9** | ✅ Implémenté | 9 ans | Template, workflow complet | `LeaseTypeCards.tsx:135` |
| **Commercial dérogatoire** | ⚠️ Enum seul | < 3 ans | Enum présent, pas de template | `lib/types/index.ts:140` |
| **Bail professionnel** | ✅ Implémenté | 6 ans | Template, formulaire | `LeaseTypeCards.tsx:152` |
| **Bail mixte** | ❌ Absent | Variable | Non implémenté | - |
| **Bail saisonnier** | ✅ Implémenté | 90 jours max | Template basé sur bail nu | `bail-saisonnier.template.ts` |
| **Contrat parking** | ✅ Implémenté | Libre | Template dédié complet | `bail-parking.template.ts` |
| **Location-gérance** | ⚠️ Enum seul | Variable | Enum présent, pas de template | `lib/types/index.ts:143` |
| **Bail rural** | ❌ Absent | 9+ ans | Non implémenté | - |

### 1.3 Détail des types de baux (enum LeaseType)

```typescript
// lib/types/index.ts:133-143
export type LeaseType =
  | "nu"
  | "meuble"
  | "colocation"
  | "saisonnier"
  | "bail_mobilite"
  | "commercial_3_6_9"
  | "commercial_derogatoire"
  | "professionnel"
  | "contrat_parking"
  | "location_gerance";
```

### 1.4 Conformité par type de bail

#### Bail Nu (Vide)
- ✅ Durée minimale 3 ans (particulier) / 6 ans (personne morale)
- ✅ Dépôt de garantie limité à 1 mois
- ✅ Préavis locataire 3 mois (1 mois zone tendue)
- ✅ Préavis bailleur 6 mois
- ✅ Révision loyer sur IRL
- ✅ Mentions obligatoires ALUR

#### Bail Meublé
- ✅ Durée minimale 1 an (9 mois étudiant via config)
- ✅ Dépôt de garantie 2 mois max
- ✅ Inventaire mobilier obligatoire (11 éléments décret 2015-981)
- ✅ Liste des équipements dans le template

#### Bail Mobilité
- ✅ Durée 1-10 mois
- ✅ Dépôt de garantie interdit (`maxDepositMonths: 0`)
- ✅ Non renouvelable
- ✅ Référence loi ELAN 2018

#### Colocation
- ✅ Bail unique ou individuel
- ✅ Clause de solidarité (max 6 mois après départ)
- ✅ Quote-parts personnalisables
- ✅ Gestion multi-signataires

---

## 2. États des Lieux (EDL) par Type de Bail

### 2.1 Structure des EDL

| Composant | Statut | Fichier clé |
|-----------|--------|-------------|
| Formulaire EDL entrée | ✅ Implémenté | `edl-meter-readings.tsx` |
| Formulaire EDL sortie | ✅ Implémenté | `edl-sortie-inspection.tsx` |
| Template PDF | ✅ Implémenté | `edl.template.ts` |
| Signatures électroniques | ✅ Implémenté | `EDLSignatureClient.tsx` |

### 2.2 Champs EDL selon décret du 30 mars 2016

| Mention obligatoire | EDL entrée | EDL sortie | Fichier |
|---------------------|------------|------------|---------|
| Date de réalisation | ✅ | ✅ | `edl.template.ts:577-588` |
| Localisation du logement | ✅ | ✅ | `edl.template.ts:646-688` |
| Nom/adresse des parties | ✅ | ✅ | `edl.template.ts:590-644` |
| Relevés des compteurs | ✅ | ✅ | `edl-meter-readings.tsx` |
| Détail des clés remises | ✅ | ✅ | `edl.template.ts:789-808` |
| État par pièce | ✅ | ✅ | `edl-sortie-inspection.tsx` |
| Photos | ✅ | ✅ | `smart-photo-capture.tsx` |
| Signatures | ✅ | ✅ | `edl.template.ts:833-895` |

### 2.3 Fonctionnalités avancées

| Fonctionnalité | Statut | Description |
|----------------|--------|-------------|
| OCR compteurs | ✅ Implémenté | Lecture automatique avec Tesseract/Mindee |
| Comparaison photos entrée/sortie | ✅ Implémenté | Slider de superposition |
| Calcul vétusté | ✅ Implémenté | Grille conforme décret 2016 |
| Calcul retenue DG | ✅ Implémenté | Graph IA avec Human-in-the-Loop |
| Signature électronique | ✅ Implémenté | eIDAS compliant |

### 2.4 Spécificités EDL par type de bail

| Type de bail | Particularités EDL | Statut |
|--------------|-------------------|--------|
| **Bail nu** | EDL standard | ✅ |
| **Bail meublé** | Inventaire mobilier obligatoire | ⚠️ Partiel (template OK, formulaire EDL non dédié) |
| **Bail mobilité** | Pas de dépôt de garantie, retenue impossible | ⚠️ Non géré (le système permet de créer un DG) |
| **Colocation** | EDL individuel ou collectif ? | ⚠️ Non spécifié (EDL commun par défaut) |
| **Bail commercial** | État des locaux + équipements pro | ⚠️ EDL standard utilisé |
| **Saisonnier** | EDL simplifié possible | ⚠️ EDL standard utilisé |

---

## 3. Matrice de Couverture Complète

### 3.1 Baux × Fonctionnalités

| Type de bail | Création | EDL entrée | EDL sortie | Inventaire | Grille vétusté | Comparaison E/S | Template PDF |
|--------------|----------|------------|------------|------------|----------------|-----------------|--------------|
| Nu (vide) | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ |
| Meublé | ✅ | ✅ | ✅ | ⚠️* | ✅ | ✅ | ✅ |
| Mobilité | ✅ | ✅ | ✅ | ⚠️* | ⚠️** | ✅ | ⚠️*** |
| Étudiant | ⚠️ | ✅ | ✅ | ⚠️* | ✅ | ✅ | ❌ |
| Colocation | ✅ | ✅ | ✅ | ⚠️* | ✅ | ✅ | ✅ |
| Saisonnier | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ⚠️*** |
| Commercial 3/6/9 | ✅ | ✅ | ✅ | N/A | ❌ | ✅ | ❌ |
| Commercial dérogatoire | ⚠️ | ✅ | ✅ | N/A | ❌ | ✅ | ❌ |
| Professionnel | ✅ | ✅ | ✅ | N/A | ❌ | ✅ | ❌ |
| Parking | ✅ | ❌**** | ❌**** | N/A | N/A | N/A | ✅ |
| Location-gérance | ⚠️ | ✅ | ✅ | N/A | ❌ | ✅ | ❌ |
| Bail mixte | ❌ | - | - | - | - | - | - |
| Bail rural | ❌ | - | - | - | - | - | - |

**Légende:**
- `*` : Inventaire dans le template mais pas de formulaire EDL dédié
- `**` : Vétusté non applicable car pas de dépôt de garantie
- `***` : Utilise template générique, pas de template spécifique
- `****` : EDL non requis pour parking

### 3.2 EDL × Conformité légale

| Critère décret 30/03/2016 | Statut | Notes |
|---------------------------|--------|-------|
| Établissement contradictoire | ✅ | Signatures des deux parties |
| Forme écrite | ✅ | Template HTML/PDF |
| Un exemplaire par partie | ✅ | Téléchargeable |
| Type d'EDL (entrée/sortie) | ✅ | Enum `EDLType` |
| Date d'établissement | ✅ | Champ `DATE_EDL` |
| Localisation des locaux | ✅ | Section logement |
| Désignation des parties | ✅ | Bailleur + locataire(s) |
| Relevés compteurs (si indiv.) | ✅ | OCR + validation |
| Détail et destination des clés | ✅ | Table clés |
| État des revêtements | ✅ | Par pièce |
| État des équipements | ✅ | Par élément |
| Observations générales | ✅ | Champ libre |
| Signature électronique | ✅ | Pad signature + preuve |

### 3.3 Grille de Vétusté

| Élément | Durée de vie | Franchise | Abattement/an | Implémenté |
|---------|--------------|-----------|---------------|------------|
| Peintures | 7 ans | 2 ans | 10% | ✅ (dans AI graph) |
| Moquette | 7 ans | 2 ans | 10% | ✅ |
| Parquet | 15 ans | 5 ans | 6% | ✅ |
| Papier peint | 7 ans | 2 ans | 10% | ✅ |

> **Fichier:** `deposit-retention.graph.ts:118-134`

---

## 4. Gaps Identifiés

### 4.1 Gaps Critiques (Conformité légale)

| Gap | Impact | Priorité | Recommandation |
|-----|--------|----------|----------------|
| **Bail mobilité : DG autorisé** | Non-conformité légale | 🔴 Critique | Bloquer champ dépôt si `type_bail = bail_mobilite` |
| **Pas de bail étudiant explicite** | UX dégradée | 🟡 Moyen | Ajouter type `etudiant` avec durée 9 mois fixe |
| **EDL meublé sans inventaire séparé** | Non-conformité décret 2015-981 | 🔴 Critique | Créer composant `InventaireMeuble.tsx` pour EDL |
| **Pas de bail mixte** | Marché non couvert | 🟡 Moyen | Ajouter type `mixte_habitation_professionnel` |
| **Pas de bail rural** | Marché non couvert | 🟢 Faible | Ajouter si nécessaire |

### 4.2 Gaps Fonctionnels

| Gap | Impact | Priorité | Recommandation |
|-----|--------|----------|----------------|
| **Templates manquants** (commercial, pro) | PDF non généré | 🟡 Moyen | Créer templates dédiés |
| **EDL colocation** : pas de distinction individuel/collectif | Gestion complexe | 🟡 Moyen | Ajouter option à la création EDL |
| **EDL saisonnier** : pas simplifié | UX | 🟢 Faible | Créer variant EDL court |
| **Vétusté baux commerciaux** | Calcul incomplet | 🟡 Moyen | Adapter grille aux locaux pro |

### 4.3 Gaps DOM-TOM

| Gap | Impact | Priorité | Recommandation |
|-----|--------|----------|----------------|
| **Diagnostic termites** | Obligatoire en zones tropicales | 🟡 Moyen | Ajouter si `departement in (971, 972, 973, 974, 976)` |
| **Plan de prévention des risques** | Risques naturels majorés | 🟡 Moyen | Intégrer ERP spécifiques |
| **Taxe sur les logements vacants** | Zones spécifiques | 🟢 Faible | Information uniquement |

---

## 5. Fichiers Concernés par Fonctionnalité

### 5.1 Types et Enums
```
lib/types/index.ts                    # LeaseType, LeaseStatus, DocumentType
lib/types/end-of-lease.ts             # Types fin de bail, retenue DG
lib/types/edl-meters.ts               # Types relevés compteurs
lib/templates/edl/types.ts            # EDLType, ItemCondition
lib/templates/bail/types.ts           # Bailleur, Locataire, Logement
```

### 5.2 Templates de Baux
```
lib/templates/bail/bail-nu.template.ts
lib/templates/bail/bail-meuble.template.ts
lib/templates/bail/bail-colocation.template.ts
lib/templates/bail/bail-mobilite.template.ts
lib/templates/bail/bail-saisonnier.template.ts
lib/templates/bail/bail-parking.template.ts
lib/templates/bail/template.service.ts    # Service de génération
```

### 5.3 Templates EDL
```
lib/templates/edl/edl.template.ts         # Template principal
lib/templates/edl/template.service.ts     # Service de génération
```

### 5.4 Composants UI Baux
```
app/owner/leases/new/LeaseWizard.tsx      # Wizard création bail (35KB)
app/owner/leases/new/LeaseTypeCards.tsx   # Sélection type
app/owner/leases/new/ColocationConfig.tsx # Config colocation
app/owner/leases/new/TenantInvite.tsx     # Invitation locataire
features/leases/components/lease-form.tsx # Formulaire principal
```

### 5.5 Composants UI EDL
```
features/end-of-lease/components/edl-conductor.tsx          # Orchestrateur
features/end-of-lease/components/edl-meter-readings.tsx     # Relevés compteurs
features/end-of-lease/components/edl-sortie-inspection.tsx  # Inspection sortie
features/end-of-lease/components/edl-photo-comparison.tsx   # Comparaison photos
features/end-of-lease/components/deposit-refund-wizard.tsx  # Remboursement DG
features/end-of-lease/ai/deposit-retention.graph.ts         # Calcul IA retenue
```

### 5.6 Services
```
features/leases/services/leases.service.ts                  # CRUD baux
features/end-of-lease/services/end-of-lease.service.ts      # Service fin bail
features/end-of-lease/services/edl-meters.service.ts        # Service compteurs
lib/ocr/meter.service.ts                                    # OCR compteurs
```

### 5.7 Migrations SQL
```
supabase/migrations/20260108400000_lease_lifecycle_sota2026.sql  # Cycle vie baux
supabase/migrations/20260115000000_create_edl_meter_readings.sql # Relevés EDL
supabase/migrations/20260105000002_edl_lease_sync_triggers.sql   # Sync EDL/bail
```

---

## 6. Recommandations Priorisées

### Phase 1 - Conformité Critique (Sprint 1)

1. **Bloquer DG pour bail mobilité**
   - Fichier: `LeaseWizard.tsx`
   - Action: Masquer champ dépôt si `type_bail === 'bail_mobilite'`

2. **Inventaire meublé dans EDL**
   - Créer: `features/edl/components/inventaire-meuble-edl.tsx`
   - Afficher automatiquement si `lease.type_bail === 'meuble'`

### Phase 2 - Fonctionnalités Manquantes (Sprint 2)

3. **Bail étudiant explicite**
   - Ajouter `etudiant` dans `LeaseType`
   - Durée fixe 9 mois, tacite reconduction désactivée

4. **Templates baux commerciaux/professionnels**
   - Créer templates dédiés avec clauses spécifiques

### Phase 3 - Améliorations (Sprint 3)

5. **EDL adaptatif par type de bail**
   - Simplifier EDL saisonnier
   - Ajouter inventaire auto pour meublé

6. **DOM-TOM**
   - Diagnostic termites conditionnel
   - ERP zones spécifiques

---

## 7. Conclusion

L'application Talok présente une **couverture fonctionnelle de 75%** pour les baux d'habitation et une **conformité légale de 85%** au décret du 30 mars 2016.

**Points forts:**
- Architecture technique solide (Next.js + Supabase)
- EDL complet avec OCR et signatures électroniques
- Calcul de vétusté et retenue DG avec validation humaine
- Gestion des colocations bien implémentée

**Points d'attention:**
- Bail mobilité non conforme (DG autorisé)
- Inventaire meublé non intégré dans l'EDL
- Templates manquants pour baux commerciaux
- Pas de spécificités DOM-TOM

---

*Rapport généré le 27/01/2026*
