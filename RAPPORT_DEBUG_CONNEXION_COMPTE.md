# RAPPORT DE DEBUG - Connexion Compte Proprietaire & Analyse Locataire

**Date :** 2026-02-21
**Branche :** `claude/debug-account-connection-PCBjo`

---

## TABLE DES MATIERES

1. [Architecture Globale](#1-architecture-globale)
2. [Connexion Backend / Frontend](#2-connexion-backend--frontend)
3. [Compte Proprietaire - Problemes de connexion](#3-compte-proprietaire---problemes-de-connexion)
4. [Compte Locataire - Donnees et gestion](#4-compte-locataire---donnees-et-gestion)
5. [Bugs de Routes identifies](#5-bugs-de-routes-identifies)
6. [Bugs de Gestion identifies](#6-bugs-de-gestion-identifies)
7. [Recommandations et Correctifs](#7-recommandations-et-correctifs)

---

## 1. ARCHITECTURE GLOBALE

| Composant | Technologie |
|-----------|-------------|
| Frontend | Next.js 14 (App Router) + React 18 + Tailwind CSS |
| Backend | Next.js API Routes + Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT + cookies) |
| State | Zustand + React Query (TanStack) |
| Deploiement | Netlify |

**Le backend et le frontend sont dans le meme projet Next.js.** Il n'y a pas de serveur backend separe. Les routes API (`/app/api/*`) servent de backend et communiquent directement avec Supabase.

### Flux de connexion

```
Utilisateur -> Middleware (Edge) -> Layout (Server Component) -> Page (Client Component)
                  |                      |
            Cookie check           Auth + Profile check
            (leger)                (fort, via Supabase)
                  |                      |
              Public?              Role check ->  Redirect si mauvais role
              Oui -> pass          Owner? -> /owner/dashboard
              Non -> /auth/signin  Tenant? -> /tenant/dashboard
```

---

## 2. CONNEXION BACKEND / FRONTEND

### 2.1 Le Backend est-il connecte au Frontend ?

**OUI, mais avec des failles dans la chaine de connexion.**

Le frontend communique avec le backend de 3 manieres :

| Methode | Usage | Fichier |
|---------|-------|---------|
| **Server Components** | Layouts (owner, tenant) chargent les donnees directement | `app/owner/layout.tsx`, `app/tenant/layout.tsx` |
| **API Client (fetch)** | Composants client appellent `/api/*` | `lib/api-client.ts` |
| **Supabase Client** | Appels directs a Supabase (RPC, queries) | `lib/supabase/client.ts` |

### 2.2 Chaine d'authentification

```
1. SignUp -> Supabase Auth -> Trigger handle_new_user -> profiles table
2. SignIn -> Cookie session -> Middleware check -> Layout auth check -> Page render
3. API call -> Bearer token ou Cookie -> getAuthenticatedUser() -> Response
```

### 2.3 Points de rupture identifies

| Point | Probleme | Impact |
|-------|----------|--------|
| Trigger `handle_new_user` | Ne cree PAS `owner_profiles` | Le profil proprietaire est incomplet |
| Auth callback | Boucle d'onboarding infinie possible | L'owner ne peut jamais acceder au dashboard |
| Sign-in form | Pas de creation auto du profil si absent | Ecran blanc si profil manquant |
| Middleware | Verifie uniquement la presence du cookie (pas la validite) | Faux positifs possibles |

---

## 3. COMPTE PROPRIETAIRE - PROBLEMES DE CONNEXION

### 3.1 BUG CRITIQUE #1 : Le trigger `handle_new_user` ne cree pas `owner_profiles`

**Fichier :** `supabase/migrations/20260105100001_fix_handle_new_user_with_metadata.sql`

**Probleme :** Quand un proprietaire s'inscrit, le trigger SQL `handle_new_user` insere une ligne dans `profiles` mais **PAS** dans `owner_profiles`.

```sql
-- Ce qui est fait :
INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone);

-- Ce qui MANQUE :
-- INSERT INTO public.owner_profiles (profile_id, type, usage_strategie)
-- VALUES (new_profile_id, 'particulier', 'habitation_only');
```

**Consequence :** La table `owner_profiles` reste vide. Toute requete qui joint `profiles` avec `owner_profiles` retourne NULL pour le proprietaire. Les pages qui dependent de `owner_profiles` (facturation, IBAN, TVA, SIRET) sont inaccessibles ou affichent des erreurs.

### 3.2 BUG CRITIQUE #2 : Boucle d'onboarding infinie

**Fichier :** `app/auth/callback/route.ts` (lignes 60-71)

**Probleme :** Apres confirmation d'email, le callback verifie `onboarding_completed_at`:

```typescript
if (!profileData?.onboarding_completed_at) {
  switch (profileData.role) {
    case "owner":
      return NextResponse.redirect(new URL("/signup/plan?role=owner", origin));
```

Si `onboarding_completed_at` n'est JAMAIS defini (bug dans l'etape finale d'onboarding), le proprietaire est **redirige en boucle** vers `/signup/plan` a chaque connexion.

**Etapes d'onboarding du proprietaire :**
```
/signup/plan -> /owner/onboarding/profile -> /owner/onboarding/finance
-> /owner/onboarding/property -> /owner/onboarding/review -> MARK COMPLETED -> /owner/dashboard
```

Si l'etape `/owner/onboarding/review` ne marque pas `onboarding_completed_at` correctement, le proprietaire ne pourra JAMAIS acceder au dashboard.

### 3.3 BUG CRITIQUE #3 : Sign-in sans creation auto du profil

**Fichier :** `features/auth/components/sign-in-form.tsx` (lignes 115-122)

**Probleme :** Si le profil n'existe pas (trigger a echoue), le sign-in redirige vers `/dashboard` sans creer le profil :

```typescript
if (!profileData) {
  console.warn("[SignIn] Aucun profil trouve, redirection vers /dashboard");
  router.push("/dashboard");
  router.refresh();
  return;
}
```

**Consequence :** `/dashboard` va tenter de lire le profil (qui n'existe pas) et rediriger vers `/auth/signin`. **Boucle de redirection infinie** entre `/auth/signin` et `/dashboard`.

### 3.4 BUG MOYEN #4 : Role NULL dans le layout owner

**Fichier :** `app/owner/layout.tsx` (lignes 46-49)

```typescript
if (profile.role !== "owner") {
  redirect(getRoleDashboardUrl(profile.role));
}
```

Si `profile.role` est `null` ou `undefined` (trigger echoue), `getRoleDashboardUrl(null)` retourne `/auth/signin`, ce qui cree une redirection silencieuse.

### 3.5 BUG MOYEN #5 : OwnerAppLayout - verif role uniquement client-side

**Fichier :** `components/layout/owner-app-layout.tsx` (lignes 134-142)

```typescript
useEffect(() => {
  if (!serverProfile && !loading && clientProfile?.role !== "owner") {
    if (clientProfile?.role === "tenant") {
      router.replace("/tenant");
    } else {
      router.replace("/dashboard");
    }
  }
}, [clientProfile, loading, router, serverProfile]);
```

La verification cote client ne se declenche **QUE** si `serverProfile` est absent. Si le serveur fournit un profil invalide, aucune redirection ne se fait.

---

## 4. COMPTE LOCATAIRE - DONNEES ET GESTION

### 4.1 Donnees utilisees par le locataire

Le locataire utilise les donnees suivantes, chargees par `fetchTenantDashboard()` :

| Donnee | Table source | Champ cle | Usage |
|--------|-------------|-----------|-------|
| **Profil** | `profiles` | `id, prenom, nom, kyc_status` | Identite, verification KYC |
| **Profil tenant** | `tenant_profiles` | `situation_pro, revenus_mensuels, nb_adultes, nb_enfants` | Dossier locataire |
| **Baux** | `leases` via `lease_signers` | `loyer, charges, date_debut, statut` | Contrat, montant du loyer |
| **Propriete** | `properties` | `adresse_complete, ville, type, surface` | Logement lie |
| **Proprietaire** | `profiles` (join via properties.owner_id) | `prenom, nom, email, telephone` | Contact du bailleur |
| **Factures** | `invoices` | `montant_total, statut, periode, due_date` | Paiements, historique |
| **Tickets** | `tickets` | `titre, statut, priorite` | Demandes de maintenance |
| **EDL** | `edl` + `edl_signatures` | `type, status, invitation_token` | Etats des lieux |
| **Compteurs** | `meters` + `meter_readings` | `type, serial_number, reading_value` | Suivi consommation |
| **Assurance** | `documents` (type=attestation_assurance) | `expiry_date` | Conformite bail |
| **Credit Score** | `/api/tenant/credit-score` (calcule) | score, historique paiements | Score locataire |
| **Consommation** | `/api/tenant/consumption` (calcule) | electricity, water, gas | Suivi energetique |

### 4.2 Comment les donnees sont recuperees

```
TenantLayout (Server Component)
    |
    +--> auth check (Supabase cookie)
    +--> getServerProfile() -> profiles table
    +--> autoLinkLeaseSigners() -> lie les lease_signers orphelins
    +--> fetchTenantDashboard(userId)
           |
           +--> RPC "tenant_dashboard" (optimise)
           |    Si echec:
           +--> fetchTenantDashboardDirect() (fallback queries)
                   |
                   +--> lease_signers (par profile_id OU invited_email)
                   +--> leases (par lease_ids)
                   +--> properties (par property_ids)
                   +--> invoices, tickets, edl, meters, documents
    |
    +--> TenantDataProvider (Context)
           |
           +--> DashboardClient (Client Component)
                   |
                   +--> fetch('/api/tenant/credit-score')
                   +--> fetch('/api/tenant/consumption')
                   +--> useTenantRealtime() (WebSocket temps reel)
```

### 4.3 Gestion des donnees locataire

| Aspect | Implementation | Fichier |
|--------|---------------|---------|
| **Chargement initial** | Server Component (layout.tsx) | `app/tenant/layout.tsx` |
| **Cache client** | React Context (TenantDataProvider) | `app/tenant/_data/TenantDataProvider.tsx` |
| **Rafraichissement** | `refetch()` via fetch `/api/tenant/dashboard` | `TenantDataProvider.tsx:52-75` |
| **Temps reel** | Supabase Realtime (useTenantRealtime) | `lib/hooks/use-realtime-tenant.ts` |
| **Mise a jour optimiste** | `updateDashboard()` callback | `TenantDataProvider.tsx:44-49` |
| **Auto-link orphelins** | Liaison lease_signers par email au chargement | `app/tenant/layout.tsx:21-56` |

### 4.4 Probleme specifique locataire : Race condition profil

**Fichier :** `app/tenant/dashboard/DashboardClient.tsx` (lignes 78-85)

Le dashboard locataire a un auto-retry si les donnees sont null :
```typescript
useEffect(() => {
  if (!dashboard && !error && !isRefetching && !retried) {
    setRetried(true);
    const timer = setTimeout(() => refetch(), 1500);
    return () => clearTimeout(timer);
  }
}, [dashboard, error, isRefetching, retried, refetch]);
```

Cela indique qu'il y a une **race condition connue** entre la creation du profil et le chargement du dashboard. Le retry a 1500ms est un palliatif, pas une solution.

---

## 5. BUGS DE ROUTES IDENTIFIES

### 5.1 Bug CRITIQUE : Runtime manquant dans `/api/tenant/dashboard/route.ts`

**Fichier :** `app/api/tenant/dashboard/route.ts`

**Probleme :** Manque les declarations `export const dynamic` et `export const runtime` :
```typescript
// MANQUANT :
// export const dynamic = "force-dynamic";
// export const runtime = "nodejs";
```

**Impact :** La route peut etre mise en cache par Next.js, retournant des donnees perimees au locataire. Compare avec `/api/owner/dashboard/route.ts` qui a les deux declarations.

### 5.2 Bug MOYEN : Client Supabase inconsistant dans `/api/me/profile/route.ts`

**Fichier :** `app/api/me/profile/route.ts` (lignes 25-26, 64-65)

**Probleme :** Utilise `supabaseAdmin()` depuis `@/app/api/_lib/supabase` au lieu de `getServiceClient()` depuis `@/lib/supabase/service-client`. Le reste du codebase (86+ fichiers) utilise `getServiceClient()`.

**Impact :** Comportement potentiellement different (options de configuration, timeout, etc.).

### 5.3 Bug MOYEN : Colonnes conditionnelles dans `/api/owner/dashboard/route.ts`

**Fichier :** `app/api/owner/dashboard/route.ts` (lignes 433-465, 475-512)

**Probleme :** Le code utilise des try-catch pour gerer des colonnes qui pourraient ne pas exister (`dpe_date_expiration`, `prix_achat`):

```typescript
try {
  const { data: propertiesWithDPEDates } = await supabase
    .from("properties")
    .select("id, energie, dpe_date_expiration")
    .in("id", propertyIds)
    .not("dpe_date_expiration", "is", null);
} catch (dpeError) {
  console.warn("[GET /api/owner/dashboard] DPE date check skipped...");
}
```

**Impact :** Indique un probleme de migration de schema. Les colonnes `dpe_date_expiration` et `prix_achat` ne sont peut-etre pas presentes en production.

### 5.4 Bug MOYEN : Noms de colonnes mixtes FR/EN

**Fichier :** `app/api/tenant/credit-score/route.ts` (lignes 99-101)

**Probleme :** Mix de noms de colonnes en francais et en anglais dans la meme table `invoices` :
- `date_echeance` (FR)
- `paid_at` (EN)
- `montant_total` (FR)
- `statut` (FR)

**Impact :** Confusion pour les developpeurs, erreurs potentielles lors de l'ecriture de nouvelles queries.

### 5.5 Bug BAS : Double verification auth dans le flux tenant

**Fichier :** `app/api/tenant/dashboard/route.ts` (ligne 43) et `app/tenant/_data/fetchTenantDashboard.ts` (ligne 561)

**Probleme :** L'auth est verifiee dans la route handler, puis re-verifiee dans `fetchTenantDashboard()`. Double appel a `supabase.auth.getUser()`.

**Impact :** Latence supplementaire (appel reseau en double), mais pas de bug fonctionnel.

### 5.6 Bug BAS : Error handling inconsistant entre routes

| Route | Pattern |
|-------|---------|
| `/api/owner/dashboard` | try-catch generique |
| `/api/me/profile` | `handleApiError()` helper |
| `/api/tenant/dashboard` | Verification d'erreur directe |

**Impact :** Reponses d'erreur au format different selon la route, complique le traitement cote client.

---

## 6. BUGS DE GESTION IDENTIFIES

### 6.1 Middleware trop permissif

**Fichier :** `middleware.ts` (lignes 92-95)

```typescript
const hasAuthCookie = allCookies.some(
  (c) => c.name.includes("auth-token") || c.name.startsWith("sb-")
);
```

**Probleme :** Le middleware verifie uniquement la **presence** d'un cookie, pas sa **validite**. Un cookie expire sera considere comme valide.

**Impact :** Un utilisateur avec un cookie expire accede aux zones protegees, puis voit une erreur dans le layout server-side. Mauvaise UX (ecran blanc momentane au lieu de redirection propre).

### 6.2 Pas de gestion de session expiree cote API

**Fichier :** `lib/api-client.ts`

Le client API gere le 401 en appelant `handleSessionExpired()` mais cela depend du comportement correct de Supabase Auth. Si la session expire pendant une requete longue, il n'y a pas de retry avec token rafraichi.

### 6.3 autoLinkLeaseSigners() a chaque chargement

**Fichier :** `app/tenant/layout.tsx` (lignes 21-56)

**Probleme :** La fonction `autoLinkLeaseSigners()` s'execute a **CHAQUE** chargement du layout tenant. Elle fait 2 requetes Supabase (SELECT + UPDATE) a chaque navigation.

```typescript
// Ligne 96 - execute a chaque render du layout
if (user.email) {
  await autoLinkLeaseSigners(profile.id, user.email);
}
```

**Impact :**
- Performance degradee (2 requetes supplementaires par navigation)
- Devrait etre fait uniquement au premier chargement ou via un cron job

### 6.4 RPC fallback systematique

**Fichier :** `app/tenant/_data/fetchTenantDashboard.ts` (lignes 570-598)

La RPC `tenant_dashboard` echoue frequemment (d'apres les logs `console.warn`), declenchant le fallback `fetchTenantDashboardDirect()` qui fait **12+ requetes** individuelles.

**Impact :** Performance degradee, latence elevee pour le dashboard tenant.

---

## 7. RECOMMANDATIONS ET CORRECTIFS

### Priorite CRITIQUE (a corriger immediatement)

| # | Bug | Fichier | Correctif |
|---|-----|---------|-----------|
| 1 | Trigger ne cree pas `owner_profiles` | Migration SQL | Ajouter INSERT INTO owner_profiles dans le trigger `handle_new_user` |
| 2 | Boucle d'onboarding infinie | `auth/callback/route.ts` | Verifier que l'etape review marque `onboarding_completed_at` |
| 3 | Sign-in sans profil = boucle | `sign-in-form.tsx` | Appeler POST `/api/me/profile` si profil absent |
| 4 | Runtime manquant dans route API | `api/tenant/dashboard/route.ts` | Ajouter `export const dynamic` et `export const runtime` |

### Priorite HAUTE (semaine prochaine)

| # | Bug | Fichier | Correctif |
|---|-----|---------|-----------|
| 5 | Role NULL dans layout | `owner/layout.tsx` | Gerer le cas `profile.role === null` |
| 6 | Client Supabase inconsistant | `api/me/profile/route.ts` | Migrer vers `getServiceClient()` |
| 7 | Colonnes schema incertaines | `api/owner/dashboard/route.ts` | Verifier migrations pour `dpe_date_expiration` et `prix_achat` |
| 8 | Middleware cookie expire | `middleware.ts` | Ajouter verification basique de l'expiration du token |

### Priorite MOYENNE (sprint suivant)

| # | Bug | Fichier | Correctif |
|---|-----|---------|-----------|
| 9 | autoLinkLeaseSigners a chaque load | `tenant/layout.tsx` | Ajouter un cache ou flag "deja lie" |
| 10 | Double auth check | Flux tenant | Supprimer la verification redondante |
| 11 | Error handling inconsistant | Routes API | Standardiser sur `handleApiError()` |
| 12 | Noms de colonnes mixtes FR/EN | Schema global | Etablir une convention de nommage |

### Correctif propose pour le Bug #1 (Trigger)

```sql
-- Ajouter dans handle_new_user() apres l'INSERT INTO profiles :
IF v_role = 'owner' THEN
  INSERT INTO public.owner_profiles (profile_id, type, usage_strategie)
  VALUES (v_profile_id, 'particulier', 'habitation_only')
  ON CONFLICT (profile_id) DO NOTHING;
END IF;
```

### Correctif propose pour le Bug #3 (Sign-in)

```typescript
// Dans sign-in-form.tsx, apres auth reussie :
if (!profileData) {
  // Creer le profil automatiquement via l'API
  const res = await fetch("/api/me/profile", {
    method: "POST",
    credentials: "include",
  });
  if (res.ok) {
    const newProfile = await res.json();
    profileData = newProfile;
  }
}
```

### Correctif propose pour le Bug #4 (Runtime)

```typescript
// Ajouter en haut de app/api/tenant/dashboard/route.ts :
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
```

---

## RESUME

| Categorie | Critique | Haute | Moyenne | Basse |
|-----------|----------|-------|---------|-------|
| Connexion proprietaire | 3 | 2 | 0 | 0 |
| Routes API | 1 | 1 | 2 | 2 |
| Gestion donnees | 0 | 0 | 3 | 1 |
| **Total** | **4** | **3** | **5** | **3** |

**Le compte proprietaire ne se connecte pas principalement a cause de :**
1. Le trigger SQL ne cree pas la sous-table `owner_profiles`
2. L'onboarding peut ne jamais se marquer comme "complete"
3. En cas de profil manquant, le sign-in entre dans une boucle de redirection

**Le backend et le frontend SONT connectes** (meme projet Next.js), mais la chaine d'authentification a des maillons faibles aux points 1, 2 et 3 ci-dessus.
