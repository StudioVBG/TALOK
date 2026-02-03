# RAPPORT D'AUDIT NAVIGATION - TALOK

Date : 2026-01-23

---

## RESUME EXECUTIF

| Catégorie | Total | OK | Problèmes |
|-----------|-------|-----|-----------|
| Routes publiques | 35+ | 33 | 2 |
| Routes protégées | 100+ | 100+ | 0 |
| Doublons détectés | 1 | - | 1 |
| Liens cassés | 5 | - | 5 |
| Problèmes breadcrumb | 1 | - | 1 |

**Score global** : 85/100

---

## ARBRE DE NAVIGATION ACTUEL

```
/
├── PAGES PUBLIQUES (accessibles sans auth)
│   ├── /                                  # Homepage avec Footer inline
│   ├── /pricing                           # Tarifs (PAS DE FOOTER)
│   ├── /features                          # Fonctionnalités EN (DOUBLON)
│   ├── /fonctionnalites                   # Fonctionnalités FR
│   │   ├── /gestion-biens
│   │   ├── /gestion-locataires
│   │   ├── /etats-des-lieux
│   │   ├── /quittances-loyers
│   │   ├── /comptabilite-fiscalite
│   │   ├── /signature-electronique
│   │   └── /paiements-en-ligne
│   ├── /contact                           # Contact (PAS DE FOOTER)
│   ├── /blog                              # Blog
│   │   └── /blog/:slug
│   ├── /faq                               # FAQ
│   ├── /guides                            # Guides
│   ├── /a-propos                          # À propos
│   ├── /temoignages                       # Témoignages
│   ├── /modeles                           # Modèles de documents
│   ├── /solutions
│   │   ├── /proprietaires-particuliers
│   │   ├── /sci-familiales
│   │   ├── /investisseurs
│   │   ├── /administrateurs-biens
│   │   └── /dom-tom
│   ├── /outils
│   │   ├── /calcul-rendement-locatif
│   │   ├── /calcul-frais-notaire
│   │   ├── /calcul-revision-irl
│   │   └── /simulateur-charges
│   ├── /legal
│   │   ├── /terms                         # CGU
│   │   └── /privacy                       # Confidentialité
│   ├── /showcase                          # Vitrine
│   └── /rejoindre-logement                # Invitation locataire
│
├── AUTHENTIFICATION
│   ├── /auth/signin                       # Connexion
│   ├── /auth/signup                       # Inscription
│   ├── /auth/forgot-password              # Mot de passe oublié
│   ├── /auth/reset-password               # Réinitialisation
│   ├── /auth/verify-email                 # Vérification email
│   ├── /signup/role                       # Choix du rôle (ALTERNATIVE)
│   ├── /signup/plan                       # Choix du plan
│   ├── /signup/account                    # Création compte
│   └── /signup/verify-email               # Vérification
│
├── DASHBOARDS PROTEGES (auth requise)
│   ├── /owner/*                           # Espace propriétaire
│   │   ├── /owner/dashboard
│   │   ├── /owner/properties
│   │   ├── /owner/leases
│   │   ├── /owner/money
│   │   ├── /owner/documents
│   │   ├── /owner/inspections
│   │   ├── /owner/tickets
│   │   └── ...
│   ├── /tenant/*                          # Espace locataire
│   │   ├── /tenant/dashboard
│   │   ├── /tenant/lease
│   │   ├── /tenant/payments
│   │   └── ...
│   ├── /admin/*                           # Administration
│   ├── /agency/*                          # Agence
│   ├── /syndic/*                          # Syndic
│   ├── /provider/*                        # Prestataire
│   ├── /guarantor/*                       # Garant
│   └── /copro/*                           # Copropriété
│
└── ROUTES SPECIALES
    ├── /signature/:token                  # Signature document
    ├── /signature-edl/:token              # Signature EDL
    ├── /invite/:token                     # Invitation
    └── /dashboard                         # Redirection selon rôle
```

---

## PROBLEMES IDENTIFIES

### PROBLEME #1 : Liens cassés vers `/auth/register`

**Sévérité** : 🔴 Critique

**Localisation** :
- `app/pricing/page.tsx` (lignes 374, 385, 394, 403)
- `components/marketing/WhyChooseUs.tsx` (ligne 274)

