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
destinée au marché français (métropole + DOM-TOM).

**Tagline :** "Gérez vos locations sans prise de tête"
**Phrase clé :** "Vous en avez marre de jongler entre les outils ?"
**Domaine :** talok.fr | App ID mobile : com.gestionlocative.app
**Support :** support@talok.fr

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

---

## 3. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Runtime | Node.js ≥20 |
| Base de données | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth + 2FA TOTP + Passkeys (WebAuthn) |
| Paiements | Stripe (Connect, Checkout, Webhooks) + GoCardless (SEPA) |
| Email | Resend |
| SMS | Twilio |
| Push | Firebase Admin + Web Push |
| Cache | Upstash Redis |
| IA | OpenAI GPT-4 + LangChain + LangGraph + Vercel AI SDK |
| OCR | Tesseract.js |
| UI | Tailwind CSS + Radix UI + Framer Motion |
| Charts | Recharts |
| Icônes | Lucide React |
| State | Zustand + TanStack Query + SWR (legacy) |
| Forms | React Hook Form + Zod |
| PDF | pdf-lib + html2pdf.js |
| Maps | Leaflet + React-Leaflet |
| Mobile | Capacitor v8 (iOS + Android) |
| Déploiement | Netlify |
| Monitoring | Sentry (non branché sur error-boundary — bug) |
| Analytics | PostHog |
| Fonts | Manrope (display) + Space Grotesk (mono) |

---

## 4. Charte graphique

| Élément | Valeur |
|---------|--------|
| Bleu principal | `#2563EB` |
| Bleu vif accent | `#3B82F6` |
| Navy texte | `#1B2A6B` |
| Gradient icône | `#1D4ED8` → `#60A5FA` |
| Fond dark | `#0F172A` |
| Card dark | `#1E293B` |
| Font display | Manrope ExtraBold |
| Font mono | Space Grotesk |
| Logo | Maison + serrure intégrée dans le "a" de TALOK |

**Dark mode locataire** ✅ correct (fond `#0F172A`)
**Dark mode propriétaire** ❌ cassé (fond gris argenté — composants utilisent `bg-white` hardcodé)

---

## 5. Fonctionnalités principales

### Gestion des baux
- Types : nu, meublé, colocation, saisonnier, étudiant, parking
- Workflow en étapes guidées avec "Lecture métier unifiée" (sidebar checklist)
- Signature électronique SES/AES/QES (eIDAS) avec OTP et preuve PDF
- Contrat scellé juridiquement avec certificat
- Résiliation, renouvellement, préavis

### Gestion des biens
- CRUD propriétés (appartement, maison, colocation, saisonnier, studio, box)
- DPE, surface, pièces, chauffage, équipements, zone encadrement loyers
- Compteurs connectés (Enedis, GRDF, Veolia) + OCR via photo
- Carte Leaflet intégrée, digicode, notes privées

### Finances & Paiements
- Quittances automatiques mensuelles
- Paiement CB (Stripe), virement, prélèvement SEPA
- Stripe Connect pour propriétaires (transferts, commissions)
- Dépôt de garantie (réception, restitution, retenue)
- Régularisation annuelle des charges

### Comptabilité
- Plan comptable français (classes 1-9)
- Export FEC (conformité fiscale)
- Rapprochement bancaire (GoCardless)
- Grand livre, balance, CRG
- Open Banking (lecture seule, auto-matching loyers)

### États des lieux
- Pièce par pièce, 6 niveaux (neuf → hors usage)
- Photos/vidéos par élément
- Relevés de compteurs intégrés
- Comparaison entrée/sortie automatique
- Signature multi-parties (propriétaire, locataire, témoin)

### Tickets & Travaux
- Création par locataire ou propriétaire
- Ordre de travaux, devis prestataire, approbation, suivi
- Assistant IA "Tom" pour diagnostic automatique

### Colocation avancée
- Planning tâches ménagères avec rotation automatique
- Règlement intérieur versionné + acceptation tracée
- Partage pondéré des loyers

### Syndic / Copropriété
- Gestion des sites, immeubles, lots, tantièmes
- Assemblées générales (draft → convoquée → en cours → terminée)
- Appels de fonds, dépenses, régularisation charges
- ⚠️ AG en mock data — vote et PV non implémentés

### IA intégrée
- Scoring dossier locataire (GPT-4)
- Suggestion retenue dépôt de garantie (LangGraph)
- Brouillon réponse tickets
- Assistant onboarding "Tom" (conversationnel)
- Analyse OCR documents

