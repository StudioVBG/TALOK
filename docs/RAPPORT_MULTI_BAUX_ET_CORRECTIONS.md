# 📊 RAPPORT COMPLET - Multi-Baux et Corrections

**Date** : 2 Décembre 2025  
**Version** : 1.0  
**Auteur** : Assistant IA

---

## 📋 Résumé exécutif

Ce rapport documente les modifications apportées pour :
1. **Support multi-baux** : Un locataire peut désormais avoir plusieurs locations (appartement + parking)
2. **Correction des bugs UI** : Affichage "? pièces" pour les parkings
3. **Amélioration de l'import d'annonces** : Correction du scraping de liens
4. **Mise à jour des types de baux** : Alignement avec les contraintes BDD

---

## 🔧 MODIFICATIONS EFFECTUÉES

### 1. Support Multi-Baux pour Locataires

#### 1.1 Nouvelle migration SQL
**Fichier** : `supabase/migrations/20251202100000_tenant_multi_leases.sql`

| Changement | Avant | Après |
|------------|-------|-------|
| RPC `tenant_dashboard` | Retourne 1 bail (`LIMIT 1`) | Retourne TOUS les baux actifs |
| Données | `lease: object` | `leases: array[]` + `lease` (rétro-compat) |
| Stats | `unpaid_amount`, `unpaid_count` | + `total_monthly_rent`, `active_leases_count` |

**Code clé** :
```sql
-- Récupérer TOUS les baux actifs (plus de LIMIT 1!)
SELECT COALESCE(jsonb_agg(lease_data), '[]'::jsonb)
INTO v_leases
FROM (
  SELECT jsonb_build_object(
    'id', l.id,
    'property', jsonb_build_object(...),
    'owner', jsonb_build_object(...)
  ) as lease_data
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = v_profile_id
  AND l.statut IN ('active', 'pending_signature', 'fully_signed')
) sub;
```

#### 1.2 Interface TypeScript mise à jour
**Fichier** : `app/tenant/_data/fetchTenantDashboard.ts`

```typescript
export interface TenantDashboardData {
  // NOUVEAU : Support multi-baux
  leases: TenantLease[];
  properties: any[];
  
  // RÉTRO-COMPATIBILITÉ
  lease: TenantLease | null;
  property: any | null;
  
  // Stats enrichies
  stats: {
    unpaid_amount: number;
    unpaid_count: number;
    total_monthly_rent: number;    // NOUVEAU
    active_leases_count: number;   // NOUVEAU
  };
}
```

#### 1.3 Dashboard Locataire multi-baux
**Fichier** : `app/tenant/dashboard/DashboardClient.tsx`

**Avant** : Affiche un seul logement
**Après** : 
- Si 1 bail → Affichage classique (card bleue gradient)
- Si plusieurs baux → Liste des locations avec :
  - Icône selon le type (🏢 appartement, 🅿️ parking, 🏠 maison)
  - Badge type de bail
  - Loyer individuel
  - Total mensuel consolidé

---

### 2. Correction "? pièces" pour Parkings

#### 2.1 Page Mes Biens (Propriétaire)
**Fichier** : `app/owner/properties/page.tsx`

**Problème** : Tous les biens affichaient "? pièces" même les parkings

**Solution** : Badges dynamiques selon le type

```typescript
const TYPES_WITHOUT_ROOMS = [
  "parking", "box", "local_commercial", 
  "bureaux", "entrepot", "fonds_de_commerce"
];

const getBadgesForProperty = (property) => {
  const badges = [
    { label: `${property.surface} m²`, variant: "secondary" }
  ];
  
  // Pièces : seulement pour habitation
  if (!TYPES_WITHOUT_ROOMS.includes(property.type)) {
    badges.push({ label: `${property.nb_pieces} pièces` });
  } else if (property.parking_numero) {
    badges.push({ label: `N°${property.parking_numero}` });
  }
  
  badges.push({ label: formatCurrency(property.monthlyRent) });
  return badges;
};
```

---

### 3. Amélioration Import d'Annonces (Scraping)

#### 3.1 API Scrape améliorée
**Fichier** : `app/api/scrape/route.ts`

| Amélioration | Description |
|--------------|-------------|
| Extraction adresse | Patterns regex pour rue, avenue, quartier |
| Codes postaux DOM | Mapping 97xxx → Villes Martinique/Guadeloupe/Réunion |
| Qualité extraction | Retourne `extraction_quality` pour feedback UI |
| Nombre de pièces | Extraction du pattern "X pièces" |

**Nouvelles données retournées** :
```typescript
{
  titre: string,
  description: string,
  loyer_hc: number | null,
  surface: number | null,
  nb_pieces: number | null,     // NOUVEAU
  type: string,
  code_postal: string | null,
  ville: string | null,         // NOUVEAU (via mapping)
  adresse: string | null,       // NOUVEAU (extraction)
  extraction_quality: {         // NOUVEAU
    has_price: boolean,
    has_surface: boolean,
    has_address: boolean,
    has_city: boolean,
    has_postal_code: boolean,
  }
}
```

#### 3.2 Wizard corrigé
**Fichier** : `features/properties/components/v3/property-wizard-v3.tsx`

**Problème** : Le titre de l'annonce était utilisé comme adresse
```typescript
// AVANT (bug)
adresse_complete: data.titre,

// APRÈS (corrigé)
if (data.adresse) {
  formUpdate.adresse_complete = data.adresse;
}
// Sinon laissé vide pour saisie manuelle
```

---

### 4. Types de Baux alignés avec BDD

