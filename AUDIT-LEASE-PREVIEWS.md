# AUDIT COMPLET — TALOK : Baux, Previews & Intégrité des Données

**Date :** 2026-02-20
**Périmètre :** Création, stockage, récupération, affichage des données de baux + EDL, auth, multi-entités, dette technique
**Méthode :** Analyse statique exhaustive du code source (6 sections parallèles)

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Section 1 — Bugs de création de données](#2-section-1--bugs-de-création-de-données)
3. [Section 2 — Bugs Supabase (stockage, RLS, schéma)](#3-section-2--bugs-supabase)
4. [Section 3 — Bugs de récupération de données](#4-section-3--bugs-de-récupération-de-données)
5. [Section 4 — Bugs d'affichage et d'utilisation](#5-section-4--bugs-daffichage-et-dutilisation)
6. [Section 5 — Bugs spécifiques (EDL, auth, multi-entités)](#6-section-5--bugs-spécifiques)
7. [Section 6 — Anti-patterns et dette technique](#7-section-6--anti-patterns-et-dette-technique)
8. [Tableau récapitulatif global](#8-tableau-récapitulatif-global)
9. [Plan d'action priorisé](#9-plan-daction-priorisé)

---

## 1. Résumé exécutif

| Sévérité | Nombre |
|----------|--------|
| CRITICAL | 7 |
| HIGH | 18 |
| MEDIUM | 29 |
| LOW | 7 |
| **TOTAL** | **61 bugs identifiés** |

**Domaines les plus impactés :**
- **Validation des données à la création** : `.parse()` au lieu de `.safeParse()`, valeurs non validées (NaN, Infinity, négatifs)
- **Sécurité Supabase** : Service role utilisé inutilement, bypass RLS, `.single()` sans gestion d'erreur
- **Affichage** : `undefined €`, `NaN €`, formatage de devises incohérent
- **Autorisation** : Layouts sans vérification de rôle, endpoints EDL sans contrôle d'accès
- **Dette technique** : 147 `@ts-nocheck`, 50+ `as any`, 2156 `console.log`, clés hardcodées

---

## 2. Section 1 — Bugs de création de données

### S1-01 | CRITICAL | `.parse()` au lieu de `.safeParse()` dans les signataires
**Fichier :** `app/api/leases/[id]/signers/route.ts:100`

```typescript
const validated = addSignerSchema.parse(body); // Throws uncaught on invalid input
```

**Problème :** Utilise `.parse()` qui lève une exception non capturée. Les emails invalides ou champs manquants crashent l'endpoint avec une erreur 500 au lieu de retourner une 400 avec un message de validation utile.

**Correction :** Remplacer par `.safeParse()` et vérifier `result.success`.

---

### S1-02 | HIGH | Valeurs override non validées dans la création de facture
**Fichier :** `app/api/leases/[id]/rent-invoices/route.ts:28, 114-115`

```typescript
const { month, loyer_override, charges_override } = body; // No type checking
const montant_loyer = loyer_override || leaseData.loyer;
const montant_charges = charges_override || leaseData.charges_forfaitaires || 0;
const montant_total = montant_loyer + montant_charges;
```

**Problème :** `loyer_override` et `charges_override` acceptent n'importe quel type (string, objet, NaN, négatif). `"123abc" + 50` = `"123abc50"` (concaténation de string). Des montants négatifs pourraient être utilisés frauduleusement.

**Correction :** Ajouter une validation Zod avec `z.number().positive()`.

---

### S1-03 | HIGH | Pas de validation date_fin > date_debut
**Fichier :** `lib/validations/lease-financial.ts:191-265`

```typescript
date_fin: z.string().optional().nullable(), // No check that date_fin > date_debut
```

**Problème :** Le schéma valide l'existence et le format de `date_fin` mais ne vérifie jamais que la date de fin est postérieure à la date de début. Un bail avec `date_debut: "2026-12-01"` et `date_fin: "2026-01-01"` passe la validation. Les vérifications de durée (bail mobilité max 10 mois) deviennent inutiles.

**Correction :** Ajouter un `.superRefine()` comparant les deux dates.

---

### S1-04 | MEDIUM | Incohérence email optionnel vs requis
**Fichiers :** `lib/validations/lease-financial.ts:195` vs `app/api/leases/[id]/signers/route.ts:11`

```typescript
// lease-financial.ts: tenant_email optionnel
tenant_email: z.string().email().optional().nullable(),

// signers/route.ts: email obligatoire
email: z.string().email("Email invalide"),
```

**Problème :** Lors de la création de bail, l'email est optionnel. Mais l'ajout de signataire l'exige. Le serveur accepte un bail sans email puis crée un signataire avec `"locataire@a-definir.com"` — email invalide qui ne peut recevoir d'invitation.

---

### S1-05 | MEDIUM | `parseFloat()` accepte NaN/Infinity
**Fichier :** `app/api/leases/route.ts:329-337`

```typescript
const loyer = body.loyer ? parseFloat(body.loyer) : undefined;
// parseFloat("abc") = NaN, parseFloat("Infinity") = Infinity
```

**Problème :** `NaN` et `Infinity` passent à travers la validation Zod (comparaisons avec NaN échouent silencieusement) et sont stockés en base.

**Correction :** Ajouter `Number.isFinite()` check après `parseFloat()`.

---

### S1-06 | HIGH | Race condition — Double soumission de formulaire
**Fichier :** `features/leases/components/lease-form.tsx:340`

```typescript
<Button type="submit" disabled={loading}>
```

**Problème :** Le bouton est bien désactivé pendant le chargement, mais un double-clic rapide avant que `setLoading(true)` ne prenne effet peut causer la création de baux en double.

**Correction :** Ajouter `if (loading) return;` au début du handler + `finally { setLoading(false) }`.

---

### S1-07 | MEDIUM | `owner_id` peut être null dans l'upload de documents
**Fichier :** `app/api/documents/upload-batch/route.ts:186`

```typescript
ownerId = role === "owner" ? profileId : null;
// Plus tard: .insert(record as any) — record.owner_id peut être null
```

**Problème :** Si la base a une contrainte `NOT NULL` sur `owner_id`, l'insert échoue. Le cast `as any` masque l'erreur TypeScript.

---

### S1-08 | MEDIUM | Multiples `as any` masquent les erreurs de type
**Fichier :** `app/api/documents/upload-batch/route.ts` (lignes 117, 297, 314, 333, 340, 367, 368, 379)

**Problème :** 8 casts `as any` dans un seul fichier. Désactive totalement la vérification TypeScript, permettant des noms de champs invalides et des inserts silencieusement incorrects.

---

### S1-09 | MEDIUM | Token d'invitation créé avant l'envoi d'email
**Fichier :** `app/api/leases/[id]/signers/route.ts:307-322`

```typescript
const inviteToken = Buffer.from(`${leaseId}:${validated.email}:${Date.now()}`).toString("base64url");
// Token created BEFORE email delivery is confirmed
```

**Problème :** Si l'envoi d'email échoue, le token existe mais l'invitation est silencieusement perdue. Aucun mécanisme de retry.

---

### S1-10 | MEDIUM | Email placeholder hardcodé pour locataire
**Fichier :** `app/api/leases/route.ts:491-502`

```typescript
invited_email: "locataire@a-definir.com", // HARDCODED PLACEHOLDER
invited_name: "Locataire à définir",
```

**Problème :** Crée des données invalides : email non délivrable, violation GDPR potentielle, processus d'invitation cassé en aval.

---

### S1-11 | MEDIUM | Pas de vérification d'existence du lease_id avant création EDL
**Fichier :** `app/api/edl/route.ts:12-14`

```typescript
lease_id: z.string().uuid("lease_id doit être un UUID valide"), // Only format check
```

**Problème :** Seul le format UUID est validé, pas l'existence en base. Erreur FK au niveau DB sans message clair.

---

### S1-12 | MEDIUM | Default hardcodé "meuble" vs enum Zod
**Fichier :** `app/api/leases/route.ts:330`

```typescript
const typeBail = body.type_bail || "meuble"; // Hardcoded fallback
```

**Problème :** Si `"meuble"` n'est pas dans l'enum `BAIL_TYPES` de Zod, la validation échoue avec un message confus.

---

### S1-13 | LOW | Champs optionnels de formulaire vs contraintes DB
**Fichier :** `features/profiles/components/tenant-profile-form.tsx:22-28`

**Problème :** Le formulaire permet `null` pour tous les champs, mais si la DB a des contraintes `NOT NULL`, l'insert échoue sans message clair côté client.

---

## 3. Section 2 — Bugs Supabase

### S2-01 | HIGH | Service role inutile pour GET /api/me/profile
**Fichier :** `app/api/me/profile/route.ts:24-32`

```typescript
const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
const serviceClient = supabaseAdmin();
// Uses service role to fetch OWN profile — unnecessary RLS bypass
```

**Problème :** L'utilisateur est déjà authentifié. Utiliser le service role bypass les politiques RLS sans raison, créant un angle mort de sécurité.

**Correction :** Utiliser le client authentifié avec RLS.

---

### S2-02 | HIGH | Service role pour opérations en lecture seule
**Fichier :** `app/api/owner/properties/route.ts:30-31, 168-169`

**Problème :** Service role utilisé pour vérifier les permissions et lire les photos. Les politiques RLS devraient gérer le scope propriétaire.

---

### S2-03 | HIGH | Erreur `.single()` non gérée dans plusieurs services
**Fichiers :**
- `lib/services/chat.service.ts:95`
- `lib/helpers/auth-helper.ts:98-102`
- `app/api/documents/upload/route.ts:84-88`
- `app/api/documents/upload-batch/route.ts:107-111`

```typescript
const { data: profile } = await this.supabase.from("profiles").select("id").eq("user_id", user.id).single();
if (!profile) throw new Error("Profil non trouvé");
// ← error object not checked
```

**Problème :** `.single()` retourne un `error` quand multiple/aucun résultat, mais seul `data` est vérifié. Peut causer des exceptions trompeuses.

**Correction :** Toujours vérifier `error` en plus de `!data`.

---

### S2-04 | HIGH | Pas de validation FK avant insert de bail
**Fichier :** `app/api/leases/route.ts:106-141`

**Problème :** L'insertion de bail ne valide pas l'existence de `property_id` avant l'insert. Si les FK ne sont pas enforced au niveau DB, des baux orphelins sont créés.

---

### S2-05 | CRITICAL | Upload storage sans vérification de succès
**Fichier :** `app/api/webhooks/stripe/route.ts:114-127`

```typescript
const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, pdfBytes, {...});
if (uploadError) { console.error(...); return; }
// getPublicUrl called immediately — file may not be replicated yet
const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);
```

**Problème :** Dans un webhook, pas de feedback utilisateur. `getPublicUrl()` peut pointer vers un fichier inexistant si la réplication storage est lente.

---

### S2-06 | MEDIUM | Fuite de souscription Realtime dans useNotifications
**Fichier :** `lib/hooks/use-notifications.ts:232-306`

**Problème :** Le tableau de dépendances inclut des callbacks instables (`toast`, `playNotificationSound`) qui causent des re-souscriptions à chaque render. Résultat : channels multiples, fuites mémoire, notifications en double.

**Correction :** Utiliser `useCallback` avec dépendances stables et `useRef` pour les callbacks.

---

### S2-07 | MEDIUM | Path traversal dans la suppression d'avatar
**Fichier :** `app/api/profile/avatar/route.ts:60-62`

```typescript
const oldPath = profile.avatar_url.replace(/^.*\/avatars\//, "");
await supabase.storage.from("avatars").remove([oldPath]);
```

**Problème :** Si `avatar_url` contient `../../other-bucket/file.pdf`, le regex pourrait ne pas sanitiser correctement. Risque de suppression de fichier dans un autre bucket.

**Correction :** Extraire uniquement le nom de fichier et valider l'absence de `..`.

---

### S2-08 | MEDIUM | `.limit(1)` sans `.single()` dans l'upload de photos
**Fichier :** `app/api/properties/[id]/photos/upload-url/route.ts:157-170`

**Problème :** Requête avec `.limit(1)` mais pas `.single()` ni `.maybeSingle()`. Le résultat est un tableau au lieu d'un objet, causant un type unsafe en aval.

---

## 4. Section 3 — Bugs de récupération de données

### S3-01 | HIGH | Pas de validation de réponse dans l'upload de photos en boucle
**Fichier :** `app/owner/inspections/[id]/photos/page.tsx:191-217`

**Problème :** Upload en boucle `for...of` : si un upload échoue après d'autres succès, état inconsistant. Pas de rollback des uploads partiels. Structure de `data.files` non validée avant accès.

---

### S3-02 | HIGH | Race condition — Composant démonté avant fin d'async
**Fichier :** `app/tenant/meters/page.tsx:120-137, 185-196`

```typescript
useEffect(() => { fetchMeters(); }, []); // No cleanup/AbortController
```

**Problème :** Pas de `response.ok` check. Updates de state après démontage (fuite mémoire). Pas d'`AbortController` pour annuler les requêtes pendantes.

**Correction :** Ajouter `AbortController` dans le cleanup du `useEffect`.

---

### S3-03 | MEDIUM | Null checks manquants sur les données du dashboard
**Fichier :** `app/owner/_data/fetchDashboard.ts:102-126`

**Problème :** `map()` sur `properties` sans vérifier que `p.id` existe. Résultat potentiel : tableau avec des `undefined`.

---

### S3-04 | MEDIUM | Messages d'erreur génériques masquent les vrais problèmes
**Fichier :** `app/owner/_data/OwnerDataProvider.tsx:130-148`

```typescript
throw new Error(`Erreur ${res.status}`); // Generic
// data.error silently ignored
// Error not stored in state — UI shows empty instead of error
```

---

### S3-05 | HIGH | Échec silencieux quand `res.ok` est false
**Fichier :** `app/owner/invoices/page.tsx:46-62`

**Problème :** Si `res.ok` est false, aucun message d'erreur affiché. L'utilisateur voit "pas de factures" au lieu d'un message d'erreur. Indistinguable d'une liste réellement vide.

---

### S3-06 | HIGH | Pattern N+1 — Requêtes séquentielles non batchées
**Fichier :** `app/owner/inspections/[id]/photos/page.tsx:101-120`

**Problème :** Fetch rooms + fetch EDL + fetch entry EDL en séquentiel. `guessRoomType()` appelé dans un `map()` sans cache.

**Correction :** Utiliser `Promise.all()` pour paralléliser et mémoiser `guessRoomType`.

---

### S3-07 | MEDIUM | Pas de timeout sur les opérations fetch
**Fichier :** `app/owner/leases/[id]/LeaseDetailsClient.tsx:471-500`

**Problème :** Upload d'image de signature sans timeout — peut bloquer indéfiniment. Le bouton reste en état "signing" si le réseau est lent.

**Correction :** Ajouter `AbortController` avec `setTimeout` de 30s.

---

### S3-08 | MEDIUM | Pas de limite maximum sur la pagination
**Fichier :** `app/api/accounting/entries/route.ts:68-94`

```typescript
const limit = parseInt(searchParams.get("limit") || "100"); // No max check
// count: "exact" scans entire table every time
```

**Problème :** Un client peut demander `?limit=100000`, causant une surcharge mémoire. `count: "exact"` est coûteux sur les grandes tables.

---

### S3-09 | MEDIUM | Données stale — pas de revalidation
**Fichier :** `app/owner/_data/OwnerDataProvider.tsx:151-154`

**Problème :** Les données du dashboard ne sont jamais rafraîchies. Si le statut d'un bail change dans un autre onglet, l'utilisateur voit des données obsolètes.

**Correction :** Ajouter un intervalle de revalidation (5min) + revalidation sur `window.focus`.

---

### S3-10 | HIGH | Erreur avalée dans l'upload de document tenant
**Fichier :** `app/api/documents/upload/route.ts:123-141`

```typescript
} catch (resolveErr) {
  console.warn("Auto-resolve lease/property échoué:", resolveErr);
  // Upload continues with null IDs — document invisible to owner
}
```

**Problème :** L'erreur est avalée. Le document est créé avec `property_id` et `lease_id` nuls, le rendant invisible pour le propriétaire.

---

## 5. Section 4 — Bugs d'affichage et d'utilisation

### S4-01 | CRITICAL | `undefined €` affiché pour les valeurs manquantes
**Fichier :** `app/owner/leases/[id]/edit/page.tsx:354-362`

```typescript
<p>{lease.loyer?.toLocaleString("fr-FR")} €</p>
// If loyer is undefined, renders "undefined €"
```

**Correction :** `{(lease.loyer ?? 0).toLocaleString("fr-FR")} €`

---

### S4-02 | CRITICAL | `NaN €` dans le calcul du total
**Fichier :** `app/owner/leases/[id]/edit/page.tsx:405`

```typescript
{(lease.loyer + lease.charges_forfaitaires).toLocaleString("fr-FR")} €
// undefined + undefined = NaN
```

---

### S4-03 | CRITICAL | Formatage de devise incohérent entre composants
**Fichier :** `app/owner/leases/[id]/edit/page.tsx:354-373`

**Problème :** Utilise `.toLocaleString("fr-FR")` directement au lieu du helper `formatCurrency()` du projet, causant des incohérences visuelles.

---

### S4-04 | HIGH | Mapping de données avec noms de champs multiples
**Fichier :** `app/owner/leases/[id]/LeaseDetailsClient.tsx:257-259`

```typescript
const displayLoyer = lease.loyer ?? propAny?.loyer_hc ?? propAny?.loyer_base ?? 0;
const displayCharges = lease.charges_forfaitaires ?? propAny?.charges_mensuelles ?? 0;
```

**Problème :** Fallback sur des champs de propriété au lieu de la source unique du bail. L'utilisateur peut voir 500€ (propriété) au lieu de 600€ (bail).

---

### S4-05 | HIGH | Null check manquant avant `new Date()`
**Fichier :** `app/owner/leases/[id]/edit/page.tsx:491`

```typescript
selected={new Date(lease.date_debut)} // date_debut could be null/undefined
```

**Problème :** Crée un `Invalid Date` si `date_debut` est undefined, cassant le calendrier.

---

### S4-06 | HIGH | Problèmes de timezone dans le parsing de dates
**Fichier :** `features/leases/components/lease-preview.tsx:217-220`

```typescript
const dateDebut = new Date(bailData.conditions.date_debut);
// "2024-01-15" parsed without timezone → could be Jan 14 in some timezones
```

---

### S4-07 | HIGH | Données source potentiellement undefined dans le calcul total
**Fichier :** `app/owner/leases/[id]/LeaseDetailsClient.tsx:1109-1112`

**Problème :** Même avec `formatCurrency()`, si `displayLoyer` ou `displayCharges` sont undefined, le total est incorrect.

---

### S4-08 | MEDIUM | Strings françaises hardcodées sans i18n
**Fichier :** `features/leases/components/lease-preview.tsx:48-54`

**Problème :** Labels de types de bail hardcodés. Rend la localisation impossible sans refactoring.

---

### S4-09 | MEDIUM | Statut inconnu → fallback silencieux vers "Brouillon"
**Fichier :** `app/owner/leases/[id]/LeaseDetailsClient.tsx:94-135`

```typescript
const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;
```

**Problème :** Un nouveau statut ajouté en DB mais pas dans le mapping affiche "Brouillon" — trompeur.

---

### S4-10 | MEDIUM | Conversion `Number()` défensive indiquant un problème de typage
**Fichier :** `app/owner/leases/ContractsClient.tsx:284`

**Problème :** `Number(lease.loyer || 0)` suggère que l'API retourne parfois des strings au lieu de numbers.

---

### S4-11 | MEDIUM | `.split("T")[0]` fragile pour extraire la date
**Fichier :** `app/owner/leases/actions.ts:85`

---

### S4-12 | MEDIUM | Bouton "Signer" visible sur bail archivé
**Fichier :** `app/owner/leases/[id]/LeaseDetailsClient.tsx:295-296`

**Problème :** `ownerNeedsToSign` ne vérifie pas `lease.statut`. Le bouton apparaît même sur un bail archivé.

---

### S4-13 | LOW | Statuts de paiement dupliqués (`succeeded` et `paid`)
**Fichier :** `app/owner/leases/[id]/tabs/LeasePaymentsTab.tsx:45-51`

---

### S4-14 | LOW | Pas de fallback d'erreur pour EDL null
**Fichier :** `app/owner/leases/[id]/tabs/LeaseEdlTab.tsx:98-149`

---

### S4-15 | LOW | `formatDateShort()` ne gère pas les dates invalides
**Fichier :** `lib/helpers/format.ts:10-33`

---

### S4-16 | LOW | Valeurs d'enum brutes affichées dans l'UI
**Fichier :** `app/owner/leases/[id]/tabs/LeaseDocumentsTab.tsx:41-44`

---

### S4-17 | LOW | Optional chaining dans des calculs arithmétiques
**Fichier :** `features/leases/components/lease-preview.tsx:100-102`

---

## 6. Section 5 — Bugs spécifiques (EDL, auth, multi-entités)

### S5-01 | CRITICAL | Layout garant sans vérification de rôle
**Fichier :** `app/guarantor/layout.tsx`

**Problème :** Tout utilisateur authentifié (propriétaire, locataire, prestataire) peut accéder aux routes `/guarantor/*` par URL directe. Aucune vérification du rôle.

**Correction :**
```typescript
if (profile.role !== "guarantor") { redirect("/dashboard"); }
```

---

### S5-02 | HIGH | `.single()` non sécurisé dans les endpoints EDL
**Fichiers :**
- `app/api/edl/preview/route.ts`
- `app/api/edl/[id]/meter-readings/route.ts`
- `app/api/edl/[id]/meter-readings/[readingId]/route.ts`
- `app/api/edl/[id]/invite/route.ts`

**Problème :** `.single()` crash si > 1 résultat ou 0 résultat. Retourne HTML au lieu de JSON, cassant le contrat API.

**Correction :** Remplacer par `.maybeSingle()` + null check.

---

### S5-03 | HIGH | PDF EDL sans vérification de permission
**Fichier :** `app/api/edl/pdf/route.ts:45-95`

```typescript
const adminClient = createAdminClient(...);
const { data: edl } = await adminClient.from("edl").select(...).eq("id", edlId).single();
// No permission check — anyone with the EDL ID can generate the PDF
```

---

### S5-04 | MEDIUM | Pas de vérification d'accès dans l'invitation EDL
**Fichier :** `app/api/edl/[id]/invite/route.ts:28-73`

**Problème :** L'endpoint ne vérifie pas que l'utilisateur est autorisé à envoyer des invitations pour cet EDL.

---

### S5-05 | MEDIUM | `.single()` non sécurisé dans la signature de bail
**Fichier :** `app/api/leases/[id]/sign/route.ts:81-100`

```typescript
.eq("user_id", user.id as any).single(); // Could crash if no profile
```

---

### S5-06 | MEDIUM | `owner_id` non résolu pour les documents tenant
**Fichier :** `app/api/documents/upload/route.ts:166-178`

**Problème :** Si la résolution de `property_id` échoue, `owner_id` reste null. Le document est invisible pour le propriétaire.

---

### S5-07 | MEDIUM | Vérification d'email placeholder incomplète
**Fichier :** `app/api/edl/[id]/invite/route.ts:11-17`

```typescript
return email.includes('@a-definir') || email.includes('@placeholder') || ...
```

**Problème :** Case-sensitive, patterns incomplets. Un email `Tenant@A-Definir.com` passerait.

---

### S5-08 | HIGH | Null guard manquant après vérification d'accès EDL
**Fichier :** `app/api/edl/[id]/meter-readings/route.ts:218-238`

```typescript
const accessResult = await verifyEDLAccess({...}, serviceClient);
if (!accessResult.authorized) { return ...; }
const editCheck = canEditEDL(accessResult.edl); // edl could be null here
```

---

### S5-09 | MEDIUM | Matching de signataire placeholder sans vérification d'email
**Fichier :** `app/api/leases/[id]/sign/route.ts:507-536`

**Problème :** Recherche de signataire placeholder par rôle uniquement (sans match email). Si plusieurs locataires ont des placeholders, le mauvais pourrait signer.

---

### S5-10 | MEDIUM | Email synthétique fallback dans la preuve de signature EDL
**Fichier :** `app/api/edl/[id]/sign/route.ts:457, 494`

```typescript
signerEmail: user.email ?? `user-${user.id.slice(0, 8)}@unknown.local`,
```

**Problème :** L'audit trail contient de faux emails. Les notifications échouent.

---

### S5-11 | LOW | `signer_profile_id` potentiellement null dans l'event outbox
**Fichier :** `app/api/edl/[id]/invite/route.ts:209-224`

---

### S5-12 | MEDIUM | Accès document trop large au niveau propriété
**Fichier :** `app/api/documents/[id]/signed-url/route.ts:69-82`

**Problème :** Un propriétaire peut accéder à tout document lié à sa propriété, même si le document a été mal associé par un locataire.

---

## 7. Section 6 — Anti-patterns et dette technique

### S6-01 | HIGH | 147 fichiers avec `@ts-nocheck`
**Impact :** Des portions entières du code ne sont pas vérifiées par TypeScript. Les erreurs de type passent en production.

**Correction progressive :** Cibler les fichiers critiques (auth, paiement, sécurité) en priorité.

---

### S6-02 | HIGH | 50+ casts `as any`
**Exemples :**
- `app/properties/[id]/preview/page.tsx:66` : `(error as any)?.message`
- `features/finance/services/bank-connect.service.ts:41` : `data as unknown as BankConnection[]`

**Correction :** Remplacer par des type guards et des interfaces typées.

---

### S6-03 | MEDIUM | ~2156 `console.log/error/warn` en production
**Impact :** Fuites d'information (emails, codes d'erreur, structure interne) dans la console navigateur.

**Correction :** Configurer `next.config.js` pour strip les console.log en production.

---

### S6-04 | CRITICAL | Clé de développement hardcodée en fallback
**Fichier :** `lib/services/sms-service.ts:38`

```typescript
const masterKey = process.env.API_KEY_MASTER_KEY ||
                  process.env.SUPABASE_SERVICE_ROLE_KEY ||
                  "default-key-for-dev-only-32chars!"; // HARDCODED
```

**Impact :** Si les variables d'environnement manquent en production, le chiffrement utilise une clé connue publiquement. Compromission totale de la sécurité.

**Correction :** `throw new Error('[CRITICAL] API_KEY_MASTER_KEY must be set')` si absent.

---

### S6-05 | CRITICAL | Pattern de stockage de mots de passe dans localStorage
**Fichier :** `app/signup/account/page.tsx:133-158`

**Statut :** Partiellement corrigé (passwords explicitement exclus), mais le pattern de persister des données de formulaire sensibles dans localStorage reste risqué.

---

### S6-06 | MEDIUM | 12+ `.catch(() => {})` silencieux
**Fichiers :**
- `features/properties/stores/wizard-store.ts:480-481`
- `lib/services/api-keys.service.ts:80`
- `lib/services/edl-creation.service.ts:222-235`

**Problème :** Les erreurs sont complètement avalées. Impossible de diagnostiquer les problèmes en production.

---

### S6-07 | HIGH | Variables d'environnement sans validation
**Fichier :** `lib/stripe/index.ts:16-20`

```typescript
if (!secretKey) {
  console.warn("⚠️ STRIPE_SECRET_KEY n'est pas configurée...");
  // Returns dummy client — continues execution!
}
```

**Problème :** En production, les intégrations échouent silencieusement au lieu de crasher au démarrage.

---

### S6-08 | MEDIUM | Types de retour `any` dans le middleware auth
**Fichier :** `lib/api/middleware.ts:31-33`

```typescript
export async function requireAuth(request: NextRequest): Promise<{ user: any; profile: any } | NextResponse>
```

---

### S6-09 | MEDIUM | Patterns de gestion d'erreurs incohérents
**Fichier :** `features/auth/services/auth.service.ts:50-93`

**Problème :** Certaines fonctions throw, d'autres retournent `{ error, success }`, d'autres throw des erreurs custom. Impossible pour l'appelant de savoir quoi attendre.

---

### S6-10 | HIGH | 200+ routes API sans validation Zod
**Impact :** Les requêtes malformées atteignent la logique métier, causant des erreurs inattendues ou des failles de sécurité.

---

## 8. Tableau récapitulatif global

| ID | Sévérité | Section | Résumé court |
|----|----------|---------|-------------|
| S1-01 | CRITICAL | Création | `.parse()` au lieu de `.safeParse()` |
| S1-02 | HIGH | Création | Override loyer/charges non validés |
| S1-03 | HIGH | Création | date_fin pas validée > date_debut |
| S1-04 | MEDIUM | Création | Email optionnel vs requis incohérent |
| S1-05 | MEDIUM | Création | parseFloat accepte NaN/Infinity |
| S1-06 | HIGH | Création | Double soumission formulaire bail |
| S1-07 | MEDIUM | Création | owner_id peut être null |
| S1-08 | MEDIUM | Création | Multiples `as any` dans upload-batch |
| S1-09 | MEDIUM | Création | Token créé avant envoi email |
| S1-10 | MEDIUM | Création | Email placeholder hardcodé |
| S1-11 | MEDIUM | Création | lease_id format seul, pas existence |
| S1-12 | MEDIUM | Création | Default "meuble" hardcodé |
| S1-13 | LOW | Création | Champs optionnels vs DB NOT NULL |
| S2-01 | HIGH | Supabase | Service role inutile GET profile |
| S2-02 | HIGH | Supabase | Service role pour lectures |
| S2-03 | HIGH | Supabase | `.single()` sans check error |
| S2-04 | HIGH | Supabase | Pas de validation FK avant insert |
| S2-05 | CRITICAL | Supabase | Upload storage non vérifié |
| S2-06 | MEDIUM | Supabase | Fuite souscription Realtime |
| S2-07 | MEDIUM | Supabase | Path traversal avatar |
| S2-08 | MEDIUM | Supabase | `.limit(1)` sans `.single()` |
| S3-01 | HIGH | Fetching | Upload photos sans validation réponse |
| S3-02 | HIGH | Fetching | Race condition démontage composant |
| S3-03 | MEDIUM | Fetching | Null checks manquants dashboard |
| S3-04 | MEDIUM | Fetching | Messages d'erreur génériques |
| S3-05 | HIGH | Fetching | Échec silencieux si !res.ok |
| S3-06 | HIGH | Fetching | Pattern N+1 requêtes séquentielles |
| S3-07 | MEDIUM | Fetching | Pas de timeout sur fetch |
| S3-08 | MEDIUM | Fetching | Pas de limite max pagination |
| S3-09 | MEDIUM | Fetching | Données stale sans revalidation |
| S3-10 | HIGH | Fetching | Erreur avalée upload document tenant |
| S4-01 | CRITICAL | Affichage | `undefined €` affiché |
| S4-02 | CRITICAL | Affichage | `NaN €` dans le total |
| S4-03 | CRITICAL | Affichage | Formatage devise incohérent |
| S4-04 | HIGH | Affichage | Noms de champs multiples en fallback |
| S4-05 | HIGH | Affichage | Null check manquant new Date() |
| S4-06 | HIGH | Affichage | Timezone dans parsing dates |
| S4-07 | HIGH | Affichage | Données source undefined dans total |
| S4-08 | MEDIUM | Affichage | Strings FR hardcodées |
| S4-09 | MEDIUM | Affichage | Statut inconnu → "Brouillon" |
| S4-10 | MEDIUM | Affichage | Conversion Number() défensive |
| S4-11 | MEDIUM | Affichage | .split("T")[0] fragile |
| S4-12 | MEDIUM | Affichage | Bouton signer sur bail archivé |
| S4-13 | LOW | Affichage | Statuts paiement dupliqués |
| S4-14 | LOW | Affichage | Pas de fallback EDL null |
| S4-15 | LOW | Affichage | formatDateShort dates invalides |
| S4-16 | LOW | Affichage | Enum brutes dans UI |
| S4-17 | LOW | Affichage | Optional chaining en arithmétique |
| S5-01 | CRITICAL | Auth/EDL | Layout garant sans check rôle |
| S5-02 | HIGH | Auth/EDL | `.single()` non sécurisé EDL |
| S5-03 | HIGH | Auth/EDL | PDF EDL sans permission check |
| S5-04 | MEDIUM | Auth/EDL | Invitation EDL sans check accès |
| S5-05 | MEDIUM | Auth/EDL | `.single()` non sécurisé sign |
| S5-06 | MEDIUM | Auth/EDL | owner_id non résolu doc tenant |
| S5-07 | MEDIUM | Auth/EDL | Placeholder email check incomplet |
| S5-08 | HIGH | Auth/EDL | Null guard manquant après access check |
| S5-09 | MEDIUM | Auth/EDL | Placeholder signer sans match email |
| S5-10 | MEDIUM | Auth/EDL | Email synthétique en preuve signature |
| S5-11 | LOW | Auth/EDL | profile_id null dans event outbox |
| S5-12 | MEDIUM | Auth/EDL | Accès document trop large |
| S6-01 | HIGH | Tech debt | 147 fichiers @ts-nocheck |
| S6-02 | HIGH | Tech debt | 50+ casts as any |
| S6-03 | MEDIUM | Tech debt | ~2156 console.log en prod |
| S6-04 | CRITICAL | Tech debt | Clé dev hardcodée en fallback |
| S6-05 | CRITICAL | Tech debt | Pattern localStorage passwords |
| S6-06 | MEDIUM | Tech debt | 12+ .catch(() => {}) silencieux |
| S6-07 | HIGH | Tech debt | Env vars sans validation |
| S6-08 | MEDIUM | Tech debt | Types retour any dans middleware |
| S6-09 | MEDIUM | Tech debt | Error handling incohérent |
| S6-10 | HIGH | Tech debt | 200+ routes sans validation Zod |

---

## 9. Plan d'action priorisé

### Phase 1 — Critique (Immédiat, 1-2 jours)

| Action | Bugs concernés | Effort |
|--------|---------------|--------|
| Supprimer la clé hardcodée, fail fast si env vars manquantes | S6-04, S6-07 | 2h |
| Ajouter vérification de rôle dans layout garant | S5-01 | 30min |
| Ajouter permission check sur PDF EDL | S5-03 | 1h |
| Fix `undefined €` et `NaN €` dans l'affichage | S4-01, S4-02, S4-03 | 2h |
| Remplacer `.parse()` par `.safeParse()` | S1-01 | 30min |
| Vérifier upload storage avant getPublicUrl | S2-05 | 1h |

### Phase 2 — Haute priorité (Semaine 1)

| Action | Bugs concernés | Effort |
|--------|---------------|--------|
| Remplacer tous les `.single()` non sécurisés par `.maybeSingle()` | S2-03, S5-02, S5-05 | 4h |
| Valider loyer/charges override + date_fin > date_debut | S1-02, S1-03 | 2h |
| Ajouter AbortController aux fetch dans useEffect | S3-02 | 3h |
| Ajouter checks `response.ok` partout | S3-05, S3-10 | 3h |
| Utiliser service role uniquement quand nécessaire | S2-01, S2-02 | 2h |
| Guard anti double-soumission | S1-06 | 1h |
| Uniformiser formatCurrency() | S4-03, S4-04 | 2h |
| Null guard après verifyEDLAccess | S5-08 | 1h |

### Phase 3 — Priorité moyenne (Semaines 2-3)

| Action | Bugs concernés | Effort |
|--------|---------------|--------|
| Ajouter validation Zod aux 20 routes les plus utilisées | S6-10 | 8h |
| Strip console.log en production | S6-03 | 1h |
| Fix souscription Realtime | S2-06 | 2h |
| Ajouter timeouts + pagination max | S3-07, S3-08 | 3h |
| Pattern error handling cohérent | S6-09 | 4h |
| Réduire @ts-nocheck de 50% (fichiers critiques) | S6-01 | continu |

### Phase 4 — Maintenance continue

| Action | Bugs concernés | Effort |
|--------|---------------|--------|
| Remplacer `as any` par types propres | S6-02 | continu |
| Ajouter revalidation de données | S3-09 | 2h |
| i18n des strings hardcodées | S4-08 | 4h |
| Normaliser les statuts de paiement | S4-13 | 1h |
| Ajouter .catch() logging partout | S6-06 | 2h |

---

*Rapport généré le 2026-02-20 par audit automatisé du code source TALOK.*
