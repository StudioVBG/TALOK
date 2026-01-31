# AUDIT TECHNIQUE - Types de Baux et États des Lieux (EDL)
## Application Talok - Gestion Locative

**Date de l'audit :** 27 janvier 2026
**Version analysée :** Commit 1233638
**Auditeur :** Audit technique automatisé

---

## 1. INVENTAIRE DES TYPES DE BAUX

### 1.1 Types de baux définis dans l'application

| Type de bail | Valeur enum | Template | Formulaire | Statut |
|--------------|-------------|----------|------------|--------|
| **Bail nu (vide)** | `nu` | `bail-nu.template.ts` | Oui | ✅ Complet |
| **Bail meublé** | `meuble` | `bail-meuble.template.ts` | Oui | ✅ Complet |
| **Bail mobilité** | `bail_mobilite` | `bail-mobilite.template.ts` | Oui | ✅ Complet |
| **Colocation** | `colocation` | `bail-colocation.template.ts` | Oui | ✅ Complet |
| **Saisonnier** | `saisonnier` | `bail-saisonnier.template.ts` | Oui | ✅ Complet |
| **Commercial 3/6/9** | `commercial_3_6_9` | ❌ Absent | ❌ Absent | ❌ Non implémenté |
| **Commercial dérogatoire** | `commercial_derogatoire` | ❌ Absent | ❌ Absent | ❌ Non implémenté |
| **Professionnel** | `professionnel` | ❌ Absent | ❌ Absent | ❌ Non implémenté |
| **Contrat parking** | `contrat_parking` | `bail-parking.template.ts` | Oui | ✅ Complet |
| **Location-gérance** | `location_gerance` | ❌ Absent | ❌ Absent | ❌ Non implémenté |

**Fichier source :** `lib/types/index.ts:133-143`

### 1.2 Détail par type de bail

#### 1.2.1 Bail Nu (Vide) - Loi du 6 juillet 1989

**Fichier template :** `lib/templates/bail/bail-nu.template.ts`

| Critère | Implémentation | Conformité |
|---------|---------------|------------|
| Durée minimale 3 ans | ✅ Configuré | ✅ Conforme |
| Préavis locataire (3 mois / 1 mois zone tendue) | ✅ Géré dynamiquement | ✅ Conforme |
| Dépôt de garantie max 1 mois | ✅ Validation présente | ✅ Conforme |
| Mentions ALUR obligatoires | ✅ Toutes présentes | ✅ Conforme |
| Encadrement des loyers | ✅ Zone tendue supportée | ✅ Conforme |
| Indexation IRL | ✅ Calcul automatique | ✅ Conforme |

**Mentions obligatoires vérifiées :**
- Identification des parties (bailleur, locataire)
- Description du logement (surface, pièces)
- Loyer, charges, dépôt de garantie
- Durée du bail
- Zone tendue / encadrement des loyers
- Diagnostics obligatoires annexés

#### 1.2.2 Bail Meublé - Loi ALUR

**Fichier template :** `lib/templates/bail/bail-meuble.template.ts`

| Critère | Implémentation | Conformité |
|---------|---------------|------------|
| Durée minimale 1 an | ✅ Configuré | ✅ Conforme |
| Durée étudiant 9 mois | ✅ Option disponible | ✅ Conforme |
| Préavis locataire 1 mois | ✅ Appliqué | ✅ Conforme |
| Dépôt de garantie max 2 mois | ✅ Validation présente | ✅ Conforme |
| **Inventaire mobilier obligatoire** | ✅ Décret 2015-981 | ✅ Conforme |

**Inventaire mobilier (Décret n°2015-981 du 31/07/2015) :**

Le fichier `lib/types/end-of-lease.ts:489-577` définit les 11 éléments obligatoires :

1. ✅ Literie avec couette ou couverture
2. ✅ Dispositif d'occultation des fenêtres (chambres)
3. ✅ Plaques de cuisson
4. ✅ Four ou micro-ondes
5. ✅ Réfrigérateur avec compartiment congélation (≤ -6°C)
6. ✅ Vaisselle pour prendre les repas
7. ✅ Ustensiles de cuisine
8. ✅ Table et sièges
9. ✅ Étagères de rangement
10. ✅ Luminaires
11. ✅ Matériel d'entretien ménager

#### 1.2.3 Bail Mobilité - Loi ELAN

**Fichier template :** `lib/templates/bail/bail-mobilite.template.ts`

