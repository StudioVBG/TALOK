---
name: talok-context
description: >
  Contexte complet du projet Talok — plateforme SaaS de gestion locative française.
  Utilise ce skill pour TOUTE tâche liée à Talok : corrections de bugs, nouvelles features,
  site vitrine, prompts, templates, architecture, design, copywriting.
  Déclenche dès que l'utilisateur mentionne Talok, gestion locative, bail, loyer,
  locataire, propriétaire, syndic, EDL, quittance, ou toute feature de l'app.
---

# Talok — Contexte complet du projet

## 1. Identité produit

**Talok** est une plateforme SaaS de gestion locative tout-en-un, née en Martinique,
destinée au marché français (métropole + France d'outre-mer).

**Positionnement :** "TALOK — LE Logiciel de Gestion Locative"
**Tagline :** "Tout ce dont vous avez besoin pour gérer vos locations est dans un seul endroit."
**Phrase clé :** "Vous gérez vos locations avec 5 outils différents ?"
**Fil conducteur marketing :** Simplicité tout-en-un
**Domaine :** talok.fr | App ID mobile : com.gestionlocative.app
**Support :** support@talok.fr

### TERMINOLOGIE OFFICIELLE OBLIGATOIRE
- JAMAIS "DOM-TOM" (obsolète depuis 2003)
- Titres/badges : "France d'outre-mer" ou "Outre-mer"
- Textes officiels : "DROM-COM"
- Les 5 départements : "DROM" (Martinique, Guadeloupe, Guyane, Réunion, Mayotte)
- "Antilles" = Martinique + Guadeloupe uniquement

### Terminologie produit — Zéro jargon technique
| Terme technique | Terme humain |
|----------------|-------------|
| eIDAS | "La même valeur légale qu'un original papier" |
| ALUR / ELAN | "conforme à la loi" |
| SEPA | "prélèvement automatique" |
| FEC | "export pour votre comptable" |
| DPE | "diagnostic énergétique" |
| Stripe / Supabase | Ne jamais mentionner |
| API | Uniquement page Enterprise |
| 2FA / TOTP | "double vérification de sécurité" |

---

## 2. Public cible (7 rôles)

| Rôle | Description |
|------|-------------|
| `owner` | Propriétaires particuliers, SCI, investisseurs |
| `tenant` | Locataires, colocataires |
| `provider` | Artisans, entreprises d'intervention |
| `agency` | Administrateurs de biens, agences |
| `guarantor` | Garants de locataires |
| `syndic` | Syndics de copropriété |
| `admin` | Administrateurs de la plateforme |

**Cible principale marketing :** Équilibre propriétaires particuliers + investisseurs/SCI

---

## 3. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Runtime | Node.js >= 20 |
| Base de données | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth + 2FA TOTP + Passkeys (WebAuthn) |
| Paiements | Stripe (Connect, Checkout) + GoCardless (SEPA) |
| Email | Resend (lib/emails/resend.service.ts) |
| SMS | Twilio |
| Push | Firebase Admin + Web Push |
| Cache | Upstash Redis |
| IA | OpenAI GPT-4 + LangChain + LangGraph + Vercel AI SDK |
| OCR | Tesseract.js |
| UI | Tailwind CSS + Radix UI + Framer Motion |
| Charts | Recharts |
| State | Zustand + TanStack Query + SWR (legacy) |
| Forms | React Hook Form + Zod |
| PDF | pdf-lib + html2pdf.js |
| Maps | Leaflet + React-Leaflet |
| Mobile | Capacitor v8 (iOS + Android) |
| Deploiement | Netlify |
| Monitoring | Sentry (installé, non branché error-boundary) |
| Analytics | PostHog |
| Fonts | Manrope (display) + Space Grotesk (mono) |

---

## 4. Charte graphique

| Element | Valeur |
|---------|--------|
| Bleu principal | #2563EB |
| Bleu accent | #3B82F6 |
| Bleu gradient fin | #60A5FA |
| Navy texte | #1B2A6B |
| Gradient | #1D4ED8 -> #3B82F6 -> #60A5FA (135 deg) |
| Fond dark | #0F172A |
| Card dark | #1E293B |
| Font display | Manrope ExtraBold |
| Font mono | Space Grotesk |
| Logo | Maison + serrure (keyhole) dans le "a" de TALOK |

### Logos SVG disponibles
- talok-logo-bleu-gradient.svg (544x422px)
- talok-logo-horizontal-badge.svg (704x282px)
- talok-icon-app.svg (320x230px)
- talok-monochrome-navy.svg (602x252px)
- talok-logo-inverse-sombre.svg (402x288px)
- talok-logo-noir.svg (418x290px)
- talok-logo-horizontal-navy.svg (608x230px)

### Dark mode
- Locataire : correct (#0F172A)
- Proprietaire : CORRIGE — bg-white -> bg-card (57 fichiers + modules documents)

---

## 5. Bugs corrigés (session complète)

### Tous résolus et déployés

| Bug | Solution |
|-----|----------|
| Facture initiale bloquée | Handler Inspection.Signed + ensureInitialInvoiceForLease() |
| 11 emails non envoyés | Branchement Resend sur toutes les routes API |
| Dark mode propriétaire | 57 fichiers + modules documents : bg-white -> bg-card |
| Erreurs Stripe brutes | Dictionnaire 25 codes FR |
| Tickets KPI à 0 | Guard propertyIds.length === 0 |
| Biens vides (localStorage) | Validation activeEntityId |
| Paiement en double | Contrainte UNIQUE partielle DB |
| Bail non activé | UPDATE leases SET status=active |
| "Dans 0 jour(s)" | formatBillingCountdown() |
| Nettoyage repo | 50 .md, 21 .sql, 230 console.log |
| Documents SOTA | 7 fichiers créés, 13 modifiés (voir skill talok-documents-sota) |

### Bugs en cours / à finaliser
| Bug | État |
|-----|------|
| /owner/invoices/[id] crash (RangeError date) | À corriger — safeDate() |
| Dashboard : Biens=0 Baux=0 | À corriger — filtre entityId |
| Tickets : chargement infini | À corriger |
| Compte bancaire : champs en double | À corriger |
| /pricing → redirect app si connecté | À corriger middleware |
| CNI recto/verso : groupement pas raccordé | À raccorder dans documents-list.tsx |
| Titres anciens documents bruts | Migration SQL UPDATE à appliquer |
| Quittances non générées | receipt-generator.ts à brancher webhook Stripe |

---

## 6. Grille tarifaire

| Plan | Prix HT/mois | Biens | Users | Signatures/mois | Stockage |
|------|-------------|-------|-------|----------------|----------|
| Gratuit | 0 euros | 1 | 1 | 0 | 100 MB |
| Starter | 9 euros | 3 | 1 | 0 | 1 GB |
| Confort (star) | 35 euros | 10 | 2 | 2 | 5 GB |
| Pro | 69 euros | 50 | 5 | 10 | 30 GB |
| Enterprise S | 249 euros | 100 | inf | 25 | 50 GB |
| Enterprise M | 349 euros | 200 | inf | 40 | 100 GB |
| Enterprise L | 499 euros | 500 | inf | 60 | 200 GB |
| Enterprise XL | 799 euros | inf | inf | inf | inf |

Annuel = -20% | 1er mois offert sur Starter, Confort, Pro

---

## 7. Site vitrine talok.fr

### Statut
Landing page déployée sur talok.fr. Structure complète, corrections visuelles en cours.

### Corrections visuelles à appliquer
- H1 : 52-56px minimum
- Innovation bar : icônes 28px, padding 24px
- Cards arguments : padding 32px, icône 52x52px
- Features : illustrations height 280px minimum
- Pricing Confort : border 2px solid #2563EB
- Typographie globale : Manrope partout, sections padding 96px

### Copywriting validé
Hero : "TALOK — LE Logiciel de Gestion Locative"
"Gérez vos locations, encaissez vos loyers et dormez tranquille."

Innovation bar : IA intégrée | Toujours conforme à la loi
App iPhone & Android | Données sécurisées en France | Né en Martinique

4 arguments : 3h/semaine | 2000 euros/an vs agence
Contrats 5 min (valeur légale garantie) | Dormez tranquille

Section outre-mer : "TALOK est né en Martinique. Pas adapté — né ici."
TVA : Martinique/Guadeloupe/Réunion 8,5% | Guyane 2,1% | Mayotte 0%

---

## 8. Architecture fichiers clés

```
TALOK/
├── app/(marketing)/     # Site vitrine
├── app/owner/           # 31 sous-repertoires
├── app/tenant/          # 8 sous-repertoires
├── app/api/             # 457 routes API
├── lib/
│   ├── accounting/
│   │   ├── index.ts             # Barrel export
│   │   ├── engine.ts            # Double-entry CRUD, 14 auto-entries
│   │   ├── fec.ts               # Générateur FEC 18 champs
│   │   ├── reconciliation.ts    # Rapprochement bancaire auto
│   │   └── chart-amort-ocr.ts   # Plan comptable, amortissements, OCR
│   ├── documents/
│   │   ├── constants.ts         # SOURCE UNIQUE types, MIME, labels
│   │   ├── format-name.ts       # getDisplayName()
│   │   ├── group-documents.ts   # groupDocuments()
│   │   └── receipt-generator.ts # A CREER
│   ├── subscriptions/plans.ts
│   ├── billing-utils.ts         # formatBillingCountdown() corrigé
│   ├── emails/resend.service.ts # Email service complet
│   └── hooks/                   # 61 hooks custom
├── features/documents/components/
│   └── grouped-document-card.tsx # CNI recto/verso groupées
├── stores/
│   └── useEntityStore.ts    # Validation activeEntityId corrigée
├── supabase/
│   ├── migrations/          # 325+ migrations SQL
│   └── functions/           # 11 Edge Functions
└── docs/audits/             # 50 fichiers .md nettoyés
```

---

## 9. Comptes de test

- Bail test : da2eb9da-1ff1-4020-8682-5f993aa6fde7 (Fort-de-France)
- Proprio test : contact.explore.mq@gmail.com (Marie-Line VOLBERG)
- Locataire test : volberg.thomas@hotmail.fr (Thomas VOLBERG)

---

## 10. Ce qui différencie Talok

1. Courte + longue durée dans la même app
2. Syndic intégré
3. Colocation avancée (planning, règlement, partage)
4. Mise en relation prestataires dans l'app
5. IA intégrée (scoring GPT-4, OCR, tickets)
6. App mobile iOS/Android native (Capacitor)
7. White-label pour agences
8. Compteurs connectés (Enedis, GRDF, Veolia)
9. Comptabilité complète avec export FEC
10. "Mes droits de locataire" — module légal unique
11. Né en France d'outre-mer — seule solution native Antilles
12. DROM-COM natif — TVA, codes postaux, spécificités locales

---

## 11. Règles Claude Code

### NE JAMAIS
- Toucher base Supabase production sans instruction explicite
- Toucher lib/subscriptions/plans.ts
- Toucher les templates de baux
- Hardcoder des types de documents (utiliser lib/documents/constants.ts)
- Insérer dans documents sans title ni original_filename
- Utiliser useCreateDocument pour les uploads

### TOUJOURS
- Importer depuis lib/documents/constants.ts
- SSG/SSR obligatoire pour app/(marketing)/
- Variables CSS design system (jamais couleurs hardcodées)
- RBAC respecté sur toutes les API routes
- Préfixer migrations SQL avec timestamp YYYYMMDDHHMMSS
- Wrapper emails en try/catch
- Mobile-first : commencer par 320px
- Respecter prefers-reduced-motion pour les animations

---

## 12. Renvois croisés entre skills

| Sujet | Skill source unique | Ne PAS dupliquer ici |
|-------|-------------------|---------------------|
| Documents : upload, storage, GED, quittances | `talok-documents-sota` | types, bucket, hooks React |
| Comptabilité : écritures, FEC, rapprochement, plan comptable | `talok-accounting` | tables SQL compta, engine, TVA OCR |
| Onboarding : inscription, emails, tour guidé | `talok-onboarding-sota` | flow, WelcomeModal, emails |
| Feature gating comptabilité (matrice par plan) | `talok-accounting` section 9 | OCR, FEC, connexions par plan |
| TVA validation justificatifs utilisateurs | `talok-accounting` (TVA_RATES) | taux DROM-COM pour OCR |
| Grille tarifaire Talok (prix, limites) | ICI section 6 | — source unique — |
