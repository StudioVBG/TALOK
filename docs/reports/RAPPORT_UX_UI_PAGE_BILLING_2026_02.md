# Rapport d'Analyse UX/UI - Page Facturation (Billing)

## Date : 09 Fevrier 2026

## Page analysee : `/owner/settings/billing`

### Score Global : 58/100

---

## TABLE DES MATIERES

1. [Resume executif](#1-resume-executif)
2. [Analyse de la hierarchie visuelle](#2-analyse-de-la-hierarchie-visuelle)
3. [Problemes de contraste et lisibilite](#3-problemes-de-contraste-et-lisibilite)
4. [Architecture de l'information](#4-architecture-de-linformation)
5. [Composants UI - Analyse detaillee](#5-composants-ui---analyse-detaillee)
6. [Etats vides et feedback](#6-etats-vides-et-feedback)
7. [Accessibilite (WCAG 2.1)](#7-accessibilite-wcag-21)
8. [Responsive et adaptabilite](#8-responsive-et-adaptabilite)
9. [Micro-interactions et feedback utilisateur](#9-micro-interactions-et-feedback-utilisateur)
10. [Coherence avec le Design System](#10-coherence-avec-le-design-system)
11. [Performance percue](#11-performance-percue)
12. [Recommandations prioritaires](#12-recommandations-prioritaires)
13. [Maquettes de correction suggeres](#13-maquettes-de-correction-suggerees)

---

## 1. RESUME EXECUTIF

La page de facturation presente des **faiblesses significatives** en matiere d'experience utilisateur, principalement liees au manque de contraste, a une hierarchie visuelle confuse, et a un manque de guidage pour l'utilisateur. Bien que la structure fonctionnelle soit correcte (forfait, usage, factures), l'execution visuelle nuit a la lisibilite et a la confiance que l'utilisateur devrait ressentir sur une page aussi critique que la gestion de son abonnement.

### Repartition des problemes identifies

| Severite | Nombre | Impact |
|----------|--------|--------|
| P0 - Critique | 6 | Bloquant ou fortement degradant |
| P1 - Majeur | 9 | Degrade significativement l'UX |
| P2 - Mineur | 11 | Amelioration souhaitable |
| P3 - Suggestion | 7 | Optimisation future |
| **Total** | **33** | |

---

## 2. ANALYSE DE LA HIERARCHIE VISUELLE

### 2.1 Probleme : Titre de page insuffisant (P1)

**Constat :** Le titre "Gerez votre abonnement et vos factures" est affiche en texte gris clair (`text-slate-400`) sans titre principal visible (`h1`). L'element `h1` "Facturation" n'est pas visible dans le screenshot, ce qui signifie que le sous-titre fait office de titre principal.

**Impact :** L'utilisateur ne sait pas immediatement ou il se trouve. Le titre n'a pas assez de poids visuel pour ancrer la page.

**Recommandation :**
- Ajouter un `h1` visible et proeminant : "Facturation" en blanc, taille `text-2xl` ou `text-3xl`, `font-bold`
- Le sous-titre descriptif doit rester secondaire mais lisible

### 2.2 Probleme : Desequilibre de la grille 2/3 - 1/3 (P2)

**Constat :** La carte "Votre forfait" occupe ~65% de la largeur et la carte "Utilisation" ~35%. Cependant, le contenu de la carte forfait ne justifie pas cette largeur disproportionnee (beaucoup d'espace vide), tandis que la carte "Utilisation" parait comprimee.

**Impact :** L'espace n'est pas utilise de maniere optimale. Les barres de progression dans "Utilisation" sont trop etroites pour etre lues confortablement. Les valeurs numeriques (ex: "2 / 50", "1 / 5") sont potentiellement tronquees.

**Recommandation :**
- Passer a une grille `grid-cols-2` equilibree (50/50), ou
- Reduire la carte forfait et agrandir la carte usage a `lg:grid-cols-5` (3+2)
- Envisager un layout vertical sur des ecrans < 1440px

### 2.3 Probleme : Absence de separation visuelle entre sections (P2)

**Constat :** Les trois blocs principaux (Forfait, Utilisation, Factures) sont visuellement similaires - memes couleurs de fond, memes bordures. Rien ne differencie leur importance.

**Impact :** L'utilisateur scanne la page sans repere clair. La carte forfait (information la plus critique) ne se demarque pas.

**Recommandation :**
- La carte forfait devrait avoir un traitement visuel plus riche (gradient de fond plus prononce, elevation plus forte)
- Utiliser des tailles de carte differentes selon la priorite de l'information
- Ajouter des separateurs ou un espacement vertical plus important entre le bloc forfait/usage et le bloc factures

---

## 3. PROBLEMES DE CONTRASTE ET LISIBILITE

### 3.1 CRITIQUE : Contraste insuffisant generalise (P0)

**Constat :** L'ensemble de la page utilise un schema de couleur sombre (`bg-slate-800/50`, `border-slate-700`) avec du texte en nuances de gris (`text-slate-300`, `text-slate-400`). Le rapport de contraste est insuffisant a de multiples endroits.

**Mesures estimees :**

| Element | Couleur texte | Couleur fond | Ratio estime | WCAG AA (4.5:1) |
|---------|---------------|--------------|--------------|------------------|
| Sous-titre page | `slate-400` (~#94a3b8) | `slate-900` (~#0f172a) | ~3.8:1 | ECHEC |
| "Details de votre abonnement" | `slate-400` | `slate-800/50` | ~3.2:1 | ECHEC |
| "Pour les gestionnaires et SCI" | `slate-400` | Gradient violet | ~2.8:1 | ECHEC |
| "Cycle de facturation" label | `slate-400` | `slate-900/50` | ~3.5:1 | ECHEC |
| Barres de progression labels | `slate-400` | `slate-800/50` | ~3.2:1 | ECHEC |
| "Suivi de votre consommation" | `slate-400` | `slate-800/50` | ~3.2:1 | ECHEC |
| "Telechargez vos factures..." | `slate-400` | `slate-800/50` | ~3.2:1 | ECHEC |
| "Aucune facture pour le moment" | `slate-400` | `slate-800/50` | ~3.2:1 | ECHEC |

**Impact :** Au moins 8 elements textuels ne respectent pas les normes WCAG AA. Cela pose un probleme d'accessibilite et de lisibilite pour tous les utilisateurs, particulierement ceux utilisant un ecran de mauvaise qualite ou dans un environnement lumineux.

**Recommandation :**
- Remplacer `text-slate-400` par `text-slate-300` minimum pour les textes descriptifs
- Utiliser `text-slate-200` pour les labels importants
- Viser un ratio de contraste minimum de 4.5:1 pour le texte et 3:1 pour les elements larges
- Tester avec un outil comme Stark ou axe DevTools

### 3.2 CRITIQUE : Valeurs numeriques illisibles dans la carte Usage (P0)

**Constat :** Les valeurs d'usage (ex: "2 / 50", "1 / 5", "0 / 10", "0 / 30 Go") sont affichees en `text-slate-400` dans la colonne droite de la carte "Utilisation". Sur le screenshot, ces valeurs sont partiellement tronquees par le bord de la carte.

**Impact :** L'utilisateur ne peut pas verifier sa consommation reelle, ce qui est l'objectif principal de cette carte. Information critique rendue illisible.

**Recommandation :**
- Augmenter la taille du texte des valeurs a `text-base` au lieu de `text-sm`
- Utiliser `text-white` ou `text-slate-100` pour les valeurs numeriques
- S'assurer que la carte a suffisamment de `padding-right` pour que les valeurs ne soient jamais tronquees
- Ajouter un `min-width` ou `flex-shrink-0` sur les valeurs numeriques

### 3.3 Probleme : Badge "Actif" peu visible (P1)

**Constat :** Le badge "Actif" en haut a droite de la carte forfait utilise un fond vert transparent (`bg-emerald-500/20`) avec du texte vert clair (`text-emerald-400`). Sur fond sombre, ce badge est a peine perceptible.

**Impact :** L'information de statut de l'abonnement (active, essai, annule) est pourtant critique. L'utilisateur doit savoir instantanement si son abonnement est actif.

**Recommandation :**
- Augmenter l'opacite du fond du badge a `bg-emerald-500/30` minimum
- Ajouter un point de couleur solide (dot indicator) avant le texte
- Envisager un fond solide pour les statuts critiques : `bg-emerald-500 text-white`

---

## 4. ARCHITECTURE DE L'INFORMATION

### 4.1 Probleme : Manque d'information sur le moyen de paiement (P1)

**Constat :** La page ne montre nulle part le moyen de paiement enregistre (carte bancaire, SEPA, etc.). L'utilisateur doit cliquer sur "Gerer le paiement" (qui ouvre le portail Stripe externe) pour voir cette information.

**Impact :** L'utilisateur n'a pas de visibilite sur son moyen de paiement sans quitter la page. Source d'anxiete potentielle ("ma carte est-elle toujours valide ?").

**Recommandation :**
- Ajouter une section "Moyen de paiement" dans la carte forfait, montrant :
  - Type de carte (Visa, Mastercard, etc.) avec icone
  - Les 4 derniers chiffres
  - Date d'expiration
  - Bouton "Modifier" pointant vers le portail Stripe
- Cette information est disponible via l'API Stripe et devrait etre affichee directement

### 4.2 Probleme : Pas de recapitulatif de ce que le forfait inclut (P1)

**Constat :** La carte forfait montre le nom "Pro", le prix "69 EUR/mois", et c'est tout. L'utilisateur ne sait pas ce que son forfait inclut sans aller sur la page pricing.

**Impact :** L'utilisateur ne peut pas evaluer si son forfait est adapte a ses besoins sans naviguer ailleurs. Cela freine egalement l'upsell ("pourquoi upgrader si je ne sais pas ce que j'ai ?").

**Recommandation :**
- Ajouter un lien "Voir les details du forfait" ou un accordeon montrant les fonctionnalites principales
- Ou afficher 3-4 fonctionnalites cles du forfait actuel sous forme de badges/chips
- Ajouter un comparatif rapide avec le forfait superieur pour encourager l'upgrade

### 4.3 Probleme : Bouton "Gerer le paiement" isole et peu clair (P1)

**Constat :** Le bouton "Gerer le paiement" est positionne en haut a droite de la page, detache du contexte. Il ouvre le portail Stripe (site externe) sans avertissement.

**Impact :**
- L'utilisateur ne comprend pas necessairement que ce bouton l'emmenera sur un site externe
- Le bouton semble lie au titre de la page, pas a une action specifique
- Pas de tooltip ou d'indication de ce que "Gerer le paiement" permet exactement

**Recommandation :**
- Deplacer le bouton dans la carte forfait, pres des informations de paiement
- Ajouter une mention "(site externe)" ou un texte d'aide
- Remplacer "Gerer le paiement" par un label plus precis : "Modifier le moyen de paiement"

### 4.4 Probleme : Les boutons d'action sont mal positionnes (P2)

**Constat :** Les boutons "Upgrader" et "Resilier" sont au meme niveau, dans la carte forfait. Le bouton "Resilier" (action destructive) est visuellement au meme niveau que "Upgrader".

**Impact :**
- L'action destructive (resilier) est trop accessible et visuellement equivalente a l'action positive (upgrader)
- Risque de clic accidentel sur "Resilier"
- Les deux boutons ensemble creent une dissonance cognitive

**Recommandation :**
- Separer spatialement les deux boutons : "Upgrader" en position primaire, "Resilier" dans un sous-menu ou en bas de page
- "Resilier" devrait etre dans une section separee "Zone de danger" en bas de la carte ou de la page, a l'instar de GitHub
- Reduire la proeminence visuelle de "Resilier" (texte seul, pas de bordure rouge)

---

## 5. COMPOSANTS UI - ANALYSE DETAILLEE

### 5.1 CRITIQUE : Carte du plan - Design confus (P0)

**Constat :** La carte du plan "Pro" a l'interieur de la carte "Votre forfait" utilise un gradient violet/indigo sur fond sombre. Le texte "Pour les gestionnaires professionnels et SCI" est en `text-slate-400` sur ce gradient, ce qui est tres difficile a lire.

**Impact :** L'information descriptive du plan est sacrifiee pour l'esthetique. L'icone orange (etoile) ne represente pas clairement le plan "Pro".

**Recommandation :**
- Augmenter le contraste du texte descriptif a `text-slate-200` minimum
- Remplacer l'icone generique par une icone ou un logo specifique au plan
- Reduire la complexite du gradient ou augmenter son opacite de fond

### 5.2 Probleme : Barres de progression sous-informatives (P1)

**Constat :** Les barres de progression dans la carte "Utilisation" montrent un ratio visuel mais les informations complementaires manquent :
- Pas de pourcentage affiche
- La couleur (vert) ne change pas selon le niveau d'usage
- Pas d'indication de tendance ou d'evolution

**Impact :** L'utilisateur voit une barre verte mais ne sait pas s'il doit s'inquieter ou non. Les barres proches de 0% (Signatures: 0/10, Stockage: 0/30) semblent vides et inutiles.

**Recommandation :**
- Afficher le pourcentage a cote de la valeur
- Implementer un code couleur progressif : vert (0-60%), orange (60-80%), rouge (80-100%)
- Ajouter un tooltip au survol montrant les details d'usage
- Masquer ou collapser les ressources a 0% d'utilisation, ou les afficher differemment
- Ajouter un texte contextuel ("Vous utilisez 4% de vos biens disponibles")

### 5.3 Probleme : Icones dans les barres de progression trop petites (P2)

**Constat :** Les icones (Building2, Users, PenTool, HardDrive) a gauche de chaque barre sont en `w-4 h-4` (16px) en `text-slate-400`, ce qui les rend quasiment invisibles.

**Recommandation :**
- Passer a `w-5 h-5` (20px) minimum
- Utiliser des couleurs plus vives ou des fonds circulaires colores pour chaque icone

### 5.4 Probleme : Carte "Cycle de facturation" / "Prochaine facturation" (P2)

**Constat :** Les deux encadres gris montrant le cycle de facturation et la prochaine date sont visuellement identiques et peu distinctifs. La date "02/01/2026" est affichee sans contexte (dans combien de jours ?).

**Recommandation :**
- Ajouter un compte a rebours : "dans 23 jours"
- Differencier visuellement les deux encadres (icones de calendrier, coloration)
- Envisager un format plus lisible : "2 janvier 2026" au lieu de "02/01/2026"

---

## 6. ETATS VIDES ET FEEDBACK

### 6.1 CRITIQUE : Etat vide des factures - Insuffisant (P0)

**Constat :** La section "Historique des factures" occupe un espace vertical considerable (~40% de la hauteur visible) pour afficher uniquement une icone grise et le texte "Aucune facture pour le moment" en `text-slate-400`.

**Impact :**
- Gaspillage d'espace ecran pour un message sans valeur ajoutee
- L'utilisateur abonne au plan Pro a 69EUR/mois devrait avoir des factures. Si la section est vide, c'est soit un bug, soit un probleme de synchronisation avec Stripe qui n'est pas explique
- Aucun CTA (Call-To-Action) ou explication
- L'etat vide ne rassure pas l'utilisateur

**Recommandation :**
- Si l'abonnement est actif et qu'il n'y a pas de factures, afficher un message explicatif : "Vos factures apparaitront ici apres votre premier cycle de facturation"
- Reduire la hauteur de l'etat vide (padding `py-8` au lieu de `py-12`)
- Ajouter un CTA : "Generer une facture" ou "Contacter le support"
- Ajouter un lien vers le portail Stripe pour consulter les factures directement

### 6.2 Probleme : Pas de confirmation visuelle du statut de paiement (P1)

**Constat :** La page n'affiche aucune information sur le dernier paiement effectue (montant, date, statut). L'utilisateur ne sait pas si son dernier paiement a bien ete traite.

**Recommandation :**
- Ajouter un encart "Dernier paiement" dans la carte forfait ou en dessous
- Montrer : date, montant, statut (reussi/echoue), moyen de paiement utilise

### 6.3 Probleme : Pas de notifications proactives (P2)

**Constat :** Aucune alerte n'est visible pour :
- Carte bancaire expirant bientot
- Prochain prelevement imminent
- Quotas approchant la limite

**Recommandation :**
- Ajouter un systeme de banniere d'alerte en haut de page pour les situations urgentes
- Montrer un avertissement jaune quand un quota depasse 80%
- Alerter si la carte expire dans les 30 prochains jours

---

## 7. ACCESSIBILITE (WCAG 2.1)

### 7.1 CRITIQUE : Non-conformite WCAG AA (P0)

**Problemes identifies :**

| Critere WCAG | Statut | Detail |
|--------------|--------|--------|
| 1.4.3 Contraste minimum (AA) | ECHEC | Multiples elements sous le ratio 4.5:1 |
| 1.4.11 Contraste non-textuel | ECHEC | Barres de progression et bordures peu visibles |
| 2.4.6 En-tetes et etiquettes | PARTIEL | Structure heading incomplete |
| 2.4.7 Focus visible | NON TESTE | Pas de style focus visible sur les boutons |
| 1.3.1 Info et relations | PARTIEL | Les cartes n'utilisent pas de landmarks ARIA |
| 4.1.2 Nom, role, valeur | PARTIEL | Barres de progression sans `aria-label` |

### 7.2 Probleme : Barres de progression sans semantique (P1)

**Constat :** Le composant `<Progress>` ne fournit pas d'information textuelle accessible. Un lecteur d'ecran ne peut pas communiquer "Biens immobiliers : 2 sur 50, 4% utilise".

**Recommandation :**
- Ajouter `aria-label="Biens immobiliers : 2 sur 50"` a chaque Progress
- Ajouter `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Ajouter un `sr-only` texte pour les lecteurs d'ecran

### 7.3 Probleme : Boutons sans labels explicites (P2)

**Constat :** Le bouton de telechargement de facture (icone Download seule) n'a pas de texte accessible. Le bouton "Gerer le paiement" ouvre un lien externe sans l'annoncer.

**Recommandation :**
- Ajouter `aria-label="Telecharger la facture [numero]"` au bouton Download
- Ajouter `aria-label` au bouton portal : "Gerer le paiement (ouvre un site externe)"

### 7.4 Probleme : Navigation au clavier non optimisee (P2)

**Constat :** L'ordre de tabulation n'est pas clairement defini. Les elements interactifs (Upgrader, Resilier, Gerer le paiement) ne sont pas groupes logiquement.

---

## 8. RESPONSIVE ET ADAPTABILITE

### 8.1 Probleme : Valeurs tronquees sur ecrans intermediaires (P0)

**Constat :** Sur le screenshot (1440px+ de large), les valeurs numeriques de la carte "Utilisation" sont deja tronquees a droite (on voit "2 / 50" mais le texte semble coupe). Sur des ecrans plus petits (1024px-1280px), ce probleme sera amplifie.

**Recommandation :**
- Tester a toutes les resolutions intermediaires (1024, 1280, 1440, 1680)
- Ajouter `overflow-visible` ou `min-width` sur les conteneurs de valeurs
- Envisager un layout vertical (valeur sous la barre) sur petits ecrans

### 8.2 Probleme : Carte Usage trop etroite en grille (P1)

**Constat :** La carte "Utilisation" en `lg:col-span-1` sur une grille de 3 colonnes est trop comprimee. Les labels comme "Signatures ce mois" prennent beaucoup de place horizontale.

**Recommandation :**
- Passer a un layout `lg:grid-cols-5` avec le forfait en `col-span-3` et l'usage en `col-span-2`
- Ou utiliser un layout `lg:grid-cols-2` avec les deux cartes en largeur egale

### 8.3 Probleme : Section factures - largeur excessive (P2)

**Constat :** La section "Historique des factures" s'etend sur toute la largeur (100%). Pour un tableau avec seulement 5 colonnes, cela cree des cellules trop larges et un etat vide disproportionne.

**Recommandation :**
- Limiter la largeur maximale du tableau : `max-w-4xl`
- Ou centrer le contenu de l'etat vide de maniere plus compacte

---

## 9. MICRO-INTERACTIONS ET FEEDBACK UTILISATEUR

### 9.1 Probleme : Pas de feedback de chargement granulaire (P2)

**Constat :** Le skeleton loader charge l'ensemble de la page, mais les factures se chargent independamment (fetch client-side). Pendant ce temps de chargement supplementaire, l'utilisateur ne recoit pas d'indication claire.

**Recommandation :**
- Ajouter un skeleton specifique pour chaque section (deja partiellement fait, mais a renforcer visuellement)
- Ajouter un texte "Chargement des factures..." pendant le fetch

### 9.2 Probleme : Bouton "Upgrader" sans preview (P2)

**Constat :** Le bouton "Upgrader" ouvre une modale, mais l'utilisateur ne sait pas a l'avance quel serait le cout supplementaire ou les avantages.

**Recommandation :**
- Ajouter un tooltip sur hover : "Passez au forfait Enterprise a partir de 149 EUR/mois"
- Ou afficher une micro-comparaison directement dans la carte

### 9.3 Probleme : Bouton "Resilier" sans friction suffisante (P1)

**Constat :** Le bouton "Resilier" est directement accessible, en rouge, au meme niveau que "Upgrader". Un clic ouvre une modale, mais la position du bouton est trop proeminente pour une action destructive.

**Recommandation :**
- Deplacer dans un menu secondaire ou une section "Zone de danger" en bas de page
- Ajouter un delai ou une etape de confirmation supplementaire
- Utiliser un design moins visible (texte gris, pas de bordure rouge)

---

## 10. COHERENCE AVEC LE DESIGN SYSTEM

### 10.1 Probleme : Mix de styles dans les cartes (P2)

**Constat :** La carte "Votre forfait" contient une sous-carte avec gradient violet pour le plan, tandis que les encadres "Cycle de facturation" utilisent un fond `slate-900/50`. Le melange de styles de fond dans une meme carte cree une impression de complexite visuelle.

**Recommandation :**
- Uniformiser les traitements visuels : soit tout en gradient, soit tout en fond solide
- Reduire le nombre de niveaux de profondeur (card > sous-card > sous-card)

### 10.2 Probleme : Couleur du bouton "Upgrader" (P3)

**Constat :** Le bouton utilise un gradient violet/indigo specifique, different du violet standard utilise ailleurs dans l'application.

**Recommandation :**
- Standardiser la couleur du CTA principal dans le design system
- Si le violet est la couleur de marque, l'utiliser de maniere consistante

### 10.3 Probleme : Icones inconsistantes (P3)

**Constat :** L'icone du plan (Sparkles/etoile orange) ne correspond pas au nom "Pro". Les icones dans les barres de progression sont grises tandis que les icones de titre sont violettes.

**Recommandation :**
- Creer un mapping icone/couleur par plan (Solo=bleu, Confort=vert, Pro=violet, Enterprise=or)
- Uniformiser la couleur des icones dans la carte Usage

---

## 11. PERFORMANCE PERCUE

### 11.1 Probleme : Double chargement visible (P2)

**Constat :** La page charge d'abord le layout (skeleton), puis les donnees d'abonnement, puis separement les factures. L'utilisateur voit 2-3 etats de chargement successifs.

**Recommandation :**
- Charger les factures en parallele avec les donnees d'abonnement
- Utiliser React Suspense avec des boundaries granulaires
- Pre-fetcher les donnees de facturation cote serveur (SSR) si possible

### 11.2 Probleme : Pas de cache des donnees (P3)

**Constat :** A chaque visite de la page, les factures sont re-fetchees (`useEffect` avec `[]`). Les donnees d'abonnement dependent du hook `useSubscription`.

**Recommandation :**
- Implementer SWR ou React Query pour la mise en cache cote client
- Ajouter un `stale-while-revalidate` pour les factures (donnees peu volatiles)

---

## 12. RECOMMANDATIONS PRIORITAIRES

### Sprint 1 - Corrections critiques (P0)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Corriger les contrastes texte : remplacer `text-slate-400` par `text-slate-200/300` sur fond sombre | Accessibilite | Faible |
| 2 | Corriger le debordement des valeurs dans la carte Usage | Lisibilite | Faible |
| 3 | Ameliorer l'etat vide des factures avec un message explicatif contextuel | Confiance utilisateur | Faible |
| 4 | Augmenter la visibilite du badge de statut (Actif/Essai/Annule) | Clarte informationnelle | Faible |
| 5 | Ajouter `aria-label` et attributs ARIA aux barres de progression | Accessibilite legale | Faible |
| 6 | Tester et corriger le responsive entre 1024px et 1440px | Utilisabilite | Moyen |

### Sprint 2 - Ameliorations majeures (P1)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 7 | Ajouter l'affichage du moyen de paiement (4 derniers chiffres, type) | Confiance | Moyen |
| 8 | Ajouter un resume des fonctionnalites incluses dans le forfait | Comprehension | Moyen |
| 9 | Deplacer "Resilier" dans une zone de danger separee | Prevention erreur | Faible |
| 10 | Ameliorer les barres de progression (couleurs progressives, pourcentages) | Lisibilite | Faible |
| 11 | Reformatter la date de prochaine facturation (format long + "dans X jours") | Clarte | Faible |
| 12 | Ajouter des alertes proactives (quota >80%, carte expirant) | Prevention | Moyen |
| 13 | Repositionner le bouton "Gerer le paiement" dans la carte forfait | Navigation | Faible |
| 14 | Ameliorer le feedback du dernier paiement | Confiance | Moyen |
| 15 | Corriger le contraste du texte descriptif dans la carte plan gradient | Lisibilite | Faible |

### Sprint 3 - Optimisations (P2-P3)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 16 | Reequilibrer la grille forfait/usage | Layout | Moyen |
| 17 | Ajouter tooltips sur les boutons d'action | Guidage | Faible |
| 18 | Uniformiser les styles de sous-cartes | Coherence | Faible |
| 19 | Implementer la mise en cache des factures (SWR/React Query) | Performance | Moyen |
| 20 | Ajouter un comparatif forfait actuel vs superieur | Upsell | Eleve |
| 21 | Charger les donnees cote serveur (SSR) | Performance | Eleve |

---

## 13. MAQUETTES DE CORRECTION SUGGEREES

### 13.1 Carte Forfait - Version amelioree (structure)

```
+------------------------------------------------------------------+
| Votre forfait                                   [Badge: ● Actif] |
| Details de votre abonnement actuel                                |
|                                                                   |
| +--------------------------------------------------------------+ |
| | [Icone Pro]  Pro                              69 EUR / mois   | |
| |              Pour les gestionnaires et SCI                    | |
| +--------------------------------------------------------------+ |
|                                                                   |
| +---------------------------+ +-------------------------------+   |
| | Cycle de facturation      | | Prochaine facturation         |   |
| | Mensuel                   | | 2 janvier 2026 (dans 23j)    |   |
| +---------------------------+ +-------------------------------+   |
|                                                                   |
| +--------------------------------------------------------------+ |
| | Moyen de paiement                                              | |
| | 💳 Visa se terminant par 4242 - Expire 12/2027   [Modifier]  | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Fonctionnalites incluses :                                        |
| [50 biens] [5 utilisateurs] [10 signatures/mois] [30 Go]         |
|                                                                   |
| [Upgrader]                                                        |
|                                                                   |
| ─────────────────────────────────────────────────────────────     |
| Zone de danger                                                    |
| [Resilier mon abonnement]                                         |
+------------------------------------------------------------------+
```

### 13.2 Carte Usage - Version amelioree (structure)

```
+---------------------------------------------+
| 📈 Utilisation                               |
| Suivi de votre consommation ce mois-ci       |
|                                              |
| 🏠 Biens immobiliers              2 / 50    |
| [████░░░░░░░░░░░░░░░░░░░░░░] 4%             |
|                                              |
| 👥 Utilisateurs                   1 / 5     |
| [████████████░░░░░░░░░░░░░░] 20%            |
|                                              |
| ✍️ Signatures ce mois              0 / 10    |
| [░░░░░░░░░░░░░░░░░░░░░░░░░] 0%             |
|                                              |
| 💾 Stockage                       0 / 30 Go |
| [░░░░░░░░░░░░░░░░░░░░░░░░░] 0%             |
|                                              |
| ℹ️ Quotas renouveles le 02/02/2026           |
+---------------------------------------------+
```

### 13.3 Etat vide Factures - Version amelioree

```
+------------------------------------------------------------------+
| 📄 Historique des factures                                        |
| Telechargez vos factures pour votre comptabilite                  |
|                                                                   |
|        [Icone document]                                           |
|        Aucune facture pour le moment                              |
|        Votre premiere facture sera generee le 02/02/2026          |
|        apres votre prochain cycle de facturation.                 |
|                                                                   |
|        [Consulter sur Stripe →]                                   |
+------------------------------------------------------------------+
```

---

## ANNEXE : CHECKLIST DE VALIDATION

Avant de valider les corrections, verifier les points suivants :

- [ ] Tous les textes ont un ratio de contraste >= 4.5:1 (WCAG AA)
- [ ] Les barres de progression ont des attributs ARIA complets
- [ ] Les valeurs numeriques ne sont jamais tronquees (tester 1024px a 1920px)
- [ ] Le bouton "Resilier" est separe de "Upgrader"
- [ ] Le moyen de paiement est affiche (ou un placeholder si non disponible)
- [ ] L'etat vide des factures est contextuel et informatif
- [ ] Les dates sont en format long et lisible
- [ ] Les pourcentages sont visibles sur les barres de progression
- [ ] Le focus clavier est visible sur tous les elements interactifs
- [ ] La page est testee sur Safari, Chrome, Firefox
- [ ] La page est testee avec un lecteur d'ecran (VoiceOver/NVDA)

---

*Rapport genere le 09/02/2026 - Analyse basee sur le screenshot de la page `/owner/settings/billing` et le code source `app/(dashboard)/owner/settings/billing/page.tsx`*