**Situation actuelle** :
```tsx
router.push("/auth/register?redirect=/pricing");
```

**Comportement attendu** :
La route `/auth/register` n'existe pas. La route correcte est `/auth/signup`.

**Correction** :
```tsx
router.push("/auth/signup?redirect=/pricing");
```

**Impact** : Les utilisateurs qui cliquent sur "Commencer" depuis la page pricing obtiennent une erreur 404.

---

### PROBLEME #2 : Absence de Footer sur les pages publiques

**Sévérité** : 🟠 Majeur

**Localisation** :
- `app/pricing/page.tsx`
- `app/fonctionnalites/page.tsx`
- `app/contact/page.tsx`
- `app/faq/page.tsx`
- `app/guides/page.tsx`
- `app/temoignages/page.tsx`
- Et toutes les autres pages marketing...

**Situation actuelle** :
Le Footer est défini inline uniquement dans `app/home-client.tsx`. Les autres pages publiques n'ont pas de footer.

**Comportement attendu** :
Toutes les pages publiques devraient avoir un Footer commun avec :
- Liens légaux (CGU, Confidentialité)
- Liens de navigation (Tarifs, Fonctionnalités, Blog)
- Contact (email, téléphone)
- Copyright

**Correction recommandée** :
1. Extraire le Footer de `home-client.tsx` vers `components/layout/public-footer.tsx`
2. L'inclure dans toutes les pages publiques ou créer un layout `(marketing)` commun

---

### PROBLEME #3 : Breadcrumb non utilisé dans les dashboards

**Sévérité** : 🟠 Majeur

**Localisation** : Toutes les pages profondes des dashboards

**Situation actuelle** :
Le composant `components/ui/breadcrumb.tsx` existe et est bien conçu avec génération automatique, mais il n'est utilisé nulle part dans les pages `/owner/*`, `/tenant/*`, `/admin/*`.

**Comportement attendu** :
```
/owner/properties/123/diagnostics/dpe/upload

Breadcrumb attendu :
Accueil > Mes biens > [Nom du bien] > Diagnostics > DPE > Upload
```

**Pages critiques nécessitant un breadcrumb** :
- `/owner/properties/:id/*` (détails bien, diagnostics, etc.)
- `/owner/leases/:id/*` (détails bail, signatures, etc.)
- `/owner/inspections/:id/*` (détails EDL)
- `/tenant/inspections/:id`
- `/admin/properties/:id/*`
- `/admin/tenants/:id`

---

### PROBLEME #4 : Doublon pages fonctionnalités

**Sévérité** : 🟡 Mineur

**Localisation** :
- `app/features/page.tsx` et `app/features/features-client.tsx`
- `app/fonctionnalites/page.tsx`

**Situation actuelle** :
Deux pages de fonctionnalités existent :
- `/features` (EN) - version complète avec sections détaillées
- `/fonctionnalites` (FR) - version index avec liens vers sous-pages

**Comportement attendu** :
Pour un site français, une seule version devrait exister.

**Correction recommandée** :
- Garder `/fonctionnalites` comme page principale
- Rediriger `/features` → `/fonctionnalites`
- Ou fusionner le contenu

---

### PROBLEME #5 : Incohérence des liens d'inscription

**Sévérité** : 🟡 Mineur

**Situation actuelle** :
Plusieurs chemins d'inscription coexistent :
- `/signup/role` → Choix du rôle (utilisé dans Navbar)
- `/auth/signup` → Inscription directe (utilisé dans pages marketing)
- `/auth/register` → N'EXISTE PAS (utilisé dans pricing) ❌

**Liens dans la Navbar** (`components/layout/navbar.tsx`) :
```tsx
<Link href="/auth/signin">Connexion</Link>
<Link href="/signup/role">Inscription</Link>  // Redirige vers choix de rôle
```

**Liens dans les pages marketing** :
```tsx
<Link href="/auth/signup">Essayer gratuitement</Link>  // Direct inscription
```