#### 4.1 LeaseTypeCards.tsx
**Fichier** : `app/owner/leases/new/LeaseTypeCards.tsx`

| Ancien ID | Nouveau ID (BDD) |
|-----------|------------------|
| `mobilite` | `bail_mobilite` |
| `parking` | `contrat_parking` |
| `commercial` | `commercial_3_6_9` |

#### 4.2 ContractsClient.tsx
**Fichier** : `app/owner/leases/ContractsClient.tsx`

Labels et filtres mis à jour pour correspondre aux IDs BDD.

---

### 5. Extraction Code Postal depuis Adresse

**Fichier** : `features/properties/components/v3/immersive/steps/AddressStep.tsx`

**Nouvelle fonction** :
```typescript
const extractPostalCode = (address: string): string | null => {
  const matches = address.match(/\b(97\d{3}|98\d{3}|\d{5})\b/g);
  if (matches) {
    // Préférer les codes DOM s'il y en a plusieurs
    return matches.find(m => m.startsWith('97') || m.startsWith('98')) 
           || matches[matches.length - 1];
  }
  return null;
};
```

Quand l'utilisateur tape une adresse, le code postal et la ville sont automatiquement extraits et remplis.

---

## 📁 FICHIERS MODIFIÉS

| Fichier | Type | Description |
|---------|------|-------------|
| `supabase/migrations/20251202100000_tenant_multi_leases.sql` | 🆕 Nouveau | RPC multi-baux |
| `app/tenant/_data/fetchTenantDashboard.ts` | ✏️ Modifié | Interface TypeScript |
| `app/tenant/dashboard/DashboardClient.tsx` | ✏️ Modifié | UI multi-baux |
| `app/owner/properties/page.tsx` | ✏️ Modifié | Badges dynamiques |
| `app/api/scrape/route.ts` | ✏️ Modifié | Extraction améliorée |
| `features/properties/components/v3/property-wizard-v3.tsx` | ✏️ Modifié | Import corrigé |
| `app/owner/leases/new/LeaseTypeCards.tsx` | ✏️ Modifié | IDs types baux |
| `app/owner/leases/ContractsClient.tsx` | ✏️ Modifié | Labels/filtres |
| `features/properties/components/v3/immersive/steps/AddressStep.tsx` | ✏️ Modifié | Extraction CP |
| `scripts/fix_all_rls_and_meters.sql` | 🆕 Nouveau | Script correctifs BDD |

---

## ⚠️ ACTIONS REQUISES

### 1. Exécuter la migration multi-baux

```bash
npx supabase db push
```

Ou manuellement dans Supabase Studio :
1. Aller dans SQL Editor
2. Copier le contenu de `supabase/migrations/20251202100000_tenant_multi_leases.sql`
3. Exécuter

### 2. Exécuter le script de corrections BDD

Dans Supabase Studio > SQL Editor, exécuter :
`scripts/fix_all_rls_and_meters.sql`

Ce script corrige :
- Contrainte `leases_type_bail_check` (nouveaux types de baux)
- RLS `lease_signers` (récursion infinie)
- Schéma `meters` (colonnes manquantes)
- Table `property_photos` si manquante
- Colonne `departement` nullable

---

## 🧪 TESTS RECOMMANDÉS

### Scénario 1 : Multi-baux locataire
1. Créer un locataire avec 2 baux (appartement + parking)
2. Se connecter en tant que locataire
3. Vérifier que le dashboard affiche les 2 locations
4. Vérifier le total mensuel consolidé

### Scénario 2 : Affichage parkings
1. Aller sur la page "Mes biens" (propriétaire)
2. Vérifier qu'un parking n'affiche PAS "? pièces"
3. Vérifier qu'il affiche le numéro de parking si disponible

### Scénario 3 : Import annonce
1. Aller sur "Ajouter un bien"
2. Coller un lien LeBonCoin ou SeLoger
3. Vérifier que l'adresse n'est PAS le titre de l'annonce
4. Vérifier le toast "Import partiel" si données manquantes

### Scénario 4 : Création bail parking
1. Créer un bail pour un bien de type "parking"
2. Vérifier que le type "Bail Parking" est disponible
3. Vérifier que la création fonctionne (pas d'erreur contrainte BDD)

---

## 📈 IMPACT UTILISATEUR

| Amélioration | Bénéfice |
|--------------|----------|
| Multi-baux | Locataires peuvent voir toutes leurs locations |
| Badges dynamiques | UI plus claire, pas d'infos non pertinentes |
| Import amélioré | Moins de saisie manuelle, moins d'erreurs |
| Types baux | Création de baux parking/commerciaux fonctionnelle |

---

## 🔮 ÉVOLUTIONS FUTURES SUGGÉRÉES

1. **Paiement groupé** : Permettre au locataire de payer tous ses loyers en une fois
2. **Vue consolidée propriétaire** : Grouper les biens par adresse
3. **Numéro de lot obligatoire** : Pour les parkings/boxes, rendre le champ obligatoire
4. **Historique multi-baux** : Voir l'historique de tous ses anciens baux

---

## ✅ STATUT FINAL

| Tâche | Statut |
|-------|--------|
| RPC multi-baux | ✅ Complété |
| Interface TypeScript | ✅ Complété |
| Dashboard locataire | ✅ Complété |
| Badges dynamiques | ✅ Complété |
| Import annonces | ✅ Complété |
| Types de baux | ✅ Complété |
| Documentation | ✅ Complété |

**Toutes les modifications sont prêtes pour déploiement.**

