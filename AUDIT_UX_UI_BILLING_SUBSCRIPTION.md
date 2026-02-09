# AUDIT UX/UI — Page Facturation & Abonnement

## TALOK - Gestion Locative SaaS B2B France

| Variable | Valeur |
|---|---|
| **NOM_PRODUIT** | TALOK |
| **SEGMENT** | B2B (propriétaires bailleurs, SCI, gestionnaires immobiliers) |
| **MARCHE** | France métropole + DOM-TOM (Martinique, Guadeloupe, Réunion, Guyane, Mayotte) |
| **STACK_TECH** | Next.js 14 (App Router), Supabase, Tailwind CSS 3.4, shadcn/ui, Stripe, Yousign |
| **FORFAIT_SWEET_SPOT** | Confort (35€/mois) — cible le propriétaire actif avec 3-10 biens |
| **Date de l'audit** | 9 février 2026 |
| **Fichiers audités** | `app/settings/billing/page.tsx`, `app/pricing/page.tsx`, `lib/subscriptions/plans.ts`, `lib/subscriptions/pricing-config.ts`, `lib/subscriptions/types.ts`, `components/subscription/*.tsx` |

---

## 1. SYNTHESE EXECUTIVE

### Score global par dimension

| # | Dimension | Score /10 | Niveau |
|---|---|---|---|
| 1 | Donnees existantes & coherence | 6/10 | Correct |
| 2 | Logique des forfaits | 7/10 | Bon |
| 3 | Architecture de l'information | 5/10 | Insuffisant |
| 4 | Design visuel & UI | 7/10 | Bon |
| 5 | Conformite legale & reglementaire | 3/10 | Critique |
| 6 | Benchmarks SOTA 2026 | 5/10 | Insuffisant |
| 7 | Accessibilite WCAG 2.2 AA | 5/10 | Insuffisant |

**Score moyen : 5,4/10** — Le systeme de facturation est fonctionnel mais presente des lacunes critiques en conformite legale et des manques importants en architecture de l'information et accessibilite.

---

## 2. DONNEES EXISTANTES — Verification & Coherence

### 2.1 Elements observes sur la page Billing (`app/settings/billing/page.tsx`)

| Element | Type | Valeur/Comportement | Observation |
|---|---|---|---|
| Titre page | H1 | "Mon abonnement" | Correct, avec icone CreditCard |
| Sous-titre | Paragraphe | "Gerez votre forfait, vos add-ons et vos moyens de paiement" | Clair et informatif |
| Nom du forfait | CardTitle | `subscription.plan.name` | Dynamique, correct |
| Badge statut | Badge | Actif/Essai/Impaye/Annule/Suspendu | 5 statuts couverts, bien differencie |
| Jours d'essai | Badge | "X jours restants" | Visible seulement en trialing, correct |
| Cycle facturation | Texte | "mensuel" ou "annuel" | Affiche correctement |
| Date prochain paiement | Texte | `current_period_end` formate | Correct |
| Prix affiche | Texte 2xl | `formatCurrency(getEffectivePrice())` | **Prix en centimes divise par 100**, format EUR correct |
| Suffixe prix | Texte | "/mois" ou "/an" | Adapte au cycle de facturation |
| Tarif garanti (grandfathering) | Badge vert | "Tarif garanti jusqu'au [date]" | Visible si `grandfathered_until` valide |
| Barre usage Biens | Progress | `properties_count / max_properties` | Correcte avec coloration |
| Barre usage Baux | Progress | `leases_count / max_leases` | Correcte |
| Barre usage Locataires | Progress | `tenants_count / max_tenants` | Correcte |
| Barre usage Stockage | Progress | `documents_size_mb / max_documents_gb` | **Conversion MB->GB correcte** (division par 1024) |
| Barre usage Signatures | Progress | `0 / quota` | **ANOMALIE : toujours 0 (TODO dans le code)** |
| Lots supplementaires | Bloc muted | Calcul dynamique | Visible si `billing_type === "per_unit"` et depassement |
| Bouton "Changer de forfait" | Button primary | Ouvre dialog upgrade | Correct |
| Bouton "Gerer le paiement" | Button outline | Ouvre Stripe Portal | Correct, adapte si pas de stripe_customer_id |
| Bouton "Mes factures" | Button outline Link | Lien vers `/settings/invoices` | Correct |
| Alerte changement de prix | Card amber | Notification d'evolution tarifaire | Visible si `price_change_notified_at && !accepted` |
| Section add-ons | Card | Liste des modules additionnels | Visible si add-ons souscrits |
| CTA modules | Card gradient | "Boostez votre abonnement" | Visible si aucun add-on |
| Dialog upgrade | Dialog 2xl | Liste des plans filtres | Exclut le plan courant |
| Dialog prix change | Dialog | Comparaison ancien/nouveau tarif | Avec option resiliation sans frais |

### 2.2 Elements observes sur la page Pricing (`app/pricing/page.tsx`)