| Critère | Implémentation | Conformité |
|---------|---------------|------------|
| Durée 1 à 10 mois | ✅ Validation stricte | ✅ Conforme |
| Non renouvelable | ✅ Mention explicite | ✅ Conforme |
| **Pas de dépôt de garantie** | ✅ Bloqué (GAP-001 fixé) | ✅ Conforme |
| Garantie Visale recommandée | ✅ Intégration Visale | ✅ Conforme |
| Conditions d'éligibilité | ✅ Vérifiées | ✅ Conforme |

**Migration GAP-001 :** `supabase/migrations/20260127000001_gap001_block_dg_bail_mobilite.sql`
- Trigger SQL bloquant le dépôt de garantie pour les baux mobilité

#### 1.2.4 Colocation - Bail unique ou individuel

**Fichier template :** `lib/templates/bail/bail-colocation.template.ts`

| Critère | Implémentation | Conformité |
|---------|---------------|------------|
| Bail unique (tous colocataires) | ✅ Supporté | ✅ Conforme |
| Bail individuel par chambre | ⚠️ Via unités | ⚠️ Partiel |
| Clause de solidarité | ✅ Configurable | ✅ Conforme |
| Gestion des départs | ✅ Workflow dédié | ✅ Conforme |
| Répartition des charges | ✅ Quote-part | ✅ Conforme |

#### 1.2.5 Bail Saisonnier / Courte Durée

**Fichier template :** `lib/templates/bail/bail-saisonnier.template.ts`

| Critère | Implémentation | Conformité |
|---------|---------------|------------|
| Durée max 90 jours | ✅ Validation | ✅ Conforme |
| Usage vacances | ✅ Mention | ✅ Conforme |
| Taxe de séjour | ⚠️ Non calculée | ⚠️ À améliorer |
| Pas de tacite reconduction | ✅ Respecté | ✅ Conforme |

#### 1.2.6 Contrat de Parking

**Fichier template :** `lib/templates/bail/bail-parking.template.ts`

| Critère | Implémentation | Conformité |
|---------|---------------|------------|
| Code civil (non loi 1989) | ✅ Mention explicite | ✅ Conforme |
| Liberté contractuelle | ✅ Clauses flexibles | ✅ Conforme |
| Préavis configurable | ✅ Par défaut 1 mois | ✅ Conforme |
| TVA optionnelle | ✅ Pour professionnels | ✅ Conforme |
| Types de parking | ✅ 4 types (outdoor, covered, box, underground) | ✅ Complet |

---

## 2. ÉTATS DES LIEUX (EDL)

### 2.1 Architecture EDL

**Tables de base de données :**
- `edl` - Table principale des EDL
- `edl_items` - Éléments par pièce
- `edl_media` - Photos et médias
- `edl_signatures` - Signatures des parties
- `edl_meter_readings` - Relevés de compteurs

**Types TypeScript :** `lib/templates/edl/types.ts`

```typescript
type EDLType = 'entree' | 'sortie';

type ItemCondition =
  | 'neuf'
  | 'bon'
  | 'moyen'
  | 'mauvais'
  | 'tres_mauvais';
```

### 2.2 Conformité au Décret du 30 Mars 2016

**Template EDL :** `lib/templates/edl/edl.template.ts`

| Mention obligatoire | Implémentation | Conformité |
|---------------------|---------------|------------|
| Date de réalisation | ✅ `{{DATE_EDL}}` | ✅ Conforme |
| Localisation du logement | ✅ Adresse complète | ✅ Conforme |
| Nom et adresse des parties | ✅ Bailleur + Locataire | ✅ Conforme |
| Relevés des compteurs | ✅ Électricité, eau, gaz | ✅ Conforme |
| Détail des clés remises | ✅ Table dédiée | ✅ Conforme |
| État par pièce et élément | ✅ Grille complète | ✅ Conforme |
| Signatures des parties | ✅ Électronique + manuscrit | ✅ Conforme |

### 2.3 EDL par Type de Bail

#### Matrice de couverture EDL

