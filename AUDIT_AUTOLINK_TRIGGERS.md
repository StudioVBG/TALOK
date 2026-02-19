# Audit complet des triggers auto-link dans Talok

**Date :** 2026-02-19
**Scope :** Analyse exhaustive de tous les mecanismes d'auto-link (liaison automatique entre entites) dans le codebase Talok.

---

## Table des matieres

1. [Tableau recapitulatif](#1-tableau-recapitulatif)
2. [Triggers auto-link (Database)](#2-triggers-auto-link-database)
3. [Auto-link applicatif (TypeScript)](#3-auto-link-applicatif-typescript)
4. [Triggers de notification](#4-triggers-de-notification)
5. [Triggers de validation et limites](#5-triggers-de-validation-et-limites)
6. [Triggers de comptage et suivi](#6-triggers-de-comptage-et-suivi)
7. [Webhooks avec liaison d'entites](#7-webhooks-avec-liaison-dentites)
8. [Edge Functions avec liaison d'entites](#8-edge-functions-avec-liaison-dentites)
9. [Liaisons directes par INSERT (API Routes)](#9-liaisons-directes-par-insert-api-routes)
10. [Problemes identifies et corrections](#10-problemes-identifies-et-corrections)
11. [Matrice de tests](#11-matrice-de-tests)

---

## 1. Tableau recapitulatif

### A. Triggers Database (auto-link)

| # | Trigger | Source | Cible | Statut | Probleme identifie | Correction proposee |
|---|---------|--------|-------|--------|---------------------|---------------------|
| 1 | `on_auth_user_created` (handle_new_user) | `auth.users` INSERT | `profiles` INSERT | ✅ | V4 corrige: email + EXCEPTION handler + guarantor | -- |
| 2 | `trigger_auto_link_lease_signers` (auto_link_lease_signers_on_profile_created) | `profiles` INSERT | `lease_signers.profile_id` UPDATE + `invitations` UPDATE + `notifications` INSERT | ⚠️ | **Double trigger** potentiel avec #3. Deux triggers AFTER INSERT sur profiles | Supprimer `on_profile_created_auto_link` (ancien trigger) |
| 3 | `on_profile_created_auto_link` (auto_link_signer_profile) | `profiles` INSERT | `lease_signers.profile_id` UPDATE | ❌ | **OBSOLETE** - Version ancienne sans LOWER(), sans invitations, sans notifications. **Risque de double-update** | **SUPPRIMER** ce trigger. Il est remplace par #2 |
| 4 | `trigger_auto_link_on_profile_update` (auto_link_lease_signers_on_profile_email_update) | `profiles` UPDATE OF email | `lease_signers.profile_id` UPDATE | ✅ | Fonctionne correctement pour les mises a jour d'email | -- |
| 5 | `trigger_link_profile_auth` (link_profile_to_auth_user) | `profiles` INSERT/UPDATE | `profiles.user_id` SET (depuis auth.users) | ✅ | Lie un profil sans user_id a un auth.users par email | -- |
| 6 | `trg_create_owner_subscription` (create_owner_subscription) | `profiles` INSERT/UPDATE OF role | `subscriptions` INSERT | ✅ | ON CONFLICT (owner_id) DO NOTHING = idempotent | -- |
| 7 | `auto_activate_lease_on_edl` (trigger_activate_lease_on_edl_signed) | `edl` UPDATE OF status | `leases.statut` UPDATE ('active') | ✅ | Verifie type='entree' et statut cible valide | -- |

### B. Triggers de notification

| # | Trigger | Source | Cible | Statut | Probleme identifie | Correction proposee |
|---|---------|--------|-------|--------|---------------------|---------------------|
| 8 | `trigger_notify_invoice_late` | `invoices` UPDATE | `notifications` INSERT (owner) | ⚠️ | Pas de deduplication si trigger re-declenche | Ajouter check `NOT EXISTS` sur notification recente |
| 9 | `trigger_notify_payment_received` | `payments` INSERT/UPDATE | `notifications` INSERT (owner) | ⚠️ | Idem - pas de check idempotence | Ajouter check `NOT EXISTS` |
| 10 | `trigger_notify_lease_signed` | `leases` UPDATE | `notifications` INSERT (owner) | ⚠️ | Idem | Ajouter check `NOT EXISTS` |
| 11 | `trigger_notify_ticket_created` | `tickets` INSERT | `notifications` INSERT (owner) | ✅ | Verifie owner != creator. Bonne logique | -- |
| 12 | `trigger_notify_ticket_resolved` | `tickets` UPDATE | `notifications` INSERT (creator) | ⚠️ | Pas de check idempotence | Ajouter check `NOT EXISTS` |

### C. Triggers de validation

| # | Trigger | Source | Cible | Statut | Probleme identifie | Correction proposee |
|---|---------|--------|-------|--------|---------------------|---------------------|
| 13 | `check_property_limit_before_insert` | `properties` INSERT | RAISE EXCEPTION si limite depassee | ✅ | Fonctionne. SECURITY DEFINER pour lire subscriptions | -- |
| 14 | `check_lease_limit_before_insert` | `leases` INSERT | RAISE EXCEPTION si limite depassee | ✅ | Fonctionne. Resout owner via properties.owner_id | -- |
| 15 | `validate_lease_before_insert` | `leases` INSERT | RAISE EXCEPTION si property/unit invalide | ✅ | Bonne validation referentielle | -- |
| 16 | `trigger_enforce_2fa_sensitive_roles` | `profiles` INSERT/UPDATE OF role | `profiles.two_factor_required` SET true | ✅ | Pour roles admin | -- |
| 17 | `trigger_prevent_2fa_disable` | `profiles` UPDATE OF two_factor_enabled | RAISE EXCEPTION si required=true | ✅ | Protection correcte | -- |

### D. Triggers de comptage

| # | Trigger | Source | Cible | Statut | Probleme identifie | Correction proposee |
|---|---------|--------|-------|--------|---------------------|---------------------|
| 18 | `trg_update_subscription_properties` | `properties` INSERT/DELETE | `subscriptions.properties_count` UPDATE | ✅ | INSERT +1, DELETE -1 (GREATEST(0,...)) | -- |
| 19 | `trg_update_subscription_leases` | `leases` INSERT/UPDATE/DELETE | `subscriptions.leases_count` UPDATE | ✅ | Recompte via COUNT avec filtre statut | -- |
| 20 | `trg_provider_compliance_update` | `provider_compliance_documents` INSERT/UPDATE/DELETE | `provider_profiles.compliance_score` UPDATE | ✅ | Calcul correct avec expiration | -- |

### E. Auto-link applicatif (TypeScript)

| # | Mecanisme | Source | Cible | Statut | Probleme identifie | Correction proposee |
|---|-----------|--------|-------|--------|---------------------|---------------------|
| 21 | `invitations.service.ts` markInvitationAsUsed | Invitation acceptee | `lease_signers.profile_id` + `invitations.used_by` | ✅ | Retry 2x, auto-link global. Robuste | -- |
| 22 | `tenant/layout.tsx` autoLinkLeaseSigners | Chargement page tenant | `lease_signers.profile_id` | ⚠️ | Execute a **chaque chargement de page**. Performance si beaucoup de tenants | Ajouter un cache/flag pour ne pas re-executer si deja lie |
| 23 | `auth/callback/route.ts` auto-link | Connexion auth | `lease_signers.profile_id` | ✅ | Couvre le cas re-connexion. Bon filet de securite | -- |
| 24 | `api/me/profile/route.ts` POST auto-link | Creation profil fallback | `lease_signers.profile_id` + `invitations.used_at` | ✅ | Unique endroit qui lie aussi les invitations | -- |
| 25 | `api/leases/[id]/roommates/route.ts` | Ajout colocataire | `lease_signers` INSERT (profile_id ou null) | ✅ | Cree signer orphelin si profil absent | -- |

### F. Webhooks avec liaison d'entites

| # | Webhook | Source | Cible | Statut | Probleme identifie | Correction proposee |
|---|---------|--------|-------|--------|---------------------|---------------------|
| 26 | Stripe `/webhooks/stripe` | checkout.session.completed | `payments` INSERT + `invoices` UPDATE + `documents` INSERT | ⚠️ | **Doublon** avec webhook payments (#27) pour payment_intent.succeeded | Unifier ou desactiver un des deux endpoints dans Stripe |
| 27 | Payments `/webhooks/payments` | payment_intent.succeeded | `payments` UPDATE + `invoices` UPDATE + `documents` INSERT | ⚠️ | **Doublon** avec #26. Approche differente (UPDATE vs INSERT) | Voir #26 |
| 28 | Signatures `/signatures/webhook` | signature.completed | `signatures` UPDATE + `lease_signers` UPDATE + `leases` UPDATE | ⚠️ | **Pas d'audit logging**. Pas de deduplication outbox | Ajouter webhook_logs + dedup outbox |
| 29 | Subscriptions `/subscriptions/webhook` | checkout/subscription events | `subscriptions` UPSERT + `subscription_invoices` UPSERT | ⚠️ | **Doublon** avec billing webhook (#30) | Unifier les handlers |
| 30 | Billing `/billing/webhook` | subscription/invoice events | `subscriptions` UPSERT + `subscription_invoices` UPSERT | ⚠️ | **Doublon** avec #29. Cle de conflit differente | Voir #29 |

### G. Triggers updated_at (non-auto-link mais critiques)

| # | Trigger | Table | Statut |
|---|---------|-------|--------|
| 31 | `update_profiles_updated_at` | profiles | ✅ |
| 32 | `update_properties_updated_at` | properties | ✅ |
| 33 | `update_leases_updated_at` | leases | ✅ |
| 34 | `update_lease_signers_updated_at` | lease_signers | ✅ |
| 35 | `update_invoices_updated_at` | invoices | ✅ |
| 36 | `update_payments_updated_at` | payments | ✅ |
| 37 | `update_tickets_updated_at` | tickets | ✅ |
| 38 | `update_work_orders_updated_at` | work_orders | ✅ |
| 39 | `update_documents_updated_at` | documents | ✅ |
| 40 | `trg_documents_search_vector` | documents | ✅ |

---

## 2. Triggers auto-link (Database)

### 2.1. `on_auth_user_created` -> `handle_new_user()`

**Fichier :** `supabase/migrations/20260216300000_fix_auth_profile_sync.sql:32-98`
**Evenement :** AFTER INSERT ON `auth.users`
**Source :** `auth.users` -> **Cible :** `profiles`

**Logique :**
1. Lit `role`, `prenom`, `nom`, `telephone` depuis `raw_user_meta_data`
2. Lit `email` depuis `NEW.email`
3. Valide le role (admin, owner, tenant, provider, guarantor) avec fallback `'tenant'`
4. INSERT INTO profiles avec ON CONFLICT (user_id) DO UPDATE
5. EXCEPTION handler: ne bloque jamais la creation auth

**Evolution :**
| Version | Migration | Ajouts |
|---------|-----------|--------|
| V1 | 20240101000002 | Role hardcode 'tenant' |
| V1.1 | 202502160000 | SET search_path = public |
| V2 | 20260105100001 | Metadata (role, prenom, nom, tel) + ON CONFLICT |
| V3 | 20260212000001 | Role 'guarantor' |
| **V4** | **20260216300000** | **Email + EXCEPTION handler** (version actuelle) |

**Gestion erreurs :** ✅ EXCEPTION WHEN OTHERS - log WARNING, ne bloque pas
**Idempotence :** ✅ ON CONFLICT (user_id) DO UPDATE
**Cascade :** N/A (trigger de creation)
**RLS :** ✅ SECURITY DEFINER (bypass RLS)

---

### 2.2. `trigger_auto_link_lease_signers` -> `auto_link_lease_signers_on_profile_created()`

**Fichier :** `supabase/migrations/20260219100000_auto_link_notify_owner.sql:18-97`
**Evenement :** AFTER INSERT ON `profiles`
**Source :** `profiles` -> **Cible :** `lease_signers`, `invitations`, `notifications`

**Logique :**
1. Recupere l'email depuis `auth.users` via `NEW.user_id`
2. UPDATE `lease_signers` SET `profile_id = NEW.id` WHERE `LOWER(invited_email) = LOWER(user_email)` AND `profile_id IS NULL`
3. Si des signers ont ete lies: cree une notification pour chaque proprietaire concerne
4. UPDATE `invitations` SET `used_by`, `used_at` pour les invitations correspondantes

**Gestion erreurs :** ⚠️ Pas d'EXCEPTION handler (crash = rollback du INSERT profiles)
**Idempotence :** ✅ `WHERE profile_id IS NULL` empeche la double-liaison
**Cascade :** Les lease_signers lies deviennent accessibles via les JOIN sur les baux
**RLS :** ✅ SECURITY DEFINER

**PROBLEME CRITIQUE :** Ce trigger coexiste potentiellement avec `on_profile_created_auto_link` (#2.3). Les deux se declenchent sur INSERT profiles. L'ancien trigger ne fait pas `DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers` et vice-versa dans certains chemins d'application de migrations.

---

### 2.3. `on_profile_created_auto_link` -> `auto_link_signer_profile()` (OBSOLETE)

**Fichier :** `supabase/migrations/20260101000002a_add_invited_email_to_signers.sql:69-73`
**Evenement :** AFTER INSERT ON `profiles`
**Source :** `profiles` -> **Cible :** `lease_signers`

**Logique (simplifiee) :**
1. UPDATE `lease_signers` SET `profile_id = NEW.id, updated_at = NOW()`
2. FROM `auth.users u` WHERE `u.id = NEW.user_id` AND `ls.invited_email = u.email` (CASE-SENSITIVE)
3. AND `ls.profile_id IS NULL`

**Differences avec #2.2 :**
| Aspect | Ancien (#2.3) | Nouveau (#2.2) |
|--------|---------------|----------------|
| Comparaison email | **Case-sensitive** (`=`) | **Case-insensitive** (`LOWER()`) |
| Invitations | Non mises a jour | ✅ Mises a jour (`used_by`, `used_at`) |
| Notifications | Pas de notification | ✅ Notifie les proprietaires |
| Logging | Pas de log | ✅ RAISE NOTICE |
| Guard clause | Pas de check email null | ✅ Return si email NULL |

**VERDICT : ❌ A SUPPRIMER** - Ce trigger est remplace par #2.2 mais pourrait encore etre actif en base.

---

### 2.4. `trigger_auto_link_on_profile_update` -> `auto_link_lease_signers_on_profile_email_update()`

**Fichier :** `supabase/migrations/20260217000000_data_integrity_audit_repair.sql:559-592`
**Evenement :** AFTER UPDATE OF email ON `profiles`
**Source :** `profiles.email` UPDATE -> **Cible :** `lease_signers.profile_id`

**Logique :**
1. Quand l'email d'un profil change, cherche les `lease_signers` orphelins correspondant au nouvel email
2. UPDATE `lease_signers` SET `profile_id = NEW.id` WHERE `LOWER(invited_email) = LOWER(NEW.email)` AND `profile_id IS NULL`

**Gestion erreurs :** Pas d'EXCEPTION handler
**Idempotence :** ✅ `WHERE profile_id IS NULL`
**RLS :** ✅ SECURITY DEFINER

---

### 2.5. `trigger_link_profile_auth` -> `link_profile_to_auth_user()`

**Fichier :** `supabase/migrations/20251204400000_ensure_profiles_email.sql:29-62`
**Evenement :** BEFORE INSERT OR UPDATE ON `profiles`
**Source :** `profiles` -> **Cible :** `profiles.user_id` (auto-set)

**Logique :**
1. Si `NEW.email IS NOT NULL` et `NEW.user_id IS NULL`
2. Cherche dans `auth.users` par email
3. Set `NEW.user_id = auth_user_id`

**Gestion erreurs :** Pas d'EXCEPTION handler
**Idempotence :** ✅ Ne modifie que si user_id est NULL
**RLS :** ✅ SECURITY DEFINER

---

### 2.6. `trg_create_owner_subscription` -> `create_owner_subscription()`

**Fichier :** `supabase/migrations/20251204100000_unified_pricing_plans.sql:270-323`
**Evenement :** AFTER INSERT OR UPDATE OF role ON `profiles` WHEN (NEW.role = 'owner')
**Source :** `profiles` -> **Cible :** `subscriptions`

**Logique :**
1. Cherche le plan 'starter' dans `subscription_plans`
2. INSERT INTO subscriptions avec status 'trialing', trial de 14 jours
3. ON CONFLICT (owner_id) DO NOTHING

**Gestion erreurs :** Pas d'EXCEPTION handler
**Idempotence :** ✅ ON CONFLICT DO NOTHING
**RLS :** ✅ SECURITY DEFINER

---

### 2.7. `auto_activate_lease_on_edl` -> `trigger_activate_lease_on_edl_signed()`

**Fichier :** `supabase/migrations/20260104000001_lease_auto_activation_trigger.sql:5-31`
**Evenement :** AFTER UPDATE OF status ON `edl`
**Source :** `edl` -> **Cible :** `leases`

**Logique :**
1. Si type = 'entree' ET status passe a 'signed'
2. UPDATE leases SET statut = 'active', activated_at = NOW(), entry_edl_id = NEW.id
3. WHERE id = NEW.lease_id AND statut IN ('fully_signed', 'pending_signature', 'partially_signed')

**Gestion erreurs :** Pas d'EXCEPTION handler (rollback si erreur)
**Idempotence :** ✅ Le WHERE filtre les statuts source, donc pas de re-activation
**Cascade :** L'activation du bail declenche `trigger_notify_lease_signed` (#10) et les compteurs de subscription (#19)
**RLS :** ✅ SECURITY DEFINER

---

## 3. Auto-link applicatif (TypeScript)

### 3.1. Invitation acceptance (`invitations.service.ts:100-191`)

**Declencheur :** Tenant accepte une invitation
**Mecanisme :**
1. Marque l'invitation comme utilisee (`invitations.used_by`, `used_at`)
2. Lie le `lease_signers` specifique au bail invite (avec retry 2x, delai 500ms)
3. Auto-link global: lie TOUS les `lease_signers` orphelins pour le meme email (`.ilike()`)

**Gestion erreurs :** ✅ Retry 2x pour le lien specifique, try/catch non-bloquant pour le global
**Idempotence :** ✅ `.is("profile_id", null)` empeche double-liaison
**Performance :** ✅ Requete ciblee, pas de N+1

---

### 3.2. Tenant layout catch-all (`tenant/layout.tsx:16-47`)

**Declencheur :** Chaque chargement d'une page sous `/tenant/*`
**Mecanisme :** Service client (bypass RLS) met a jour tous les `lease_signers` orphelins

**PROBLEME :** Execute a chaque page load. Meme si aucun orphelin n'existe, la requete SELECT est executee. Pour un SaaS avec beaucoup de locataires, cela genere du trafic DB inutile.

**Correction proposee :**
- Ajouter un flag en session/cookie `autolink_done=true` apres la premiere execution
- Ou ne l'executer que dans le callback auth (#3.3)

---

### 3.3. Auth callback (`auth/callback/route.ts:75-98`)

**Declencheur :** Chaque connexion (OAuth, magic link)
**Mecanisme :** Service client lie les orphans. Bon filet de securite.

**Gestion erreurs :** ✅ try/catch non-bloquant
**Idempotence :** ✅ `.is("profile_id", null)`

---

### 3.4. Profile creation fallback (`api/me/profile/route.ts:114-151`)

**Declencheur :** POST /api/me/profile quand le trigger DB n'a pas cree le profil
**Mecanisme :** Lie les `lease_signers` ET les `invitations` non-utilisees

**Gestion erreurs :** ✅ try/catch non-bloquant
**Idempotence :** ✅ `.is("profile_id", null)` et `.is("used_at", null)`

---

## 4. Triggers de notification

### 4.1. `notify_invoice_late()` (invoices UPDATE)

**Fichier :** `supabase/migrations/20251205000001_notification_triggers.sql:87-132`
**Condition :** `NEW.statut = 'late'` AND `OLD.statut != 'late'`
**Notifie :** Proprietaire (via leases -> properties -> owner_id)
**Type :** `payment_late`
**Idempotence :** ⚠️ Si le statut oscille (late -> paid -> late), une nouvelle notification est creee a chaque passage

---

### 4.2. `notify_payment_received()` (payments INSERT/UPDATE)

**Fichier :** `supabase/migrations/20251205000001_notification_triggers.sql:137-181`
**Condition :** `NEW.statut = 'succeeded'` AND `OLD.statut != 'succeeded'`
**Notifie :** Proprietaire
**Type :** `payment_received`
**Idempotence :** ⚠️ INSERT + UPDATE: un paiement insere avec statut 'succeeded' directement declenche le trigger

---

### 4.3. `notify_lease_signed()` (leases UPDATE)

**Fichier :** `supabase/migrations/20251205000001_notification_triggers.sql:186-222`
**Condition :** `NEW.statut = 'active'` AND `OLD.statut != 'active'`
**Notifie :** Proprietaire
**Type :** `lease_signed`

---

### 4.4. `notify_ticket_created()` (tickets INSERT)

**Fichier :** `supabase/migrations/20251205000001_notification_triggers.sql:227-265`
**Condition :** `owner_id IS NOT NULL` AND `owner_id != created_by_profile_id`
**Notifie :** Proprietaire (seulement si c'est pas lui le createur)
**Type :** `ticket_new`
**Idempotence :** ✅ Trigger INSERT only

---

### 4.5. `notify_ticket_resolved()` (tickets UPDATE)

**Fichier :** `supabase/migrations/20251205000001_notification_triggers.sql:270-308`
**Condition :** `NEW.statut IN ('resolved', 'closed')` AND `OLD.statut NOT IN ('resolved', 'closed')`
**Notifie :** Createur du ticket
**Type :** `ticket_resolved`

---

## 5. Triggers de validation et limites

### 5.1. `enforce_property_limit()` (properties BEFORE INSERT)

**Fichier :** `supabase/migrations/20260110500000_subscription_limits_enforcement.sql:9-46`

Verifie que le proprietaire n'a pas atteint sa limite de biens selon son forfait. RAISE EXCEPTION avec ERRCODE 'P0001' et message `SUBSCRIPTION_LIMIT_REACHED`.

Fallback: si pas de subscription, `max_allowed = 1`.

---

### 5.2. `enforce_lease_limit()` (leases BEFORE INSERT)

**Fichier :** `supabase/migrations/20260110500000_subscription_limits_enforcement.sql:51-98`

Meme logique que 5.1 mais pour les baux. Resout l'owner via `properties.owner_id` depuis `NEW.property_id`.

---

### 5.3. `validate_lease_insert()` (leases BEFORE INSERT)

**Fichier :** `supabase/migrations/20260217000000_data_integrity_audit_repair.sql:519-550`

Valide que `NEW.property_id` existe dans `properties` et que `NEW.unit_id` (si present) appartient bien a la bonne property.

---

## 6. Triggers de comptage et suivi

### 6.1. `update_subscription_properties_count()` (properties INSERT/DELETE)

**Fichier :** `supabase/migrations/20241129000001_subscriptions.sql:405-426`

INCREMENT +1 sur INSERT, DECREMENT -1 (GREATEST(0,...)) sur DELETE. Modifie `subscriptions.properties_count`.

---

### 6.2. `update_subscription_leases_count()` (leases INSERT/UPDATE/DELETE)

**Fichier :** `supabase/migrations/20241129000001_subscriptions.sql:429-460`

Recompte via COUNT complet (pas increment/decrement) filtre sur `statut IN ('active', 'pending_signature')`. Plus fiable que l'approche increment.

---

### 6.3. Provider compliance (`provider_compliance_documents` INSERT/UPDATE/DELETE)

**Fichier :** `supabase/migrations/20251205200000_provider_compliance_sota.sql:217-420`

Recalcule le `compliance_score` et le `kyc_status` du prestataire a chaque modification de ses documents.

---

## 7. Webhooks avec liaison d'entites

### 7.1. Stripe Webhook (`/api/webhooks/stripe/route.ts`)

| Evenement | Entites liees | Idempotence |
|-----------|---------------|-------------|
| `checkout.session.completed` | `payments` INSERT, `invoices` UPDATE (paid), `documents` INSERT (quittance) | ⚠️ Pas de check explicite |
| `payment_intent.succeeded` | `payments` INSERT, `invoices` UPDATE | ✅ Check `provider_ref` existant |
| `payment_intent.payment_failed` | `payments` INSERT (failed), `invoices` UPDATE (late) | -- |
| `invoice.paid` | `subscription_invoices` INSERT, `subscriptions` UPDATE | -- |
| `customer.subscription.updated` | `subscriptions` UPDATE | ✅ UPDATE idempotent |
| `customer.subscription.deleted` | `subscriptions` UPDATE (canceled) | ✅ |
| `account.updated` | `stripe_connect_accounts` UPDATE | ✅ |

### 7.2. Payments Webhook (`/api/webhooks/payments/route.ts`)

| Evenement | Entites liees | Idempotence |
|-----------|---------------|-------------|
| `payment_intent.succeeded` | `payments` UPDATE, `invoices` UPDATE, `documents` INSERT | ✅ UPDATE par provider_ref |
| `payment_intent.payment_failed` | `payments` UPDATE (failed) | ✅ |
| `payment_intent.canceled` | `payments` DELETE (pending only) | ✅ |

**PROBLEME :** Les webhooks #7.1 et #7.2 gerent tous les deux `payment_intent.succeeded` avec des approches differentes (INSERT vs UPDATE). Si les deux endpoints sont enregistres dans Stripe, le paiement pourrait etre traite deux fois.

### 7.3. Signatures Webhook (`/api/signatures/webhook/route.ts`)

| Evenement | Entites liees |
|-----------|---------------|
| `signature.completed` | `signatures` UPDATE, `lease_signers` UPDATE, `leases` UPDATE (fully_signed), `outbox` INSERT |
| `signature.failed` | `signatures` UPDATE, `outbox` INSERT |

**PROBLEME :** Pas de `webhook_logs`. Pas de deduplication pour les evenements outbox.

### 7.4. Subscriptions & Billing Webhooks

**PROBLEME :** Deux endpoints separés (`/subscriptions/webhook` et `/billing/webhook`) gerent les memes evenements Stripe (`customer.subscription.*`, `invoice.*`) avec des cles de conflit differentes :
- Subscriptions: `onConflict: "owner_id"`
- Billing: `onConflict: "stripe_subscription_id"`

---

## 8. Edge Functions avec liaison d'entites

### 8.1. `monthly-invoicing`

**Declencheur :** CRON (1er du mois) ou appel manuel
**Entites creees :** `invoices` via RPC `generate_monthly_invoices`, `outbox` events
**Idempotence :** Depend de la fonction SQL (probablement check periode existante)

### 8.2. `bank-sync`

**Declencheur :** Appel API authentifie
**Entites creees :** `bank_connections` INSERT
**Idempotence :** ❌ Pas de deduplication

### 8.3. `process-outbox`

**Declencheur :** CRON ou appel manuel
**Entites creees :** `notifications`, `documents` (receipts), `user_ages`
**Idempotence :** ✅ Marque les events `processing` avant traitement. Retry avec backoff exponentiel.

---

## 9. Liaisons directes par INSERT (API Routes)

### Entites prioritaires

| Relation | Mecanisme | Fichier | Validation |
|----------|-----------|---------|------------|
| **Proprietaire -> Bien** | `properties.owner_id = profile.id` (INSERT) | `api/properties/route.ts:654-657` | ✅ Profile authentifie |
| **Bien -> Bail** | `leases.property_id` (INSERT) | `api/leases/route.ts:412-427` | ✅ `validate_lease_before_insert` trigger |
| **Bail -> Locataire** | `lease_signers` INSERT avec role 'locataire_principal' | `api/leases/route.ts:460-530` | ✅ Profile ou invited_email |
| **Bien -> EDL** | `edl.property_id + edl.lease_id` (INSERT) | `lib/services/edl-creation.service.ts:117-131` | ✅ + auto-injection signatures |
| **Bien -> Ticket** | `tickets.property_id` (INSERT) | `api/tickets/route.ts:235-243` | ✅ Schema Zod |
| **Proprio -> Document** | `documents.owner_id` (INSERT resolue depuis property) | `api/documents/upload/route.ts:150-174` | ✅ |
| **Locataire -> Facture** | `invoices.tenant_id` (resolue via lease_signers) | `api/invoices/route.ts:257-270` | ✅ Dedup par periode |
| **Prestataire -> Intervention** | `work_orders.provider_id` (INSERT) | `api/work-orders/route.ts:56-63` | ✅ + cascade ticket status |
| **Entite juridique -> Bien** | `properties.legal_entity_id` (FK optionnel) | Table schema | ⚠️ Implementation partielle |

---

## 10. Problemes identifies et corrections

### CRITIQUE (P0)

#### P0-1: Double trigger auto-link sur profiles INSERT

**Probleme :** Deux triggers AFTER INSERT sur `profiles` font le meme travail :
- `on_profile_created_auto_link` -> `auto_link_signer_profile()` (ancien, case-sensitive)
- `trigger_auto_link_lease_signers` -> `auto_link_lease_signers_on_profile_created()` (nouveau, case-insensitive + notifications)

Si les deux sont actifs en base, chaque creation de profil execute DEUX updates sur `lease_signers`. Le premier trigger lie les signers (case-sensitive), le second les re-lie (case-insensitive). Le second ne trouvera rien car `profile_id IS NULL` sera deja faux, mais c'est du travail DB inutile.

**Correction :**
```sql
DROP TRIGGER IF EXISTS on_profile_created_auto_link ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_link_signer_profile();
```

#### P0-2: Doublons webhooks Stripe

**Probleme :** `/api/webhooks/stripe/route.ts` et `/api/webhooks/payments/route.ts` gerent les memes evenements (`payment_intent.succeeded`, `payment_intent.payment_failed`).

**Correction :** Verifier la configuration Stripe Dashboard :
- Si UN SEUL endpoint est enregistre : pas de probleme
- Si DEUX endpoints sont enregistres pour les memes evenements : **desactiver l'un des deux**

#### P0-3: Doublons webhooks subscriptions

**Probleme :** `/api/subscriptions/webhook/route.ts` et `/api/billing/webhook/route.ts` gerent les memes evenements avec des cles de conflit differentes.

**Correction :** Fusionner en un seul handler ou s'assurer que seul un endpoint est enregistre dans Stripe.

---

### IMPORTANT (P1)

#### P1-1: Pas d'EXCEPTION handler sur auto_link_lease_signers_on_profile_created

**Probleme :** Si la creation de notification echoue (ex: table notifications n'existe pas, colonne manquante), tout le trigger echoue et la creation du profil est rollback. L'utilisateur ne peut pas s'inscrire.

**Correction :**
```sql
-- Ajouter dans auto_link_lease_signers_on_profile_created():
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link] Erreur non-bloquante: % (SQLSTATE=%)', SQLERRM, SQLSTATE;
  RETURN NEW;
```

#### P1-2: Politique RLS notifications potentiellement conflictuelle

**Probleme :** Deux politiques INSERT pourraient coexister :
- `"System can insert notifications"` avec `WITH CHECK (true)` (de apply_notifications.sql)
- `"notifications_insert_own_or_service"` avec restriction (de batch_pending_04)

La premiere est trop permissive, la seconde plus restrictive. Mais le DROP dans batch_pending_04 cible un nom different (`notifications_insert_system`), donc la politique permissive survit.

**Correction :**
```sql
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
```

#### P1-3: Layout tenant execute auto-link a chaque page load

**Probleme :** `tenant/layout.tsx` execute une requete SELECT + potentiel UPDATE a chaque navigation.

**Correction :** Ajouter un flag dans le profil ou en cookie pour ne l'executer qu'une fois par session.

---

### MINEUR (P2)

#### P2-1: Notifications triggers sans deduplication

**Probleme :** Si un statut oscille (ex: invoice late -> paid -> late), une nouvelle notification est creee a chaque transition.

**Correction :** Ajouter dans chaque trigger notification :
```sql
AND NOT EXISTS (
  SELECT 1 FROM notifications
  WHERE related_id = NEW.id
    AND type = 'payment_late'
    AND created_at > NOW() - INTERVAL '1 hour'
)
```

#### P2-2: Webhook signatures sans audit logging

**Probleme :** Le webhook Yousign n'ecrit pas dans `webhook_logs`.

**Correction :** Ajouter un INSERT dans `webhook_logs` en debut et fin de traitement.

#### P2-3: Entite juridique -> Biens partiellement implementee

**Probleme :** Le FK `properties.legal_entity_id` existe mais pas d'UI "company switcher" complete.

**Impact :** Faible pour l'instant. A completer quand la feature multi-entreprise sera prioritaire.

---

## 11. Matrice de tests

### Tests par trigger

| Test | T1 (handle_new_user) | T2 (auto_link_signers) | T4 (email_update) | T6 (owner_sub) | T7 (edl_activate) |
|------|:--------------------:|:---------------------:|:-----------------:|:--------------:|:-----------------:|
| Declenchement correct | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lien cree correct (bon ID) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pas de doublon si 2x | ✅ ON CONFLICT | ✅ profile_id IS NULL | ✅ IS NULL | ✅ DO NOTHING | ✅ filtre statut |
| Cible n'existe pas | ✅ EXCEPTION | ⚠️ pas d'EXCEPTION | N/A | ⚠️ plan absent | N/A |
| Suppression source | N/A | ⚠️ profiles CASCADE? | N/A | N/A | CASCADE |
| Suppression cible | N/A | SET NULL (FK) | N/A | N/A | CASCADE |
| Performance (N+1) | ✅ single INSERT | ⚠️ FOR LOOP notifications | ✅ single UPDATE | ✅ single INSERT | ✅ single UPDATE |
| RLS policies OK | ✅ SECURITY DEFINER | ✅ SECURITY DEFINER | ✅ SECURITY DEFINER | ✅ SECURITY DEFINER | ✅ SECURITY DEFINER |
| Fonctionne owner | ✅ | ✅ | ✅ | ✅ (trigger cible) | ✅ |
| Fonctionne tenant | ✅ | ✅ (cible principale) | ✅ | N/A | N/A |
| Fonctionne provider | ✅ | ✅ | ✅ | N/A | N/A |

### Tests par webhook

| Test | Stripe | Payments | Signatures | Subscriptions | Billing |
|------|:------:|:--------:|:----------:|:-------------:|:-------:|
| Verification signature | ✅ | ✅ | ✅ HMAC-SHA256 | ✅ | ✅ |
| Idempotence | ⚠️ partielle | ✅ UPDATE | ⚠️ outbox dup | ✅ UPSERT | ✅ UPSERT |
| Entite cible absente | ⚠️ 500 | ⚠️ 500 | ⚠️ 500 | ⚠️ silent skip | ⚠️ 500 |
| Audit logging | ✅ webhook_logs | ❌ absent | ❌ absent | ❌ absent | ✅ audit_log |
| Doublon avec autre webhook | ⚠️ oui (#P0-2) | ⚠️ oui (#P0-2) | -- | ⚠️ oui (#P0-3) | ⚠️ oui (#P0-3) |

### Tests par auto-link applicatif

| Test | invitations.service | tenant/layout | auth/callback | api/me/profile |
|------|:-------------------:|:-------------:|:-------------:|:--------------:|
| Lien correct | ✅ | ✅ | ✅ | ✅ |
| Idempotence | ✅ IS NULL | ✅ IS NULL | ✅ IS NULL | ✅ IS NULL |
| Erreur non-bloquante | ✅ retry+catch | ✅ catch | ✅ catch | ✅ catch |
| Performance | ✅ cible | ⚠️ chaque page | ✅ 1x login | ✅ 1x creation |
| Bypass RLS | ✅ service client | ✅ service client | ✅ service client | ✅ service client |
| Case-insensitive | ✅ ilike | ✅ ilike | ✅ ilike | ✅ ilike |

---

## Synthese des actions prioritaires

| Priorite | Action | Impact | Effort |
|----------|--------|--------|--------|
| **P0** | Supprimer trigger `on_profile_created_auto_link` + fonction `auto_link_signer_profile` | Double-execution, case-sensitivity | 1 migration SQL |
| **P0** | Verifier config Stripe: un seul endpoint par type d'evenement | Double-traitement paiements | Config Stripe Dashboard |
| **P1** | Ajouter EXCEPTION handler a `auto_link_lease_signers_on_profile_created` | Inscription bloquee si erreur notification | 1 migration SQL |
| **P1** | Corriger politique RLS notifications (supprimer l'ancienne permissive) | Securite | 1 migration SQL |
| **P1** | Optimiser auto-link dans tenant/layout.tsx (1x par session) | Performance | 1 modification TS |
| **P2** | Ajouter deduplication aux triggers de notification | Doublons notifications | 1 migration SQL |
| **P2** | Ajouter audit logging au webhook signatures | Tracabilite | 1 modification TS |
| **P2** | Completer implementation entite juridique <-> biens | Feature incomplete | Multi-fichiers |