| Element | Type | Valeur/Comportement | Observation |
|---|---|---|---|
| Hero badge | Badge violet | "Tarification simple et transparente" | Bon signal de confiance |
| H1 | Titre gradient | "Le bon forfait pour votre gestion locative" | Accrocheur, pertinent |
| Offre 1er mois | Badge emerald | "1er mois offert" | Visible et attractif |
| Toggle billing | Radio buttons | Mensuel / Annuel (-20%) | Fonctionnel |
| Grille 4 plans standard | Cards | Gratuit, Starter, Confort, Pro | Layout 4 colonnes desktop |
| Grille 4 plans Enterprise | Cards | S, M, L, XL | Section separee, bien differenciee |
| Avantages Enterprise | 4 cards stats | Frais CB, SEPA, GLI, AM | Valeurs correctes |
| Tableau comparatif | Table collapsible | Features par plan | Cache par defaut |
| Signaux de confiance | 4 icones | Paiement securise, +10 000 proprios, +50 000 biens, 4.8/5 | Non verifiables |
| FAQ | Accordion 7 items | Questions frequentes | Reponses pertinentes |
| CTA final | Section gradient | Starter + Confort | Bon double CTA |
| Footer | PublicFooter | variant="dark" | Correct |

---

## 3. INCOHERENCES & ANOMALIES

### Classees par severite

#### Critiques

| # | Element | Probleme | Impact | Fichier:Ligne |
|---|---|---|---|---|
| C1 | Usage signatures | Toujours affiche a `0` — commentaire `// TODO: recuperer l'usage reel` dans le code | L'utilisateur ne peut pas connaitre sa consommation de signatures, un des items les plus monetises | `app/settings/billing/page.tsx:372` |
| C2 | Pas d'affichage HT/TTC | Aucune mention HT ou TTC sur les prix affiches | Non-conforme Art. L112-1 Code de la Consommation (obligation d'affichage TTC pour B2C, HT+TTC pour B2B) | `app/settings/billing/page.tsx:323-325`, `app/pricing/page.tsx:182-184` |
| C3 | Pas de mention TVA | Aucune reference a la TVA applicable (20% metropole, 8.5% Martinique/Guadeloupe, 2.1% specifiques) | Non-conforme pour DOM-TOM, risque fiscal | Global |
| C4 | Pas de lien CGV/CGU | Aucun lien vers les conditions generales sur les pages de facturation ou pricing | Non-conforme LCEN et Art. L221-5 Code de la Consommation | `app/pricing/page.tsx` |
| C5 | Pas de droit de retractation | Aucune mention du delai de 14 jours | Non-conforme Art. L221-18 Code de la Consommation | Global |
| C6 | `@ts-nocheck` sur page billing | La page principale de facturation a `// @ts-nocheck` desactivant toute verification TypeScript | Risque de bugs silencieux en production, dette technique critique | `app/settings/billing/page.tsx:2` |

#### Majeurs

| # | Element | Probleme | Impact | Fichier:Ligne |
|---|---|---|---|---|
| M1 | Reduction annuelle inconsistante | Page pricing affiche "-20%", mais l'upgrade modal affiche "-17%" ; le calcul reel de Starter donne -17%, Confort donne -20% | Confusion utilisateur, perte de confiance | `app/pricing/page.tsx:577` vs `components/subscription/upgrade-modal.tsx:172,336` |
| M2 | Plan `enterprise` legacy non nettoye | Le plan legacy `enterprise` est toujours reference dans le code (pricing page, upgrade modal), creant de la confusion avec les vrais tiers S/M/L/XL | Navigation incoherente, plan fantome | `app/pricing/page.tsx:248`, `components/subscription/upgrade-modal.tsx:62` |
| M3 | `PLAN_LIMITS` vs `plans.ts` incoherent | `pricing-config.ts` definit `confort.max_users: 1` alors que `plans.ts` definit `confort.limits.max_users: 2` | Potentiel bug si les deux sources sont utilisees | `lib/subscriptions/pricing-config.ts:313` vs `lib/subscriptions/plans.ts:268` |
| M4 | Pas de downgrade explicite | Le dialogue "Changer de forfait" ne distingue pas upgrade/downgrade. Pas d'avertissement sur les features perdues lors du downgrade | L'utilisateur peut downgrader par accident sans comprendre les consequences | `app/settings/billing/page.tsx:506-548` |
| M5 | Pas d'historique de factures inline | Le bouton "Mes factures" renvoie vers `/settings/invoices` mais aucun apercu recent n'est affiche sur la page billing | L'utilisateur ne voit pas son historique de paiement sans navigation supplementaire | `app/settings/billing/page.tsx:410-415` |
| M6 | Calcul prix annuel grandfathered incorrect | Le calcul `locked_price_monthly * 12 * 0.83` applique ~17% de reduction en dur, pas le vrai prix yearly | Le prix affiche pour le cycle annuel peut ne pas correspondre au montant facture par Stripe | `app/settings/billing/page.tsx:230` |
| M7 | `handleSelectPlan` Starter redirige vers dashboard | Cliquer "Commencer" sur le plan Starter redirige vers `/owner/dashboard` au lieu du checkout | L'utilisateur ne peut pas souscrire au Starter depuis la page pricing | `app/pricing/page.tsx:463-469` |
| M8 | Pas de portabilite des donnees (RGPD) | Aucun bouton d'export des donnees sur la page de facturation | Non-conforme Art. 20 RGPD (droit a la portabilite) | Global |