### Autres
- Messagerie temps réel (threads par bail, ticket)
- Notifications multi-canal (email, push, SMS, in-app)
- GED (bibliothèque, coffre-fort, alertes expiration)
- RGPD complet (accès, rectification, effacement, portabilité)
- White-label (3 niveaux)
- App mobile iOS/Android (Capacitor)
- "Mes droits de locataire" — unique sur le marché

---

## 6. Grille tarifaire

| Plan | Prix HT/mois | Biens | Users | Signatures/mois | Stockage |
|------|-------------|-------|-------|----------------|----------|
| Gratuit | 0€ | 1 | 1 | 0 | 100 MB |
| Starter | 9€ | 3 | 1 | 0 | 1 GB |
| Confort ⭐ | 35€ | 10 | 2 | 2 | 5 GB |
| Pro | 69€ | 50 | 5 | 10 | 30 GB |
| Enterprise S | 249€ | 100 | ∞ | 25 | 50 GB |
| Enterprise M | 349€ | 200 | ∞ | 40 | 100 GB |
| Enterprise L | 499€ | 500 | ∞ | 60 | 200 GB |
| Enterprise XL | 799€ | ∞ | ∞ | ∞ | ∞ |

**Annuel = -20% sur tous les plans**
**1er mois offert** sur Starter, Confort, Pro

### Frais paiements
- CB : 2,2% (standard) / 1,9% (Enterprise)
- SEPA : 0,50€/tx (standard) / 0,40€/tx (Enterprise)
- Virement : gratuit

### Signature extra (au-delà du quota)
- Gratuit/Starter : 5,90€/4,90€ l'unité
- Confort : 3,90€ | Pro : 2,50€ | Enterprise S/M/L : 1,90€ | XL : 0€

### Addons
- Pack Relances avancées : 4,90€/mois
- Export Comptable : 4,90€/mois
- Rapport Fiscal : 9,90€/an
- Analytique Multi-biens : 9,90€/mois
- Scoring Locataire Basic : 9,90€/dossier
- Scoring Locataire Advanced (GPT-4) : 14,90€/dossier
- SMS : 0,15€/unit | Pack 10 : 1,20€ | Pack 50 : 5€

### Remise GLI
Starter -5% → Confort -10% → Pro -15% → Ent S -18% → Ent M -20% → Ent L -22% → XL -25%

### White-Label
- Basic (Ent M) : logo, couleur, nom, email custom
- Full (Ent L) : + favicon, domaine custom, page login, suppression "Powered by Talok"
- Premium (Ent XL) : + CSS custom, SSO SAML/OIDC, multi-organisations, API Branding

---

## 7. Bugs connus & priorités

### 🔴 PRIORITÉ ABSOLUE (bloquants production)

| Bug | Impact | Fichier |
|-----|--------|---------|
| Facture initiale non générée | Aucun bail ne peut être activé | `/supabase/functions/receipt-generator/` + `/api/pdf/generate` |
| 10+ emails non envoyés | Locataires/garants jamais notifiés | Chercher TODO email dans le code |
| Intent Stripe/GoCardless incomplet | Paiements impossibles | `/api/v1/invoices/[iid]/payments` |
| CSRF non bloquant sans secret | Faille sécurité production | `lib/security/` |
| Rate-limiting mémoire | Non scalable | Remplacer par Upstash Redis (déjà installé) |

### 🟠 PRIORITÉ HAUTE (qualité)

| Bug | Impact |
|-----|--------|
| Dark mode propriétaire cassé (gris argenté) | Image produit dégradée |
| Tickets hardcodés à 0 | Stats fausses dashboard |
| "Dans 0 jour(s)" forfait Starter | Bug affichage date |
| Erreurs Stripe brutes affichées | Jargon technique visible user |
| "Taux d'occupation 0%" rouge | Anxiogène, mal calculé |
| Activité récente vide (Supabase Realtime non branché) | Dashboard incomplet |
| Visites locataire : "Erreur de chargement" | Bug API réservations |
| Aperçu contrat PDF vide côté locataire | PDF ne se charge pas |

### 🟡 PRIORITÉ NORMALE (dette technique)

| Problème | Action |
|----------|--------|
| 50+ composants dépréciés | Nettoyer (OwnerKpiCard → KpiCard, etc.) |
| ~80 fichiers .md audit à la racine | Déplacer vers /docs/audits/ |
| ~50 scripts .sql à la racine | Déplacer vers /supabase/fixes/ |
| 4 console.log de debug en prod | Supprimer |
| Sentry non branché error-boundary | Brancher |
| Suspension utilisateur admin manquante | Implémenter |
| Signature garants (eIDAS) TODO | Implémenter |

### 🔵 FONCTIONNALITÉS MANQUANTES

