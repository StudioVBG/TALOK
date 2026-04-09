# Talok — Plan d'actions priorisé
## Issu de l'audit code vs skills — 9 avril 2026

---

## P0 — Bloquant (cette semaine)

### Sécurité
- [ ] Activer RLS sur table `tenants` (données personnelles locataires exposées)
- [ ] Activer RLS sur table `two_factor_sessions` (sessions 2FA exposées)
- [ ] Activer RLS sur `public.lease_notices` (congés avec données sensibles)
- [ ] Vérifier/activer RLS sur `api_webhook_deliveries`

### Feature Gating critique
- [ ] Ajouter vérification `hasAPI` dans middleware des routes /api/v1/* (tout utilisateur peut accéder à l'API REST)
- [ ] Ajouter vérification `hasWorkOrders` dans routes /api/work-orders/*
- [ ] Ajouter vérification `hasEdlDigital` dans routes /api/edl/*
- [ ] Ajouter vérification `hasProvidersManagement` dans routes /api/providers/*
- [ ] Ajouter vérification `hasScoringTenant` dans routes scoring
- [ ] Ajouter vérification `hasOpenBanking` dans routes /api/bank-connect/*
- [ ] Ajouter vérification `maxStorageMB` dans /api/documents/upload

### Données incohérentes
- [ ] Corriger prix dans table `subscription_plans` : 19.90€ → 35€ (Confort), 49.90€ → 69€ (Pro)
- [ ] Aligner grille tarifaire entre talok-context (24,90€/59,90€) et talok-stripe-pricing (35€/69€) — décider du prix officiel

---

## P1 — Important (2 semaines)

### Bugs critiques
- [ ] Corriger /owner/invoices/[id] crash (RangeError date) — appliquer safeDate()
- [ ] Corriger Dashboard Biens=0 Baux=0 — filtre entityId manquant
- [ ] Corriger Tickets chargement infini
- [ ] Corriger Agency signup cassé (schema, trigger DB, redirection callback)
- [ ] Corriger compte bancaire champs en double
- [ ] Corriger /pricing redirect si connecté (middleware)

### Feature Gating suite
- [ ] Ajouter vérification `hasAutoReminders` dans crons relances
- [ ] Ajouter vérification `hasAutoRemindersSMS` dans route SMS
- [ ] Ajouter vérification `hasIRLRevision` dans cron IRL
- [ ] Ajouter vérification `hasRentCollection` dans routes paiement loyer
- [ ] Ajouter vérification `hasMultiEntity` dans routes entités
- [ ] Ajouter vérification `hasWhiteLabel` dans routes whitelabel
- [ ] Créer helper middleware `withPlanCheck(featureName)` réutilisable

### Onboarding
- [ ] Supprimer guided-tour.tsx (doublon avec OnboardingTour.tsx)
- [ ] Ajouter data-tour attrs manquants dans sidebars owner + tenant
- [ ] Corriger police Inter → Manrope dans emails
- [ ] Ajouter logo SVG sur pages auth (TalokLogo component)
- [ ] Ajouter progress bar onboarding Syndic + Agency

### Documents
- [ ] Raccorder CNI recto/verso groupement dans documents-list.tsx
- [ ] Migration SQL pour nettoyer titres anciens documents
- [ ] Implémenter génération PDF bail signé post-signature

---

## P2 — Amélioration (1 mois)

### Agent TALO (module le plus en retard)
- [ ] Créer routes /api/talo/chat (streaming avec Vercel AI SDK)
- [ ] Créer routes /api/talo/conversations (CRUD)
- [ ] Créer routes /api/talo/fiscal/simulate + optimize
- [ ] Créer routes /api/talo/classify + extract
- [ ] Créer routes /api/talo/scoring + scoring/compare
- [ ] Créer pages app/owner/talo/ (chat, scoring, fiscal)
- [ ] Créer composants TaloChatInterface, TaloMessageBubble, TaloInput
- [ ] Créer composants ScoringLauncher, ScoringResultCard, ScoringComparison
- [ ] Créer composants FiscalSimulator, FiscalRecommendation
- [ ] Définir TALO_SYSTEM_PROMPT + SCORING_SYSTEM_PROMPT
- [ ] Implémenter LangGraph tools (get_property_info, get_lease_info, etc.)
- [ ] Ajouter vérification hasAITalo sur toutes les routes TALO
- [ ] Implémenter quotas (500 messages/mois Pro, illimité Enterprise)

### Colocation
- [ ] Implémenter clause de solidarité 6 mois max
- [ ] Implémenter SEPA individuel par colocataire
- [ ] Ajouter flag hasColocation dans PlanLimits (sans modifier plans.ts)

### Garant
- [ ] Créer cron automatique libération garant à 6 mois
- [ ] Ajouter feature gating sur module garant

### Syndic
- [ ] Brancher Stripe metered billing pour facturation par lot copro
- [ ] Compléter UI assemblées générales (votes, résolutions)

### Droits locataire
- [ ] Créer table legal_articles (référentiel juridique)
- [ ] Enrichir page app/tenant/legal-rights/ au-delà des calculateurs
- [ ] Ajouter guides préavis, dépôt de garantie, révision loyer

### Saisonnier
- [ ] Vérifier sync iCal Airbnb/Booking end-to-end
- [ ] Tester calcul taxe séjour complet

### Mobile
- [ ] Vérifier build iOS + Android (capacitor sync)
- [ ] Configurer deep links (apple-app-site-association, assetlinks.json)
- [ ] Tester push notifications end-to-end
- [ ] Vérifier PWA manifest + service worker

---

## P3 — Nice to have (backlog)

### Nettoyage code
- [ ] Supprimer app/auth/reset-password (deprecated → /recovery/password/[requestId])
- [ ] Vérifier si app/login/page.tsx est un doublon
- [ ] Vérifier si table tenant_documents (LEGACY) est encore requise
- [ ] Renommer tables IA pour cohérence avec skills (ai_conversations → talo_conversations)
- [ ] Nettoyer duplicata : public.accounting_accounts vs accounting_entries

### Modules avancés
- [ ] SSO : implémenter hasSSO (SAML/OIDC pour Enterprise XL)
- [ ] Compteurs connectés : finaliser intégration Enedis/GRDF OAuth
- [ ] Assurances : vérification attestation locataire annuelle automatisée
- [ ] Diagnostics : checklist DDT dans la création de bail
- [ ] Sentry : brancher error-boundary (installé mais non branché)
- [ ] PostHog : vérifier tracking analytics complet

### Performance & Qualité
- [ ] Run tsc --noEmit et corriger erreurs TypeScript
- [ ] Auditer usage de `any` dans le codebase
- [ ] Vérifier SSG (generateStaticParams) sur pages marketing
- [ ] Optimiser bundle size (code splitting pages lourdes)

---

## Effort estimé par priorité

| Priorité | Nombre d'actions | Effort estimé |
|----------|-----------------|---------------|
| P0 — Bloquant | 14 | 3-5 jours |
| P1 — Important | 18 | 5-8 jours |
| P2 — Amélioration | 25 | 15-25 jours |
| P3 — Nice to have | 13 | 10-15 jours |
| **Total** | **70** | **33-53 jours** |