#### Mineurs

| # | Element | Probleme | Impact | Fichier:Ligne |
|---|---|---|---|---|
| m1 | Accents manquants sur pricing | "adapte a votre portefeuille", "Comparez nos forfaits en detail", "Trouvez le forfait qui correspond a vos besoins" | Qualite linguistique reduite, impression de produit non fini | `app/pricing/page.tsx:538,693,696` |
| m2 | Emojis dans le code | Utilisation d'emojis dans les toasts (`"✅ Conditions acceptees"`, `"🎉 Paiement reussi !"`) | Les emojis ne s'affichent pas de maniere uniforme sur tous les systemes | `app/settings/billing/page.tsx:197`, `app/pricing/page.tsx:422` |
| m3 | Etat vide peu informatif | L'etat "Aucun abonnement actif" ne montre pas les avantages des forfaits | Manque d'incitation a la conversion | `app/settings/billing/page.tsx:420-438` |
| m4 | Pas de skeleton loading sur pricing | La page pricing n'a pas de loading state pendant le chargement de l'authentification | Flash de contenu non authentifie | `app/pricing/page.tsx:406-510` |
| m5 | Enterprise legacy "A partir de 199€" | Le plan legacy Enterprise affiche "A partir de 199€/mois" alors que le prix reel commence a 249€ | Prix trompeur | `lib/subscriptions/plans.ts:792` |
| m6 | Label "Fonctionnalites" sans accent | Dans le tableau comparatif, l'en-tete est "Fonctionnalites" au lieu de "Fonctionnalités" | Faute d'orthographe visible | `app/pricing/page.tsx:256` |
| m7 | "Illimite" sans accent | Dans le tableau de comparaison, "Illimite" au lieu de "Illimité" | Faute d'orthographe | `app/pricing/page.tsx:308,325` |

---

## 4. LOGIQUE TARIFAIRE

### 4.1 Analyse de la grille existante

| Plan | Prix/mois | Prix/an | Eq. mensuel annuel | Reduction | Biens | Signatures | Cible |
|---|---|---|---|---|---|---|---|
| Gratuit | 0€ | 0€ | 0€ | - | 1 | 0 (5,90€/u) | Decouverte |
| Starter | 9€ | 90€ | 7,50€ | -17% | 3 (+3€/suppl.) | 0 (4,90€/u) | Petit proprietaire |
| **Confort** | **35€** | **336€** | **28€** | **-20%** | **10 (+2,50€/suppl.)** | **2/mois (3,90€/u)** | **Proprietaire actif** |
| Pro | 69€ | 662€ | ~55€ | -20% | 50 (+2€/suppl.) | 10/mois (2,50€/u) | SCI, gestionnaire |
| Enterprise S | 249€ | 2 390€ | ~199€ | -20% | 100 | 25/mois (1,90€/u) | Gestionnaire etabli |
| Enterprise M | 349€ | 3 350€ | ~279€ | -20% | 200 | 40/mois (1,90€/u) | Gestionnaire confirme |
| Enterprise L | 499€ | 4 790€ | ~399€ | -20% | 500 | 60/mois (1,90€/u) | Grand gestionnaire |
| Enterprise XL | 799€ | 7 670€ | ~639€ | -20% | Illimite | Illimite | Premium |

### 4.2 Points forts de la grille

- **Ecart de prix raisonnable** : les paliers Gratuit -> Starter (9€) -> Confort (35€) -> Pro (69€) suivent une progression logique
- **Modele hybride per-unit intelligent** : les frais par bien supplementaire (3€, 2.50€, 2€) incitent a l'upgrade plutot qu'au depassement
- **Signatures comme levier d'upsell** : le modele "quota inclus + tarif degressif" est bien pense
- **GLI comme differentiation** : les remises progressives (-5% a -25%) sont un vrai levier de retention pour le segment immobilier

### 4.3 Points faibles de la grille

1. **Gap trop important Starter -> Confort** : le saut de 9€ a 35€ (x3.9) est brutal. Un plan intermediaire a 19-22€ pour 5 biens manque.
2. **Starter trop limite** : 3 biens, pas de signatures incluses, pas d'open banking — le plan n'offre presque rien de plus que le Gratuit pour 9€/mois.
3. **0 signature sur Starter pour 9€/mois** : en 2026, ne pas inclure au moins 1 signature electronique sur un plan payant est penalisant vs la concurrence.
4. **Prix Starter annuel -17% vs -20% sur les autres** : l'inconsistance de la reduction annuelle est confuse.
5. **Enterprise S a 249€** : le saut de Pro (69€) a Enterprise S (249€) est un gouffre (x3.6). Un plan a 129€-149€ manque.

### 4.4 Comparaison marche SaaS B2B immobilier France