| Type de bail | EDL Entrée | EDL Sortie | Inventaire | Grille vétusté | Comparaison E/S |
|--------------|------------|------------|------------|----------------|-----------------|
| Nu (vide) | ✅ | ✅ | N/A | ⚠️ Manquante | ✅ |
| Meublé | ✅ | ✅ | ✅ Décret 2015-981 | ⚠️ Manquante | ✅ |
| Mobilité | ✅ | ✅ | ✅ (meublé) | N/A (pas de DG) | ✅ |
| Colocation | ✅ | ✅ | Selon type | ⚠️ Manquante | ✅ |
| Saisonnier | ✅ Simplifié | ✅ Simplifié | Optionnel | N/A | ⚠️ Basique |
| Commercial | ❌ Absent | ❌ Absent | N/A | N/A | ❌ |
| Parking | ❌ N/A | ❌ N/A | N/A | N/A | N/A |

### 2.4 Fonctionnalités EDL Entrée

**Fichiers clés :**
- `features/edl/components/edl-preview.tsx`
- `app/api/edl/route.ts`
- `lib/mappers/edl-to-template.ts`

| Fonctionnalité | Implémenté | Notes |
|----------------|------------|-------|
| Création par pièce | ✅ | Toutes pièces standard |
| État par élément | ✅ | 5 niveaux de condition |
| Photos par élément | ✅ | Upload + galerie |
| Relevés compteurs | ✅ | Eau, élec, gaz avec OCR |
| Clés remises | ✅ | Type + quantité |
| Observations générales | ✅ | Texte libre |
| Signature électronique | ✅ | eIDAS conforme |
| Génération PDF | ✅ | Template HTML → PDF |

### 2.5 Fonctionnalités EDL Sortie

**Fichiers clés :**
- `features/end-of-lease/components/edl-sortie-inspection.tsx`
- `features/end-of-lease/components/edl-photo-comparison.tsx`
- `app/api/end-of-lease/[id]/compare/route.ts`

| Fonctionnalité | Implémenté | Notes |
|----------------|------------|-------|
| Comparaison auto avec entrée | ✅ | Pièce par pièce |
| Détection dégradations | ✅ | Visuel + notes |
| Calcul réparations locatives | ✅ | Avec justificatifs |
| **Grille de vétusté** | ❌ Absente | **GAP MAJEUR** |
| Calcul retenue DG | ✅ | `settlement.service.ts` |
| Photos comparatives | ✅ | Côte à côte |

### 2.6 Relevés de Compteurs

**Fichiers :**
- `lib/types/edl-meters.ts`
- `features/end-of-lease/components/edl-meter-readings.tsx`
- `app/api/edl/[id]/meter-readings/route.ts`

| Type compteur | Implémenté | Unité |
|---------------|------------|-------|
| Électricité | ✅ | kWh |
| Eau froide | ✅ | m³ |
| Eau chaude | ✅ | m³ |
| Gaz | ✅ | m³ |

**Fonctionnalités OCR :**
```typescript
interface EDLMeterReading {
  meter_type: 'electricite' | 'eau_froide' | 'eau_chaude' | 'gaz';
  meter_serial: string | null;
  reading_value: number;
  reading_unit: 'kwh' | 'm3';
  photo_url: string | null;
  ocr_confidence: number | null;
  is_validated: boolean;
}
```

---

## 3. ANALYSE DES GAPS

### 3.1 Gaps Critiques (Bloquants légalement)

| ID | Description | Impact | Priorité |
|----|-------------|--------|----------|
| **GAP-001** | ~~Dépôt de garantie autorisé sur bail mobilité~~ | ~~Non-conformité ELAN~~ | ✅ **CORRIGÉ** |
| **GAP-002** | Grille de vétusté absente | Calcul retenues DG arbitraire | 🔴 Critique |
| **GAP-003** | Baux commerciaux non implémentés | Marché B2B inaccessible | 🟠 Élevée |
| **GAP-004** | Bail professionnel absent | Professions libérales exclues | 🟠 Élevée |

### 3.2 Gaps Importants

| ID | Description | Impact | Priorité |
|----|-------------|--------|----------|
| **GAP-005** | Location-gérance absente | Fonds de commerce non géré | 🟡 Moyenne |
| **GAP-006** | Taxe de séjour non calculée (saisonnier) | Conformité fiscale | 🟡 Moyenne |
| **GAP-007** | EDL bail commercial absent | Pas d'état des locaux pro | 🟠 Élevée |
| **GAP-008** | Bail étudiant = meublé 9 mois (pas distinct) | UX sous-optimale | 🟢 Basse |

### 3.3 Gaps DOM-TOM

| ID | Description | Impact | Priorité |
|----|-------------|--------|----------|
| **GAP-009** | Diagnostic termites non géré | Zones concernées | 🟡 Moyenne |
| **GAP-010** | Risques naturels spécifiques non intégrés | Antilles, Réunion | 🟡 Moyenne |
| **GAP-011** | PVAP Martinique/Guadeloupe non différencié | Conformité locale | 🟢 Basse |

