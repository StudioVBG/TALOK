# SOTA 2026 — Référence projet TALOK

**Dernière mise à jour :** Février 2026  
**Contexte :** Standard « State of the Art » pour la gestion locative SaaS (France + DROM).

---

## 1. Définition

**SOTA 2026** désigne dans ce projet :

- Les **patterns, conventions et choix techniques** alignés sur l’état de l’art 2026 (Stripe, Notion, Vercel, Linear, concurrents gestion locative).
- Les **évolutions métier et conformité** (ALUR, BIC, DROM, multi-entités, signatures, EDL, outbox).
- La **traçabilité** : comment repérer dans le code et la doc ce qui est considéré « SOTA 2026 ».

Ce document sert de **référence unique** : définition, où taguer, comment auditer, et liens vers les autres docs SOTA.

---

## 2. Quand utiliser le tag « SOTA 2026 » dans le code

Utiliser le commentaire `// SOTA 2026` ou `// ✅ SOTA 2026` pour :

| Contexte | Exemple |
|----------|--------|
| **Sécurité / conformité** | RLS, vérification des permissions, rollback compensatoire, audit log |
| **SSOT / données** | Validation Zod centralisée, champs pré-calculés, source unique de vérité |
| **UX alignée benchmarks** | Toasts, skeletons, célébrations, undo/redo, bottom nav, safe areas |
| **Métier 2026** | Cycle de vie bail (draft → pending_signature → active), EDL digital, signatures, outbox, multi-entités |
| **Performance / robustesse** | Debounce, mutex, invalidation cache ISR, optimistic updates |

À éviter : taguer du code legacy non refactoré ou des détails cosmétiques sans impact métier/UX.

---

## 3. Scores et domaines (résumé)

Issus du [Rapport des Améliorations SOTA 2026](./RAPPORT_AMELIORATIONS_SOTA_2026.md) :

| Domaine | Score | Technologies / patterns clés |
|---------|-------|-----------------------------|
| IA | 98% | GPT-5.2 (3 tiers), LangGraph, RAG, HITL |
| Architecture | 95% | Next.js App Router, Server Components, Edge |
| Sécurité | 92% | WebAuthn/Passkeys, 2FA TOTP, RLS, rate limiting |
| Performance | 90% | React Query v5, streaming, PWA, optimistic updates |
| UX/UI | 88% | Framer Motion, skeletons, celebrations, real-time |
| Paiements | 95% | Stripe Connect, webhooks, idempotency |

---

## 4. Benchmarks et taux de couverture

- **Prompt d’audit :** [audit/prompts/05-benchmarks-sota-2026.md](./audit/prompts/05-benchmarks-sota-2026.md)  
  Compare les écrans TALOK aux leaders (Navigation, Data Display, Feedback, Settings, Gestion locative).
- **Seuils :**
  - \> 85 % : Best-in-class
  - 70–85 % : Compétitif
  - 50–70 % : Lacunes notables
  - \< 50 % : Retard significatif

Remplir la colonne **TALOK** (✅ / ⚠️ / ❌) lors de chaque audit de page pour mettre à jour le taux de couverture.

---

## 5. Documents SOTA 2026

| Document | Description |
|----------|-------------|
| [RAPPORT_AMELIORATIONS_SOTA_2026.md](./RAPPORT_AMELIORATIONS_SOTA_2026.md) | Améliorations déjà intégrées (IA, stack, sécurité, UX) |
| [reports/RAPPORT_ANALYSE_SOTA_2026.md](./reports/RAPPORT_ANALYSE_SOTA_2026.md) | Analyse complète (architecture, données, flux, recommandations) |
| [reports/RAPPORT_ANALYSE_PAGE_BIEN_SOTA_2026.md](./reports/RAPPORT_ANALYSE_PAGE_BIEN_SOTA_2026.md) | Audit ciblé page bien |
| [RAPPORT_FORFAITS_SUBSCRIPTIONS_SOTA_2026.md](./RAPPORT_FORFAITS_SUBSCRIPTIONS_SOTA_2026.md) | Forfaits et abonnements |
| [SOTA-2026-VISIT-SCHEDULING.md](./SOTA-2026-VISIT-SCHEDULING.md) | Planification des visites (stack, BDD, APIs calendrier) |
| [audit/prompts/05-benchmarks-sota-2026.md](./audit/prompts/05-benchmarks-sota-2026.md) | Prompt et grille benchmarks (colonnes TALOK à remplir) |

---

## 6. Zones clés dans le code

- **Baux / signatures :** `app/api/leases/[id]/sign/route.ts`, `LeaseDetailsClient.tsx`, `fetchLeaseDetails.ts`, `LEASE_STATUS_WORKFLOW.md`
- **Validation (SSOT) :** `lib/validations/` (Zod), `lib/validations/lease-financial.ts`
- **Wizard propriété / immeuble :** `features/properties/stores/wizard-store.ts`, `property-wizard-v3.tsx`, `building-units` API
- **EDL / documents :** `lib/services/edl-creation.service.ts`, `app/api/edl/`, RLS `edl_signatures`
- **Paiements / outbox :** `app/api/webhooks/stripe/route.ts`, `supabase/functions/process-outbox/`
- **Résolution locataire :** `lib/helpers/resolve-tenant-display.ts`
- **Types / BDD :** `lib/supabase/database.types.ts`, migrations `*_sota*.sql`, `*_sota2026*.sql`

---

## 7. Checklist rapide (nouveau code / PR)

- [ ] Pas de `.catch()` sur `PostgrestBuilder` Supabase ; utiliser `try/catch` + `await`.
- [ ] Entrées utilisateur et API validées avec Zod (schémas dans `lib/validations` ou domaine).
- [ ] Permissions et RLS : pas de fuite de données cross-tenant/owner.
- [ ] Feedback utilisateur : toast ou message clair en cas d’erreur.
- [ ] Si impact métier « SOTA 2026 » : commentaire `// SOTA 2026` + mise à jour doc si nécessaire.

---

## 8. Évolutions prévues (extensions SOTA)

- Intégration Stripe complète (paiements locataires).
- Yousign / équivalent pour signatures avancées.
- Command palette (⌘K) et quick actions.
- Couverture de tests (Vitest/Playwright) sur les flux critiques.

Pour toute mise à jour de cette référence (nouveaux docs, nouveaux domaines, seuils), mettre à jour la date en en-tête et les tableaux concernés.