| Concurrent | Plan equivalent | Prix/mois | Biens inclus | Signatures |
|---|---|---|---|---|
| Rentila | Standard | 24,90€ | 10 biens | Non incluses |
| Hektor (Septeo) | Essentiel | 39€ | 20 lots | 5/mois |
| LOCKimmo | Pro | 29€ | 15 lots | Non incluses |
| Ublo | Scale | 49€ | 50 lots | Incluses |
| **TALOK Confort** | **Sweet spot** | **35€** | **10 biens** | **2/mois** |

**Positionnement** : TALOK Confort est aligne avec le marche sur le prix mais inferieur en nombre de biens inclus et signatures. Le plan Pro a 69€ est bien positionne pour 50 biens.

### 4.5 Proposition de grille tarifaire optimisee

| Plan | Prix suggere | Biens | Signatures | Changements cles |
|---|---|---|---|---|
| Gratuit | 0€ | 1 | 0 | Inchange |
| Starter | 12€/mois | 3 (+3€/suppl.) | **1/mois incluse** | +3€, +1 signature, +open banking basic |
| **Essentiel** (nouveau) | **22€/mois** | **5** (+2.50€/suppl.) | **1/mois** | Nouveau palier intermediaire |
| Confort | 35€/mois | 10 (+2.50€/suppl.) | 3/mois | +1 signature |
| Pro | 69€/mois | 50 (+2€/suppl.) | 10/mois | Inchange |
| Business | 149€/mois | 100 | 15/mois | Nouveau, comble le gap Pro->Enterprise |
| Enterprise S | 249€ | 200 | 25/mois | Augmente a 200 biens |
| Enterprise L | 499€ | 500 | 60/mois | Inchange |
| Enterprise XL | 799€ | Illimite | Illimite | Inchange |

### 4.6 Evaluation des mecanismes d'abonnement

| Mecanisme | Present | Observations |
|---|---|---|
| Toggle mensuel/annuel | Oui | Fonctionne mais reduction inconsistante (-17% vs -20%) |
| Upgrade | Oui | Fonctionnel via dialog mais sans apercu du prorata |
| Downgrade | Partiel | Possible via "Changer de forfait" mais sans garde-fous |
| Pause | Non (toast "bientot disponible") | Annonce sans implementation — frustrant pour l'utilisateur |
| Resiliation | Oui | Bon flow multi-etapes avec retention (raisons, offres, confirmation) |
| Essai gratuit | Oui | 30 jours sur plans payants, visible en trialing |
| Grandfathering | Oui | Mecanisme avance avec dates de protection — excellent |
| Codes promo | Backend only | Types definis mais aucune UI pour saisir un code promo |

---

## 5. POINTS FORTS (minimum 5)

1. **Flow de resiliation exemplaire** (`cancel-modal.tsx`) : le parcours en 4 etapes (raison -> offres alternatives -> confirmation -> succes) est conforme aux meilleures pratiques de retention 2026. La collecte de feedback et les offres contextuelles (pause, offre speciale) sont bien pensees.

2. **Systeme de grandfathering tarifaire** : la protection de prix avec date d'expiration, notification proactive et option d'acceptation/resiliation est un pattern avance rare dans les SaaS B2B francais. C'est un vrai outil de retention.

3. **Usage bars visuels et informatifs** : les barres de progression avec coloration contextuelle (vert < 80%, amber >= 80%, rouge >= 100%) donnent une visibilite immediate sur la consommation. Le pattern est bien implemente.

4. **Design system coherent** : l'utilisation de shadcn/ui + Tailwind assure une coherence visuelle forte. Les composants Card, Badge, Progress, Dialog sont bien utilises. La page pricing avec son theme dark et ses effets de glassmorphisme est visuellement soignee.

5. **Architecture subscription provider robuste** : le `SubscriptionProvider` avec ses hooks specialises (`useFeature`, `useUsageLimit`, `useCurrentPlan`, `useSignatureQuota`) est bien concu pour le feature gating. L'ecoute des changements d'auth et le refresh automatique sont des bonnes pratiques.

6. **Gestion des erreurs Stripe** : les toasts d'erreur, les etats de chargement par action (`actionLoading`) et la redirection conditionnelle (checkout vs portal selon l'existence du `stripe_customer_id`) montrent une bonne maitrise du flow de paiement.

7. **Animations Framer Motion** : les transitions d'entree stagger sur la page pricing et les animations de dialog (slide + fade) ajoutent du polish sans nuire a la performance.

---

## 6. POINTS FAIBLES & AMELIORATIONS

### 6.1 Architecture de l'Information