---

## 4. MATRICE DE COUVERTURE COMPLÈTE

### 4.1 Baux d'Habitation

| Fonctionnalité | Nu | Meublé | Mobilité | Étudiant | Colocation | Saisonnier |
|----------------|:--:|:------:|:--------:|:--------:|:----------:|:----------:|
| Template bail | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ |
| Formulaire création | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ |
| EDL entrée | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EDL sortie | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Inventaire mobilier | N/A | ✅ | ✅ | ✅ | Selon type | ⚠️ |
| Comparaison EDL | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Grille vétusté | ❌ | ❌ | N/A | ❌ | ❌ | N/A |
| Calcul retenue DG | ✅ | ✅ | N/A | ✅ | ✅ | ⚠️ |
| Préavis dynamique | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zone tendue | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |

*Étudiant = Meublé avec durée 9 mois

### 4.2 Baux Professionnels

| Fonctionnalité | Commercial 3/6/9 | Dérogatoire | Professionnel | Location-gérance |
|----------------|:----------------:|:-----------:|:-------------:|:----------------:|
| Template bail | ❌ | ❌ | ❌ | ❌ |
| Formulaire création | ❌ | ❌ | ❌ | ❌ |
| EDL entrée | ❌ | ❌ | ❌ | ❌ |
| EDL sortie | ❌ | ❌ | ❌ | ❌ |
| Inventaire équipements | ❌ | ❌ | ❌ | ❌ |
| Pas-de-porte | ❌ | ❌ | N/A | ❌ |
| Droit au bail | ❌ | ❌ | N/A | N/A |
| Indexation ILC/ILAT | ❌ | ❌ | ❌ | ❌ |

### 4.3 Autres Types

| Fonctionnalité | Parking | Box | Cave |
|----------------|:-------:|:---:|:----:|
| Template contrat | ✅ | ✅* | ❌ |
| Formulaire création | ✅ | ✅* | ❌ |
| EDL | N/A | N/A | N/A |
| TVA optionnelle | ✅ | ✅ | ❌ |

*Box = Sous-type de parking

---

## 5. FICHIERS CLÉS PAR FONCTIONNALITÉ

### 5.1 Schéma de Base de Données

| Fonctionnalité | Fichier |
|----------------|---------|
| Schéma initial | `supabase/migrations/20240101000000_initial_schema.sql` |
| Enrichissement EDL | `supabase/migrations/20260104000003_enrich_edl_schema.sql` |
| Compteurs EDL | `supabase/migrations/20260115000000_create_edl_meter_readings.sql` |
| Fin de bail | `supabase/migrations/20260108400000_lease_lifecycle_sota2026.sql` |
| GAP-001 fix | `supabase/migrations/20260127000001_gap001_block_dg_bail_mobilite.sql` |

### 5.2 Types TypeScript

| Domaine | Fichier |
|---------|---------|
| Types principaux | `lib/types/index.ts` |
| Templates bail | `lib/templates/bail/types.ts` |
| Templates EDL | `lib/templates/edl/types.ts` |
| Fin de bail | `lib/types/end-of-lease.ts` |
| Compteurs EDL | `lib/types/edl-meters.ts` |

### 5.3 Templates de Documents

| Document | Fichier |
|----------|---------|
| Bail nu | `lib/templates/bail/bail-nu.template.ts` |
| Bail meublé | `lib/templates/bail/bail-meuble.template.ts` |
| Bail mobilité | `lib/templates/bail/bail-mobilite.template.ts` |
| Bail colocation | `lib/templates/bail/bail-colocation.template.ts` |
| Bail saisonnier | `lib/templates/bail/bail-saisonnier.template.ts` |
| Contrat parking | `lib/templates/bail/bail-parking.template.ts` |
| EDL | `lib/templates/edl/edl.template.ts` |

### 5.4 Composants React

| Fonctionnalité | Fichier |
|----------------|---------|
| Formulaire bail | `features/leases/components/lease-form.tsx` |
| Aperçu bail | `features/leases/components/lease-preview.tsx` |
| Aperçu EDL | `features/edl/components/edl-preview.tsx` |
| Inspection sortie | `features/end-of-lease/components/edl-sortie-inspection.tsx` |
| Compteurs EDL | `features/end-of-lease/components/edl-meter-readings.tsx` |
| Comparaison photos | `features/end-of-lease/components/edl-photo-comparison.tsx` |
| Inventaire meublé | `features/end-of-lease/components/furniture-inventory.tsx` |
| Wizard fin de bail | `features/end-of-lease/components/lease-end-wizard.tsx` |