| Feature | Module |
|---------|--------|
| Vote en AG | Syndic |
| Génération PV d'assemblée | Syndic |
| Bibliothèque documents copro | Syndic |
| Calcul retenue dépôt de garantie EDL | Fin de bail |
| Templates EDL prédéfinis par type | EDL |
| Barre de progression onboarding proprio | UX |
| Navigation retour entre étapes onboarding | UX |
| Tableau comparatif pricing (placeholder vide) | Marketing |
| Registre invités colocation (UI manquante) | Colocation |

---

## 8. Architecture fichiers clés

```
TALOK/
├── app/
│   ├── (marketing)/          # 24 pages publiques
│   ├── owner/                # 31 sous-répertoires propriétaire
│   ├── tenant/               # 8 sous-répertoires locataire
│   ├── syndic/               # 9 sous-répertoires syndic
│   ├── agency/               # 14 sous-répertoires agence
│   ├── provider/             # 14 sous-répertoires prestataire
│   ├── guarantor/            # 7 sous-répertoires garant
│   ├── admin/                # 22 sous-répertoires admin
│   └── api/                  # 457 routes API
├── components/               # 331 fichiers
├── features/                 # 28 modules métier
├── lib/
│   ├── subscriptions/plans.ts          # Définitions des plans
│   ├── subscriptions/pricing-config.ts # Config tarifaire complète
│   ├── white-label/types.ts            # Types white-label
│   ├── services/                       # Services métier
│   ├── supabase/                       # Client & queries
│   ├── stripe/                         # Stripe utils
│   ├── ai/                             # Intégrations IA
│   └── hooks/                          # 61 hooks custom
├── supabase/
│   ├── migrations/           # 325 migrations SQL
│   └── functions/            # 11 Edge Functions
│       ├── receipt-generator/  # ⚠️ Génération quittances (TODO)
│       ├── generate-pdf/       # ⚠️ PDF (TODO)
│       └── sepa-auto-collect/  # ⚠️ Bug IPs dynamiques
└── tailwind.config.ts        # Design system Talok
```

---

## 9. Pages marketing (24 pages complètes)

### Navigation publique
- **Produit** : 7 pages fonctionnalités + 4 outils gratuits
- **Solutions** : 5 personas (Propriétaires, Admins biens, SCI, Investisseurs, DOM-TOM)
- **Ressources** : Blog, Guides, FAQ, Audit, Témoignages
- **Tarifs** : Page pricing complète

### Outils gratuits (différenciateurs SEO)
- Calcul rendement locatif
- Simulateur révision IRL
- Frais de notaire
- Simulateur charges locatives

### Spécificité DOM-TOM (avantage concurrentiel unique)
- Né en Martinique — seule solution locative native Antilles
- TVA spécifique : 8,5% Antilles/Réunion, 2,1% Guyane, 0% Mayotte
- 5 régions : Martinique 800+, Guadeloupe 650+, Guyane 150+, Réunion 400+, Mayotte 50+

---

## 10. Ce qui différencie Talok de la concurrence

Aucun concurrent ne combine :
1. **Courte + longue durée** dans la même app
2. **Syndic intégré** (pas juste locatif)
3. **Colocation avancée** (planning ménage, règlement, partage)
4. **Mise en relation prestataires** directement dans l'app
5. **IA intégrée** (fin de bail, tickets, OCR, scoring)
6. **App mobile iOS/Android** native (Capacitor)
7. **White-label** pour agences
8. **Compteurs connectés** (Enedis, GRDF, Veolia)
9. **Comptabilité complète** avec export FEC
10. **"Mes droits de locataire"** — module légal unique sur le marché
11. **Né en DOM-TOM** — seule solution native Antilles

---

## 11. Règles importantes pour Claude Code

### NE JAMAIS toucher sans instruction explicite
- La base Supabase en production (migrations irréversibles)
- Les fichiers de configuration des plans (`lib/subscriptions/plans.ts`)
- Les templates de baux (documents juridiques)
- Les Edge Functions Supabase en production

### Toujours faire
- Tester sur le bail `da2eb9da` existant (bail de test disponible)
- Vérifier SSG/SSR pour toute page publique (SEO critique)
- Utiliser les variables CSS du design system (pas de couleurs hardcodées)
- Respecter le RBAC existant pour toutes les API routes
- Préfixer les nouvelles migrations SQL avec timestamp

### Pour le dark mode
- Dark mode locataire = référence correcte (`#0F172A`)
- Dark mode propriétaire = à corriger (remplacer `bg-white` par `bg-card`)
- Variables CSS dark à définir dans `globals.css`

### Pour les emails
- Provider : Resend (déjà installé)
- Templates dans `/lib/email/` et `/lib/templates/`
- Chercher les TODO avec : `grep -r "TODO.*email\|TODO.*send\|TODO.*notify" --include="*.ts"`