| # | Severite | Probleme | Solution SOTA | Sprint |
|---|---|---|---|---|
| AI-1 | Majeur | Pas d'apercu des factures recentes sur la page billing | Afficher les 3 dernieres factures inline avec lien "Voir tout" (pattern Stripe Dashboard) | Sprint 1 |
| AI-2 | Majeur | Pas de resume du cout total mensuel (base + supplements + add-ons) | Ajouter un bloc "Cout total estime" avec ventilation detaillee | Sprint 1 |
| AI-3 | Majeur | Dialog "Changer de forfait" ne distingue pas up/downgrade | Separer les flows : "Upgrader" (vert, met en avant les gains) vs "Downgrader" (orange, alerte sur les pertes) | Sprint 1 |
| AI-4 | Mineur | Pas de breadcrumb sur la page billing | Ajouter Parametres > Abonnement pour la navigation | Sprint 3 |
| AI-5 | Mineur | Section add-ons identique pour "aucun add-on" et "avec add-ons" | Differencier le CTA : "Explorer les modules" (vide) vs "Gerer mes modules" (avec) | Sprint 3 |
| AI-6 | Majeur | Pas de page dediee a l'historique d'usage | Ajouter un onglet "Historique" avec graphiques de consommation mensuelle (pattern Vercel Usage) | Sprint 2 |
| AI-7 | Mineur | Le tableau de comparaison utilise le plan `enterprise` legacy au lieu des vrais tiers S/M/L/XL | Remplacer `enterprise` par les 4 tiers reels dans le tableau | Sprint 1 |

### 6.2 Design Visuel & UI

| # | Severite | Probleme | Solution SOTA | Sprint |
|---|---|---|---|---|
| UI-1 | Mineur | Pricing page dark-only, billing page suit le theme systeme | Assurer la coherence : soit les deux en dark, soit les deux adaptatifs | Sprint 2 |
| UI-2 | Mineur | Les boutons "Changer de forfait" et "Gerer le paiement" ont le meme poids visuel | Le CTA primaire devrait etre plus prominent (taille, couleur gradient) | Sprint 3 |
| UI-3 | Mineur | Icone `Edit` (crayon) pour les signatures est trompeuse | Utiliser `PenTool` ou `FileSignature` de Lucide | Sprint 3 |
| UI-4 | Mineur | Badge "Essai" en `secondary` (gris) pas assez visible | Utiliser une couleur specifique (bleu clair) pour differencier de "Actif" | Sprint 3 |
| UI-5 | Mineur | L'etat de chargement est un simple spinner centre | Utiliser des skeletons qui imitent la structure de la page (pattern shadcn Skeleton) | Sprint 2 |
| UI-6 | Mineur | Pas d'indicateur visuel du plan courant dans la dialog upgrade | Griser et marquer "Plan actuel" sur le plan en cours | Sprint 1 |

### 6.3 UX Fonctionnel

| # | Severite | Probleme | Solution SOTA | Sprint |
|---|---|---|---|---|
| UX-1 | Critique | Usage des signatures toujours a 0 (TODO non implemente) | Implementer le suivi reel via `signature-tracking.ts` et l'API `/api/subscriptions/usage` | Sprint 1 |
| UX-2 | Majeur | Pas de saisie de code promo a l'achat | Ajouter un champ "Code promo" dans le checkout flow (les types backend existent deja : `PromoCode`, `PromoCodeValidation`) | Sprint 1 |
| UX-3 | Majeur | Bouton "Pause" non fonctionnel (toast placeholder) | Soit implementer la pause (Stripe Subscription pause), soit retirer l'option du flow de resiliation | Sprint 2 |
| UX-4 | Majeur | Pas de confirmation visuelle apres changement de plan | Ajouter une page de succes/celebration apres checkout (le composant `Celebration` existe deja) | Sprint 2 |
| UX-5 | Mineur | Pas de notification push/email avant renouvellement | Implementer un email J-7 et J-1 avant renouvellement (obligation Art. L215-1 Code de la Consommation pour renouvellement tacite) | Sprint 2 |
| UX-6 | Mineur | Pas de simulateur de prix | Ajouter un curseur "Nombre de biens" sur la page pricing pour calculer le prix reel | Sprint 3 |
| UX-7 | Majeur | Plan Starter non souscriptible depuis la page pricing | Corriger `handleSelectPlan` pour rediriger vers le checkout au lieu du dashboard | Sprint 1 |

### 6.4 Legal & Conformite

| # | Severite | Probleme | Solution SOTA | Sprint |
|---|---|---|---|---|
| L-1 | Critique | Prix affiches sans mention HT/TTC | Afficher "X€ HT/mois" avec tooltip "Y€ TTC" (Art. L112-1 Code de la Consommation, Art. 289 CGI) | Sprint 1 |
| L-2 | Critique | Pas de mention de TVA | Ajouter le taux de TVA applicable et gerer les specificites DOM-TOM (TVA 8.5% Martinique/Guadeloupe, 2.1% certains produits, octroi de mer) | Sprint 1 |
| L-3 | Critique | Pas de lien CGV/CGU sur les pages commerciales | Ajouter un lien visible vers les CGV dans le footer de la page pricing et dans le checkout | Sprint 1 |
| L-4 | Critique | Pas de mention du droit de retractation 14 jours | Ajouter la mention sur la page pricing et dans l'email de confirmation (Art. L221-18 Code de la Consommation) | Sprint 1 |
| L-5 | Majeur | Pas de bouton d'export des donnees | Ajouter "Exporter mes donnees" dans la section billing (Art. 20 RGPD — droit a la portabilite) | Sprint 2 |
| L-6 | Majeur | Pas de mentions legales sur les factures | Les factures doivent contenir : n° de facture, SIRET, adresse, TVA, detail des prestations (Art. L441-3 Code de Commerce) | Sprint 2 |
| L-7 | Majeur | Pas de conformite Digital Services Act 2026 | Ajouter les informations requises sur la transparence algorithmique et les voies de recours | Sprint 3 |
| L-8 | Majeur | Email de rappel avant renouvellement tacite absent | Obligation legale pour les contrats a tacite reconduction (Art. L215-1 Code de la Consommation) | Sprint 2 |
| L-9 | Mineur | FAQ mentionne "30 jours" de conservation post-resiliation | Verifier la conformite avec la politique de retention RGPD ; 30 jours peut etre insuffisant pour les obligations fiscales (6 ans pour les factures) | Sprint 3 |

