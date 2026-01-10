# 📊 Rapport d'Analyse : Forfaits et Verrouillage des Fonctionnalités

**Date d'analyse** : Janvier 2026
**Version** : SOTA 2025/2026
**Analysé par** : Claude Code

---

## 📋 Table des matières

1. [Vue d'ensemble des forfaits](#vue-densemble-des-forfaits)
2. [Matrice complète des fonctionnalités](#matrice-complète-des-fonctionnalités)
3. [Limites quantitatives par forfait](#limites-quantitatives-par-forfait)
4. [Mécanismes de verrouillage implémentés](#mécanismes-de-verrouillage-implémentés)
5. [Analyse des usages actuels dans le code](#analyse-des-usages-actuels-dans-le-code)
6. [Points manquants et recommandations](#points-manquants-et-recommandations)

---

## 1. Vue d'ensemble des forfaits

### 1.1 Forfaits Standard

| Forfait | Prix/mois | Prix/an | Biens inclus | Signatures/mois | Cible |
|---------|-----------|---------|--------------|-----------------|-------|
| **Gratuit** | 0€ | 0€ | 1 | 0 | Découverte |
| **Starter** | 9€ | 90€ (-17%) | 3 | 0 | Petits propriétaires |
| **Confort** ⭐ | 35€ | 336€ (-20%) | 10 | 2 | Propriétaires actifs |
| **Pro** | 69€ | 662€ (-20%) | 50 | 10 | Gestionnaires/SCI |

### 1.2 Forfaits Enterprise

| Forfait | Prix/mois | Prix/an | Biens | Signatures/mois | Spécificités |
|---------|-----------|---------|-------|-----------------|--------------|
| **Enterprise S** | 249€ | 2 390€ | 50-100 | 25 | AM partagé |
| **Enterprise M** | 349€ | 3 350€ | 100-200 | 40 | + White label basique |
| **Enterprise L** ⭐ | 499€ | 4 790€ | 200-500 | 60 | + AM dédié + Custom domain |
| **Enterprise XL** | 799€ | 7 670€ | 500+ | Illimité | + SSO + Formations |

---

## 2. Matrice complète des fonctionnalités

### 2.1 Fonctionnalités de base

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| Portail locataire | Basic | Basic | Advanced | Full | Full |
| Génération de bail | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quittances PDF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Suivi des loyers | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.2 Documents (Category: `documents`)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| **Signatures électroniques** | 5,90€/u | 4,90€/u | 2 incluses (3,90€/u) | 10 incluses (2,50€/u) | 25-60 incluses (1,90€/u) |
| **EDL numérique** | ❌ | ❌ | ✅ | ✅ | ✅ |
| Génération bail ALUR | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.3 Finance (Category: `finance`)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| **Open Banking** | ❌ | ❌ | ✅ Basic | ✅ Advanced | ✅ Premium |
| **Rapprochement bancaire** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Paiement en ligne** | ❌ | ✅ (2,2%/0,50€) | ✅ (2,2%/0,50€) | ✅ (2,2%/0,50€) | ✅ (1,9%/0,40€) |
| **Réduction GLI** | 0% | -5% | -10% | -15% | -18% à -25% |

### 2.4 Automatisation (Category: `automation`)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| **Relances auto email** | ❌ | Basic (1 rappel) | ✅ | ✅ | ✅ |
| **Relances SMS** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Révision IRL auto** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Alertes échéances** | ❌ | ❌ | ✅ | ✅ | ✅ |

### 2.5 Intelligence Artificielle (Category: `ai`)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| **Scoring locataire IA** | ❌ | ❌ | ✅ Basic | ✅ Advanced | ✅ Advanced |

### 2.6 Collaboration (Category: `collaboration`)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| **Multi-utilisateurs** | ❌ | ❌ | ✅ (2 users) | ✅ (5 users) | Illimité |
| **Ordres de travaux** | ❌ | ❌ | ✅ | ✅ + Planning | ✅ + Planning |
| **Gestion prestataires** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Rôles/permissions** | ❌ | ❌ | ❌ | ✅ | ✅ |

### 2.7 Fonctionnalités Avancées (Category: `advanced`)

| Fonctionnalité | Gratuit | Starter | Confort | Pro | Enterprise |
|----------------|---------|---------|---------|-----|------------|
| **API** | ❌ | ❌ | ❌ | ✅ Read/Write | ✅ Full |
| **Webhooks** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **White label** | ❌ | ❌ | ❌ | ❌ | M+ (Basic→Full) |
| **Custom domain** | ❌ | ❌ | ❌ | ❌ | L+ |
| **SSO** | ❌ | ❌ | ❌ | ❌ | XL uniquement |
| **Module copropriété** | ❌ | ❌ | ❌ | ❌ | L+ |
| **Support prioritaire** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Account Manager** | ❌ | ❌ | ❌ | ❌ | Partagé→Dédié |

---

## 3. Limites quantitatives par forfait

### 3.1 Limites de ressources

| Ressource | Gratuit | Starter | Confort | Pro | Ent. S | Ent. M | Ent. L | Ent. XL |
|-----------|---------|---------|---------|-----|--------|--------|--------|---------|
| **Biens max** | 1 | 3 | 10 | 50 | 100 | 200 | 500 | ∞ |
| **Baux max** | 1 | 5 | 25 | ∞ | ∞ | ∞ | ∞ | ∞ |
| **Locataires max** | 2 | 10 | 40 | ∞ | ∞ | ∞ | ∞ | ∞ |
| **Stockage** | 100 Mo | 1 Go | 5 Go | 30 Go | 50 Go | 100 Go | 200 Go | ∞ |
| **Utilisateurs** | 1 | 1 | 2 | 5 | ∞ | ∞ | ∞ | ∞ |
| **Signatures/mois** | 0 | 0 | 2 | 10 | 25 | 40 | 60 | ∞ |

### 3.2 Frais supplémentaires

| Type | Gratuit | Starter | Confort | Pro | Enterprise |
|------|---------|---------|---------|-----|------------|
| **Bien supplémentaire** | N/A | 3€/mois | 2,50€/mois | 2€/mois | Inclus |
| **Signature au-delà** | 5,90€ | 4,90€ | 3,90€ | 2,50€ | 1,90€ (ou inclus XL) |

### 3.3 SLA par forfait Enterprise

| Tier | SLA Garantie |
|------|--------------|
| Enterprise S | 99% |
| Enterprise M | 99% |
| Enterprise L | 99,5% |
| Enterprise XL | 99,9% |

---

## 4. Mécanismes de verrouillage implémentés

### 4.1 Composants de gating disponibles

| Composant | Fichier | Usage |
|-----------|---------|-------|
| `PlanGate` | `components/subscription/plan-gate.tsx` | Bloc de contenu avec overlay |
| `PlanGateInline` | `components/subscription/plan-gate.tsx` | Boutons/éléments interactifs |
| `PlanGateTooltip` | `components/subscription/plan-gate.tsx` | Tooltip sur éléments désactivés |
| `SmartPaywall` | `components/subscription/smart-paywall.tsx` | Paywall animé (banner/card/fullscreen) |
| `UsageLimitBanner` | `components/subscription/usage-limit-banner.tsx` | Alerte limite proche/atteinte |
| `UsageMeter` | `components/subscription/usage-limit-banner.tsx` | Jauge d'utilisation |
| `UpgradeTrigger` | `components/subscription/smart-paywall.tsx` | Bouton/badge upgrade |
| `UpgradeModal` | `components/subscription/upgrade-modal.tsx` | Modal de changement de plan |

### 4.2 Hooks disponibles

```typescript
// Depuis subscription-provider.tsx
useSubscription()       // Context complet
useFeature(feature)     // Vérifier une feature
useUsageLimit(resource) // Vérifier une limite
useCurrentPlan()        // Obtenir le plan actuel
useSignatureQuota()     // Quota signatures détaillé
```

### 4.3 Modes de verrouillage

| Mode | Description | Utilisation |
|------|-------------|-------------|
| `block` | Overlay opaque avec CTA | Sections complètes |
| `blur` | Contenu flouté | Aperçu avec incitation |
| `hide` | Masqué complètement | Éléments non pertinents |
| `badgeOnly` | Badge "Pro" affiché | Indication sans blocage |

---

## 5. Analyse des usages actuels dans le code

### 5.1 Fonctionnalités effectivement gérées

| Feature Key | Où utilisé | Type de gating |
|-------------|------------|----------------|
| `edl_digital` | `app/owner/inspections/InspectionsClient.tsx` | `PlanGate` mode blur |
| `open_banking` | `app/owner/money/MoneyClient.tsx` | `PlanGateInline` |
| `leases` (limite) | `app/owner/money/MoneyClient.tsx`, `app/owner/leases/ContractsClient.tsx` | `UsageLimitBanner` |
| `properties` (limite) | `app/owner/properties/page.tsx` | `UsageLimitBanner` |

### 5.2 FeatureKeys définies mais NON implémentées dans l'UI

Ces features sont définies dans `plans.ts` mais **aucun gating n'est présent dans le code** :

| Feature | Définie | Implémentée | État |
|---------|---------|-------------|------|
| `signatures` | ✅ | ⚠️ Partiel | Badge usage uniquement |
| `bank_reconciliation` | ✅ | ❌ | **MANQUANT** |
| `auto_reminders` | ✅ | ❌ | **MANQUANT** |
| `auto_reminders_sms` | ✅ | ❌ | **MANQUANT** |
| `irl_revision` | ✅ | ❌ | **MANQUANT** |
| `alerts_deadlines` | ✅ | ❌ | **MANQUANT** |
| `tenant_portal` | ✅ | ❌ | **MANQUANT** |
| `tenant_payment_online` | ✅ | ❌ | **MANQUANT** |
| `lease_generation` | ✅ | ❌ | Non verrouillé (tous plans) |
| `colocation` | ✅ | ❌ | **MANQUANT** |
| `multi_units` | ✅ | ❌ | **MANQUANT** |
| `multi_users` | ✅ | ❌ | **MANQUANT** |
| `work_orders` | ✅ | ❌ | **MANQUANT** |
| `providers_management` | ✅ | ❌ | **MANQUANT** |
| `owner_reports` | ✅ | ❌ | **MANQUANT** |
| `api_access` | ✅ | ❌ | **MANQUANT** |
| `webhooks` | ✅ | ❌ | **MANQUANT** |
| `white_label` | ✅ | ❌ | **MANQUANT** |
| `custom_domain` | ✅ | ❌ | **MANQUANT** |
| `sso` | ✅ | ❌ | **MANQUANT** |
| `scoring_tenant` | ✅ | ❌ | **MANQUANT** |
| `copro_module` | ✅ | ❌ | **MANQUANT** |
| `priority_support` | ✅ | ❌ | **MANQUANT** |
| `dedicated_account_manager` | ✅ | ❌ | **MANQUANT** |

---

## 6. Points manquants et recommandations

### 6.1 🚨 Priorité CRITIQUE - Fonctionnalités payantes accessibles gratuitement

Ces features sont payantes selon la config mais **aucun gating n'empêche leur accès** :

| Feature | Plan requis | Action requise |
|---------|-------------|----------------|
| **Scoring locataire IA** | Confort+ | Ajouter `PlanGate` sur `/owner/tenants/scoring` |
| **Rapprochement bancaire** | Confort+ | Ajouter `PlanGate` sur la fonctionnalité |
| **Relances automatiques** | Confort+ | Ajouter `PlanGate` sur `/owner/reminders` |
| **Relances SMS** | Pro+ | Gater l'option SMS dans les relances |
| **Révision IRL** | Confort+ | Gater la fonction de révision auto |
| **Multi-utilisateurs** | Confort+ | Bloquer l'ajout d'utilisateurs |
| **Ordres de travaux** | Confort+ | Ajouter `PlanGate` sur `/owner/maintenance` |
| **Gestion prestataires** | Pro+ | Gater `/owner/providers` |
| **API Access** | Pro+ | Vérifier accès API endpoints |

### 6.2 ⚠️ Priorité HAUTE - Limites non appliquées côté backend

| Limite | État actuel | Risque |
|--------|-------------|--------|
| `max_properties` | UI uniquement | Bypass possible via API |
| `max_leases` | UI uniquement | Bypass possible via API |
| `max_users` | Non implémenté | Aucune limite |
| `max_documents_gb` | Non implémenté | Stockage illimité |
| `signatures_monthly_quota` | Partiel | Tracking sans blocage |

**Recommandation** : Implémenter des checks côté serveur dans les mutations Supabase (RLS) et/ou dans les API routes.

### 6.3 📋 Priorité MOYENNE - UX améliorations

| Point | Recommandation |
|-------|----------------|
| Pas de page `/pricing` complète | Créer une page tarifs détaillée |
| Pas d'affichage du plan actuel | Ajouter badge plan dans sidebar |
| Pas de comparaison de plans | Ajouter tableau comparatif |
| Pas de notification avant limite | Implémenter alertes à 80% d'usage |

### 6.4 📝 Recommandations d'implémentation

#### A. Gating backend (RLS Policies)

```sql
-- Exemple : Limiter le nombre de biens
CREATE OR REPLACE FUNCTION check_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT properties_count INTO current_count
  FROM subscriptions WHERE owner_id = NEW.owner_id;

  SELECT max_properties INTO max_allowed
  FROM subscription_plans sp
  JOIN subscriptions s ON s.plan_id = sp.id
  WHERE s.owner_id = NEW.owner_id;

  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'Property limit reached for your plan';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### B. Gating frontend systématique

```tsx
// Exemple : Scoring locataire
<PlanGate feature="scoring_tenant" mode="block">
  <TenantScoringComponent />
</PlanGate>

// Exemple : Bouton SMS
<PlanGateInline feature="auto_reminders_sms">
  <Button onClick={sendSMS}>Envoyer SMS</Button>
</PlanGateInline>
```

#### C. Middleware API

```typescript
// lib/middleware/subscription-check.ts
export async function checkFeatureAccess(
  userId: string,
  feature: FeatureKey
): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;
  return userHasFeature(userId, feature);
}
```

---

## 7. Résumé des actions requises

### Immédiat (Bloquant)
- [ ] Implémenter le gating pour `scoring_tenant`
- [ ] Implémenter le gating pour `bank_reconciliation`
- [ ] Implémenter le gating pour `auto_reminders` / `auto_reminders_sms`
- [ ] Implémenter le gating pour `multi_users` (ajout utilisateurs)
- [ ] Implémenter le gating pour `work_orders`
- [ ] Implémenter le gating pour `providers_management`

### Court terme (1-2 sprints)
- [ ] Ajouter validation backend (RLS) pour `max_properties`
- [ ] Ajouter validation backend pour `max_leases`
- [ ] Ajouter validation backend pour `max_users`
- [ ] Implémenter tracking stockage (`max_documents_gb`)
- [ ] Ajouter page `/pricing` complète

### Moyen terme
- [ ] Implémenter gating API (`api_access`)
- [ ] Implémenter gating Enterprise (`webhooks`, `white_label`, `sso`)
- [ ] Ajouter dashboard usage dans settings
- [ ] Notifications proactives avant limites

---

## 8. Analyse exhaustive par page (100%)

### 8.1 Pages nécessitant un gating URGENT

| Page | Feature requise | Plan min | État actuel | Action |
|------|-----------------|----------|-------------|--------|
| `/owner/work-orders/page.tsx` | `work_orders` | Confort | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="work_orders">` |
| `/owner/providers/page.tsx` | `providers_management` | Pro | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="providers_management">` |
| `/owner/indexation/page.tsx` | `irl_revision` | Confort | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="irl_revision">` |
| `/owner/copro/charges/page.tsx` | `copro_module` | Enterprise L+ | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="copro_module">` |
| `/owner/copro/regularisation/page.tsx` | `copro_module` | Enterprise L+ | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="copro_module">` |
| `/owner/analytics/page.tsx` | `owner_reports` | Confort | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="owner_reports">` |
| `/owner/leases/new/ColocationConfig.tsx` | `colocation` | Confort | ❌ **AUCUN GATING** | Ajouter `<PlanGate feature="colocation">` |

### 8.2 Composants nécessitant un gating conditionnel

| Composant | Feature | Contexte | Action |
|-----------|---------|----------|--------|
| `LeaseTypeCards.tsx` | `colocation` | Option colocation | Désactiver si pas feature |
| `PropertySelector.tsx` | `multi_units` | Multi-lots | Désactiver si pas feature |
| `SignersClient.tsx` | `signatures` | Envoi signature | Vérifier quota avant envoi |
| `ScoringDashboard.tsx` | `scoring_tenant` | Dashboard scoring | Gate complet |
| `ScoreDecisionPanel.tsx` | `scoring_tenant` | Décision scoring | Gate inline |

### 8.3 API Routes sans validation de subscription

| Route API | Feature/Limite à vérifier | État |
|-----------|---------------------------|------|
| `POST /api/properties` | `max_properties` | ❌ **Aucune vérification** |
| `POST /api/leases` | `max_leases` | ❌ **Aucune vérification** |
| `POST /api/signatures/send` | `signatures_monthly_quota` | ⚠️ Tracking sans blocage |
| `POST /api/work-orders` | `work_orders` | ❌ **Aucune vérification** |
| `POST /api/indexation` | `irl_revision` | ❌ **Aucune vérification** |
| `GET /api/copro/*` | `copro_module` | ❌ **Aucune vérification** |
| `POST /api/scoring/*` | `scoring_tenant` | ❌ **Aucune vérification** |

### 8.4 Features additionnelles (non dans FeatureKey mais utilisées)

Ces features sont utilisées dans les plans mais ne sont pas dans le type `FeatureKey` :

| Feature | Utilisée dans | Devrait être gatée |
|---------|---------------|-------------------|
| `open_banking_level` | Plans (basic/advanced/premium) | Différencier les niveaux |
| `roles_permissions` | Pro+ | Gating page settings/team |
| `activity_log` | Pro+ | Gating page logs |
| `work_orders_planning` | Pro+ | Gating planning dans work orders |
| `scoring_advanced` | Pro+ | Différencier scoring basic/advanced |
| `white_label_level` | Enterprise M+ | Différencier basic/full |
| `sla_guarantee` | Enterprise | Informatif uniquement |
| `account_manager_type` | Enterprise | Informatif uniquement |
| `multi_mandants` | Enterprise | Gating si fonctionnalité existe |
| `channel_manager` | Enterprise | Gating si fonctionnalité existe |

### 8.5 Base de données - Vérifications manquantes

**Aucun trigger de blocage n'existe** pour les limites. Le schéma actuel :
- ✅ Compteurs automatiques (`properties_count`, `leases_count`)
- ❌ Pas de `RAISE EXCEPTION` si limite dépassée
- ❌ Pas de RLS policy basée sur les limites

**Migration SQL requise** :

```sql
-- Trigger pour bloquer l'ajout de biens au-delà de la limite
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Récupérer le plan et la limite
  SELECT s.properties_count, sp.max_properties, s.plan_slug
  INTO current_count, max_allowed, plan_slug
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de biens atteinte pour le forfait %. Passez à un forfait supérieur.', plan_slug;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_property_limit_before_insert
BEFORE INSERT ON properties
FOR EACH ROW EXECUTE FUNCTION enforce_property_limit();
```

---

## 9. Score de couverture du gating

| Catégorie | Couvert | Total | % |
|-----------|---------|-------|---|
| **Features UI** | 2 | 25 | **8%** |
| **Limites UI** | 2 | 6 | **33%** |
| **Limites Backend** | 0 | 6 | **0%** |
| **API Routes** | 0 | 10+ | **0%** |

### Score global : **~10%** 🔴

**Interprétation** : Le système de gating est bien architecturé mais presque non implémenté. 90% des fonctionnalités payantes sont accessibles gratuitement.

---

## 10. Annexes

### A. Liste complète des FeatureKeys

```typescript
type FeatureKey =
  | 'signatures'
  | 'open_banking'
  | 'bank_reconciliation'
  | 'auto_reminders'
  | 'auto_reminders_sms'
  | 'irl_revision'
  | 'alerts_deadlines'
  | 'tenant_portal'
  | 'tenant_payment_online'
  | 'lease_generation'
  | 'colocation'
  | 'multi_units'
  | 'multi_users'
  | 'work_orders'
  | 'providers_management'
  | 'owner_reports'
  | 'api_access'
  | 'webhooks'
  | 'white_label'
  | 'custom_domain'
  | 'priority_support'
  | 'dedicated_account_manager'
  | 'scoring_tenant'
  | 'edl_digital'
  | 'copro_module';
```

### B. Fichiers clés du système

| Fichier | Rôle |
|---------|------|
| `lib/subscriptions/plans.ts` | Définition des plans et features |
| `lib/subscriptions/pricing-config.ts` | Prix et quotas |
| `lib/subscriptions/subscription-service.ts` | Service backend |
| `components/subscription/subscription-provider.tsx` | Context React |
| `components/subscription/plan-gate.tsx` | Composants de gating |
| `supabase/migrations/20241129000001_subscriptions.sql` | Schema BDD |

---

*Rapport généré automatiquement - Janvier 2026*