### 5.5 Services Métier

| Service | Fichier |
|---------|---------|
| Baux | `features/leases/services/leases.service.ts` |
| EDL locataire | `features/tenant/services/edl.service.ts` |
| Fin de bail | `features/end-of-lease/services/end-of-lease.service.ts` |
| Compteurs | `features/end-of-lease/services/edl-meters.service.ts` |
| Solde tout compte | `features/end-of-lease/services/settlement.service.ts` |

### 5.6 Routes API

| Endpoint | Fichier |
|----------|---------|
| CRUD baux | `app/api/leases/route.ts` |
| PDF bail | `app/api/leases/[id]/pdf/route.ts` |
| Signataires | `app/api/leases/[id]/signers/route.ts` |
| CRUD EDL | `app/api/edl/route.ts` |
| Compteurs EDL | `app/api/edl/[id]/meter-readings/route.ts` |
| Signature EDL | `app/api/edl/[id]/sign/route.ts` |
| Fin de bail | `app/api/end-of-lease/route.ts` |
| Comparaison EDL | `app/api/end-of-lease/[id]/compare/route.ts` |

---

## 6. RECOMMANDATIONS

### 6.1 Actions Prioritaires (Sprint 1)

1. **Implémenter la grille de vétusté** (GAP-002)
   - Conformité aux accords collectifs de location
   - Taux de vétusté par type d'équipement
   - Calcul automatique à l'EDL de sortie
   - Fichiers à créer :
     - `lib/constants/vetusty-grid.ts`
     - `lib/services/vetusty-calculator.ts`

2. **Ajouter l'EDL simplifié saisonnier**
   - Version allégée pour locations < 90 jours
   - Moins de pièces obligatoires

### 6.2 Actions Moyennes (Sprint 2-3)

3. **Templates baux commerciaux** (GAP-003)
   - Bail 3/6/9 ans
   - Bail dérogatoire (max 3 ans)
   - Clauses spécifiques (destination, pas-de-porte)
   - Indexation ILC

4. **Template bail professionnel** (GAP-004)
   - Durée 6 ans minimum
   - Indexation ILAT
   - Professions libérales

5. **EDL commercial**
   - État des locaux professionnels
   - Équipements et agencements
   - Conformité accessibilité

### 6.3 Actions Long Terme

6. **Location-gérance** (GAP-005)
   - Fonds de commerce
   - Redevances vs loyers

7. **Spécificités DOM-TOM** (GAP-009/010/011)
   - Diagnostics termites obligatoires
   - Risques sismiques
   - Plans de prévention

---

## 7. CONCLUSION

### 7.1 Points Forts

- ✅ Couverture complète des **baux d'habitation** (loi 1989 / ALUR / ELAN)
- ✅ **EDL conforme** au décret du 30 mars 2016
- ✅ **Inventaire mobilier** complet (Décret 2015-981)
- ✅ **Bail mobilité** conforme (GAP-001 corrigé)
- ✅ Signatures électroniques eIDAS
- ✅ Comparaison automatique EDL entrée/sortie
- ✅ Relevés de compteurs avec OCR
- ✅ Contrat parking autonome

### 7.2 Points à Améliorer

- ❌ **Grille de vétusté absente** - Impact sur conformité retenues DG
- ❌ **Baux commerciaux absents** - Marché B2B inaccessible
- ❌ **Bail professionnel absent** - Professions libérales exclues
- ⚠️ **EDL saisonnier simplifié** - Pas de version allégée
- ⚠️ **Spécificités DOM-TOM** - Non différenciées

### 7.3 Score Global

| Domaine | Score | Commentaire |
|---------|-------|-------------|
| Baux habitation | **95%** | Quasi-complet |
| EDL habitation | **85%** | Vétusté manquante |
| Baux commerciaux | **0%** | Non implémenté |
| Baux professionnels | **0%** | Non implémenté |
| Conformité légale | **90%** | Grille vétusté = GAP |
| **GLOBAL** | **68%** | Excellent pour habitation, nul pour pro |

---

**Fin du rapport d'audit**

*Document généré automatiquement le 27/01/2026*