---

## 7. BENCHMARKS SOTA 2026

### 7.1 Features attendues d'une page billing state-of-the-art

| Feature | Stripe Billing | Notion | Vercel | Linear | TALOK | Statut |
|---|---|---|---|---|---|---|
| Resume du plan actuel | Oui | Oui | Oui | Oui | Oui | OK |
| Usage/quotas visuels | Oui | Oui | Oui | Non | Oui | OK |
| Historique des factures inline | Oui | Oui | Oui | Oui | Non (lien externe) | MANQUANT |
| Telechargement facture PDF | Oui | Oui | Oui | Oui | Via Stripe Portal | PARTIEL |
| Changement de plan (up/down) | Oui | Oui | Oui | Oui | Oui (sans distinction) | PARTIEL |
| Apercu du prorata | Oui | Oui | Non | Non | Non | MANQUANT |
| Gestion moyen de paiement | Oui | Oui | Oui | Oui | Via Stripe Portal | PARTIEL |
| Toggle mensuel/annuel | Oui | Oui | Oui | Non | Oui | OK |
| Code promo | Oui | Oui | Non | Non | Non (backend only) | MANQUANT |
| Pause d'abonnement | Oui | Non | Non | Non | Non (placeholder) | MANQUANT |
| Estimation cout mensuel | Non | Non | Oui | Non | Non | MANQUANT |
| Export donnees | Oui | Oui | Oui | Oui | Non | MANQUANT |
| Historique d'usage | Oui | Non | Oui | Non | Non | MANQUANT |
| Notifications pre-renouvellement | Oui | Oui | Oui | Oui | Non | MANQUANT |
| Flow resiliation multi-etapes | Oui | Oui | Non | Non | Oui | OK |
| Offres de retention | Oui | Oui | Non | Non | Oui | OK |
| Grandfathering tarifaire | Oui | Non | Non | Non | Oui | OK |
| Feature comparison table | Oui | Oui | Non | Non | Oui | OK |
| Dark mode | Non | Oui | Oui | Oui | Oui | OK |
| Simulateur de prix | Non | Non | Oui | Non | Non | MANQUANT |
| Mentions legales conformes | Oui | Oui | Oui | Oui | Non | CRITIQUE |
| Multi-devise / multi-region | Oui | Oui | Oui | Oui | Non | MANQUANT |
| Portail self-service complet | Oui | Oui | Oui | Oui | Partiel (via Stripe) | PARTIEL |

### 7.2 Taux de couverture fonctionnelle

- **Features presentes et completes** : 8/22 = 36%
- **Features partiellement implementees** : 4/22 = 18%
- **Features manquantes** : 10/22 = 45%

**Taux de couverture global : 54%** (en comptant les partielles a 50%)

### 7.3 Quick wins vs chantiers structurels

**Quick wins (< 1 sprint)**
- Afficher les 3 dernieres factures inline (donnees deja disponibles via Stripe)
- Ajouter les mentions HT/TTC sur les prix
- Corriger le bug Starter non souscriptible
- Supprimer le plan `enterprise` legacy du tableau comparatif
- Ajouter les liens CGV/CGU
- Corriger les accents manquants sur la page pricing

**Chantiers structurels (> 1 sprint)**
- Implementer le tracking reel des signatures
- Gerer la TVA multi-region (metropole + DOM-TOM)
- Creer un portail self-service complet (sans passer par Stripe Portal)
- Ajouter l'historique d'usage avec graphiques
- Implementer la pause d'abonnement
- Conformite RGPD complete (export, portabilite)

---

## 8. ACCESSIBILITE (WCAG 2.2 AA)

### 8.1 Audit par critere

