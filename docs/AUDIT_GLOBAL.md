# 🔍 AUDIT GLOBAL - Talok SaaS

**Date**: 6 Décembre 2025  
**Version**: 1.0  
**Périmètre**: Code, Infrastructure, Conformité, Scalabilité

---

## 📑 Table des matières

1. [Analytics & Produit](#1-analytics--produit)
2. [DevOps & CI/CD](#2-devops--cicd)
3. [Observabilité](#3-observabilité)
4. [Gouvernance des données](#4-gouvernance-des-données)
5. [Légal & RGPD](#5-légal--rgpd-france)
6. [Outils internes](#6-outils-internes)
7. [Coûts & Scalabilité](#7-coûts--scalabilité)
8. [Plan d'action prioritaire](#8-plan-daction-prioritaire)

---

## 1. Analytics & Produit

### 📊 État actuel

| Élément | Status | Fichiers/Impl |
|---------|--------|---------------|
| Event tracking interne | ⚠️ Partiel | `lib/helpers/analytics-events.ts` |
| Outbox pattern | ✅ Implémenté | Table `outbox` Supabase |
| Property Wizard events | ✅ Définis | 15 événements couverts |
| Service analytics tiers | ❌ Absent | Pas de PostHog/Amplitude/Mixpanel |
| Google Analytics | ❌ Absent | - |

#### Événements définis (Property Wizard)

```typescript
// lib/helpers/analytics-events.ts
PropertyWizardEvents = {
  TYPE_STEP_VIEW, TYPE_SELECTED, TYPE_FILTER_USED, TYPE_SEARCH_USED,
  CTA_CONTINUE_CLICK, PROP_ADDRESS_SUBMITTED, PROP_GEOCODED_OK/FAIL,
  UNIT_DETAILS_SAVED, ROOMS_SET, PHOTOS_UPLOADED, FEATURES_SAVED,
  LISTING_PUBLISH_CLICKED, LISTING_PUBLISHED, LISTING_LINT_FAILED,
  PROPERTY_ACTIVATED, CODE_GENERATED, METER_ADDED, EDL_SCHEDULED
}
```

### ⚠️ Événements manquants critiques

| Catégorie | Événements à ajouter |
|-----------|---------------------|
| **Onboarding** | `Signup.Started`, `Signup.Completed`, `Profile.Created`, `FirstProperty.Added` |
| **Propriétaire** | `Lease.Created`, `Lease.Signed`, `Invoice.Generated`, `Payment.Received`, `Tenant.Invited` |
| **Locataire** | `Application.Started`, `Application.Completed`, `Payment.Made`, `Ticket.Created` |
| **Conversion** | `Plan.Viewed`, `Plan.Selected`, `Checkout.Started`, `Subscription.Activated` |
| **Engagement** | `Session.Started`, `Feature.Used`, `Export.Downloaded` |

### 🎯 Funnels à mettre en place

```
1. ACQUISITION FUNNEL
   Landing Page → Signup → Email Verified → First Login → Profile Completed

2. ACTIVATION FUNNEL  
   Profile → First Property → First Tenant → First Lease → First Invoice

3. REVENUE FUNNEL
   Free Trial → Plan Selection → Checkout → Payment → Active Subscription

4. RETENTION FUNNEL
   Monthly Login → Active Property → Invoice Generated → Payment Received
```

### 🚨 Risques

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| Pas de données pour piloter le produit | 🔴 Critique | Haute |
| Impossible de mesurer le ROI marketing | 🔴 Critique | Haute |
| Pas de segmentation utilisateurs | 🟠 Élevé | Haute |

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Intégrer **PostHog** (self-hosted ou cloud) | 2j | 🔴 |
| P1 | Définir tracking plan complet (40+ events) | 1j | 🔴 |
| P1 | Implémenter funnels onboarding/conversion | 2j | 🔴 |
| P2 | Dashboard analytics admin temps réel | 3j | 🟠 |
| P2 | A/B testing framework (PostHog/Growthbook) | 2j | 🟠 |
| P3 | Cohortes et segmentation avancée | 2j | 🟡 |

---

## 2. DevOps & CI/CD

### 📊 État actuel

| Élément | Status | Détails |
|---------|--------|---------|
| GitHub Actions | ❌ Absent | Pas de `.github/workflows/` |
| Tests automatisés CI | ❌ Absent | Tests locaux uniquement |
| Lint en CI | ❌ Absent | Pas de check automatique |
| Type-check en CI | ❌ Absent | Pas de check automatique |
| Build preview | ❌ Absent | Pas de preview branches |
| Deploy Vercel | ✅ Manuel | Via dashboard Vercel |
| Cron jobs | ✅ Configuré | `vercel.json` avec 7 crons |

#### Crons configurés

```json
// vercel.json
- /api/cron/generate-monthly-invoices (1er du mois 6h)
- /api/cron/rent-reminders (tous les jours 9h)
- /api/cron/irl-indexation (1er du mois 10h)
- /api/cron/lease-expiry-alerts (lundi 8h)
- /api/cron/subscription-alerts (tous les jours 10h)
- /api/cron/notifications (tous les jours 8h)
- /api/cron/check-cni-expiry (tous les jours 7h)
```

### ⚠️ Scripts existants (non automatisés)

```bash
scripts/
├── auto-deploy.sh        # Deploy manuel
├── deploy-vercel.sh      # Deploy Vercel
├── check-env.sh          # Vérif variables env
├── clear-cache.sh        # Nettoyage cache
├── apply-migrations.ts   # Migrations BDD
└── ... (68 fichiers)
```

### 🚨 Risques

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| Déploiement de code cassé en prod | 🔴 Critique | Moyenne |
| Régressions non détectées | 🔴 Critique | Haute |
| Pas de rollback automatique | 🟠 Élevé | Moyenne |
| Types incorrects en production | 🟠 Élevé | Haute |

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Créer `.github/workflows/ci.yml` | 1j | 🔴 |
| P0 | Tests + lint + type-check en CI | 1j | 🔴 |
| P1 | Preview deployments Vercel | 0.5j | 🟠 |
| P1 | Protection branch `main` | 0.5j | 🟠 |
| P2 | Rollback automatique si erreurs | 1j | 🟠 |
| P2 | Semantic versioning + changelog | 1j | 🟡 |
| P3 | Feature flags (LaunchDarkly/PostHog) | 2j | 🟡 |

#### Pipeline CI recommandé

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build
  
  e2e:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## 3. Observabilité

### 📊 État actuel

| Élément | Status | Fichiers |
|---------|--------|----------|
| Sentry (erreurs) | ✅ Configuré | `sentry.*.config.ts` (3 fichiers) |
| Session Replay | ✅ Activé | 10% sessions, 100% erreurs |
| Logger structuré | ✅ Implémenté | `lib/monitoring/index.ts` |
| API monitoring | ⚠️ Basique | `createApiMonitor()` |
| Alerting | ❌ Absent | Pas de PagerDuty/OpsGenie |
| Dashboards | ❌ Absent | Pas de Grafana/Datadog |
| APM (traces) | ⚠️ Partiel | Sentry traces 10% |

#### Configuration Sentry

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% en prod
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  ignoreErrors: ['Network request failed', 'ResizeObserver...'],
});
```

#### Logger structuré

```typescript
// lib/monitoring/index.ts
logger.info(message, context)  // JSON en prod
logger.warn(message, context)
logger.error(message, { error, ...context })
logger.debug(message, context) // Dev only
trackEvent(eventName, properties)
withTiming(operationName, operation, context)
createApiMonitor(routeName)
```

### 🚨 Risques

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| Erreurs critiques non alertées | 🔴 Critique | Moyenne |
| Pas de corrélation logs/traces | 🟠 Élevé | Haute |
| Debug difficile en production | 🟠 Élevé | Haute |
| Pas de métriques business temps réel | 🟠 Élevé | Haute |

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Configurer alertes Sentry (Slack/email) | 0.5j | 🔴 |
| P1 | Ajouter logs structurés sur routes critiques | 1j | 🟠 |
| P1 | Dashboard Sentry issues triées | 0.5j | 🟠 |
| P2 | Intégrer Vercel Analytics | 0.5j | 🟠 |
| P2 | APM complet (augmenter sample rate) | 0.5j | 🟠 |
| P3 | Custom metrics (loyers collectés, etc.) | 2j | 🟡 |
| P3 | Synthetics (uptime monitoring) | 1j | 🟡 |

---

## 4. Gouvernance des données

### 📊 État actuel

| Élément | Status | Détails |
|---------|--------|---------|
| Backups automatiques | ✅ Supabase | Point-in-time recovery (7j gratuit) |
| Backups manuels | ❌ Absent | Pas de script export régulier |
| Restore testé | ❌ Non | Jamais testé |
| Archivage données anciennes | ❌ Absent | Tout reste en base |
| Soft delete | ⚠️ Partiel | Certaines tables uniquement |
| Cycle de vie documents | ❌ Absent | Storage non géré |

#### Structure Storage Supabase

```
storage/
├── documents/       # Baux, quittances, attestations
├── photos/          # Photos logements
├── identity/        # CNI, justificatifs
├── signatures/      # Documents signés
└── edl/             # États des lieux
```

### 🚨 Risques

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| Perte de données (disaster recovery) | 🔴 Critique | Faible |
| Coûts storage croissants | 🟠 Élevé | Haute |
| Données sensibles non purgées | 🟠 Élevé (RGPD) | Haute |
| Restore non fonctionnel | 🔴 Critique | Moyenne |

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Tester restore complet | 0.5j | 🔴 |
| P0 | Documenter procédure disaster recovery | 0.5j | 🔴 |
| P1 | Script backup régulier (pg_dump) | 1j | 🟠 |
| P1 | Politique rétention Storage | 1j | 🟠 |
| P2 | Archivage données > 5 ans | 2j | 🟠 |
| P2 | Soft delete généralisé | 2j | 🟡 |
| P3 | Backup cross-region | 1j | 🟡 |

#### Politique de rétention recommandée

```
| Type de donnée         | Rétention active | Archive | Purge |
|------------------------|------------------|---------|-------|
| Baux actifs            | Illimité         | -       | -     |
| Baux terminés          | 3 ans            | 7 ans   | 10 ans|
| Quittances             | 5 ans            | 10 ans  | 15 ans|
| Documents identité     | Fin bail + 1 an  | -       | Purge |
| Photos logement        | Illimité         | -       | -     |
| Logs connexion         | 1 an             | -       | Purge |
| Audit logs             | 5 ans            | 10 ans  | -     |
```

---

## 5. Légal & RGPD (France)

### 📊 État actuel

| Élément | Status | Fichiers |
|---------|--------|----------|
| Gestion consentements | ✅ Implémenté | `app/api/consents/route.ts` |
| Table user_consents | ✅ Existe | Supabase |
| Anonymisation | ✅ Implémenté | `app/api/privacy/anonymize/route.ts` |
| Export données | ⚠️ Partiel | `lib/services/export-service.ts` |
| Droit à l'oubli | ⚠️ Partiel | Anonymisation uniquement |
| Politique vie privée | ✅ Page | `app/legal/privacy/page.tsx` |
| CGU | ✅ Page | `app/legal/terms/page.tsx` |
| Journalisation accès | ⚠️ Partiel | Audit log basique |
| DPO contact | ❌ Absent | Pas de référent identifié |
| Registre traitements | ❌ Absent | Non documenté |

#### Table user_consents

```sql
user_consents (
  user_id, 
  terms_version, privacy_version,
  terms_accepted, privacy_accepted,
  terms_accepted_at, privacy_accepted_at,
  cookies_necessary, cookies_analytics, cookies_ads
)
```

#### Anonymisation existante

```typescript
// app/api/privacy/anonymize/route.ts
- Anonymise: prenom, nom → "ANONYME"
- Supprime: telephone, avatar_url, date_naissance
- Log dans audit_log
// ⚠️ Ne couvre PAS: documents, leases, invoices, tickets
```

### 🚨 Risques

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| Non-conformité RGPD (amende 4% CA) | 🔴 Critique | Moyenne |
| Export incomplet (violation Art. 20) | 🟠 Élevé | Haute |
| Données sensibles non purgées | 🟠 Élevé | Haute |
| Pas de journalisation accès données | 🟠 Élevé | Haute |

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | API export RGPD complet (JSON/PDF) | 2j | 🔴 |
| P0 | Anonymisation cascade (documents, etc.) | 2j | 🔴 |
| P0 | Désigner DPO (même informel) | 0.5j | 🔴 |
| P1 | Registre des traitements (Article 30) | 1j | 🟠 |
| P1 | Log accès données personnelles | 1j | 🟠 |
| P1 | Durées de conservation documentées | 1j | 🟠 |
| P2 | Cookie banner RGPD-compliant | 1j | 🟠 |
| P2 | Procédure suppression compte self-service | 2j | 🟡 |
| P3 | Audit annuel conformité | 1j | 🟡 |

#### Données à inclure dans export RGPD

```
1. Profil complet (nom, email, téléphone, etc.)
2. Tous les baux (locataire ou propriétaire)
3. Factures et quittances
4. Documents uploadés
5. Historique des tickets
6. Historique des paiements
7. Logs de connexion
8. Consentements donnés
```

---

## 6. Outils internes

### 📊 État actuel

| Élément | Status | Localisation |
|---------|--------|--------------|
| Back-office Admin | ✅ Complet | `app/admin/` (15+ pages) |
| Dashboard stats | ✅ Implémenté | `app/admin/dashboard/` |
| Gestion utilisateurs | ✅ Implémenté | `app/admin/people/` |
| Gestion propriétés | ✅ Implémenté | `app/admin/properties/` |
| Modération | ✅ Implémenté | `app/admin/moderation/` |
| Audit logs viewer | ✅ Implémenté | `app/api/admin/audit-logs/` |
| Impersonation | ❌ Absent | - |
| AI Copilot | ✅ Implémenté | `components/admin/ai-copilot-panel.tsx` |
| Compliance | ✅ Implémenté | `app/admin/compliance/` |
| Templates | ✅ Implémenté | `app/admin/templates/` |
| Plans/Subscriptions | ✅ Implémenté | `app/admin/plans/` |

#### Pages Admin existantes

```
app/admin/
├── dashboard/        # KPIs globaux
├── people/           # Propriétaires, locataires, prestataires
├── properties/       # Biens immobiliers
├── tenants/          # Locataires (vue dédiée)
├── providers/        # Prestataires en attente
├── moderation/       # Actions de modération
├── compliance/       # Vérifications réglementaires
├── plans/            # Gestion des forfaits
├── templates/        # Templates documents
├── blog/             # Gestion articles
├── reports/          # Rapports
├── integrations/     # APIs tierces
├── accounting/       # Comptabilité
└── privacy/          # RGPD
```

### 🚨 Risques

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| Pas d'impersonation (debug difficile) | 🟠 Élevé | Haute |
| Actions admin non auditées | 🟠 Élevé | Moyenne |
| Pas de mode lecture seule | 🟡 Moyen | Faible |

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P1 | Impersonation sécurisée | 2j | 🟠 |
| P1 | Audit log toutes actions admin | 1j | 🟠 |
| P2 | Rôles admin granulaires | 2j | 🟠 |
| P2 | Export rapports admin (PDF/CSV) | 1j | 🟡 |
| P3 | Mode lecture seule (viewer) | 1j | 🟡 |

#### Impersonation recommandée

```typescript
// Exemple implémentation sécurisée
interface ImpersonationSession {
  admin_id: string;        // Admin qui impersonne
  target_user_id: string;  // Utilisateur cible
  started_at: Date;
  expires_at: Date;        // Max 1h
  reason: string;          // Obligatoire
  actions_log: Action[];   // Toutes actions loggées
}

// Route: POST /api/admin/impersonate
// - Vérifie rôle admin
// - Log dans audit_log
// - Crée session temporaire
// - Badge visuel "Mode impersonation"
```

---

## 7. Coûts & Scalabilité

### 📊 État actuel

| Élément | Status | Détails |
|---------|--------|---------|
| Indexes DB | ✅ Nombreux | 448+ indexes créés |
| N+1 queries | ⚠️ Risque | Non optimisé systématiquement |
| Cache | ⚠️ Partiel | React Query client uniquement |
| Edge Functions | ✅ Configuré | Supabase Edge Functions |
| API timeout | ✅ Configuré | 10s standard, 120s cron |
| Region | ✅ CDG1 | Paris (France) |

#### Indexes existants (échantillon)

```sql
-- 448 indexes détectés dans les migrations
-- Tables les plus indexées:
- properties (status, owner_id, created_at, unique_code)
- leases (property_id, status, start_date)
- invoices (lease_id, status, due_date)
- profiles (user_id, role)
- audit_log (user_id, entity_type, created_at)
```

#### Configuration Vercel

```json
// vercel.json
{
  "regions": ["cdg1"],
  "functions": {
    "app/api/**/*.ts": { "maxDuration": 10 },
    "app/api/cron/**/*.ts": { "maxDuration": 120 },
    "app/api/pdf/**/*.ts": { "maxDuration": 60 }
  }
}
```

### 📈 Estimation coûts par fonctionnalité

| Fonctionnalité | Coût/opération | Volume estimé | Coût/mois |
|----------------|----------------|---------------|-----------|
| **Stripe payments** | 1.5% + 0.25€ | 100k€ loyers | ~1 750€ |
| **Yousign signatures** | ~1.50€ | 500 signatures | ~750€ |
| **Resend emails** | ~0.001€ | 10k emails | ~10€ |
| **Supabase Pro** | Fixe | - | ~25€ |
| **Vercel Pro** | Fixe | - | ~20€ |
| **Sentry Team** | Fixe | - | ~29€ |
| **Storage Supabase** | 0.021€/GB | 50 GB | ~1€ |
| **OpenAI (scoring)** | ~0.01€/call | 500 calls | ~5€ |
| **Total estimé** | | | **~2 590€/mois** |

### 🚨 Requêtes à risque

```sql
-- 1. Dashboard owner sans pagination
SELECT * FROM properties WHERE owner_id = ?
-- Risque: +100 propriétés = lenteur

-- 2. Historique paiements sans limite
SELECT * FROM payments WHERE lease_id IN (...)
-- Risque: historique long = timeout

-- 3. Analytics sans agrégation
SELECT COUNT(*) FROM invoices GROUP BY DATE(created_at)
-- Risque: scan full table
```

### ✅ Recommandations SOTA 2025

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P1 | Pagination obligatoire partout | 2j | 🟠 |
| P1 | Audit requêtes lentes (pg_stat) | 0.5j | 🟠 |
| P1 | Cache Redis pour données chaudes | 2j | 🟠 |
| P2 | Materialized views pour analytics | 1j | 🟠 |
| P2 | Connection pooling PgBouncer | 1j | 🟡 |
| P2 | Rate limiting par plan | 1j | 🟡 |
| P3 | CDN pour assets statiques | 0.5j | 🟡 |
| P3 | Image optimization (Next.js) | 0.5j | 🟡 |

#### Index manquants recommandés

```sql
-- Index composites pour requêtes fréquentes
CREATE INDEX idx_invoices_lease_status_due 
  ON invoices(lease_id, status, due_date);

CREATE INDEX idx_payments_invoice_status 
  ON payments(invoice_id, status);

CREATE INDEX idx_properties_owner_status_created 
  ON properties(owner_id, status, created_at DESC);

-- Index partiel pour données actives
CREATE INDEX idx_leases_active 
  ON leases(property_id) WHERE status = 'active';
```

---

## 8. Plan d'action prioritaire

### 🔴 Sprint 1 - Fondations (Semaine 1-2)

| # | Action | Fichier/Route | Effort |
|---|--------|---------------|--------|
| 1 | Créer CI/CD GitHub Actions | `.github/workflows/ci.yml` | 1j |
| 2 | Configurer alertes Sentry | Sentry Dashboard | 0.5j |
| 3 | Tester restore Supabase | Procédure documentée | 0.5j |
| 4 | API export RGPD complet | `app/api/privacy/export/` | 2j |
| 5 | Intégrer PostHog analytics | `lib/analytics/posthog.ts` | 2j |

### 🟠 Sprint 2 - Robustesse (Semaine 3-4)

| # | Action | Fichier/Route | Effort |
|---|--------|---------------|--------|
| 6 | Anonymisation cascade RGPD | `app/api/privacy/anonymize/` | 2j |
| 7 | Impersonation admin | `app/api/admin/impersonate/` | 2j |
| 8 | Tracking plan 40+ events | `docs/TRACKING_PLAN.md` | 1j |
| 9 | Pagination généralisée | Services existants | 2j |
| 10 | Logs structurés routes critiques | Routes API | 1j |

### 🟡 Sprint 3 - Optimisation (Semaine 5-6)

| # | Action | Fichier/Route | Effort |
|---|--------|---------------|--------|
| 11 | Registre traitements RGPD | `docs/REGISTRE_TRAITEMENTS.md` | 1j |
| 12 | Cache Redis données chaudes | `lib/cache/` | 2j |
| 13 | Materialized views analytics | Migrations SQL | 1j |
| 14 | Feature flags PostHog | Intégration code | 2j |
| 15 | Backup script automatisé | `scripts/backup-db.sh` | 1j |

---

## 📋 Checklist de conformité

### RGPD

- [ ] Export données utilisateur complet
- [ ] Suppression/anonymisation cascade
- [ ] Registre des traitements
- [ ] DPO désigné
- [ ] Durées de conservation documentées
- [ ] Cookie banner compliant
- [ ] Log accès données personnelles

### Sécurité

- [ ] CI/CD avec tests obligatoires
- [ ] Protection branch main
- [ ] Secrets rotation régulière
- [ ] Audit log toutes actions sensibles
- [ ] Rate limiting API

### Observabilité

- [ ] Alertes erreurs critiques
- [ ] Dashboard métriques business
- [ ] APM traces complètes
- [ ] Synthetics (uptime)

### Scalabilité

- [ ] Pagination obligatoire
- [ ] Cache layer
- [ ] Indexes optimisés
- [ ] Connection pooling

---

## 📚 Ressources

- [PostHog Self-Hosted](https://posthog.com/docs/self-host)
- [CNIL - Guide RGPD](https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on)
- [Sentry Best Practices](https://docs.sentry.io/product/sentry-basics/)
- [Supabase Backup](https://supabase.com/docs/guides/platform/backups)
- [Vercel CI/CD](https://vercel.com/docs/deployments/git)

---

*Document généré le 6 Décembre 2025 - À mettre à jour trimestriellement*