**Comportement attendu** :
Unifier le parcours d'inscription. Recommandation :
- CTA principal → `/signup/role` (choix du rôle d'abord)
- Lien "Déjà un compte ?" → `/auth/signin`

---

## MATRICE DES REDIRECTIONS

| Situation | Comportement attendu | Comportement actuel | Statut |
|-----------|---------------------|---------------------|--------|
| Visiteur sur `/` | Affiche homepage | ✅ OK | ✅ |
| Visiteur sur `/owner` | Redirige vers `/auth/signin` | ✅ OK | ✅ |
| Visiteur sur `/tenant` | Redirige vers `/auth/signin` | ✅ OK | ✅ |
| Visiteur sur `/admin` | Redirige vers `/auth/signin` | ✅ OK | ✅ |
| User connecté owner sur `/tenant` | Redirige vers `/owner` | ✅ OK | ✅ |
| User connecté tenant sur `/owner` | Redirige vers `/tenant` | ✅ OK | ✅ |
| User connecté sur `/auth/signin` | Devrait rediriger vers dashboard | ⚠️ Non vérifié | 🟡 |
| Visiteur sur `/dashboard` | Redirige vers `/auth/signin` | ✅ OK | ✅ |

---

## TABLEAU DES LAYOUTS

| Route | Layout | Header | Footer | Breadcrumb | Auth |
|-------|--------|--------|--------|------------|------|
| `/` | RootLayout | Navbar | Inline | Non | Non |
| `/pricing` | RootLayout | Navbar | ✅ PublicFooter | Non | Non |
| `/fonctionnalites` | RootLayout | Navbar | ✅ PublicFooter | Non | Non |
| `/contact` | RootLayout | Navbar | ✅ PublicFooter | Non | Non |
| `/auth/*` | RootLayout | Navbar | Non | Non | Non |
| `/owner/*` | OwnerAppLayout | Sidebar | Non | ❌ A IMPLEMENTER | Oui |
| `/tenant/*` | TenantAppLayout | Sidebar | Non | ❌ A IMPLEMENTER | Oui |
| `/admin/*` | AdminLayout | Sidebar | Non | ❌ A IMPLEMENTER | Oui |

---

## PLAN D'ACTION

### Priorite 1 (Critique) - CORRIGE ✅
1. [x] **Corriger les liens `/auth/register` → `/auth/signup`**
   - `app/pricing/page.tsx` ✅
   - `components/marketing/WhyChooseUs.tsx` ✅

### Priorite 2 (Majeur) - PARTIELLEMENT CORRIGE
2. [x] **Creer un composant Footer commun**
   - `components/layout/public-footer.tsx` ✅ CREE
   - Ajoute a: `app/pricing/page.tsx` ✅
   - Ajoute a: `app/fonctionnalites/page.tsx` ✅
   - Ajoute a: `app/contact/page.tsx` ✅
   - A faire: Autres pages marketing (faq, guides, temoignages, etc.)

3. [ ] **Implementer le Breadcrumb dans les dashboards**
   - Ajouter dans `OwnerAppLayout`
   - Ajouter dans `TenantAppLayout`
   - Ajouter dans `AdminLayout`

### Priorite 3 (Mineur) - A planifier
4. [ ] **Unifier les chemins d'inscription**
   - Decider du parcours principal
   - Mettre a jour tous les liens

5. [ ] **Résoudre le doublon `/features` vs `/fonctionnalites`**
   - Rediriger `/features` → `/fonctionnalites`

---

## CHECKLIST FINALE

### Navigation publique
- [x] Homepage accessible sans auth
- [x] Toutes les pages marketing accessibles
- [x] Header public cohérent partout (Navbar)
- [ ] Footer commun sur toutes les pages ⚠️
- [x] CTA fonctionnels (sauf `/auth/register` ❌)
- [x] Liens légaux fonctionnels

### Navigation protégée
- [x] Redirection vers `/auth/signin` si non authentifié
- [x] Dashboard accessible après connexion
- [x] Navigation sidebar cohérente
- [ ] Breadcrumb présent et fonctionnel ⚠️

### Pas de doublons majeurs
- [x] Un seul composant Navbar
- [x] Layouts séparés pour chaque type de dashboard
- [ ] Doublon `/features` vs `/fonctionnalites` ⚠️

### Liens
- [x] Utilisation de Next.js Link
- [ ] Aucun lien cassé ❌ (`/auth/register`)
- [x] Middleware de protection fonctionnel

---

*Rapport généré par Claude Code le 2026-01-23*