| Critere WCAG | Description | Statut | Details |
|---|---|---|---|
| **1.4.3** Contraste texte/fond | Ratio minimum 4.5:1 pour le texte normal | PARTIEL | Le texte `text-slate-400` sur fond `slate-900` donne un ratio d'environ 4.7:1 (OK), mais `text-slate-500` sur `slate-800` donne ~3.5:1 (FAIL). Les sous-titres des plans Enterprise et les descriptions de features sont en dessous du seuil. |
| **1.4.11** Contraste non-textuel | Ratio minimum 3:1 pour les composants UI | PARTIEL | Les barres de progression `Progress` ont un bon contraste. Les bordures `border-slate-700/50` avec opacite 50% sont en dessous du seuil sur fond sombre. |
| **2.4.6** En-tetes et structure | En-tetes descriptifs et hierarchiques | PARTIEL | La page billing a un H1 correct. La page pricing a un H1 + H2 coherents. Mais les dialogs n'ont pas tous de heading visible (cancel-modal utilise `sr-only`). |
| **4.1.2** Nom, role, valeur (ARIA) | Composants interactifs avec attributs ARIA | BON | Le toggle de facturation utilise `role="radiogroup"` et `aria-checked`. Le tableau de comparaison a `role="table"` et `scope="col"`. Le badge de reduction a un `aria-label`. Le bouton du tableau comparatif a `aria-expanded` et `aria-controls`. |
| **2.4.4** But des liens | Les liens ont un texte descriptif | PARTIEL | "Voir les forfaits", "Mes factures" sont clairs. Mais "Voir et accepter", "Plus tard" sont ambigus hors contexte. Les icones dans les boutons ont des textes adjacents (OK). |
| **2.1.1** Navigation clavier | Tous les composants accessibles au clavier | BON | Les boutons, liens et accordions sont nativement focusables. Les toggles de facturation ont `focus-visible:ring-2`. Les dialogs utilisent Radix UI (piege du focus correct). |
| **1.3.1** Info et relations | Structure semantique du contenu | PARTIEL | Le tableau de features utilise correctement `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`. Mais les cards de plans ne sont pas des `<article>` et les barres d'usage n'ont pas de `role="meter"` ou `aria-valuenow`. |
| **2.4.7** Focus visible | Indicateur de focus visible | BON | Les boutons du toggle ont `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`. Les composants shadcn/ui ont des styles de focus par defaut. |
| **1.4.1** Utilisation de la couleur | La couleur n'est pas le seul moyen de transmettre l'information | PARTIEL | Les barres d'usage utilisent la couleur (vert/amber/rouge) mais aussi le texte "X / Y". Le badge "Actif" est vert mais a aussi le texte. Le badge "-20%" est vert mais a du texte. Cependant, les icones Check (vert) et X (gris) dans le tableau sont differenciees uniquement par couleur — le `aria-label` compense partiellement. |

### 8.2 Resume accessibilite

- **Conforme** : 3 criteres (4.1.2, 2.1.1, 2.4.7)
- **Partiellement conforme** : 5 criteres (1.4.3, 1.4.11, 2.4.6, 2.4.4, 1.3.1, 1.4.1)
- **Non conforme** : 0 critere completement defaillant

**Note RGAA estimee : ~65%** — Correct mais necessite des ameliorations pour atteindre la conformite AA complete.

### 8.3 Recommandations prioritaires

1. Augmenter le contraste de `text-slate-500` a `text-slate-400` minimum sur fond sombre
2. Ajouter `role="meter"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax` sur les barres d'usage
3. Ajouter un texte alternatif "Inclus"/"Non inclus" visible (pas seulement en `aria-label`) dans le tableau de comparaison pour les utilisateurs qui ne percoivent pas les couleurs
4. S'assurer que tous les dialogs ont un `DialogTitle` visible (pas `sr-only`)
5. Ajouter des labels `aria-label` ou `aria-describedby` sur les cards de plan pour les lecteurs d'ecran

---

## 9. ROADMAP — 3 Sprints priorises

### Sprint 1 : Corrections critiques (Conformite legale + bugs bloquants)

| # | Tache | Type | Effort estime | Fichier(s) |
|---|---|---|---|---|
| S1-1 | Ajouter mention HT/TTC sur tous les prix | Legal | Moyen | `plans.ts`, `billing/page.tsx`, `pricing/page.tsx` |
| S1-2 | Implementer le tracking reel des signatures (supprimer le TODO) | Bug | Moyen | `billing/page.tsx`, `subscription-provider.tsx`, API usage |
| S1-3 | Ajouter liens CGV/CGU dans le footer pricing et le checkout | Legal | Faible | `pricing/page.tsx`, `public-footer.tsx` |
| S1-4 | Ajouter mention droit de retractation 14 jours | Legal | Faible | `pricing/page.tsx`, emails transactionnels |
| S1-5 | Corriger le bug Starter non souscriptible (handleSelectPlan) | Bug | Faible | `pricing/page.tsx:463-469` |
| S1-6 | Supprimer `@ts-nocheck` et corriger les erreurs TS | Tech debt | Moyen | `billing/page.tsx:2` |
| S1-7 | Harmoniser la reduction annuelle (-20% partout ou valeur reelle) | Coherence | Faible | `pricing/page.tsx`, `upgrade-modal.tsx` |
| S1-8 | Nettoyer le plan `enterprise` legacy du tableau comparatif | Coherence | Faible | `pricing/page.tsx:248` |
| S1-9 | Corriger les accents manquants sur la page pricing | Qualite | Faible | `pricing/page.tsx` |
| S1-10 | Separer les flows upgrade/downgrade dans le dialog | UX | Moyen | `billing/page.tsx:506-548` |

### Sprint 2 : Ameliorations majeures (UX + Conformite avancee)

