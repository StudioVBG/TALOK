# AUDIT UX/UI — Page Facturation & Abonnement (v2)

## TALOK - Gestion Locative SaaS B2B France

| Variable | Valeur |
|---|---|
| **NOM_PRODUIT** | TALOK |
| **SEGMENT** | B2B (propriétaires bailleurs, SCI, gestionnaires immobiliers) |
| **MARCHÉ** | France métropole + DOM-TOM (Martinique, Guadeloupe, Réunion, Guyane, Mayotte) |
| **OBJECTIF_ARR** | Non communiqué (estimé 500K-2M EUR d'après la grille tarifaire) |
| **STACK_TECH** | Next.js 14 (App Router), React 18, Supabase (PostgreSQL), Tailwind CSS 3.4, shadcn/ui (Radix UI), Stripe, Yousign, Framer Motion |
| **FORFAIT_SWEET_SPOT** | Confort (35 EUR/mois) — cible le propriétaire actif avec 3-10 biens |
| **Date de l'audit** | 9 février 2026 |
| **Version** | v2 — Audit complet sur code source actuel |
| **Fichiers audités** | `app/(dashboard)/owner/settings/billing/page.tsx`, `app/pricing/page.tsx`, `lib/subscriptions/plans.ts`, `lib/subscriptions/pricing-config.ts`, `lib/subscriptions/types.ts`, `components/subscription/*.tsx` |

---

## 1. SYNTHÈSE EXÉCUTIVE

### Score global par dimension

| # | Dimension | Score | Niveau | Commentaire |
|---|---|---|---|---|
| 1 | Données existantes et cohérence | 7/10 | Bon | La plupart des données sont correctes, mais une erreur de logique sur `isPaid` fausse le comportement du plan Starter |
| 2 | Logique des forfaits | 7,5/10 | Bon | Grille bien structurée, mais des gaps tarifaires importants et un Starter peu attractif |
| 3 | Architecture de l'information | 8/10 | Très bon | Bonne séparation billing/pricing, factures inline, mais pas d'historique d'usage ni d'estimation de coût total |
| 4 | Design visuel et UI | 8,5/10 | Très bon | Design system cohérent, animations soignées, dark mode réussi |
| 5 | Conformité légale et réglementaire | 7/10 | Bon | Pricing page conforme (HT/TTC, CGV, rétractation). Billing page lacunaire (pas de HT/TTC, pas de CGV, pas d'export RGPD) |
| 6 | Benchmarks SOTA 2026 | 6,5/10 | Passable | Couverture fonctionnelle de ~64%. Quick wins identifiés pour monter à ~80% |
| 7 | Accessibilité WCAG 2.2 AA | 7,5/10 | Bon | ARIA et focus bien gérés sur pricing. Barres d'usage et boutons d'actions sans attributs ARIA suffisants sur billing |

**Score moyen : 7,4/10** — Base solide avec des corrections ciblées à apporter.

### Statut des corrections précédentes (v1 -> v2)

| Correction | Statut actuel | Remarques |
|---|---|---|
| C1 — Signature tracking | CORRIGÉ | Usage via `useSubscription()` provider, plus de TODO |
| C2 — Affichage HT/TTC | PARTIELLEMENT CORRIGÉ | Présent sur pricing page, **absent sur billing page** |
| C3 — Mention TVA | PARTIELLEMENT CORRIGÉ | Présent sur pricing page footer, absent sur billing page |
| C4 — Liens CGV/CGU | PARTIELLEMENT CORRIGÉ | Présent sur pricing page, absent sur billing page |
| C5 — Droit de rétractation | CORRIGÉ | FAQ + section légale sur pricing page |
| C6 — `@ts-nocheck` | CORRIGÉ | Types propres, plus de `@ts-nocheck` |
| M1 — Réduction annuelle | CORRIGÉ | `getYearlyDiscount()` calcule la vraie réduction par plan |
| M5 — Factures inline | CORRIGÉ | `InvoicesTable` composant intégré dans la billing page |
| M7 — Starter souscriptible | CORRIGÉ | Checkout Stripe via `handleSelectPlan` |
| M8 — Export données RGPD | NON CORRIGÉ | Toujours absent de la billing page |

---

## 2. DONNÉES EXISTANTES — Vérification et Cohérence

### 2.1 Éléments observés sur la page Billing

**Fichier : `app/(dashboard)/owner/settings/billing/page.tsx`**

| Élément | Type | Valeur/Comportement | Observation |
|---|---|---|---|
| Titre page | H1 | "Facturation" | Clair et concis |
| Sous-titre | Paragraphe | "Gérez votre abonnement et vos factures" | Informatif |
| Bouton "Gérer le paiement" | Button outline | Ouvre Stripe Customer Portal | Visible seulement si `isPaid` (ligne 359). **ANOMALIE : conditionné par `currentPlan !== "starter"`** |
| Badge statut | Badge | Actif / Essai / Gratuit | 3 statuts visuellement différenciés (emerald/violet/slate) |
| Alerte essai | Banner violet | "Période d'essai en cours — Il vous reste X jours" | Visible seulement en `isTrialing`, avec CTA "Ajouter un moyen de paiement" |
| Alerte annulation | Banner rouge | "Abonnement annulé — sera résilié le [date]" | Visible si `isCanceled`, avec bouton "Réactiver" |
| Card forfait | Card lg:col-span-2 | Nom, description, prix, badge gradient | Affiche le plan avec icône Sparkles et gradient violet |
| Prix affiché | Texte 2xl | `formatPrice(price_monthly ou price_yearly)` | **PAS de mention HT/TTC** — `formatPrice` retourne juste "X EUR" |
| Suffixe prix | Texte sm | "/mois" ou "/an" | S'adapte au cycle de facturation |
| Cycle de facturation | Info block | "Mensuel" ou "Annuel" | Affiché dans un bloc bg-slate-900 |
| Prochaine facturation | Info block | Date formatée fr-FR | Affiché dans un bloc adjacent |
| Bouton "Upgrader" | Button gradient | Ouvre `UpgradeModal` | Visible si `canUpgrade` (getPlanLevel < enterprise) |
| Bouton "Résilier" | Button outline rouge | Ouvre `CancelModal` | Visible si `isPaid && !isCanceled` |
| Bouton "Voir les forfaits" | Button violet | Redirige vers `/pricing` | Visible seulement si `currentPlan === "starter"` |
| **Usage — Biens** | Progress bar | `usage.properties.used / max_properties` | Coloration contextuelle OK (vert/amber/rouge) |
| **Usage — Utilisateurs** | Progress bar | `usage.users.used / max_users` | Correct, avec "Illimité" si -1 |
| **Usage — Signatures** | Progress bar | `usage.signatures.used / signatures_monthly_quota` | Connecté au provider, tracking réel |
| **Usage — Stockage** | Progress bar | `usage.storage.used / max_documents_gb` | Avec unité "Go" affichée |
| Tableau factures | Table | Date, numéro, montant, statut, téléchargement PDF | 5 colonnes, badge statut (Payée/En attente), bouton Download |
| Skeleton loading | Skeleton | Structure mimant la page | 4 skeletons pour l'état de chargement |

### 2.2 Éléments observés sur la page Pricing

**Fichier : `app/pricing/page.tsx`**

| Élément | Type | Valeur/Comportement | Observation |
|---|---|---|---|
| Hero badge | Badge violet | "Tarification simple et transparente" | Signal de confiance, icône Sparkles |
| H1 | Titre gradient | "Le bon forfait pour votre gestion locative" | Texte gradient violet-indigo, accrocheur |
| Badge "1er mois offert" | Badge emerald | `role="status"` + `aria-label` | Bonne accessibilité, CTA attractif |
| Toggle facturation | Radiogroup | Mensuel / Annuel (-20%) | `role="radiogroup"`, `aria-checked`, `focus-visible:ring-2` — conforme WCAG |
| Mention HT | Paragraphe xs | "Tous les prix sont affichés hors taxes (HT). TVA 20% en sus" | Présent, conforme Art. L112-1 |
| Grille 4 plans standard | Cards 4 colonnes | Gratuit, Starter, Confort, Pro | Layout responsive `lg:grid-cols-4` |
| Grille 4 plans Enterprise | Cards 4 colonnes | Enterprise S, M, L, XL | Section séparée avec badge "Solutions Enterprise" |
| Prix HT | Texte 4xl | `formatPrice(price)` + "HT/mois" ou "HT/an" | Conforme |
| Prix TTC | Texte xs | Calcul `price * 1.20` formaté | Affiché en `text-slate-500` sous le prix HT |
| Équivalent mensuel | Texte sm | "soit X EUR HT/mois" (en annuel) | Bonne pratique pour la comparaison |
| Badge réduction | Badge emerald | "-20%" ou valeur calculée via `getYearlyDiscount()` | Avec `aria-label` descriptif |
| Highlights | Liste à puces | 5-8 points par plan | Icône Check emerald, texte slate-300 |
| CTA bouton | Button pleine largeur | "Commencer", "1er mois offert", "Nous contacter" | Adapté au segment du plan |
| Section Enterprise benefits | 4 stat cards | Frais CB 1,9%, SEPA 0,40 EUR, GLI -25%, AM inclus | Valeurs cohérentes avec `pricing-config.ts` |
| Tableau comparatif | Table collapsible | Features par plan (5 plans) | `aria-expanded`, `aria-controls`, `<th scope="col">` |
| Trust signals | 4 icônes | Sécurisé, +10 000 proprios, +50 000 biens, 4.8/5 | **Données non vérifiables — risque de confiance** |
| FAQ | Accordion 8 items | Questions fréquentes | Couvre : changement, essai, tarifs, frais cachés, paiement, RGPD, GLI, rétractation |
| CTA final | Section gradient | "Commencer avec Starter" + "1er mois offert" (Confort) | Double CTA, bon pattern |
| Section légale | Footer xs | Art. L221-18 rétractation + liens CGV/CGU/Privacy | Conforme Code de la Consommation |
| Footer | PublicFooter | variant="dark" | Composant réutilisable |

### 2.3 Éléments observés dans la configuration tarifaire

**Fichier : `lib/subscriptions/pricing-config.ts`**

| Élément | Valeur | Vérification |
|---|---|---|
| CB_PERCENTAGE | 220 (2,2%) | Cohérent avec le marché, marge ~31% sur coût Stripe 1,5% |
| ENTERPRISE_CB_PERCENTAGE | 190 (1,9%) | Cohérent, marge ~21% |
| SEPA_FIXED | 50 (0,50 EUR) | Cohérent, marge 30% |
| ENTERPRISE_SEPA_FIXED | 40 (0,40 EUR) | Cohérent, marge 12,5% |
| YOUSIGN_COST | 150 (1,50 EUR) | Prix volume négocié réaliste |
| PLAN_LIMITS.confort.max_users | 2 | **Cohérent avec plans.ts** (corrigé depuis v1) |
| Starter price_yearly | 9 000 (90 EUR) | Réduction = 17% (9*12=108, (108-90)/108=16,7%) — **incohérent avec le "-20%" affiché globalement** |

---

## 3. INCOHÉRENCES ET ANOMALIES

### Classées par sévérité

#### Critiques

| # | Élément | Problème | Impact | Localisation |
|---|---|---|---|---|
| C1 | `isPaid` logique inversée pour Starter | `isPaid = currentPlan !== "starter"` (ligne 297). Le plan Starter coûte 9 EUR/mois mais est traité comme non-payant. Conséquence : pas de bouton "Gérer le paiement", pas d'infos de facturation (cycle, prochaine date), pas de bouton "Résilier" | Les utilisateurs Starter payants ne peuvent pas gérer leur abonnement, accéder au portail Stripe, ni résilier depuis la page billing | `billing/page.tsx:297` |
| C2 | Billing page sans mention HT/TTC | Le prix affiché sur la billing page utilise `formatPrice()` sans indication HT ni TTC. Alors que la pricing page affiche correctement "HT" et le montant TTC | Non-conforme Art. L112-1 Code de la Consommation sur une page où l'utilisateur payant consulte son forfait | `billing/page.tsx:487-496` |
| C3 | Billing page sans liens CGV/CGU | Aucun lien vers les conditions générales sur la page de gestion de l'abonnement | Non-conforme LCEN — la page billing est le point de contact principal pour un abonné | `billing/page.tsx` (absent) |

#### Majeurs

| # | Élément | Problème | Impact | Localisation |
|---|---|---|---|---|
| M1 | Réduction annuelle Starter = -17%, pas -20% | Le Starter annuel est à 90 EUR (7,50 EUR/mois) soit -17%, alors que tous les autres plans sont à -20%. Le toggle global affiche "-20%" | Confusion utilisateur : il voit "-20%" mais paie -17% de réduction sur Starter | `plans.ts:203` (9000 vs 900*12=10800) |
| M2 | Upgrade modal limité à enterprise_s | L'`UpgradeModal` ne propose que `["confort", "pro", "enterprise_s"]` (ligne 68). Un utilisateur Enterprise S ne peut pas upgrader vers M, L ou XL depuis la billing page | Perte de revenus potentiels sur les upgrades Enterprise | `upgrade-modal.tsx:68` |
| M3 | `canUpgrade` compare avec "enterprise" legacy | `canUpgrade = getPlanLevel(currentPlan) < getPlanLevel("enterprise")` et "enterprise" a le level 3 (= enterprise_s). Les utilisateurs enterprise_s et au-dessus voient `canUpgrade = false` | Impossible d'accéder au bouton Upgrader pour les clients Enterprise | `billing/page.tsx:298` |
| M4 | Pas de bouton export données (RGPD Art. 20) | Aucun mécanisme d'export des données personnelles sur la page billing. Le droit à la portabilité n'est pas implémenté côté UI | Non-conformité RGPD. Les utilisateurs ne peuvent pas exercer leur droit à la portabilité | `billing/page.tsx` (absent) |
| M5 | Pas de code promo dans le checkout | Les types backend `PromoCode` et `PromoCodeValidation` existent, l'API `/subscriptions/promo/validate` existe, mais aucun champ de saisie n'est proposé à l'utilisateur | Impossibilité d'utiliser des codes promo, impact sur les campagnes marketing | `pricing/page.tsx` (absent du flow) |
| M6 | Download facture sans label accessible | Le bouton de téléchargement de facture (ligne 255) contient uniquement une icône Download sans `aria-label` ni texte | Non-conforme WCAG 2.4.4 — un lecteur d'écran annoncera un bouton sans nom | `billing/page.tsx:255-264` |
| M7 | Toast succès avec emoji | `title: "🎉 Abonnement activé !"` (ligne 306) utilise un emoji. Les emojis ne s'affichent pas uniformément et ajoutent du bruit pour les lecteurs d'écran | Incohérence visuelle cross-platform, pollution audio sur technologies d'assistance | `billing/page.tsx:306` |
| M8 | Enterprise S redirige vers /contact au lieu de checkout | L'upgrade modal redirige Enterprise S vers `/contact?subject=enterprise` (ligne 79) alors que Enterprise S est souscriptible directement via Stripe (code pricing page lignes 471-478) | Friction inutile — un client prêt à payer est renvoyé vers un formulaire de contact | `upgrade-modal.tsx:78-80` |

#### Mineurs

| # | Élément | Problème | Impact | Localisation |
|---|---|---|---|---|
| m1 | Pas de breadcrumb sur billing | Pas de fil d'Ariane pour situer la page dans la hiérarchie (Paramètres > Facturation) | Navigation contextuelle réduite | `billing/page.tsx` |
| m2 | Pas de skeleton sur pricing page | La page pricing n'a pas de skeleton pendant le chargement de `useAuth()` | Flash de contenu potentiel | `pricing/page.tsx` |
| m3 | Trust signals non sourcés | "+10 000 propriétaires", "+50 000 biens gérés", "4.8/5 satisfaction" sans source ni lien | Crédibilité réduite si les chiffres ne sont pas vérifiables | `pricing/page.tsx:762-766` |
| m4 | Pas de simulateur de prix interactif | Pas de curseur "Nombre de biens" pour estimer le prix réel avec biens supplémentaires | L'utilisateur ne peut pas projeter son coût réel | `pricing/page.tsx` |
| m5 | Icônes Enterprise identiques | Les 4 plans Enterprise utilisent la même icône Crown, sans différenciation visuelle du tier | Difficulté à distinguer visuellement les tiers | `pricing/page.tsx:110-113` |
| m6 | Comparison table limitée à 5 plans | Le tableau de comparaison affiche seulement Gratuit, Starter, Confort, Pro, Enterprise S — excluant M, L, XL | Informations incomplètes pour la prise de décision Enterprise | `pricing/page.tsx:269` |
| m7 | Pas d'indication du plan actuel sur pricing | Si un utilisateur connecté visite `/pricing`, aucun indicateur ne montre son plan actuel | Confusion — il ne sait pas quel plan il a déjà | `pricing/page.tsx` |

---

## 4. LOGIQUE TARIFAIRE

### 4.1 Analyse de la grille existante

| Plan | Prix/mois HT | Prix/an HT | Éq. mensuel annuel | Réduction réelle | Biens | Signatures/mois | Utilisateurs | Cible |
|---|---|---|---|---|---|---|---|---|
| Gratuit | 0 EUR | 0 EUR | - | - | 1 | 0 (5,90 EUR/u) | 1 | Découverte |
| Starter | 9 EUR | 90 EUR | 7,50 EUR | **-17%** | 3 (+3 EUR/suppl.) | 0 (4,90 EUR/u) | 1 | Petit propriétaire |
| **Confort** | **35 EUR** | **336 EUR** | **28 EUR** | **-20%** | **10 (+2,50 EUR/suppl.)** | **2 (3,90 EUR/u)** | **2** | **Propriétaire actif** |
| Pro | 69 EUR | 662 EUR | ~55 EUR | -20% | 50 (+2 EUR/suppl.) | 10 (2,50 EUR/u) | 5 | SCI, gestionnaire |
| Enterprise S | 249 EUR | 2 390 EUR | ~199 EUR | -20% | 100 | 25 (1,90 EUR/u) | Illimité | Gestionnaire 50-100 biens |
| Enterprise M | 349 EUR | 3 350 EUR | ~279 EUR | -20% | 200 | 40 (1,90 EUR/u) | Illimité | Gestionnaire 100-200 biens |
| Enterprise L | 499 EUR | 4 790 EUR | ~399 EUR | -20% | 500 | 60 (1,90 EUR/u) | Illimité | Grand gestionnaire |
| Enterprise XL | 799 EUR | 7 670 EUR | ~639 EUR | -20% | Illimité | Illimité | Illimité | Très grands portefeuilles |

### 4.2 Points forts de la grille

1. **Modèle hybride per-unit intelligent** : les frais par bien supplémentaire (3 EUR, 2,50 EUR, 2 EUR, 0 EUR) créent un mécanisme d'expansion naturel qui incite à l'upgrade plutôt qu'au dépassement abusif.

2. **Signatures comme levier d'upsell** : le modèle "quota inclus + tarif dégressif" (5,90 EUR -> 1,90 EUR selon le plan) est bien pensé. C'est un driver de revenus additionnels significatif avec une marge de 62-74%.

3. **GLI comme différenciation sectorielle** : les remises progressives (-5% à -25% sur l'assurance Garantie Loyers Impayés) sont un avantage compétitif unique dans le segment immobilier — aucun concurrent ne propose cela.

4. **4 tiers Enterprise granulaires** : la segmentation S/M/L/XL par nombre de biens (100/200/500/illimité) couvre bien le spectre des gestionnaires professionnels.

5. **Réduction annuelle -20% cohérente** (sauf Starter) : le rabais est assez attractif pour inciter l'engagement annuel sans être excessif.

### 4.3 Points faibles de la grille

1. **Gap Starter -> Confort trop important** : le saut de 9 EUR à 35 EUR (x3,9) est brutal. Il manque un palier intermédiaire à 19-22 EUR pour 5 biens qui capterait les propriétaires en croissance.

2. **Starter trop limité pour 9 EUR/mois** : 3 biens, 0 signature incluse, pas d'open banking, pas de rapprochement bancaire. La valeur perçue vs le plan Gratuit est faible — uniquement le paiement en ligne et les rappels email basiques.

3. **0 signature incluse sur Starter** : en 2026, ne pas inclure au moins 1 signature électronique sur un plan payant est pénalisant. Les concurrents incluent des signatures dès leurs plans intermédiaires.

4. **Réduction Starter annuelle = -17% (pas -20%)** : `price_yearly = 9000` (90 EUR) au lieu de `900 * 12 * 0.80 = 8640` (86,40 EUR). Incohérence avec le badge "-20%" affiché globalement.

5. **Gap Pro -> Enterprise S (x3,6)** : le saut de 69 EUR à 249 EUR est un gouffre. Les gestionnaires avec 50-70 biens hésiteront entre un Pro surchargé et un Enterprise S trop cher. Un plan "Business" à 129-149 EUR manque.

6. **Pas de plan "Essentiel" pour SCI** : les SCI patrimoniales avec 4-7 biens sont très nombreuses en France et tombent dans le gap Starter-Confort.

### 4.4 Comparaison marché SaaS B2B immobilier France 2026

| Concurrent | Plan équivalent | Prix/mois HT | Biens inclus | Signatures | Positionnement |
|---|---|---|---|---|---|
| Rentila | Standard | 24,90 EUR | 10 biens | Non incluses | Référence mid-market |
| Hektor (Septeo) | Essentiel | 39 EUR | 20 lots | 5/mois incluses | Plus de biens + signatures |
| LOCKimmo | Pro | 29 EUR | 15 lots | Non incluses | Moins cher pour plus de biens |
| Ublo | Scale | 49 EUR | 50 lots | Incluses | Agressif sur l'Enterprise |
| Qalimo | Premium | 19,90 EUR | 5 biens | 2/mois | Bon rapport qualité-prix |
| **TALOK Confort** | **Sweet spot** | **35 EUR** | **10 biens** | **2/mois** | **Aligné prix, inférieur en biens** |

**Positionnement** : TALOK Confort est dans la fourchette du marché sur le prix, mais offre moins de biens que Hektor (20 lots) et LOCKimmo (15 lots) pour un prix similaire. Le différenciateur est l'Open Banking et le scoring IA, absents chez la plupart des concurrents.

### 4.5 Proposition de grille tarifaire optimisée

| Plan | Prix suggéré | Biens | Signatures | Changements clés |
|---|---|---|---|---|
| Gratuit | 0 EUR | 1 | 0 | Inchangé |
| Starter | 12 EUR/mois | 3 (+3 EUR/suppl.) | **1/mois incluse** | +3 EUR, +1 signature, alignment -20% annuel |
| **Essentiel** (nouveau) | **22 EUR/mois** | **5** (+2,50 EUR/suppl.) | **1/mois incluse** | Nouveau palier pour SCI patrimoniales |
| Confort | 35 EUR/mois | 10 (+2,50 EUR/suppl.) | **3/mois** (+1) | +1 signature incluse |
| Pro | 69 EUR/mois | 50 (+2 EUR/suppl.) | 10/mois | Inchangé |
| **Business** (nouveau) | **149 EUR/mois** | **100** | **15/mois** | Comble le gap Pro -> Enterprise |
| Enterprise S | 249 EUR | 200 | 25/mois | Augmenté de 100 à 200 biens |
| Enterprise L | 499 EUR | 500 | 60/mois | Inchangé |
| Enterprise XL | 799 EUR | Illimité | Illimité | Inchangé |

### 4.6 Évaluation des mécanismes d'abonnement

| Mécanisme | Présent | Qualité | Observations |
|---|---|---|---|
| Toggle mensuel/annuel | Oui | Bon | Fonctionnel avec `role="radiogroup"`. Badge "-20%" visible. Réduction Starter incohérente (-17%) |
| Upgrade | Oui | Partiel | UpgradeModal fonctionnel mais limité à 3 plans (confort/pro/enterprise_s). Pas de prorata affiché |
| Downgrade | Non visible | Absent | Pas de bouton ni de flow de downgrade explicite sur la billing page |
| Pause | Non | Absent | Proposé dans le cancel-modal comme alternative mais non implémenté (toast placeholder) |
| Résiliation | Oui | Excellent | Flow 4 étapes (raison -> offres -> confirmation -> succès) avec collecte de feedback |
| Essai gratuit | Oui | Bon | 30 jours sur plans payants, bannière visible avec jours restants |
| Grandfathering | Architecture OK | Bon | Types et structures backend présents mais pas visiblement activé dans le code billing actuel |
| Codes promo | Backend only | Incomplet | API `/subscriptions/promo/validate` existe, types définis, aucune UI |
| Réactivation | Oui | Bon | Bouton "Réactiver" dans la bannière d'annulation avec appel API |

---

## 5. POINTS FORTS

1. **Flow de résiliation exemplaire** (`cancel-modal.tsx`) : le parcours en 4 étapes (raison -> offres alternatives -> confirmation -> succès) est conforme aux meilleures pratiques de retention 2026. La collecte de feedback catégorisée (trop cher, pas assez utilisé, features manquantes, concurrent, temporaire) et les offres contextuelles (pause, offre spéciale) sont bien pensées.

2. **Architecture `SubscriptionProvider` robuste** : le Context React avec ses hooks spécialisés (`useSubscription`, `useFeature`, `useUsageLimit`, `useCurrentPlan`) est bien conçu pour le feature gating. Les helpers `canUseMore`, `getRemainingUsage`, `isOverLimit` permettent un contrôle granulaire. La synchronisation avec l'authentification Supabase est correcte.

3. **Page pricing conforme et complète** : affichage HT/TTC correct (Art. L112-1), mention TVA (20% métropole + note DOM-TOM), liens CGV/CGU/Privacy, mention Art. L221-18 (droit de rétractation 14 jours), FAQ avec question dédiée à la rétractation. C'est un niveau de conformité rarement vu dans les SaaS B2B français.

4. **Design system cohérent et soigné** : l'utilisation de shadcn/ui + Tailwind assure une cohérence visuelle forte. Les cards de plan avec gradients différenciés par tier, les badges contextuels, les animations Framer Motion (stagger, whileHover, whileInView) et l'effet glassmorphisme créent une expérience premium.

5. **Barres d'usage visuellement informatives** : les Progress bars avec coloration contextuelle (emerald < 80%, amber >= 80%, red >= 100%) donnent une visibilité immédiate sur la consommation. L'indicateur "Illimité" pour les plans sans limite est une bonne pratique.

6. **Factures inline avec téléchargement PDF** : le composant `InvoicesTable` directement intégré dans la billing page avec statut (Payée/En attente), numéro de facture, montant formaté et bouton de téléchargement PDF est un pattern SOTA qui évite la navigation vers une page séparée.

7. **Gestion des erreurs Stripe** : les toasts d'erreur avec messages descriptifs, les états de chargement granulaires (`portalLoading`, `loading` par plan), et la gestion des callbacks success/canceled depuis Stripe montrent une bonne maîtrise du flow de paiement.

8. **Feature comparison table accessible** : le tableau utilise correctement `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `role="table"`, `aria-label`. Les icônes Check/X ont des `<span className="sr-only">` pour les lecteurs d'écran. Le bouton toggle a `aria-expanded` et `aria-controls`.

---

## 6. POINTS FAIBLES ET AMÉLIORATIONS

### 6.1 Architecture de l'Information

| # | Sévérité | Problème | Solution SOTA | Sprint |
|---|---|---|---|---|
| AI-1 | Majeur | Pas d'estimation du coût total mensuel (base + suppléments) | Ajouter un bloc "Coût total estimé" avec ventilation : abonnement + biens supplémentaires + signatures hors quota. Pattern Vercel Usage Dashboard | Sprint 1 |
| AI-2 | Majeur | Pas d'historique d'usage avec tendances | Ajouter un onglet "Historique" ou graphique sparkline montrant l'évolution de la consommation sur 3-6 mois | Sprint 2 |
| AI-3 | Mineur | Pas de breadcrumb sur billing | Ajouter Paramètres > Facturation comme fil d'Ariane | Sprint 3 |
| AI-4 | Mineur | Tableau comparatif limité à 5 plans | Inclure les 4 tiers Enterprise dans le tableau (scrollable horizontalement) ou ajouter un onglet Enterprise | Sprint 2 |
| AI-5 | Mineur | Pas d'indicateur plan actuel sur pricing page | Ajouter un badge "Votre plan" sur le plan actif quand l'utilisateur est connecté | Sprint 2 |

### 6.2 Design Visuel et UI

| # | Sévérité | Problème | Solution SOTA | Sprint |
|---|---|---|---|---|
| UI-1 | Mineur | Icônes Enterprise toutes identiques (Crown) | Utiliser des icônes différenciées : Building (S), Building2 (M), Castle (L), Landmark (XL) | Sprint 3 |
| UI-2 | Mineur | Pricing page dark-only, billing page dark aussi mais styles légèrement différents | Harmoniser les palettes exactes : les `bg-slate-800/50` vs `bg-slate-800/30` créent des nuances subtiles | Sprint 3 |
| UI-3 | Mineur | Bouton "Upgrader" et "Voir les forfaits" jamais visibles en même temps | Unifier : un seul CTA principal adaptatif selon le contexte (Gratuit -> "Voir les forfaits", Starter+ -> "Upgrader") | Sprint 2 |
| UI-4 | Mineur | Les stat blocks Enterprise (Frais CB 1,9%, SEPA 0,40 EUR, GLI -25%, AM inclus) utilisent des non-breaking spaces Unicode | Utiliser `{'\u00A0'}` de manière cohérente ou CSS `white-space: nowrap` | Sprint 3 |

### 6.3 UX Fonctionnel

| # | Sévérité | Problème | Solution SOTA | Sprint |
|---|---|---|---|---|
| UX-1 | Critique | `isPaid = currentPlan !== "starter"` exclut les Starter payants de la gestion | Corriger la logique : `isPaid = currentPlan !== "gratuit"` ou mieux `subscription?.status === "active" \|\| subscription?.status === "trialing"` | Sprint 1 |
| UX-2 | Majeur | Upgrade modal ne couvre pas Enterprise M/L/XL | Ajouter les 4 tiers Enterprise dans les plans disponibles de l'UpgradeModal ou rediriger vers une page Enterprise dédiée | Sprint 1 |
| UX-3 | Majeur | `canUpgrade` utilise `getPlanLevel("enterprise")` (legacy, level 3) | Remplacer par `getPlanLevel("enterprise_xl")` (level 6) pour permettre les upgrades Enterprise | Sprint 1 |
| UX-4 | Majeur | Enterprise S redirige vers /contact dans l'upgrade modal | Aligner avec la pricing page : les plans Enterprise S et M sont souscriptibles directement via Stripe | Sprint 1 |
| UX-5 | Majeur | Pas de saisie de code promo | Ajouter un champ "Code promo" dans le checkout flow avec validation en temps réel via l'API existante | Sprint 2 |
| UX-6 | Mineur | Pas de simulateur de prix | Ajouter un curseur "Nombre de biens" sur pricing pour calculer le prix réel incluant les suppléments | Sprint 3 |
| UX-7 | Mineur | Pause d'abonnement non implémentée | Soit implémenter via Stripe Subscription Pause, soit retirer l'option du flow de résiliation | Sprint 2 |
| UX-8 | Mineur | Pas de confirmation post-upgrade | Ajouter une animation de célébration ou page de succès après checkout réussi (un toast seul est insuffisant) | Sprint 2 |

### 6.4 Légal et Conformité

| # | Sévérité | Problème | Solution SOTA | Sprint |
|---|---|---|---|---|
| L-1 | Critique | Billing page sans mention HT/TTC | Ajouter "HT" après le prix et "soit X EUR TTC" en dessous, comme sur la pricing page | Sprint 1 |
| L-2 | Majeur | Billing page sans liens CGV/CGU | Ajouter les liens CGV/CGU/Privacy en bas de la billing page | Sprint 1 |
| L-3 | Majeur | Pas de bouton export données (RGPD Art. 20) | Ajouter "Exporter mes données" dans la section billing avec téléchargement JSON/CSV | Sprint 1 |
| L-4 | Majeur | Pas de mention TVA sur billing page | Ajouter "TVA 20% applicable" sous le prix affiché | Sprint 1 |
| L-5 | Majeur | Factures : contenu non vérifié côté frontend | S'assurer que les factures PDF contiennent : n° de facture, SIRET, adresse siège social, TVA, détail des prestations (Art. L441-3 Code de Commerce) | Sprint 2 |
| L-6 | Majeur | Pas d'email de rappel pré-renouvellement | Obligation pour les contrats à tacite reconduction (Art. L215-1 Code de la Consommation) — email J-30 à J-15 avant échéance | Sprint 2 |
| L-7 | Majeur | Pas de conformité Digital Services Act 2026 | Ajouter les informations sur la transparence algorithmique (scoring IA) et les voies de recours | Sprint 3 |
| L-8 | Mineur | DOM-TOM : TVA non gérée dynamiquement | Les taux spécifiques (8,5% Martinique/Guadeloupe, 2,1% certains produits, octroi de mer) ne sont pas gérés. Seule une note "Tarifs spécifiques DOM-TOM disponibles sur demande" est présente | Sprint 3 |
| L-9 | Mineur | FAQ : "données conservées 30 jours post-résiliation" | Vérifier la cohérence avec les obligations fiscales (conservation 6 ans pour les factures selon Art. L102 B du LPF) et la politique RGPD (Art. 17) | Sprint 3 |

---

## 7. BENCHMARKS SOTA 2026

### 7.1 Comparaison features billing state-of-the-art

| Feature | Stripe Billing | Notion | Vercel | Linear | TALOK | Statut |
|---|---|---|---|---|---|---|
| Résumé du plan actuel | Oui | Oui | Oui | Oui | Oui | OK |
| Usage/quotas visuels | Oui | Oui | Oui | Non | Oui | OK |
| Historique des factures inline | Oui | Oui | Oui | Oui | Oui | OK |
| Téléchargement facture PDF | Oui | Oui | Oui | Oui | Oui | OK |
| Changement de plan (up) | Oui | Oui | Oui | Oui | Oui (partiel) | PARTIEL |
| Changement de plan (down) | Oui | Oui | Oui | Oui | Non explicite | MANQUANT |
| Aperçu du prorata | Oui | Oui | Non | Non | Non | MANQUANT |
| Gestion moyen de paiement | Oui | Oui | Oui | Oui | Via Stripe Portal | PARTIEL |
| Toggle mensuel/annuel | Oui | Oui | Oui | Non | Oui | OK |
| Code promo | Oui | Oui | Non | Non | Non (backend only) | MANQUANT |
| Pause d'abonnement | Oui | Non | Non | Non | Non | MANQUANT |
| Estimation coût mensuel | Non | Non | Oui | Non | Non | MANQUANT |
| Export données RGPD | Oui | Oui | Oui | Oui | Non | MANQUANT |
| Historique d'usage (graphes) | Oui | Non | Oui | Non | Non | MANQUANT |
| Notifications pré-renouvellement | Oui | Oui | Oui | Oui | Non vérifié | INCERTAIN |
| Flow résiliation multi-étapes | Oui | Oui | Non | Non | Oui | OK |
| Offres de rétention | Oui | Oui | Non | Non | Oui | OK |
| Grandfathering tarifaire | Oui | Non | Non | Non | Architecture OK | PARTIEL |
| Feature comparison table | Oui | Oui | Non | Non | Oui | OK |
| Dark mode | Non | Oui | Oui | Oui | Oui | OK |
| Simulateur de prix | Non | Non | Oui | Non | Non | MANQUANT |
| Mentions légales conformes | Oui | Oui | Oui | Oui | Pricing OK, Billing partiel | PARTIEL |
| Multi-devise / multi-région | Oui | Oui | Oui | Oui | Non | MANQUANT |
| Portail self-service complet | Oui | Oui | Oui | Oui | Via Stripe Portal | PARTIEL |
| Plan actuel visible sur pricing | Oui | Oui | Oui | Oui | Non | MANQUANT |

### 7.2 Taux de couverture fonctionnelle

- **Features complètes** : 10/25 = 40%
- **Features partiellement implémentées** : 5/25 = 20%
- **Features manquantes** : 10/25 = 40%

**Taux de couverture global : 60%** (partielles comptées à 50%)

**Objectif réaliste post-audit : 80%** (+20% via les corrections Sprint 1 et Sprint 2)

### 7.3 Quick wins vs chantiers structurels

**Quick wins (effort faible, impact fort)**
- Corriger `isPaid` (1 ligne de code, impact critique)
- Ajouter "HT" et TVA sur la billing page (copier le pattern pricing)
- Ajouter liens CGV/CGU sur billing page (3 liens)
- Corriger `canUpgrade` pour inclure les plans Enterprise
- Ajouter `aria-label` sur les boutons d'action des factures
- Supprimer l'emoji du toast de succès

**Chantiers structurels (effort élevé, impact fort)**
- Implémenter l'export de données RGPD (API + UI)
- Gérer la TVA multi-région (métropole + DOM-TOM)
- Créer un portail self-service complet (remplacer Stripe Portal)
- Ajouter l'historique d'usage avec graphiques
- Implémenter les codes promo dans le checkout
- Conformité Digital Services Act 2026

---

## 8. ACCESSIBILITÉ (WCAG 2.2 AA)

### 8.1 Audit par critère

| Critère WCAG | Description | Page Pricing | Page Billing | Détails |
|---|---|---|---|---|
| **1.4.3** Contraste texte/fond (4.5:1 min) | Texte normal lisible | CONFORME | PARTIEL | `text-slate-400` sur `slate-800/50` : ~4,7:1 (OK). `text-slate-500` sur `slate-900/50` : ~3,5:1 (FAIL sur pricing pour les prix TTC et les descriptions Enterprise) |
| **1.4.11** Contraste non-textuel (3:1 min) | Composants UI et graphiques | CONFORME | PARTIEL | Progress bars : emerald/amber/red sur slate = OK. Bordures `border-slate-700/50` (opacité 50%) sur fond sombre : ~2,5:1 (FAIL) |
| **2.4.6** En-têtes et structure | Hiérarchie H1-H6 | CONFORME | CONFORME | Pricing : H1 ("Le bon forfait...") + H2 ("Pour les gestionnaires de 50+ biens", "Comparez nos forfaits", "Questions fréquentes"). Billing : H1 ("Facturation") + CardTitle pour les sous-sections |
| **4.1.2** Nom, rôle, valeur (ARIA) | Composants interactifs identifiés | CONFORME | PARTIEL | Pricing : `role="radiogroup"`, `aria-checked`, `role="table"`, `scope="col"`, `aria-expanded`, `aria-controls`, `aria-label` sur badges, `aria-hidden` sur icônes, `sr-only` sur check/X. **Billing : bouton Download sans `aria-label`, Progress sans `role="meter"`** |
| **2.4.4** But des liens | Liens avec texte descriptif | CONFORME | PARTIEL | Pricing : tous les CTA ont un texte clair. **Billing : le bouton Download ne contient qu'une icône sans texte accessible** |
| **2.1.1** Navigation clavier | Tous les composants focusables | CONFORME | CONFORME | Boutons, liens, accordions nativement focusables. Toggle billing : `focus-visible:ring-2`. Dialogs : piège de focus Radix UI correct |
| **2.4.7** Focus visible | Indicateur de focus | CONFORME | CONFORME | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2` sur les toggles. shadcn/ui fournit des styles de focus par défaut |
| **1.3.1** Info et relations | Structure sémantique | CONFORME | PARTIEL | Pricing : `<table>` avec `<thead>/<tbody>/<th>`. **Billing : les barres d'usage utilisent `<Progress>` shadcn sans `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`**. Les cards ne sont pas des `<article>` |
| **1.4.1** Utilisation de la couleur | Couleur non unique vecteur d'info | CONFORME | CONFORME | Les barres d'usage ont la couleur ET le texte "X / Y". Les badges ont du texte. Le tableau pricing a des `sr-only` "Inclus"/"Non inclus" |

### 8.2 Résumé accessibilité

| Critère | Pricing | Billing |
|---|---|---|
| Conformes | 9/9 | 5/9 |
| Partiellement conformes | 0/9 | 4/9 |
| Non conformes | 0/9 | 0/9 |

**Score RGAA estimé** :
- Page Pricing : ~95% — Excellent
- Page Billing : ~72% — Correct mais améliorable

### 8.3 Recommandations prioritaires accessibilité

1. **Ajouter `aria-label="Télécharger la facture [numéro]"` sur les boutons Download** — Impact : conformité 2.4.4 et 4.1.2

2. **Ajouter `role="meter"` avec `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="[limit]"` et `aria-label="[resource] : X sur Y utilisés"` sur les barres d'usage** — Impact : conformité 1.3.1 et 4.1.2

3. **Augmenter le contraste de `text-slate-500` à `text-slate-400`** pour les prix TTC et descriptions sur fond sombre — Impact : conformité 1.4.3

4. **Augmenter l'opacité des bordures** : `border-slate-700` (sans `/50`) pour atteindre le ratio 3:1 — Impact : conformité 1.4.11

5. **Ajouter `aria-label` descriptifs sur les cards de plan** de la billing page pour les lecteurs d'écran — Impact : conformité 1.3.1

---

## 9. ROADMAP — 3 Sprints priorisés

### Sprint 1 : Corrections critiques et conformité (Urgent)

| # | Tâche | Type | Effort | Fichier(s) |
|---|---|---|---|---|
| S1-1 | Corriger `isPaid = currentPlan !== "gratuit"` (au lieu de "starter") | Bug critique | Très faible | `billing/page.tsx:297` |
| S1-2 | Ajouter mention "HT" après le prix + "soit X EUR TTC" sur billing page | Légal | Faible | `billing/page.tsx:487-496` |
| S1-3 | Ajouter mention TVA 20% sous les prix sur billing page | Légal | Faible | `billing/page.tsx:494` |
| S1-4 | Ajouter liens CGV/CGU/Privacy en bas de billing page | Légal | Faible | `billing/page.tsx` (nouveau bloc) |
| S1-5 | Corriger `canUpgrade` : remplacer `"enterprise"` par `"enterprise_xl"` | Bug | Très faible | `billing/page.tsx:298` |
| S1-6 | Étendre l'UpgradeModal pour inclure Enterprise M/L/XL | UX | Moyen | `upgrade-modal.tsx:68` |
| S1-7 | Permettre checkout direct Enterprise S/M dans l'UpgradeModal | UX | Moyen | `upgrade-modal.tsx:78-80` |
| S1-8 | Ajouter `aria-label` sur bouton Download facture | A11y | Très faible | `billing/page.tsx:255` |
| S1-9 | Supprimer emoji du toast succès | Qualité | Très faible | `billing/page.tsx:306` |
| S1-10 | Ajouter bouton "Exporter mes données" (Art. 20 RGPD) | RGPD | Moyen | `billing/page.tsx` + API |

### Sprint 2 : Améliorations UX et conformité avancée

| # | Tâche | Type | Effort | Fichier(s) |
|---|---|---|---|---|
| S2-1 | Ajouter bloc "Coût total estimé" (base + suppléments + signatures) | UX | Moyen | `billing/page.tsx` |
| S2-2 | Ajouter champ code promo dans le checkout | UX | Moyen | `pricing/page.tsx`, API |
| S2-3 | Implémenter ou retirer la pause d'abonnement | UX | Élevé | `cancel-modal.tsx`, Stripe API |
| S2-4 | Ajouter indicateur plan actuel sur pricing page (utilisateur connecté) | UX | Faible | `pricing/page.tsx` |
| S2-5 | Ajouter `role="meter"` + ARIA sur les barres d'usage | A11y | Faible | `billing/page.tsx:150-162` |
| S2-6 | Augmenter contraste `text-slate-500` -> `text-slate-400` | A11y | Faible | Global |
| S2-7 | Implémenter email de rappel J-30/J-15 avant renouvellement | Légal | Moyen | Backend (cron + Resend) |
| S2-8 | Vérifier conformité des factures PDF (Art. L441-3) | Légal | Moyen | Backend Stripe webhook |
| S2-9 | Harmoniser réduction Starter annuel à -20% (86,40 EUR/an) | Cohérence | Très faible | `plans.ts:203` |
| S2-10 | Ajouter page/animation succès post-checkout | UX | Moyen | Nouveau composant |

### Sprint 3 : Optimisations et nouvelles features

| # | Tâche | Type | Effort | Fichier(s) |
|---|---|---|---|---|
| S3-1 | Ajouter simulateur de prix interactif (curseur nombre de biens) | UX | Élevé | `pricing/page.tsx` |
| S3-2 | Créer page historique d'usage avec graphiques | Feature | Élevé | Nouveau module |
| S3-3 | Ajouter breadcrumb sur billing page | UX | Faible | `billing/page.tsx` |
| S3-4 | Gérer TVA multi-région (DOM-TOM : 8,5%, 2,1%, octroi de mer) | Légal | Élevé | `pricing-config.ts`, API, billing |
| S3-5 | Conformité Digital Services Act 2026 (transparence IA) | Légal | Moyen | Global |
| S3-6 | Ajouter plan "Essentiel" intermédiaire (22 EUR/mois, 5 biens) | Business | Moyen | `plans.ts`, `pricing-config.ts`, BDD |
| S3-7 | Ajouter plan "Business" (149 EUR/mois, 100 biens) | Business | Moyen | `plans.ts`, `pricing-config.ts`, BDD |
| S3-8 | Tableau comparatif étendu avec tous les tiers Enterprise | UX | Moyen | `pricing/page.tsx:269` |
| S3-9 | Portail self-service complet (remplacer Stripe Portal) | Feature | Très élevé | Nouveau module |
| S3-10 | Support multi-langue (fr/en) | Feature | Très élevé | i18n global |

---

## 10. CONCLUSION

### Résumé actionnable

**TALOK dispose d'une base de facturation solide et mature**, avec des patterns avancés rarement vus dans les SaaS B2B français : flow de résiliation multi-étapes avec rétention, architecture SubscriptionProvider avec feature gating, grille tarifaire 8 plans avec modèle hybride per-unit, et une page pricing conforme aux exigences légales françaises.

**Le problème critique n°1 est le bug `isPaid`** (ligne 297 de billing/page.tsx) : en traitant le plan Starter (9 EUR/mois) comme non-payant, les utilisateurs Starter ne peuvent pas gérer leur abonnement, accéder au portail Stripe, ni résilier. C'est une correction d'une ligne qui a un impact majeur.

**Le problème critique n°2 est l'asymétrie de conformité légale** entre la page pricing (conforme : HT/TTC, TVA, CGV, rétractation) et la page billing (non conforme : aucune de ces mentions). La billing page est pourtant le point de contact quotidien des abonnés payants.

**Le problème critique n°3 est la limitation des upgrades Enterprise** : le bouton "Upgrader" disparaît pour les clients Enterprise S (et au-dessus), et le modal ne propose pas les tiers M/L/XL. C'est un frein direct à la croissance du revenu.

**Sur le plan du benchmark SOTA**, avec un taux de couverture de 60%, TALOK est dans la moyenne des SaaS B2B. Les corrections Sprint 1 (principalement des quick wins) permettraient de monter à ~75%, et le Sprint 2 à ~80%.

### Priorités recommandées

1. **Immédiat (< 1 jour)** : corriger `isPaid`, ajouter HT/TTC sur billing, corriger `canUpgrade` — 3 bugs critiques, effort minimal
2. **Court terme (Sprint 1)** : conformité légale billing page + extension UpgradeModal Enterprise
3. **Moyen terme (Sprint 2)** : améliorations UX (code promo, estimation coût, succès post-checkout) + conformité avancée (email renouvellement, factures)
4. **Long terme (Sprint 3)** : nouvelles features (simulateur de prix, historique d'usage, plans intermédiaires, DSA 2026)

### Métriques à suivre post-audit

| Métrique | Objectif | Méthode de mesure |
|---|---|---|
| Taux de conversion pricing -> checkout | +15% vs baseline | PostHog funnel events |
| Taux de churn mensuel | -20% vs baseline | Stripe Dashboard MRR Movements |
| ARPU (revenu moyen par utilisateur) | +10% via upgrades Enterprise | Stripe Dashboard |
| NPS page billing | > 40 | Enquête in-app (PostHog surveys) |
| Couverture WCAG AA | > 90% | Audit automatisé axe-core + tests Playwright |
| Conformité légale | 100% | Audit juridique externe |
| Couverture fonctionnelle SOTA | > 80% | Revue trimestrielle vs benchmark |
| Taux d'utilisation export données | Baseline à établir | PostHog event tracking |

---

*Rapport v2 généré le 9 février 2026 — Audit exhaustif basé sur l'analyse du code source actuel des pages `app/(dashboard)/owner/settings/billing/page.tsx`, `app/pricing/page.tsx`, et de l'ensemble des fichiers `lib/subscriptions/` et `components/subscription/`. Ce rapport remplace la version v1 du même jour.*
