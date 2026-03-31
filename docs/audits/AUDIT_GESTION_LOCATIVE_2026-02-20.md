# Audit Complet — Plateforme de Gestion Locative TALOK

**Date :** 2026-02-20 (mis a jour apres analyse captures d'ecran)
**Plateforme :** Talok (talok.fr)
**Backend :** Supabase (Auth + PostgreSQL)
**Timezone :** America/Martinique (UTC-4)
**Proprietaire :** contact.explore.mq@gmail.com (Marie-Line VOLBERG, SCI ATOMGISTE)
**Scope :** Comptes proprietaire et locataire(s), baux, invitations, EDL

---

## Table des matieres

1. [AXE 1 — Etat des comptes existants](#axe-1--etat-des-comptes-existants)
2. [AXE 2 — Ameliorations appliquees](#axe-2--ameliorations-appliquees)
3. [AXE 3 — Futures creations de comptes](#axe-3--futures-creations-de-comptes)
4. [Annexe A — Requetes SQL de diagnostic](#annexe-a--requetes-sql-de-diagnostic)
5. [Annexe B — Checklist imprimable](#annexe-b--checklist-imprimable)

---

## Architecture relationnelle de reference

```
auth.users (id, email)
  |
  v  [trigger: on_auth_user_created -> handle_new_user()]
profiles (id, user_id -> auth.users.id, role, email, nom, prenom)
  |
  +--[role=owner]-> owner_profiles -> properties (owner_id -> profiles.id)
  |                                     |
  |                                     v
  |                                   leases (property_id -> properties.id)
  |                                     |
  |                                     +-> lease_signers (lease_id, profile_id -> profiles.id)
  |                                     |     role: proprietaire | locataire_principal | colocataire | garant
  |                                     |     invited_email: email avant creation compte
  |                                     |     invited_name: nom avant creation compte
  |                                     |
  |                                     +-> invitations (lease_id, email, token, used_at)
  |                                     |
  |                                     +-> edl (lease_id, type: entree|sortie, status)
  |                                     |
  |                                     +-> invoices (lease_id, owner_id, tenant_id)
  |                                           |
  |                                           +-> payments (invoice_id)
  |
  +--[role=tenant]-> tenant_profiles
```

**Point critique :** La relation bail <-> locataire passe par `lease_signers` (table de jonction), PAS par un `tenant_id` direct sur `leases`. Les colonnes `tenant_email_pending` / `tenant_name_pending` sur `leases` sont des champs transitoires utilises pendant le workflow d'invitation.

---

## RESULTATS — Analyse des captures d'ecran (2026-02-20)

### Bail identifie

| Champ | Valeur |
|-------|--------|
| **Bail ID** | `da2eb9da-1ff1-4020-8682-5f993aa6fde7` |
| **Adresse** | 63 Rue Victor Schoelcher 97200 Fort-de-France |
| **Type** | Habitation (nu) |
| **Loyer** | 35,00 EUR/mois (20,00 EUR HC + 15,00 EUR charges) |
| **Depot de garantie** | 20,00 EUR |
| **Periode** | 09/01/2026 — 08/01/2029 |
| **Bailleur** | SCI ATOMGISTE, representee par Marie-Line VOLBERG |
| **Email bailleur** | contact.explore.mq@gmail.com |
| **Tel bailleur** | +596696614049 |
| **Locataire attendu** | Thomas VOLBERG |
| **Email locataire** | volberg.thomas@hotmail.fr |
| **Tel locataire** | +596696614049 |

### Tableau recapitulatif — Bail da2eb9da

| Element | Liste baux | Detail bail (sidebar) | Contrat PDF | EDL | Statut |
|---------|-----------|----------------------|-------------|-----|--------|
| Nom locataire | Thomas VOLBERG | **"En attente d'invitation"** | **"[En attente de locataire]"** | Thomas VOLBERG | ROUGE |
| Email locataire | volberg.thomas@hotmail.fr | Non affiche | Non affiche | volberg.thomas@hotmail.fr | JAUNE |
| Statut bail | "Signe (Attend EDL)" | "Bail signe par toutes les parties" | "Bail valide (avec recommandations)" | — | JAUNE |
| EDL | — | "Etat des lieux requis" | — | Brouillon (13/02/2026) | JAUNE |
| Assurance | — | "En attente" | — | — | JAUNE |

### 5 incoherences detectees

#### INCOHERENCE 1 — ROUGE : Sidebar "En attente d'invitation" MAIS bail signe

**Constat :**
- La sidebar affiche "En attente d'invitation" + bouton "Inviter un locataire"
- MAIS la checklist affiche "Bail signe par toutes les parties" (coche verte)
- MAIS la liste des baux affiche "Thomas VOLBERG" correctement

**Cause probable (code source) :**
La sidebar dans `LeaseDetailsClient.tsx:1128-1169` affiche "En attente d'invitation" quand `mainTenant` est `null`. Or `mainTenant` est determine a la ligne 271 :
```typescript
const mainTenant = signers?.find((s) => {
  const role = (s.role || '').toLowerCase();
  return role === 'locataire_principal' || role === 'locataire' || role === 'tenant' || role === 'principal';
});
```
Alors que la checklist "Bail signe" ne regarde que `lease.statut` :
```typescript
["fully_signed", "active", "terminated", "archived"].includes(lease.statut)
```

**Diagnostic :** Le `mainTenant` est `null` soit parce que :
1. Le `lease_signers` avec role `locataire_principal` n'existe PAS pour ce bail
2. OU le signers array n'est pas charge correctement (probleme RLS/requete)
3. OU le role stocke en base ne matche pas les valeurs attendues

**Requete SQL de diagnostic :**
```sql
-- Voir TOUS les signataires de ce bail
SELECT
  ls.id, ls.role, ls.signature_status, ls.signed_at,
  ls.profile_id, ls.invited_email, ls.invited_name,
  p.nom AS profile_nom, p.prenom AS profile_prenom, p.email AS profile_email
FROM lease_signers ls
LEFT JOIN profiles p ON ls.profile_id = p.id
WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY ls.role;
```

#### INCOHERENCE 2 — ROUGE : PDF "[En attente de locataire]" MAIS liste montre Thomas VOLBERG

**Constat :**
- Le contrat PDF affiche "Nom et prenom: [En attente de locataire]"
- La recommandation PDF dit "Aucun locataire defini"
- MAIS la liste des baux affiche "Thomas VOLBERG" avec avatar "TV"

**Cause (code source) :**
- La **liste** (`/api/leases/route.ts:238`) resout le nom via `tenantSigner?.profile.prenom + nom`
- Le **PDF** (`/api/leases/[id]/pdf/route.ts:189`) lit aussi `tenantSigner?.profile`
- Le **resolve** (`resolve-tenant-display.ts:49-122`) renvoie "[En attente de locataire]" quand :
  1. `profile.prenom` ET `profile.nom` sont tous deux NULL/vides
  2. ET `invited_name` est NULL/vide
  3. ET `invited_email` est NULL/vide ou placeholder

**Diagnostics differencies :**
- La liste des baux charge les signers via un chemin API different (`GET /api/leases`) avec alias `profile:profiles(...)` - FONCTIONNE
- Le detail du bail charge via `fetchLeaseDetails.ts:307-334` avec `profiles(...)` sans alias, puis mappe manuellement `profiles` -> `profile` - PEUT ECHOUER si le profil n'est pas lie

**Requete SQL de diagnostic :**
```sql
-- Verifier la liaison signer -> profile -> auth.users
SELECT
  ls.id AS signer_id,
  ls.role,
  ls.profile_id,
  ls.invited_email,
  ls.invited_name,
  p.id AS profile_exists,
  p.prenom AS profile_prenom,
  p.nom AS profile_nom,
  p.email AS profile_email,
  p.user_id AS profile_user_id,
  au.email AS auth_email
FROM lease_signers ls
LEFT JOIN profiles p ON ls.profile_id = p.id
LEFT JOIN auth.users au ON p.user_id = au.id
WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';
```

#### INCOHERENCE 3 — JAUNE : EDL montre Thomas VOLBERG mais contrat ne le montre pas

**Constat :**
- L'EDL (onglet detail) affiche : "Le(s) Locataire(s): Nom: Thomas VOLBERG, Email: volberg.thomas@hotmail.fr"
- Mais le contrat PDF dans le meme bail affiche "[En attente de locataire]"

**Cause :** L'EDL stocke les informations locataire AU MOMENT DE SA CREATION (copie dans la table `edl`), alors que le contrat PDF lit EN TEMPS REEL depuis `lease_signers` -> `profiles`. Si le lien `lease_signers.profile_id` est rompu, le PDF ne trouve plus les informations.

#### INCOHERENCE 4 — JAUNE : Meme numero de telephone pour les deux parties

**Constat :**
- Bailleur : +596696614049
- Locataire : +596696614049

**Note :** Cela peut etre intentionnel (lien familial Thomas/Marie-Line VOLBERG) mais merite verification. Si c'est un copier-coller, le locataire n'a pas de vrai numero en base.

#### INCOHERENCE 5 — JAUNE : Date EDL incoherente

**Constat :**
- En-tete EDL : "14 fevrier 2026"
- Liste EDL : "Date prevue: 13/02/2026"
- Statut : Brouillon

**Cause probable :** L'EDL a ete cree le 13/02 (`scheduled_at`) mais la date affichee dans l'en-tete est la date du jour du chargement ou la date de creation reelle (`created_at`), qui peut etre le 14/02.

### Diagnostic global — Cause racine probable

Le probleme CENTRAL est que **le `lease_signers` du locataire principal est deconnecte** :

```
Scenario le plus probable:

1. Marie-Line cree le bail → INSERT lease_signers (role='proprietaire', profile_id=owner)
2. Marie-Line ajoute Thomas → INSERT lease_signers (role='locataire_principal', invited_email='volberg.thomas@hotmail.fr')
3. Thomas signe le bail (via lien invitation) → UPDATE lease.statut = 'fully_signed'
4. MAIS le profile_id du signer locataire n'a PAS ete lie au profil de Thomas

RESULTAT:
- lease_signers row existe avec invited_email + invited_name MAIS profile_id = NULL
- La liste des baux resout le nom via invited_name ou profil → OK
- La sidebar/PDF cherchent le profil lie → ECHEC → "[En attente de locataire]"
```

### Requete SQL corrective prioritaire

```sql
-- ETAPE 1: DIAGNOSTIC — Voir l'etat exact des signers
SELECT
  ls.id AS signer_id,
  ls.role,
  ls.signature_status,
  ls.profile_id,
  ls.invited_email,
  ls.invited_name,
  p.nom AS profile_nom,
  p.prenom AS profile_prenom,
  p.user_id,
  au.email AS auth_email
FROM lease_signers ls
LEFT JOIN profiles p ON ls.profile_id = p.id
LEFT JOIN auth.users au ON p.user_id = au.id
WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY ls.role;

-- ETAPE 2: Chercher le profil de Thomas VOLBERG
SELECT p.id AS profile_id, p.user_id, p.nom, p.prenom, p.email, p.role,
  au.email AS auth_email, au.last_sign_in_at
FROM profiles p
JOIN auth.users au ON p.user_id = au.id
WHERE LOWER(au.email) = LOWER('volberg.thomas@hotmail.fr');

-- ETAPE 3: Si le profil existe, lier le signer (REMPLACER LES IDs)
-- UPDATE lease_signers
-- SET profile_id = '<PROFILE_ID_THOMAS>'
-- WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
--   AND role = 'locataire_principal'
--   AND profile_id IS NULL;

-- ETAPE 4: Verification post-correction
-- SELECT ls.*, p.nom, p.prenom, p.email
-- FROM lease_signers ls
-- LEFT JOIN profiles p ON ls.profile_id = p.id
-- WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';
```

---

## AXE 1 — Etat des comptes existants

### 1.1 Modele de donnees et points de controle

Pour chaque bail, la chaine relationnelle complete doit etre :

```
auth.users (email) -> profiles (user_id) -> lease_signers (profile_id) -> leases (id)
                                                      |
                                              invited_email (avant liaison)
```

#### Points de verification par bail

| # | Point de controle | Table source | Verification |
|---|-------------------|--------------|-------------|
| 1 | Le proprietaire a un compte auth | `auth.users` | email = contact.explore.mq@gmail.com |
| 2 | Le proprietaire a un profil | `profiles` | user_id -> auth.users.id, role='owner' |
| 3 | Le bien existe et est lie au proprietaire | `properties` | owner_id -> profiles.id du proprietaire |
| 4 | Le bail est lie au bien | `leases` | property_id -> properties.id |
| 5 | Le proprietaire est signer | `lease_signers` | lease_id + profile_id + role='proprietaire' |
| 6 | Le locataire est signer | `lease_signers` | lease_id + role='locataire_principal' |
| 7 | Le signer locataire a un profile_id | `lease_signers` | profile_id IS NOT NULL |
| 8 | Le profil locataire a un user_id | `profiles` | user_id IS NOT NULL |
| 9 | L'invitation est acceptee | `invitations` | used_at IS NOT NULL |
| 10 | L'EDL d'entree existe | `edl` | lease_id + type='entree' |

### 1.2 Tableau recapitulatif type (a remplir avec les donnees reelles)

> **IMPORTANT :** Pour obtenir ce tableau rempli, executez la requete Q1 du fichier
> `scripts/audit-rental-platform.sql` dans Supabase Studio > SQL Editor.

| Bail ID (court) | Adresse | Locataire | profile_id | lease_signers | Invitation | EDL | Statut |
|-----------------|---------|-----------|------------|---------------|------------|-----|--------|
| _a remplir_     | _Q1_    | _Q1_      | _Q1_       | _Q1_          | _Q1_       | _Q1_| _Q1_   |

**Legende :**
- VERT : Chaine complete, toutes les FK sont coherentes
- JAUNE : Donnee partielle (signer orphelin, invitation en attente, EDL manquant)
- ROUGE : Rupture de connexion critique (pas de signer, profil sans auth)

### 1.3 Types de ruptures de connexion identifies

#### Type A — Signer orphelin (profile_id NULL)

**Symptome :** Le locataire ne voit pas son bail dans `/tenant/lease`.
**Cause probable :**
1. Le locataire n'a pas encore cree son compte Talok
2. Le locataire a cree son compte avec un email different de celui de l'invitation
3. Le trigger `auto_link_lease_signers_on_profile_created` n'a pas fonctionne (ancien trigger case-sensitive)

**Diagnostic SQL :**
```sql
SELECT ls.id, ls.lease_id, ls.invited_email, ls.invited_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM auth.users au WHERE LOWER(au.email) = LOWER(ls.invited_email)
    ) THEN 'LINKABLE — compte existe'
    ELSE 'EN ATTENTE — pas de compte'
  END AS diagnostic
FROM lease_signers ls
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND ls.invited_email NOT LIKE '%@a-definir%';
```

**Correction SQL (si LINKABLE) :**
```sql
-- D'abord verifier :
SELECT ls.id AS signer_id, p.id AS profile_id, au.email
FROM lease_signers ls
JOIN auth.users au ON LOWER(au.email) = LOWER(ls.invited_email)
JOIN profiles p ON p.user_id = au.id
WHERE ls.profile_id IS NULL;

-- Puis corriger :
UPDATE lease_signers ls
SET profile_id = p.id
FROM auth.users au
JOIN profiles p ON p.user_id = au.id
WHERE LOWER(au.email) = LOWER(ls.invited_email)
  AND ls.profile_id IS NULL;
```

#### Type B — Profil sans compte auth (user_id NULL)

**Symptome :** Le locataire ne peut pas se connecter, ou le profil n'est pas affiche dans le sidebar.
**Cause probable :** Le profil a ete cree manuellement (INSERT direct) sans le trigger `handle_new_user`.

**Diagnostic SQL :**
```sql
SELECT p.id, p.email, p.nom, p.prenom, p.role, p.user_id
FROM profiles p
WHERE p.user_id IS NULL AND p.role = 'tenant';
```

**Correction SQL :**
```sql
-- Verifier d'abord si un auth.users existe avec le meme email
SELECT p.id AS profile_id, p.email, au.id AS auth_id
FROM profiles p
JOIN auth.users au ON LOWER(au.email) = LOWER(p.email)
WHERE p.user_id IS NULL;

-- Corriger :
UPDATE profiles p
SET user_id = au.id
FROM auth.users au
WHERE LOWER(au.email) = LOWER(p.email)
  AND p.user_id IS NULL;
```

#### Type C — Invitation bloquee

**Symptome :** Le locataire a recu l'email mais le lien ne fonctionne plus.
**Cause probable :** Token expire (par defaut quelques jours), ou invitation deja marquee used_at sans que le lien lease_signers ait ete fait.

**Diagnostic SQL :**
```sql
SELECT inv.id, inv.email, inv.lease_id, inv.expires_at, inv.used_at,
  CASE
    WHEN inv.used_at IS NOT NULL THEN 'UTILISEE'
    WHEN inv.expires_at < NOW() THEN 'EXPIREE'
    ELSE 'ACTIVE'
  END AS statut
FROM invitations inv
WHERE inv.used_at IS NULL
ORDER BY inv.created_at DESC;
```

**Action :** Re-envoyer l'invitation depuis l'interface proprietaire (un nouveau token est genere).

#### Type D — Incoherence email invite vs email profil

**Symptome :** Le signer est lie a un profil, mais les emails ne correspondent pas.
**Cause probable :** Le locataire a change son email apres l'invitation.

**Diagnostic SQL :**
```sql
SELECT ls.invited_email, ten.email AS profile_email, au.email AS auth_email,
  ls.lease_id
FROM lease_signers ls
JOIN profiles ten ON ls.profile_id = ten.id
LEFT JOIN auth.users au ON ten.user_id = au.id
WHERE ls.invited_email IS NOT NULL
  AND LOWER(ls.invited_email) != LOWER(COALESCE(au.email, ten.email, ''));
```

### 1.4 Verification specifique — Proprietaire Marie-Line VOLBERG

```sql
-- Compte proprietaire
SELECT au.id, au.email, au.created_at, au.last_sign_in_at,
  p.id AS profile_id, p.role, p.nom, p.prenom,
  op.type AS owner_type, op.siret
FROM auth.users au
JOIN profiles p ON p.user_id = au.id
LEFT JOIN owner_profiles op ON op.profile_id = p.id
WHERE au.email = 'contact.explore.mq@gmail.com';

-- Biens du proprietaire
SELECT pr.id, pr.adresse_complete, pr.code_postal, pr.ville,
  pr.type, pr.surface, pr.unique_code
FROM properties pr
JOIN profiles p ON pr.owner_id = p.id
JOIN auth.users au ON p.user_id = au.id
WHERE au.email = 'contact.explore.mq@gmail.com';

-- Baux du proprietaire avec locataires
SELECT l.id AS bail_id, l.type_bail, l.statut, l.loyer, l.date_debut,
  pr.adresse_complete,
  ls.invited_email, ls.invited_name, ls.profile_id,
  ls.signature_status,
  ten.nom AS tenant_nom, ten.prenom AS tenant_prenom, ten.email AS tenant_email
FROM leases l
JOIN properties pr ON l.property_id = pr.id
JOIN profiles own ON pr.owner_id = own.id
JOIN auth.users au ON own.user_id = au.id
LEFT JOIN lease_signers ls ON ls.lease_id = l.id
  AND ls.role IN ('locataire_principal', 'colocataire')
LEFT JOIN profiles ten ON ls.profile_id = ten.id
WHERE au.email = 'contact.explore.mq@gmail.com'
ORDER BY l.created_at DESC;
```

---

## AXE 2 — Ameliorations appliquees

### 2.1 Historique des corrections (migrations recentes)

| Date | Migration | Description | Statut |
|------|-----------|-------------|--------|
| 2026-02-16 | `20260216200000` | Trigger `auto_link_lease_signers_on_profile_created` (AFTER INSERT profiles) — lie automatiquement les signers orphelins quand un tenant cree son compte | Applique |
| 2026-02-16 | `20260216300000` | Fix `handle_new_user` V4 — email + EXCEPTION handler + role guarantor | Applique |
| 2026-02-17 | `20260217000000` | Audit & reparation integrite relationnelle complete — table `_repair_log`, backfill emails, lien signers orphelins, FK manquantes | Applique |
| 2026-02-19 | `20260219100000` | Auto-link enrichi avec notifications proprietaire quand le locataire cree son compte | Applique |
| 2026-02-19 | `20260219200000` | Fix audit triggers — suppression trigger obsolete `on_profile_created_auto_link`, ajout EXCEPTION handler, deduplication notifications | Applique |
| 2026-02-20 | `20260220000000` | Trigger `auto_link_signer_on_insert` (BEFORE INSERT lease_signers) — lien immediat si le locataire a deja un compte quand le bail est cree + RPC `find_profile_by_email` | Applique |

### 2.2 Triggers auto-link en place (etat actuel)

| # | Trigger | Evenement | Fonction | Etat |
|---|---------|-----------|----------|------|
| 1 | `on_auth_user_created` | AFTER INSERT `auth.users` | `handle_new_user()` V4 | ACTIF — cree profil avec email + metadata |
| 2 | `trigger_link_profile_auth` | BEFORE INSERT/UPDATE `profiles` | `link_profile_to_auth_user()` | ACTIF — lie user_id par email si NULL |
| 3 | `trigger_auto_link_lease_signers` | AFTER INSERT `profiles` | `auto_link_lease_signers_on_profile_created()` | ACTIF — lie signers orphelins + notifie owner |
| 4 | `trigger_auto_link_signer_on_insert` | BEFORE INSERT `lease_signers` | `auto_link_signer_on_insert()` | ACTIF — lien immediat a la creation |
| 5 | `trigger_auto_link_on_profile_update` | AFTER UPDATE OF email `profiles` | `auto_link_on_profile_email_update()` | ACTIF — reliaison si email change |
| 6 | `on_profile_created_auto_link` | (OBSOLETE) | `auto_link_signer_profile()` | **SUPPRIME** (20260219200000) |

### 2.3 Points d'auto-link applicatifs (TypeScript)

| # | Mecanisme | Declencheur | Fichier |
|---|-----------|-------------|---------|
| 1 | Invitation acceptance | POST /api/invitations/accept | `app/api/invitations/accept/route.ts` |
| 2 | Auth callback catch-all | Chaque connexion | `app/auth/callback/route.ts` |
| 3 | Profile creation fallback | POST /api/me/profile | `app/api/me/profile/route.ts` |
| 4 | Tenant layout catch-all | Page load /tenant/* | `app/tenant/layout.tsx` (optimise: 1x/session) |

### 2.4 Verification post-corrections

Requete SQL pour verifier que les corrections n'ont pas cree de doublons :

```sql
-- Doublons lease_signers apres corrections
SELECT lease_id, profile_id, COUNT(*) AS cnt
FROM lease_signers
WHERE profile_id IS NOT NULL
GROUP BY lease_id, profile_id
HAVING COUNT(*) > 1;

-- Doublons profils par user_id
SELECT user_id, COUNT(*) AS cnt
FROM profiles
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Repair log resume
SELECT table_name, action, COUNT(*) AS nb_operations
FROM _repair_log
GROUP BY table_name, action
ORDER BY table_name, action;
```

### 2.5 Comparaison avant/apres

| Metrique | Avant (pre-migrations) | Apres (post-migrations) | Verification |
|----------|----------------------|------------------------|-------------|
| Trigger case-sensitive | `=` (exact) | `LOWER(TRIM())` (insensible) | Q8 |
| Double trigger INSERT profiles | 2 triggers concurrents | 1 seul trigger (`trigger_auto_link_lease_signers`) | Q9 |
| EXCEPTION handler auto-link | Absent (crash = rollback signup) | Present (ne bloque jamais) | Q8 |
| Auto-link a l'INSERT signer | Absent (seulement apres signup) | BEFORE INSERT trigger | Q8 |
| Notification owner sur signup tenant | Absente | Notification automatique | Q8 |
| RPC find_profile_by_email | Absent (listUsers admin API) | RPC SECURITY DEFINER | Code |
| Deduplication notifications | Absente | Fenetre 1h de deduplication | Q8 |
| Layout tenant auto-link | Chaque page load | 1x par session (cookie) | Code |

---

## AXE 3 — Futures creations de comptes

### 3.1 Workflow complet etape par etape

```
ETAPE 1: CREATION DU BIEN (si nouveau)
  Owner: /owner/properties/new
  -> INSERT properties (owner_id = profil proprietaire)
  -> Verification: property_id retourne, owner_id correct

ETAPE 2: CREATION DU BAIL
  Owner: /owner/leases/new (ou /api/leases/invite)
  -> INSERT leases (property_id, type_bail, loyer, charges, dates)
  -> INSERT lease_signers (lease_id, profile_id=owner, role='proprietaire')
  -> Status bail: 'draft' ou 'pending_signature'
  -> Verification: bail cree, signer owner present

ETAPE 3: AJOUT LOCATAIRE AU BAIL
  Cas A — Locataire avec compte existant :
    -> RPC find_profile_by_email(email) retourne le profil
    -> INSERT lease_signers (lease_id, profile_id=tenant, role='locataire_principal')
    -> Le trigger auto_link_signer_on_insert lie immediatement
    -> Notification in-app au locataire

  Cas B — Locataire sans compte :
    -> INSERT lease_signers (lease_id, profile_id=NULL, invited_email, invited_name, role='locataire_principal')
    -> INSERT invitations (email, lease_id, token, expires_at)
    -> Envoi email d'invitation via Resend (sendLeaseInviteEmail)
    -> Le locataire est en attente

ETAPE 4: INSCRIPTION DU LOCATAIRE (Cas B seulement)
  Locataire: clique sur le lien email -> /signature/{token}
  -> Validation token (GET /api/invitations/validate)
  -> Inscription (si pas de compte) -> auth.users INSERT
  -> Trigger handle_new_user -> INSERT profiles
  -> Trigger auto_link_lease_signers -> UPDATE lease_signers (profile_id)
  -> Trigger auto_link -> UPDATE invitations (used_at, used_by)
  -> Notification owner "Locataire inscrit"

ETAPE 5: SIGNATURE DU BAIL
  Les deux parties signent via /signature/{session}
  -> UPDATE lease_signers.signature_status = 'signed'
  -> Quand tous signes: UPDATE leases.statut = 'fully_signed'
  -> Generation PDF signe (pdf_signed_url)

ETAPE 6: EDL D'ENTREE
  -> INSERT edl (lease_id, type='entree')
  -> Realisation de l'EDL (pieces, photos, commentaires)
  -> UPDATE edl.status = 'signed'
  -> Trigger auto_activate_lease_on_edl -> UPDATE leases.statut = 'active'

ETAPE 7: BAIL ACTIF
  -> Facturation mensuelle automatique (edge function monthly-invoicing)
  -> Le locataire voit son bail dans /tenant/lease
  -> Le proprietaire voit le bail dans /owner/leases
```

### 3.2 Checklist de verification pre-creation

#### Pour chaque nouveau locataire :

```
[ ] 1. VERIFIER: Le compte auth existe-t-il deja ?
      SELECT id, email FROM auth.users
      WHERE LOWER(email) = LOWER('<EMAIL_LOCATAIRE>');

[ ] 2. VERIFIER: Un profil existe-t-il deja ?
      SELECT id, user_id, role, email, nom FROM profiles
      WHERE LOWER(email) = LOWER('<EMAIL_LOCATAIRE>')
         OR user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = LOWER('<EMAIL_LOCATAIRE>'));

[ ] 3. VERIFIER: Existe-t-il deja un bail actif pour ce bien ?
      SELECT l.id, l.statut, l.date_debut, l.date_fin
      FROM leases l
      WHERE l.property_id = '<PROPERTY_ID>'
        AND l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed');

[ ] 4. VERIFIER: L'email est-il bien orthographie ?
      (Pas de faute de frappe, domaine valide, pas d'accent)

[ ] 5. PREPARER: Informations requises
      - Nom complet du locataire
      - Email du locataire (sera utilise pour le compte)
      - Telephone (optionnel)
      - Type de bail (nu, meuble, etudiant, colocation, etc.)
      - Loyer mensuel (HC)
      - Charges forfaitaires
      - Depot de garantie
      - Date de debut
      - Date de fin (si CDD)
```

#### Pour chaque nouveau bail :

```
[ ] 1. Le bien est cree et publie dans Talok
[ ] 2. Le DPE est valide (pas classe G si logement)
[ ] 3. Le proprietaire est bien le signer 'proprietaire'
[ ] 4. Le locataire est ajoute avec le BON email
[ ] 5. L'invitation a ete envoyee (verifier dans les logs email)
[ ] 6. Attendre la creation du compte locataire
[ ] 7. Verifier l'auto-link (lease_signers.profile_id non NULL)
[ ] 8. Verifier la signature (les deux parties)
[ ] 9. Verifier le PDF genere
[ ] 10. Creer l'EDL d'entree
[ ] 11. Verifier l'activation du bail (statut = 'active')
```

### 3.3 Points de controle a chaque etape

| Etape | Point de controle | Requete SQL de verification |
|-------|-------------------|---------------------------|
| Apres creation bail | Le bail existe avec le bon property_id | `SELECT id, statut, property_id FROM leases WHERE id = '<BAIL_ID>';` |
| Apres ajout signer owner | Le signer owner est present | `SELECT id, role, profile_id FROM lease_signers WHERE lease_id = '<BAIL_ID>' AND role = 'proprietaire';` |
| Apres ajout signer tenant | Le signer tenant est present (profile_id ou invited_email) | `SELECT id, role, profile_id, invited_email FROM lease_signers WHERE lease_id = '<BAIL_ID>' AND role = 'locataire_principal';` |
| Apres envoi invitation | L'invitation existe et n'est pas expiree | `SELECT id, email, expires_at, used_at FROM invitations WHERE lease_id = '<BAIL_ID>';` |
| Apres inscription tenant | Le profil est lie au signer | `SELECT ls.profile_id, p.user_id, p.email FROM lease_signers ls JOIN profiles p ON ls.profile_id = p.id WHERE ls.lease_id = '<BAIL_ID>' AND ls.role = 'locataire_principal';` |
| Apres signature | Les deux parties ont signe | `SELECT role, signature_status, signed_at FROM lease_signers WHERE lease_id = '<BAIL_ID>';` |
| Apres EDL | Le bail est active | `SELECT l.statut, e.status AS edl_status FROM leases l LEFT JOIN edl e ON e.lease_id = l.id AND e.type = 'entree' WHERE l.id = '<BAIL_ID>';` |

### 3.4 Requetes SQL correctives en cas de probleme

#### Probleme: Le locataire a cree son compte mais le signer n'est pas lie

```sql
-- 1. DIAGNOSTIQUER
SELECT
  ls.id AS signer_id, ls.invited_email,
  p.id AS profile_id, au.email AS auth_email
FROM lease_signers ls
CROSS JOIN LATERAL (
  SELECT p2.id FROM profiles p2
  JOIN auth.users au2 ON p2.user_id = au2.id
  WHERE LOWER(au2.email) = LOWER(ls.invited_email)
  LIMIT 1
) p
JOIN auth.users au ON au.email = ls.invited_email
WHERE ls.profile_id IS NULL AND ls.lease_id = '<BAIL_ID>';

-- 2. CORRIGER (remplacer les IDs)
UPDATE lease_signers
SET profile_id = '<PROFILE_ID>'
WHERE id = '<SIGNER_ID>' AND profile_id IS NULL;
```

#### Probleme: L'invitation est expiree

```sql
-- Action: re-creer l'invitation depuis l'interface owner
-- OU manuellement (derniere option):
UPDATE invitations
SET expires_at = NOW() + INTERVAL '7 days',
    token = encode(gen_random_bytes(32), 'hex')
WHERE lease_id = '<BAIL_ID>' AND used_at IS NULL;
```

#### Probleme: Le bail est fully_signed mais pas active (EDL manquant)

```sql
-- Verifier qu'un EDL d'entree existe
SELECT id, type, status FROM edl WHERE lease_id = '<BAIL_ID>';

-- Si pas d'EDL, activer manuellement le bail (si EDL fait hors plateforme)
-- ATTENTION: cette action est irreversible
UPDATE leases
SET statut = 'active', activated_at = NOW()
WHERE id = '<BAIL_ID>' AND statut = 'fully_signed';
```

### 3.5 Prevention des ruptures futures

| Risque | Mecanisme de prevention en place | Verification |
|--------|----------------------------------|-------------|
| Signer orphelin apres signup | Trigger `trigger_auto_link_lease_signers` (AFTER INSERT profiles) | Auto |
| Signer orphelin a la creation | Trigger `trigger_auto_link_signer_on_insert` (BEFORE INSERT lease_signers) | Auto |
| Email case-sensitive | Tous les triggers utilisent `LOWER(TRIM())` | Auto |
| Crash signup sur erreur auto-link | EXCEPTION handler dans le trigger | Auto |
| Double-link | Clause `WHERE profile_id IS NULL` dans tous les triggers | Auto |
| Invitation expiree | Token regenerable depuis l'interface owner | Manuel |
| Double trigger sur profiles | Ancien trigger `on_profile_created_auto_link` supprime | Fait |

---

## Annexe A — Requetes SQL de diagnostic

Toutes les requetes sont disponibles dans le fichier :
**`scripts/audit-rental-platform.sql`**

### Requetes cles :

| # | Requete | Description |
|---|---------|-------------|
| Q1 | Tableau recapitulatif par bail | Vue d'ensemble avec statut VERT/JAUNE/ROUGE |
| Q2 | Coherence texte vs FK | Verifie invited_email vs profile.email |
| Q3a | Signers orphelins | profile_id NULL avec email valide |
| Q3b | Profils sans auth | user_id NULL ou invalide |
| Q3c | Invitations bloquees | Non utilisees, expirees ou en attente |
| Q4 | Verification EDL/contrat | Compare bail, signataires et EDL |
| Q5 | Doublons potentiels | Baux, signataires et profils en double |
| Q6 | Dates incoherentes | date_fin < date_debut, dates suspectes |
| Q7 | Journal des reparations | Contenu de _repair_log |
| Q8 | Triggers actifs | Verification post-corrections |
| Q9 | Trigger obsolete | Verifie suppression du double trigger |
| Q10 | Check integrite global | Appel check_data_integrity() |
| Q11-12 | Pre-creation | Verification compte/profil existant |
| Q13-14 | Post-creation | Verification chaine complete bail/locataire |

### Execution rapide (copier-coller dans SQL Editor) :

```sql
-- Diagnostic complet en une commande
SELECT * FROM check_data_integrity();
```

---

## Annexe B — Checklist imprimable

### Checklist creation nouveau bail + locataire

```
PREPARATION
  [ ] Email du locataire verifie (pas de faute)
  [ ] Pas de compte existant avec cet email (ou compte confirme)
  [ ] Bien cree dans Talok avec DPE valide
  [ ] Pas de bail actif en cours sur ce bien
  [ ] Informations bail preparees (loyer, charges, dates, type)

CREATION
  [ ] Bail cree via l'interface owner
  [ ] Type de bail correct
  [ ] Loyer et charges corrects
  [ ] Dates de debut/fin correctes
  [ ] Signer proprietaire ajoute automatiquement

INVITATION LOCATAIRE
  [ ] Email locataire saisi dans le formulaire
  [ ] Nom locataire saisi
  [ ] Invitation envoyee (verifier reception email)
  [ ] Signer cree dans lease_signers (avec invited_email)
  [ ] Invitation cree dans invitations (avec token)

APRES INSCRIPTION LOCATAIRE
  [ ] Le locataire a cree son compte
  [ ] Le profil est lie au signer (profile_id non NULL)
  [ ] L'invitation est marquee used_at
  [ ] Le locataire voit son bail dans /tenant/lease
  [ ] Le proprietaire voit le locataire dans la sidebar

SIGNATURE
  [ ] Le proprietaire a signe
  [ ] Le locataire a signe
  [ ] Le bail est en statut fully_signed
  [ ] Le PDF signe est genere

EDL ET ACTIVATION
  [ ] EDL d'entree cree
  [ ] EDL complete (pieces, photos, compteurs)
  [ ] EDL signe par les deux parties
  [ ] Le bail passe en statut 'active'
  [ ] La facturation mensuelle est activee

VERIFICATION FINALE
  [ ] SELECT * FROM check_data_integrity();
  [ ] Aucun orphelin dans lease_signers
  [ ] Aucun doublon dans lease_signers
  [ ] Le locataire accede a son tableau de bord
  [ ] Le proprietaire voit le bail actif
```

---

## Conclusion et prochaines etapes

### Ce qui fonctionne bien :
1. Les triggers auto-link couvrent 4 points d'entree (signup, login, page load, creation signer)
2. Tous les comparaisons email sont case-insensitive (`LOWER(TRIM())`)
3. Les EXCEPTION handlers empechent le blocage du signup en cas d'erreur
4. La notification automatique au proprietaire quand le locataire s'inscrit
5. La fonction `check_data_integrity()` permet un diagnostic rapide

### Actions en attente :
1. **Fournir les captures d'ecran** de l'interface Talok et/ou les resultats des requetes SQL pour remplir le tableau AXE 1
2. **Verifier la configuration Stripe** (un seul webhook par type d'evenement)
3. **Executer les requetes Q1 a Q6** dans Supabase Studio pour obtenir l'etat reel des donnees

### Pour les prochaines sessions :
- Fournir les captures d'ecran de : sidebar proprietaire, liste des baux, detail d'un bail, contrat PDF, EDL
- Fournir les resultats de `SELECT * FROM check_data_integrity();`
- Pour chaque nouveau locataire a creer : nom, email, bien concerne