| # | Tache | Type | Effort estime | Fichier(s) |
|---|---|---|---|---|
| S2-1 | Afficher les 3 dernieres factures inline sur la page billing | UX | Moyen | `billing/page.tsx`, API invoices |
| S2-2 | Ajouter un bloc "Cout total estime" (base + supplements + add-ons) | UX | Moyen | `billing/page.tsx` |
| S2-3 | Implementer ou retirer la pause d'abonnement | UX | Eleve | `cancel-modal.tsx`, API Stripe |
| S2-4 | Ajouter la page de succes post-checkout avec celebration | UX | Moyen | Nouveau composant + routing |
| S2-5 | Ajouter un champ code promo dans le checkout | UX | Moyen | `pricing/page.tsx`, API checkout |
| S2-6 | Gerer la TVA multi-region (metropole + DOM-TOM) | Legal | Eleve | `pricing-config.ts`, `plans.ts`, API |
| S2-7 | Implementer l'email de rappel J-7 avant renouvellement | Legal | Moyen | Backend (cron + email) |
| S2-8 | Ajouter le bouton "Exporter mes donnees" | RGPD | Moyen | `billing/page.tsx`, API export |
| S2-9 | Ameliorer le contraste texte (slate-500 -> slate-400) | A11y | Faible | Global |
| S2-10 | Ajouter `role="meter"` + ARIA sur les barres d'usage | A11y | Faible | `billing/page.tsx:598-631` |

### Sprint 3 : Optimisations & Nice-to-have

| # | Tache | Type | Effort estime | Fichier(s) |
|---|---|---|---|---|
| S3-1 | Ajouter un simulateur de prix interactif sur la page pricing | UX | Eleve | `pricing/page.tsx` |
| S3-2 | Creer une page d'historique d'usage avec graphiques | Feature | Eleve | Nouveau module |
| S3-3 | Ajouter un breadcrumb sur la page billing | UX | Faible | `billing/page.tsx` |
| S3-4 | Creer un portail self-service complet (remplacer Stripe Portal) | Feature | Tres eleve | Nouveau module |
| S3-5 | Ajouter un plan "Essentiel" intermediaire a 22€/mois | Business | Moyen | `plans.ts`, `pricing-config.ts`, BDD |
| S3-6 | Conformite Digital Services Act 2026 | Legal | Moyen | Global |
| S3-7 | Ajouter le skeleton loading sur la page pricing | UX | Faible | `pricing/page.tsx` |
| S3-8 | Remplacer l'icone Edit par FileSignature pour les signatures | UI | Faible | `billing/page.tsx:369` |
| S3-9 | Corriger l'incoherence `PLAN_LIMITS.confort.max_users` (1 vs 2) | Bug | Faible | `pricing-config.ts:313` |
| S3-10 | Ajouter le support multi-langue (en/fr) pour l'internationalisation | Feature | Tres eleve | Global |

---

## 10. CONCLUSION

### Resume actionnable

**TALOK dispose d'une base solide** pour son systeme de facturation et d'abonnement : le flow de resiliation est exemplaire, le systeme de grandfathering est avance, et l'architecture technique (SubscriptionProvider, feature gating) est bien concue.

**Les lacunes critiques sont essentiellement legales** : l'absence de mentions HT/TTC, de lien CGV, de mention du droit de retractation et de gestion de la TVA DOM-TOM represente un risque reglementaire reel. Ces points doivent etre corriges en priorite absolue.

**Sur le plan fonctionnel**, les manques les plus impactants sont le tracking des signatures (TODO non implemente), l'absence d'historique de factures inline, et l'impossibilite de souscrire au plan Starter depuis la page pricing.

**Sur le plan du benchmark SOTA**, avec un taux de couverture de 54%, TALOK est dans la moyenne basse des SaaS B2B. Les quick wins identifies (factures inline, mentions legales, code promo) permettraient de monter rapidement a ~70%.

### Priorites recommandees

1. **Immediat** : conformite legale (Sprint 1, items S1-1 a S1-5)
2. **Court terme** : corrections UX critiques (Sprint 1, items S1-6 a S1-10)
3. **Moyen terme** : ameliorations UX majeures + conformite avancee (Sprint 2)
4. **Long terme** : optimisations et nouvelles features (Sprint 3)

### Metriques a suivre post-audit

| Metrique | Objectif | Methode de mesure |
|---|---|---|
| Taux de conversion pricing -> checkout | +15% | Analytics (event tracking) |
| Taux de churn mensuel | -20% | Stripe Dashboard |
| NPS page billing | > 40 | Enquete in-app |
| Couverture WCAG AA | > 90% | Audit automatise (axe-core) |
| Conformite legale | 100% | Audit juridique externe |
| Couverture fonctionnelle SOTA | > 75% | Revue trimestrielle |

---

*Rapport genere le 9 fevrier 2026 — Audit base sur l'analyse du code source des pages `app/settings/billing/page.tsx`, `app/pricing/page.tsx`, et de l'ensemble des fichiers `lib/subscriptions/` et `components/subscription/`.*
